from pathlib import Path

from pixivdl.cache import DiskCache
from pixivdl.schemas import PixivImagePage, PixivWork


def make_work() -> PixivWork:
    return PixivWork(
        pid="123",
        title="Title",
        author_id="1",
        author_name="Artist",
        page_count=1,
        cover_url="/api/works/123/image/0",
        pages=[
            PixivImagePage(
                page=0,
                original_url="https://i.pximg.net/img-original/img/2024/01/01/0.jpg",
                extension="jpg",
                preview_url="/api/works/123/image/0",
            )
        ],
    )


def test_disk_cache_round_trips_work_and_image(tmp_path: Path) -> None:
    cache = DiskCache(tmp_path / "cache")
    work = make_work()

    cache.put_work(work)
    assert cache.get_work("123") == work

    image_path = cache.put_image(work, 0, "regular", b"image")
    assert image_path.read_bytes() == b"image"
    assert cache.get_image(work, 0, "regular") == image_path

