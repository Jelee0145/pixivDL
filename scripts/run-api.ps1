$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$python = Join-Path $root ".venv\Scripts\python.exe"
if (-not (Test-Path $python)) {
    $python = "python"
}

& $python -m uvicorn pixivdl.main:app --app-dir (Join-Path $root "backend") --host 127.0.0.1 --port 8000 --reload

