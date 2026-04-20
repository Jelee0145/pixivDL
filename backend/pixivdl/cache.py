from __future__ import annotations

from pathlib import Path

from fastapi import HTTPException

from .config import get_cache_dir
from .schemas import PixivWork
from .security import ensure_child_path, validate_pid


class DiskCache:
    def __init__(self, root: Path | None = None) -> None:
        self.root = root or get_cache_dir()
        self.metadata_dir = self.root / "works"
        self.image_dir = self.root / "images"

    def get_work(self, pid: str) -> PixivWork | None:
        validate_pid(pid)
        path = self._work_path(pid)
        if not path.exists():
            return None
        try:
            return PixivWork.model_validate_json(path.read_text(encoding="utf-8"))
        except Exception:
            return None

    def put_work(self, work: PixivWork) -> None:
        path = self._work_path(work.pid)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(work.model_dump_json(), encoding="utf-8")

    def image_path(self, work: PixivWork, page: int, size: str) -> Path:
        image = next((item for item in work.pages if item.page == page), None)
        if image is None:
            raise HTTPException(status_code=404, detail="Image page was not found.")
        if size not in {"thumb", "regular", "original"}:
            raise HTTPException(status_code=400, detail="Image size is invalid.")
        directory = ensure_child_path(self.image_dir, self.image_dir / work.pid)
        return ensure_child_path(directory, directory / f"{size}_p{page}.{image.extension}")

    def get_image(self, work: PixivWork, page: int, size: str) -> Path | None:
        path = self.image_path(work, page, size)
        return path if path.exists() else None

    def put_image(self, work: PixivWork, page: int, size: str, data: bytes) -> Path:
        path = self.image_path(work, page, size)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return path

    def _work_path(self, pid: str) -> Path:
        validate_pid(pid)
        path = self.metadata_dir / f"{pid}.json"
        return ensure_child_path(self.metadata_dir, path)
