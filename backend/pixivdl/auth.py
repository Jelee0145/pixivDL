from __future__ import annotations

import base64
from dataclasses import dataclass
import hashlib
import os
from pathlib import Path
import secrets

from .config import (
    COOKIE_USER,
    SERVICE_NAME,
    get_fallback_cookie_key_path,
    get_fallback_cookie_path,
)

try:
    import keyring
except Exception:  # pragma: no cover - depends on host system
    keyring = None


FALLBACK_COOKIE_VERSION = "pixivdl-cookie-v1"


def _machine_hint() -> bytes:
    parts = [
        os.environ.get("USERDOMAIN", ""),
        os.environ.get("USERNAME", ""),
        str(Path.home()),
        SERVICE_NAME,
    ]
    return "|".join(parts).encode("utf-8")


def _set_private_file_mode(path: Path) -> None:
    try:
        path.chmod(0o600)
    except OSError:
        pass


def _load_or_create_fallback_key() -> bytes:
    key_path = get_fallback_cookie_key_path()
    key_path.parent.mkdir(parents=True, exist_ok=True)
    if key_path.exists():
        try:
            return base64.b64decode(key_path.read_text(encoding="utf-8").strip())
        except Exception:
            pass
    key = secrets.token_bytes(32)
    key_path.write_text(base64.b64encode(key).decode("ascii"), encoding="utf-8")
    _set_private_file_mode(key_path)
    return key


def _derive_fallback_key() -> bytes:
    raw_key = _load_or_create_fallback_key()
    return hashlib.sha256(raw_key + _machine_hint()).digest()


def _xor_stream(data: bytes, key: bytes) -> bytes:
    output = bytearray()
    counter = 0
    while len(output) < len(data):
        block = hashlib.sha256(key + counter.to_bytes(8, "big")).digest()
        output.extend(block)
        counter += 1
    return bytes(source ^ mask for source, mask in zip(data, output))


def _save_fallback_cookie(cookie: str) -> None:
    cookie_path = get_fallback_cookie_path()
    cookie_path.parent.mkdir(parents=True, exist_ok=True)
    encrypted = _xor_stream(cookie.encode("utf-8"), _derive_fallback_key())
    payload = base64.b64encode(encrypted).decode("ascii")
    cookie_path.write_text(f"{FALLBACK_COOKIE_VERSION}\n{payload}", encoding="utf-8")
    _set_private_file_mode(cookie_path)


def _load_fallback_cookie() -> str | None:
    cookie_path = get_fallback_cookie_path()
    if not cookie_path.exists():
        return None
    try:
        version, payload = cookie_path.read_text(encoding="utf-8").splitlines()[:2]
    except Exception:
        return None
    if version != FALLBACK_COOKIE_VERSION:
        return None
    try:
        encrypted = base64.b64decode(payload)
        cookie = _xor_stream(encrypted, _derive_fallback_key()).decode("utf-8").strip()
    except Exception:
        return None
    return cookie or None


def _clear_fallback_cookie() -> None:
    for path in (get_fallback_cookie_path(), get_fallback_cookie_key_path()):
        try:
            path.unlink(missing_ok=True)
        except OSError:
            pass


@dataclass
class CookieStore:
    _cookie: str | None = None

    def set(self, cookie: str, save: bool = False) -> tuple[bool, str]:
        self._cookie = cookie.strip()
        if not save:
            return True, "Cookie stored for this session."
        keyring_error: str | None = None
        if keyring is None:
            keyring_error = "system credential storage is not available"
        else:
            try:
                keyring.set_password(SERVICE_NAME, COOKIE_USER, self._cookie)
            except Exception as exc:
                keyring_error = f"system credential storage failed: {type(exc).__name__}"
            else:
                _clear_fallback_cookie()
                return True, "Cookie stored in the system credential store."
        try:
            _save_fallback_cookie(self._cookie)
        except Exception as exc:
            return (
                False,
                f"Cookie is active for this session, but {keyring_error}; local fallback failed: {type(exc).__name__}.",
            )
        return (
            True,
            f"Cookie stored in local fallback storage because {keyring_error}.",
        )

    def get(self) -> str | None:
        if self._cookie:
            return self._cookie
        if keyring is not None:
            try:
                cookie = keyring.get_password(SERVICE_NAME, COOKIE_USER)
            except Exception:
                cookie = None
            if cookie:
                self._cookie = cookie
                return cookie
        cookie = _load_fallback_cookie()
        if cookie:
            self._cookie = cookie
        return cookie

    def clear(self) -> None:
        self._cookie = None
        if keyring is not None:
            try:
                keyring.delete_password(SERVICE_NAME, COOKIE_USER)
            except Exception:
                pass
        _clear_fallback_cookie()

    def saved(self) -> bool:
        if keyring is not None:
            try:
                if keyring.get_password(SERVICE_NAME, COOKIE_USER):
                    return True
            except Exception:
                pass
        return bool(_load_fallback_cookie())

    def present(self) -> bool:
        return bool(self.get())
