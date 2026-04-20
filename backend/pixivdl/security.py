from __future__ import annotations

import os
import re
from pathlib import Path
from urllib.parse import urlparse

from fastapi import HTTPException


INVALID_FILENAME_CHARS = re.compile(r'[<>:"/\\|?*\x00-\x1f]')
PID_RE = re.compile(r"^\d+$")
ALLOWED_PROXY_SCHEMES = {"http", "https", "socks5", "socks5h"}
CONTROL_CHARS = re.compile(r"[\x00-\x1f\x7f]")


def validate_pid(pid: str) -> str:
    if not PID_RE.fullmatch(pid):
        raise HTTPException(status_code=400, detail="PID must contain digits only.")
    return pid


def sanitize_filename(value: str, fallback: str = "untitled", max_len: int = 120) -> str:
    cleaned = INVALID_FILENAME_CHARS.sub("_", value).strip(" .")
    cleaned = re.sub(r"\s+", " ", cleaned)
    if not cleaned:
        cleaned = fallback
    return cleaned[:max_len].rstrip(" .") or fallback


def validate_proxy_url(proxy_url: str | None) -> str:
    if not proxy_url:
        return ""
    if proxy_url != proxy_url.strip() or CONTROL_CHARS.search(proxy_url):
        raise HTTPException(status_code=400, detail="Proxy URL contains invalid whitespace.")
    parsed = urlparse(proxy_url)
    if parsed.scheme not in ALLOWED_PROXY_SCHEMES or not parsed.hostname:
        raise HTTPException(
            status_code=400,
            detail="Proxy must use http, https, socks5, or socks5h and include a host.",
        )
    try:
        _port = parsed.port
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Proxy port is invalid.") from exc
    if parsed.path not in {"", "/"} or parsed.query or parsed.fragment:
        raise HTTPException(status_code=400, detail="Proxy URL must not include path, query, or fragment.")
    return proxy_url


def ensure_safe_download_dir(path_value: str, create: bool = True) -> Path:
    if not path_value or not path_value.strip():
        raise HTTPException(status_code=400, detail="Download path cannot be empty.")

    path = Path(path_value).expanduser()
    try:
        resolved = path.resolve()
    except OSError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid download path: {exc}") from exc

    if _is_dangerous_root(resolved):
        raise HTTPException(status_code=400, detail="Refusing to write directly to a system root.")

    try:
        if create:
            resolved.mkdir(parents=True, exist_ok=True)
        elif not resolved.is_dir():
            raise HTTPException(status_code=400, detail="Download path must be an existing directory.")
        test_file = resolved / ".pixivdl_write_test"
        with test_file.open("w", encoding="utf-8") as handle:
            handle.write("ok")
        test_file.unlink(missing_ok=True)
    except OSError as exc:
        raise HTTPException(status_code=400, detail=f"Download path is not writable: {exc}") from exc

    return resolved


def ensure_child_path(parent: Path, child: Path) -> Path:
    parent_resolved = parent.resolve()
    child_resolved = child.resolve()
    try:
        child_resolved.relative_to(parent_resolved)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Resolved path escapes download directory.") from exc
    return child_resolved


def _is_dangerous_root(path: Path) -> bool:
    anchor = Path(path.anchor)
    if path == anchor:
        return True
    protected = {
        Path.home().anchor,
        os.environ.get("SystemRoot", ""),
        os.environ.get("WINDIR", ""),
    }
    return str(path) in {str(Path(p).resolve()) for p in protected if p}
