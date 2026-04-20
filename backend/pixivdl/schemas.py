from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class Settings(BaseModel):
    download_path: str
    proxy_url: str = ""
    concurrency: int = Field(default=2, ge=1, le=6)
    delay_ms: int = Field(default=800, ge=0, le=10000)
    cookie_saved: bool = False
    cookie_present: bool = False


class SettingsUpdate(BaseModel):
    download_path: str | None = None
    proxy_url: str | None = None
    concurrency: int | None = Field(default=None, ge=1, le=6)
    delay_ms: int | None = Field(default=None, ge=0, le=10000)


class PathCheckRequest(BaseModel):
    path: str


class ProxyCheckRequest(BaseModel):
    proxy_url: str | None = None


class StatusResponse(BaseModel):
    ok: bool
    message: str


class CookieRequest(BaseModel):
    cookie: str
    save: bool = False


class PixivImagePage(BaseModel):
    page: int
    original_url: str
    regular_url: str | None = None
    thumb_url: str | None = None
    extension: str
    preview_url: str


class PixivWork(BaseModel):
    pid: str
    title: str
    author_id: str
    author_name: str
    page_count: int
    cover_url: str
    pages: list[PixivImagePage]


class DownloadRequest(BaseModel):
    pid: str
    pages: list[int]
    mode: Literal["files", "zip"] = "files"
    target_dir: str | None = None


class DownloadJob(BaseModel):
    id: str
    pid: str
    mode: Literal["files", "zip"]
    status: Literal["queued", "running", "done", "failed"]
    total: int
    completed: int
    failed_pages: list[int]
    files: list[str]
    error: str | None = None


class Favorite(BaseModel):
    pid: str
    title: str
    author_id: str
    author_name: str
    page_count: int
    cover_url: str
    cover_cache_path: str | None = None
    added_at: str
    updated_at: str
    metadata: dict[str, Any]

