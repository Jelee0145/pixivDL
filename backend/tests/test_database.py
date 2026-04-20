from pathlib import Path

from pixivdl.database import Database


def test_favorite_upsert_does_not_store_cookie(tmp_path: Path) -> None:
    db = Database(tmp_path / "app.db")
    db.upsert_favorite(
        {
            "pid": "123",
            "title": "Title",
            "author_id": "1",
            "author_name": "Artist",
            "page_count": 3,
            "cover_url": "/api/works/123/image/0",
            "cover_cache_path": None,
            "metadata": {"pid": "123", "page_count": 3},
        }
    )
    favorite = db.get_favorite("123")
    assert favorite is not None
    assert favorite["page_count"] == 3
    assert "cookie" not in str((tmp_path / "app.db").read_bytes()).lower()


def test_repeated_favorite_upsert_keeps_single_record(tmp_path: Path) -> None:
    db = Database(tmp_path / "app.db")
    payload = {
        "pid": "123",
        "title": "Title",
        "author_id": "1",
        "author_name": "Artist",
        "page_count": 3,
        "cover_url": "/api/works/123/image/0",
        "cover_cache_path": None,
        "metadata": {"pid": "123", "page_count": 3},
    }
    db.upsert_favorite(payload)
    db.upsert_favorite({**payload, "title": "Updated"})
    favorites = db.list_favorites()
    assert len(favorites) == 1
    assert favorites[0]["title"] == "Updated"
