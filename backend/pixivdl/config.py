from __future__ import annotations

import os
from pathlib import Path


APP_NAME = "pixivdl"
SERVICE_NAME = "PixivDL"
COOKIE_USER = "pixiv-cookie"


def get_data_dir() -> Path:
    override = os.environ.get("PIXIVDL_DATA_DIR")
    if override:
        return Path(override).expanduser().resolve()
    return (Path(__file__).resolve().parents[2] / ".pixivdl-data").resolve()


def get_db_path() -> Path:
    return get_data_dir() / "pixivdl.db"


def get_cache_dir() -> Path:
    return get_data_dir() / "cache"


def get_secret_dir() -> Path:
    return get_data_dir() / "secrets"


def get_fallback_cookie_path() -> Path:
    return get_secret_dir() / "pixiv-cookie.dat"


def get_fallback_cookie_key_path() -> Path:
    return get_secret_dir() / "pixiv-cookie.key"


def default_download_path() -> str:
    return str((Path.home() / "Downloads" / "PixivDL").resolve())
