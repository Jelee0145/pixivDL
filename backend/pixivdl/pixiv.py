from __future__ import annotations

import asyncio
import mimetypes
from pathlib import Path
from urllib.parse import urlparse

import httpx
from fastapi import HTTPException

from .auth import CookieStore
from .schemas import PixivImagePage, PixivWork


USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)
ALLOWED_IMAGE_HOSTS = {"i.pximg.net"}


class PixivClient:
    def __init__(self, cookie_store: CookieStore, proxy_url: str = "", delay_ms: int = 800) -> None:
        self.cookie_store = cookie_store
        self.proxy_url = proxy_url
        self.delay_ms = delay_ms

    async def fetch_work(self, pid: str) -> PixivWork:
        cookie = self._require_cookie()
        async with self._client(self._metadata_headers(pid, cookie)) as client:
            metadata_resp, pages_resp = await asyncio.gather(
                client.get(f"https://www.pixiv.net/ajax/illust/{pid}"),
                client.get(f"https://www.pixiv.net/ajax/illust/{pid}/pages"),
            )
        metadata = self._json_or_raise(metadata_resp, "Pixiv metadata request failed.")
        pages_data = self._json_or_raise(pages_resp, "Pixiv pages request failed.")

        body = metadata.get("body")
        page_body = pages_data.get("body")
        if metadata.get("error") or pages_data.get("error") or not isinstance(body, dict):
            raise HTTPException(status_code=502, detail="Pixiv returned an error for this PID.")
        if not isinstance(page_body, list):
            raise HTTPException(status_code=502, detail="Pixiv pages response was incomplete.")

        title = str(body.get("title") or f"pixiv_{pid}")
        author_id = str(body.get("userId") or "")
        author_name = str(body.get("userName") or "Unknown")
        pages: list[PixivImagePage] = []
        for index, page in enumerate(page_body):
            urls = page.get("urls") if isinstance(page, dict) else None
            if not isinstance(urls, dict):
                continue
            original = urls.get("original")
            if not original:
                continue
            pages.append(
                PixivImagePage(
                    page=index,
                    original_url=original,
                    regular_url=urls.get("regular"),
                    thumb_url=urls.get("thumb_mini") or urls.get("small"),
                    extension=_extension_from_url(original),
                    preview_url=f"/api/works/{pid}/image/{index}?size=regular",
                )
            )

        if not pages:
            raise HTTPException(status_code=502, detail="No downloadable image pages were found.")

        cover = pages[0].preview_url
        return PixivWork(
            pid=pid,
            title=title,
            author_id=author_id,
            author_name=author_name,
            page_count=len(pages),
            cover_url=cover,
            pages=pages,
        )

    async def fetch_image_bytes(self, work: PixivWork, page: int, size: str = "original") -> tuple[bytes, str]:
        image_page = next((item for item in work.pages if item.page == page), None)
        if image_page is None:
            raise HTTPException(status_code=404, detail="Image page was not found.")
        url = image_page.original_url
        if size == "regular" and image_page.regular_url:
            url = image_page.regular_url
        if size == "thumb" and image_page.thumb_url:
            url = image_page.thumb_url
        _validate_pixiv_image_url(url)

        self._require_cookie()
        async with self._client(self._image_headers(work.pid)) as client:
            response = await client.get(url)
        self._raise_for_status(response, "Pixiv image request failed.")
        content_type = response.headers.get("content-type") or mimetypes.guess_type(url)[0] or "image/jpeg"
        if not content_type.lower().startswith("image/"):
            raise HTTPException(status_code=502, detail="Pixiv returned non-image content.")
        return response.content, content_type

    async def test_proxy(self) -> None:
        async with self._client({"User-Agent": USER_AGENT}) as client:
            response = await client.get("https://www.pixiv.net/", follow_redirects=False)
        if response.status_code >= 500:
            raise HTTPException(status_code=502, detail="Pixiv did not respond successfully.")

    def _metadata_headers(self, pid: str, cookie: str) -> dict[str, str]:
        return {
            "User-Agent": USER_AGENT,
            "Referer": f"https://www.pixiv.net/artworks/{pid}",
            "Cookie": cookie,
            "Accept": "application/json",
        }

    def _image_headers(self, pid: str) -> dict[str, str]:
        return {
            "User-Agent": USER_AGENT,
            "Referer": f"https://www.pixiv.net/artworks/{pid}",
            "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        }

    def _client(self, headers: dict[str, str]) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            headers=headers,
            proxy=self.proxy_url or None,
            timeout=httpx.Timeout(30.0, connect=15.0),
        )

    def _require_cookie(self) -> str:
        cookie = self.cookie_store.get()
        if not cookie:
            raise HTTPException(status_code=401, detail="Pixiv Cookie is not configured.")
        return cookie

    def _json_or_raise(self, response: httpx.Response, fallback: str) -> dict:
        self._raise_for_status(response, fallback)
        try:
            data = response.json()
        except ValueError as exc:
            raise HTTPException(status_code=502, detail="Pixiv returned invalid JSON.") from exc
        if not isinstance(data, dict):
            raise HTTPException(status_code=502, detail="Pixiv returned an unexpected response.")
        return data

    @staticmethod
    def _raise_for_status(response: httpx.Response, fallback: str) -> None:
        if response.status_code in {401, 403}:
            raise HTTPException(status_code=401, detail="Pixiv Cookie is invalid or access is denied.")
        if response.status_code == 404:
            raise HTTPException(status_code=404, detail="Pixiv work was not found.")
        if response.status_code == 429:
            raise HTTPException(status_code=429, detail="Pixiv rate limited the request. Try again later.")
        if response.status_code >= 400:
            raise HTTPException(status_code=502, detail=fallback)


def _extension_from_url(url: str) -> str:
    suffix = Path(urlparse(url).path).suffix.lower().lstrip(".")
    return suffix or "jpg"


def _validate_pixiv_image_url(url: str) -> None:
    parsed = urlparse(url)
    hostname = parsed.hostname or ""
    if parsed.scheme != "https" or hostname not in ALLOWED_IMAGE_HOSTS:
        raise HTTPException(status_code=502, detail="Pixiv returned an unexpected image host.")
