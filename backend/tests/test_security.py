from pathlib import Path

import pytest
from fastapi import HTTPException

from pixivdl.security import (
    ensure_child_path,
    ensure_safe_download_dir,
    sanitize_filename,
    validate_pid,
    validate_proxy_url,
)


def test_validate_pid_accepts_digits() -> None:
    assert validate_pid("123456") == "123456"


def test_validate_pid_rejects_non_digits() -> None:
    with pytest.raises(HTTPException) as exc:
        validate_pid("../123")
    assert exc.value.status_code == 400


def test_validate_proxy_url() -> None:
    assert validate_proxy_url("http://127.0.0.1:7890") == "http://127.0.0.1:7890"
    assert validate_proxy_url("socks5://127.0.0.1:1080") == "socks5://127.0.0.1:1080"
    with pytest.raises(HTTPException):
        validate_proxy_url("file:///tmp/socket")
    with pytest.raises(HTTPException):
        validate_proxy_url("http://127.0.0.1:99999")
    with pytest.raises(HTTPException):
        validate_proxy_url(" http://127.0.0.1:7890")
    with pytest.raises(HTTPException):
        validate_proxy_url("http://127.0.0.1:7890/path")


def test_sanitize_filename_removes_unsafe_chars() -> None:
    assert sanitize_filename('a<b>:"/\\|?* title') == "a_b________ title"
    assert sanitize_filename(" ... ", fallback="x") == "x"


def test_safe_download_dir_and_child(tmp_path: Path) -> None:
    target = ensure_safe_download_dir(str(tmp_path / "downloads"))
    child = ensure_child_path(target, target / "work" / "image.jpg")
    assert child.parent.name == "work"
    with pytest.raises(HTTPException):
        ensure_child_path(target, tmp_path.parent / "escape.jpg")
