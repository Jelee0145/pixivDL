from __future__ import annotations

import asyncio
import io
import mimetypes
import zipfile
from pathlib import Path
from urllib.parse import quote

from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles

from .auth import CookieStore
from .cache import DiskCache
from .config import get_cache_dir
from .database import Database
from .downloads import DownloadManager
from .pixiv import PixivClient
from .schemas import (
    CookieRequest,
    DownloadJob,
    DownloadRequest,
    Favorite,
    PathCheckRequest,
    PixivWork,
    ProxyCheckRequest,
    Settings,
    SettingsUpdate,
    StatusResponse,
)
from .security import ensure_safe_download_dir, sanitize_filename, validate_pid, validate_proxy_url


app = FastAPI(title="PixivDL", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

db = Database()
cookie_store = CookieStore()
download_manager = DownloadManager()
disk_cache = DiskCache()
work_cache: dict[str, PixivWork] = {}


@app.middleware("http")
async def enforce_local_browser_origin(request: Request, call_next):
    host = _host_without_port(request.headers.get("host", ""))
    if host not in {"127.0.0.1", "localhost", "::1"}:
        return Response(status_code=403, content="PixivDL only accepts localhost requests.")
    origin = request.headers.get("origin")
    if origin:
        allowed_origins = {
            "http://127.0.0.1:8000",
            "http://127.0.0.1:5173",
            "http://localhost:8000",
            "http://localhost:5173",
        }
        if origin not in allowed_origins:
            return Response(status_code=403, content="Origin is not allowed.")
    return await call_next(request)


def _host_without_port(host_header: str) -> str:
    host_header = host_header.strip().lower()
    if host_header.startswith("["):
        end = host_header.find("]")
        return host_header[1:end] if end != -1 else host_header
    return host_header.split(":", 1)[0]


def get_settings_model() -> Settings:
    values = db.get_settings()
    return Settings(
        download_path=values["download_path"],
        proxy_url=values.get("proxy_url", ""),
        concurrency=int(values.get("concurrency", "2")),
        delay_ms=int(values.get("delay_ms", "800")),
        cookie_saved=cookie_store.saved(),
        cookie_present=cookie_store.present(),
    )


def get_pixiv_client() -> PixivClient:
    settings = get_settings_model()
    return PixivClient(
        cookie_store=cookie_store,
        proxy_url=settings.proxy_url,
        delay_ms=settings.delay_ms,
    )


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/settings", response_model=Settings)
async def get_settings() -> Settings:
    return get_settings_model()


@app.put("/api/settings", response_model=Settings)
async def update_settings(payload: SettingsUpdate) -> Settings:
    updates: dict[str, str | int] = {}
    if payload.download_path is not None:
        ensure_safe_download_dir(payload.download_path)
        updates["download_path"] = payload.download_path
    if payload.proxy_url is not None:
        updates["proxy_url"] = validate_proxy_url(payload.proxy_url)
    if payload.concurrency is not None:
        updates["concurrency"] = payload.concurrency
    if payload.delay_ms is not None:
        updates["delay_ms"] = payload.delay_ms
    if updates:
        db.update_settings(updates)
    return get_settings_model()


@app.post("/api/settings/test-path", response_model=StatusResponse)
async def test_path(payload: PathCheckRequest) -> StatusResponse:
    resolved = ensure_safe_download_dir(payload.path, create=False)
    return StatusResponse(ok=True, message=f"Path is writable: {resolved}")


@app.post("/api/settings/test-proxy", response_model=StatusResponse)
async def test_proxy(payload: ProxyCheckRequest) -> StatusResponse:
    settings = get_settings_model()
    proxy_url = validate_proxy_url(payload.proxy_url if payload.proxy_url is not None else settings.proxy_url)
    client = PixivClient(cookie_store=cookie_store, proxy_url=proxy_url, delay_ms=settings.delay_ms)
    await client.test_proxy()
    return StatusResponse(ok=True, message="Pixiv is reachable with this proxy setting.")


@app.post("/api/auth/cookie", response_model=StatusResponse)
async def set_cookie(payload: CookieRequest) -> StatusResponse:
    if not payload.cookie.strip() or "=" not in payload.cookie:
        raise HTTPException(status_code=400, detail="Cookie must include at least one key=value pair.")
    ok, message = cookie_store.set(payload.cookie, payload.save)
    return StatusResponse(ok=ok, message=message)


@app.delete("/api/auth/cookie", response_model=StatusResponse)
async def clear_cookie() -> StatusResponse:
    cookie_store.clear()
    return StatusResponse(ok=True, message="Cookie cleared.")


@app.get("/api/works/{pid}", response_model=PixivWork)
async def get_work(pid: str, client: PixivClient = Depends(get_pixiv_client)) -> PixivWork:
    return await fetch_cached_work(validate_pid(pid), client)


@app.get("/api/works/{pid}/image/{page}")
async def proxy_image(
    pid: str,
    page: int,
    size: str = Query(default="regular", pattern="^(thumb|regular|original)$"),
    client: PixivClient = Depends(get_pixiv_client),
) -> Response:
    work = await fetch_cached_work(validate_pid(pid), client)
    data, content_type = await get_cached_image_bytes(work, page, size, client)
    return Response(content=data, media_type=content_type)


@app.post("/api/downloads", response_model=DownloadJob)
async def create_download(
    payload: DownloadRequest,
    background_tasks: BackgroundTasks,
    client: PixivClient = Depends(get_pixiv_client),
) -> DownloadJob:
    pid = validate_pid(payload.pid)
    pages = _validate_download_pages(payload.pages)
    settings = get_settings_model()
    target_dir = payload.target_dir or settings.download_path
    ensure_safe_download_dir(target_dir)
    work = await fetch_cached_work(pid, client)
    available_pages = {page.page for page in work.pages}
    if any(page not in available_pages for page in pages):
        raise HTTPException(status_code=400, detail="One or more selected pages do not exist.")
    job = download_manager.create_job(pid, pages, payload.mode)
    background_tasks.add_task(
        download_manager.run,
        job,
        client,
        work,
        pages,
        target_dir,
        settings.concurrency,
        settings.delay_ms,
    )
    return job


@app.post("/api/downloads/browser")
async def browser_download(
    payload: DownloadRequest,
    client: PixivClient = Depends(get_pixiv_client),
) -> Response:
    pid = validate_pid(payload.pid)
    pages = _validate_download_pages(payload.pages)
    work = await fetch_cached_work(pid, client)
    available_pages = {page.page for page in work.pages}
    if any(page not in available_pages for page in pages):
        raise HTTPException(status_code=400, detail="One or more selected pages do not exist.")

    if payload.mode == "files" and len(pages) == 1:
        page = pages[0]
        data, content_type = await get_cached_image_bytes(work, page, "original", client)
        image = next(item for item in work.pages if item.page == page)
        filename = sanitize_filename(f"{work.pid}_p{page}", fallback=f"{work.pid}_p{page}") + f".{image.extension}"
        return Response(
            content=data,
            media_type=content_type,
            headers={"Content-Disposition": _content_disposition(filename)},
        )

    archive = io.BytesIO()
    zip_name = sanitize_filename(f"{work.pid}_{work.title}", fallback=work.pid) + ".zip"
    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as zip_file:
        for page in pages:
            data, _content_type = await get_cached_image_bytes(work, page, "original", client)
            image = next(item for item in work.pages if item.page == page)
            zip_file.writestr(f"{work.pid}_p{page}.{image.extension}", data)
    archive.seek(0)
    return StreamingResponse(
        archive,
        media_type="application/zip",
        headers={"Content-Disposition": _content_disposition(zip_name)},
    )


@app.get("/api/downloads/{job_id}", response_model=DownloadJob)
async def get_download(job_id: str) -> DownloadJob:
    return download_manager.get(job_id)


@app.get("/api/favorites", response_model=list[Favorite])
async def list_favorites() -> list[Favorite]:
    return [Favorite(**item) for item in db.list_favorites()]


@app.post("/api/favorites/{pid}", response_model=Favorite)
async def add_favorite(pid: str, client: PixivClient = Depends(get_pixiv_client)) -> Favorite:
    pid = validate_pid(pid)
    existing = db.get_favorite(pid)
    if existing is not None:
        return Favorite(**existing)
    work = await fetch_cached_work(pid, client)
    cover_cache_path = await _cache_cover(client, work)
    cover_url = f"/api/favorites/{work.pid}/cover" if cover_cache_path else work.cover_url
    favorite = {
        "pid": work.pid,
        "title": work.title,
        "author_id": work.author_id,
        "author_name": work.author_name,
        "page_count": work.page_count,
        "cover_url": cover_url,
        "cover_cache_path": cover_cache_path,
        "metadata": work.model_dump(),
    }
    db.upsert_favorite(favorite)
    stored = db.get_favorite(pid)
    if stored is None:
        raise HTTPException(status_code=500, detail="Favorite was not stored.")
    return Favorite(**stored)


@app.delete("/api/favorites/{pid}", response_model=StatusResponse)
async def delete_favorite(pid: str) -> StatusResponse:
    validate_pid(pid)
    deleted = db.delete_favorite(pid)
    return StatusResponse(ok=deleted, message="Favorite removed." if deleted else "Favorite was not found.")


@app.get("/api/favorites/{pid}/cover")
async def get_favorite_cover(pid: str) -> FileResponse:
    favorite = db.get_favorite(validate_pid(pid))
    if not favorite or not favorite.get("cover_cache_path"):
        raise HTTPException(status_code=404, detail="Favorite cover was not found.")
    cache_dir = get_cache_dir().resolve()
    cover_path = Path(favorite["cover_cache_path"]).resolve()
    try:
        cover_path.relative_to(cache_dir)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Favorite cover path is invalid.") from exc
    if not cover_path.exists():
        raise HTTPException(status_code=404, detail="Favorite cover file was not found.")
    return FileResponse(cover_path)


async def _cache_cover(client: PixivClient, work: PixivWork) -> str | None:
    try:
        cached = disk_cache.get_image(work, 0, "regular")
        if cached:
            return str(cached)
        data, _content_type = await client.fetch_image_bytes(work, 0, "regular")
        target = await asyncio.to_thread(disk_cache.put_image, work, 0, "regular", data)
        return str(target)
    except Exception:
        return None


async def fetch_cached_work(pid: str, client: PixivClient) -> PixivWork:
    work = work_cache.get(pid)
    if work is not None:
        return work
    work = await asyncio.to_thread(disk_cache.get_work, pid)
    if work is not None:
        work_cache[pid] = work
        return work
    work = await client.fetch_work(pid)
    await asyncio.to_thread(disk_cache.put_work, work)
    work_cache[pid] = work
    return work


async def get_cached_image_bytes(
    work: PixivWork,
    page: int,
    size: str,
    client: PixivClient,
) -> tuple[bytes, str]:
    cached_image = disk_cache.get_image(work, page, size)
    if cached_image:
        content_type = mimetypes.guess_type(cached_image.name)[0] or "image/jpeg"
        return await asyncio.to_thread(cached_image.read_bytes), content_type
    data, content_type = await client.fetch_image_bytes(work, page, size)
    await asyncio.to_thread(disk_cache.put_image, work, page, size, data)
    return data, content_type


def _validate_download_pages(pages: list[int]) -> list[int]:
    if not pages:
        raise HTTPException(status_code=400, detail="Select at least one page to download.")
    if len(set(pages)) != len(pages) or min(pages) < 0:
        raise HTTPException(status_code=400, detail="Download pages must be unique non-negative indexes.")
    return sorted(pages)


def _content_disposition(filename: str) -> str:
    ascii_fallback = filename.encode("ascii", "ignore").decode("ascii") or "pixivdl-download"
    return f"attachment; filename=\"{ascii_fallback}\"; filename*=UTF-8''{quote(filename)}"


frontend_dist = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
