from __future__ import annotations

import asyncio
import uuid
import zipfile
from pathlib import Path

from fastapi import HTTPException

from .pixiv import PixivClient
from .schemas import DownloadJob, PixivWork
from .security import ensure_child_path, ensure_safe_download_dir, sanitize_filename


class DownloadManager:
    def __init__(self) -> None:
        self.jobs: dict[str, DownloadJob] = {}

    def create_job(self, pid: str, pages: list[int], mode: str) -> DownloadJob:
        job = DownloadJob(
            id=uuid.uuid4().hex,
            pid=pid,
            mode=mode,  # type: ignore[arg-type]
            status="queued",
            total=len(pages),
            completed=0,
            failed_pages=[],
            files=[],
        )
        self.jobs[job.id] = job
        return job

    def get(self, job_id: str) -> DownloadJob:
        job = self.jobs.get(job_id)
        if job is None:
            raise HTTPException(status_code=404, detail="Download job was not found.")
        return job

    async def run(
        self,
        job: DownloadJob,
        client: PixivClient,
        work: PixivWork,
        pages: list[int],
        target_dir: str,
        concurrency: int,
        delay_ms: int,
    ) -> None:
        job.status = "running"
        try:
            base_dir = ensure_safe_download_dir(target_dir)
            if job.mode == "zip":
                await self._download_zip(job, client, work, pages, base_dir, concurrency, delay_ms)
            else:
                await self._download_files(job, client, work, pages, base_dir, concurrency, delay_ms)
            if job.failed_pages:
                job.status = "failed"
                job.error = job.error or "Some pages failed to download."
            else:
                job.status = "done"
        except Exception as exc:
            job.status = "failed"
            job.error = str(exc)

    async def _download_files(
        self,
        job: DownloadJob,
        client: PixivClient,
        work: PixivWork,
        pages: list[int],
        base_dir: Path,
        concurrency: int,
        delay_ms: int,
    ) -> None:
        folder_name = sanitize_filename(f"{work.pid}_{work.title}", fallback=work.pid)
        work_dir = ensure_child_path(base_dir, base_dir / folder_name)
        work_dir.mkdir(parents=True, exist_ok=True)
        semaphore = asyncio.Semaphore(concurrency)

        async def one(page: int) -> None:
            async with semaphore:
                await self._download_one_file(job, client, work, page, work_dir)
                if delay_ms:
                    await asyncio.sleep(delay_ms / 1000)

        await asyncio.gather(*(one(page) for page in pages))

    async def _download_zip(
        self,
        job: DownloadJob,
        client: PixivClient,
        work: PixivWork,
        pages: list[int],
        base_dir: Path,
        concurrency: int,
        delay_ms: int,
    ) -> None:
        filename = sanitize_filename(f"{work.pid}_{work.title}", fallback=work.pid) + ".zip"
        zip_path = ensure_child_path(base_dir, base_dir / filename)
        semaphore = asyncio.Semaphore(concurrency)
        results: list[tuple[int, bytes, str]] = []

        async def one(page: int) -> None:
            async with semaphore:
                try:
                    data, _content_type = await client.fetch_image_bytes(work, page, "original")
                    image = next(item for item in work.pages if item.page == page)
                    results.append((page, data, image.extension))
                    job.completed += 1
                except Exception:
                    job.failed_pages.append(page)
                if delay_ms:
                    await asyncio.sleep(delay_ms / 1000)

        await asyncio.gather(*(one(page) for page in pages))
        if not results:
            job.error = "All selected pages failed to download; ZIP was not created."
            return
        with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for page, data, extension in sorted(results, key=lambda item: item[0]):
                archive.writestr(f"{work.pid}_p{page}.{extension}", data)
        job.files.append(str(zip_path))

    async def _download_one_file(
        self,
        job: DownloadJob,
        client: PixivClient,
        work: PixivWork,
        page: int,
        work_dir: Path,
    ) -> None:
        try:
            data, _content_type = await client.fetch_image_bytes(work, page, "original")
            image = next(item for item in work.pages if item.page == page)
            target = ensure_child_path(work_dir, work_dir / f"{work.pid}_p{page}.{image.extension}")
            target.write_bytes(data)
            job.completed += 1
            job.files.append(str(target))
        except Exception:
            job.failed_pages.append(page)
