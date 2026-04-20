import zipfile
from pathlib import Path

import pytest

from pixivdl.downloads import DownloadManager
from pixivdl.schemas import PixivImagePage, PixivWork


class FakeClient:
    async def fetch_image_bytes(self, work: PixivWork, page: int, size: str = "original") -> tuple[bytes, str]:
        return f"page-{page}".encode(), "image/jpeg"


class FailingClient:
    async def fetch_image_bytes(self, work: PixivWork, page: int, size: str = "original") -> tuple[bytes, str]:
        raise RuntimeError("failed")


def make_work() -> PixivWork:
    return PixivWork(
        pid="123",
        title="Bad:/Title",
        author_id="1",
        author_name="Artist",
        page_count=2,
        cover_url="/api/works/123/image/0",
        pages=[
            PixivImagePage(
                page=0,
                original_url="https://example.com/0.jpg",
                extension="jpg",
                preview_url="/api/works/123/image/0",
            ),
            PixivImagePage(
                page=1,
                original_url="https://example.com/1.png",
                extension="png",
                preview_url="/api/works/123/image/1",
            ),
        ],
    )


@pytest.mark.asyncio
async def test_download_files(tmp_path: Path) -> None:
    manager = DownloadManager()
    job = manager.create_job("123", [0, 1], "files")
    await manager.run(job, FakeClient(), make_work(), [0, 1], str(tmp_path), 2, 0)
    assert job.status == "done"
    assert job.completed == 2
    assert (tmp_path / "123_Bad__Title" / "123_p0.jpg").read_bytes() == b"page-0"


@pytest.mark.asyncio
async def test_download_zip(tmp_path: Path) -> None:
    manager = DownloadManager()
    job = manager.create_job("123", [0, 1], "zip")
    await manager.run(job, FakeClient(), make_work(), [0, 1], str(tmp_path), 2, 0)
    assert job.status == "done"
    zip_path = tmp_path / "123_Bad__Title.zip"
    assert zip_path.exists()
    with zipfile.ZipFile(zip_path) as archive:
        assert archive.read("123_p1.png") == b"page-1"


@pytest.mark.asyncio
async def test_download_zip_does_not_create_empty_archive_when_all_pages_fail(tmp_path: Path) -> None:
    manager = DownloadManager()
    job = manager.create_job("123", [0, 1], "zip")
    await manager.run(job, FailingClient(), make_work(), [0, 1], str(tmp_path), 2, 0)
    assert job.status == "failed"
    assert job.files == []
    assert not list(tmp_path.glob("*.zip"))
