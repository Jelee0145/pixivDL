from __future__ import annotations

import json
import sqlite3
from collections.abc import Iterable
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from .config import default_download_path, get_db_path


DEFAULT_SETTINGS = {
    "download_path": default_download_path(),
    "proxy_url": "",
    "concurrency": "2",
    "delay_ms": "800",
}


class Database:
    def __init__(self, path: Path | None = None) -> None:
        self.path = path or get_db_path()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.init()

    @contextmanager
    def connect(self) -> Iterable[sqlite3.Connection]:
        conn = sqlite3.connect(self.path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    def init(self) -> None:
        with self.connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS favorites (
                    pid TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    author_id TEXT NOT NULL,
                    author_name TEXT NOT NULL,
                    page_count INTEGER NOT NULL,
                    cover_url TEXT NOT NULL,
                    cover_cache_path TEXT,
                    metadata_json TEXT NOT NULL,
                    added_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            for key, value in DEFAULT_SETTINGS.items():
                conn.execute(
                    "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
                    (key, value),
                )

    def get_settings(self) -> dict[str, str]:
        with self.connect() as conn:
            rows = conn.execute("SELECT key, value FROM settings").fetchall()
        values = dict(DEFAULT_SETTINGS)
        values.update({row["key"]: row["value"] for row in rows})
        return values

    def update_settings(self, updates: dict[str, Any]) -> None:
        with self.connect() as conn:
            for key, value in updates.items():
                conn.execute(
                    "INSERT INTO settings (key, value) VALUES (?, ?) "
                    "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                    (key, str(value)),
                )

    def upsert_favorite(self, favorite: dict[str, Any]) -> None:
        now = datetime.now(UTC).isoformat()
        with self.connect() as conn:
            existing = conn.execute(
                "SELECT added_at FROM favorites WHERE pid = ?", (favorite["pid"],)
            ).fetchone()
            added_at = existing["added_at"] if existing else now
            conn.execute(
                """
                INSERT INTO favorites (
                    pid, title, author_id, author_name, page_count, cover_url,
                    cover_cache_path, metadata_json, added_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(pid) DO UPDATE SET
                    title = excluded.title,
                    author_id = excluded.author_id,
                    author_name = excluded.author_name,
                    page_count = excluded.page_count,
                    cover_url = excluded.cover_url,
                    cover_cache_path = excluded.cover_cache_path,
                    metadata_json = excluded.metadata_json,
                    updated_at = excluded.updated_at
                """,
                (
                    favorite["pid"],
                    favorite["title"],
                    favorite["author_id"],
                    favorite["author_name"],
                    favorite["page_count"],
                    favorite["cover_url"],
                    favorite.get("cover_cache_path"),
                    json.dumps(favorite["metadata"], ensure_ascii=False),
                    added_at,
                    now,
                ),
            )

    def list_favorites(self) -> list[dict[str, Any]]:
        with self.connect() as conn:
            rows = conn.execute(
                "SELECT * FROM favorites ORDER BY updated_at DESC"
            ).fetchall()
        return [self._favorite_row(row) for row in rows]

    def get_favorite(self, pid: str) -> dict[str, Any] | None:
        with self.connect() as conn:
            row = conn.execute("SELECT * FROM favorites WHERE pid = ?", (pid,)).fetchone()
        return self._favorite_row(row) if row else None

    def delete_favorite(self, pid: str) -> bool:
        with self.connect() as conn:
            cursor = conn.execute("DELETE FROM favorites WHERE pid = ?", (pid,))
            return cursor.rowcount > 0

    @staticmethod
    def _favorite_row(row: sqlite3.Row) -> dict[str, Any]:
        return {
            "pid": row["pid"],
            "title": row["title"],
            "author_id": row["author_id"],
            "author_name": row["author_name"],
            "page_count": row["page_count"],
            "cover_url": row["cover_url"],
            "cover_cache_path": row["cover_cache_path"],
            "metadata": json.loads(row["metadata_json"]),
            "added_at": row["added_at"],
            "updated_at": row["updated_at"],
        }

