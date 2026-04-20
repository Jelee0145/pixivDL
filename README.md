# PixivDL

PixivDL is a local web app for fetching a Pixiv illustration by PID, previewing its pages, downloading selected images, packing selected pages into a ZIP, and keeping a local favorites list.

The app is intentionally local-first:

- The backend listens on `127.0.0.1`.
- Pixiv cookies are kept in memory by default, or in the system credential store when explicitly saved.
- SQLite stores settings and favorites only, not cookies.
- Queried work metadata and preview/original images are cached under `.pixivdl-data/cache` in this project directory.
- File writes are restricted to user-selected writable directories.

## Setup

Windows 一键启动：

```powershell
.\启动 PixivDL.bat
```

首次启动会创建 `.venv`、安装 Python/Node 依赖、打开后端和前端两个窗口，并自动打开浏览器。

如果 Python/Node 报 `_overlapped`、`WinError 10106`、`CSPRNG` 或 PowerShell `8009001d`，先双击 `修复系统环境.bat` 并同意管理员权限，完成后重启 Windows，再双击 `rebuild PixivDL env.bat` 重建依赖环境。

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -e ".[dev]"
cd frontend
npm install
```

## Development

Run the API:

```powershell
.\.venv\Scripts\python -m uvicorn pixivdl.main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload
```

Run the UI:

```powershell
cd frontend
npm run dev
```

Open `http://127.0.0.1:5173`.

In the Settings tab, Pixiv Cookie can be pasted manually or imported from a `Get cookies.txt` export. Netscape-format `cookies.txt` files are converted into a normal `Cookie` header automatically.

Downloads are initiated by the browser. A single selected page in file mode downloads as the original image; multiple selected pages are returned as a ZIP.

## Production Build

```powershell
cd frontend
npm run build
cd ..
.\.venv\Scripts\python -m uvicorn pixivdl.main:app --app-dir backend --host 127.0.0.1 --port 8000
```

The FastAPI app serves `frontend/dist` when it exists.

## Notes

PixivDL uses pixiv.net web AJAX endpoints. They are not a stable public API, so future Pixiv changes can require maintenance. Use the tool only for content your Pixiv account is allowed to access and keep request rates modest.
