from pixivdl import auth
from pixivdl.auth import CookieStore


class FailingKeyring:
    @staticmethod
    def set_password(service: str, user: str, password: str) -> None:
        raise RuntimeError("boom")

    @staticmethod
    def get_password(service: str, user: str) -> str | None:
        return None


class WorkingKeyring:
    value: str | None = None

    @classmethod
    def set_password(cls, service: str, user: str, password: str) -> None:
        cls.value = password

    @classmethod
    def get_password(cls, service: str, user: str) -> str | None:
        return cls.value


def test_cookie_store_save_failure_uses_local_fallback(monkeypatch, tmp_path) -> None:
    monkeypatch.setenv("PIXIVDL_DATA_DIR", str(tmp_path))
    monkeypatch.setattr(auth, "keyring", FailingKeyring)
    store = CookieStore()

    ok, message = store.set("PHPSESSID=abc", save=True)

    assert ok is True
    assert "local fallback" in message
    assert store.get() == "PHPSESSID=abc"

    restarted_store = CookieStore()
    assert restarted_store.get() == "PHPSESSID=abc"
    assert restarted_store.saved() is True


def test_cookie_store_save_success(monkeypatch, tmp_path) -> None:
    monkeypatch.setenv("PIXIVDL_DATA_DIR", str(tmp_path))
    WorkingKeyring.value = None
    monkeypatch.setattr(auth, "keyring", WorkingKeyring)
    store = CookieStore()

    ok, message = store.set("PHPSESSID=abc", save=True)

    assert ok is True
    assert "credential store" in message
    assert WorkingKeyring.value == "PHPSESSID=abc"


def test_cookie_store_save_without_keyring_uses_local_fallback(monkeypatch, tmp_path) -> None:
    monkeypatch.setenv("PIXIVDL_DATA_DIR", str(tmp_path))
    monkeypatch.setattr(auth, "keyring", None)
    store = CookieStore()

    ok, message = store.set("PHPSESSID=abc", save=True)

    assert ok is True
    assert "local fallback" in message
    assert CookieStore().get() == "PHPSESSID=abc"


def test_cookie_store_clear_removes_local_fallback(monkeypatch, tmp_path) -> None:
    monkeypatch.setenv("PIXIVDL_DATA_DIR", str(tmp_path))
    monkeypatch.setattr(auth, "keyring", None)
    store = CookieStore()
    store.set("PHPSESSID=abc", save=True)

    store.clear()

    assert store.get() is None
    assert CookieStore().saved() is False
