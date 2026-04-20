import httpx
import pytest
import respx
from fastapi import HTTPException

from pixivdl.auth import CookieStore
from pixivdl.pixiv import PixivClient
from pixivdl.schemas import PixivImagePage, PixivWork


@pytest.mark.asyncio
@respx.mock
async def test_fetch_work_parses_pages() -> None:
    pid = "123"
    respx.get(f"https://www.pixiv.net/ajax/illust/{pid}").mock(
        return_value=httpx.Response(
            200,
            json={
                "error": False,
                "body": {
                    "title": "Title",
                    "userId": "42",
                    "userName": "Artist",
                },
            },
        )
    )
    respx.get(f"https://www.pixiv.net/ajax/illust/{pid}/pages").mock(
        return_value=httpx.Response(
            200,
            json={
                "error": False,
                "body": [
                    {
                        "urls": {
                            "original": "https://i.pximg.net/img-original/img/2024/01/01/0.jpg",
                            "regular": "https://i.pximg.net/img-master/img/2024/01/01/0.jpg",
                        }
                    },
                    {
                        "urls": {
                            "original": "https://i.pximg.net/img-original/img/2024/01/01/1.png",
                        }
                    },
                ],
            },
        )
    )
    store = CookieStore("PHPSESSID=abc")
    work = await PixivClient(store).fetch_work(pid)
    assert work.title == "Title"
    assert work.author_name == "Artist"
    assert work.page_count == 2
    assert work.pages[1].extension == "png"


@pytest.mark.asyncio
async def test_fetch_work_requires_cookie() -> None:
    with pytest.raises(HTTPException) as exc:
        await PixivClient(CookieStore()).fetch_work("123")
    assert exc.value.status_code == 401


def make_work(url: str = "https://i.pximg.net/img-original/img/2024/01/01/0.jpg") -> PixivWork:
    return PixivWork(
        pid="123",
        title="Title",
        author_id="42",
        author_name="Artist",
        page_count=1,
        cover_url="/api/works/123/image/0",
        pages=[
            PixivImagePage(
                page=0,
                original_url=url,
                extension="jpg",
                preview_url="/api/works/123/image/0",
            )
        ],
    )


@pytest.mark.asyncio
async def test_fetch_image_rejects_unexpected_host() -> None:
    with pytest.raises(HTTPException) as exc:
        await PixivClient(CookieStore("PHPSESSID=abc")).fetch_image_bytes(
            make_work("https://example.com/0.jpg"),
            0,
        )
    assert exc.value.status_code == 502


@pytest.mark.asyncio
@respx.mock
async def test_fetch_image_omits_cookie_and_requires_image_content() -> None:
    route = respx.get("https://i.pximg.net/img-original/img/2024/01/01/0.jpg").mock(
        return_value=httpx.Response(200, headers={"content-type": "image/jpeg"}, content=b"image")
    )
    data, content_type = await PixivClient(CookieStore("PHPSESSID=abc")).fetch_image_bytes(make_work(), 0)
    assert data == b"image"
    assert content_type == "image/jpeg"
    assert "Cookie" not in route.calls[0].request.headers


@pytest.mark.asyncio
@respx.mock
async def test_fetch_image_rejects_non_image_content() -> None:
    respx.get("https://i.pximg.net/img-original/img/2024/01/01/0.jpg").mock(
        return_value=httpx.Response(200, headers={"content-type": "text/html"}, text="<html></html>")
    )
    with pytest.raises(HTTPException) as exc:
        await PixivClient(CookieStore("PHPSESSID=abc")).fetch_image_bytes(make_work(), 0)
    assert exc.value.status_code == 502
