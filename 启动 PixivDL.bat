@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
  call "%~dp0rebuild PixivDL env.bat"
  if not "%errorlevel%"=="0" exit /b 1
)

if not exist "frontend\node_modules" (
  call "%~dp0rebuild PixivDL env.bat"
  if not "%errorlevel%"=="0" exit /b 1
)

echo Starting PixivDL API...
start "PixivDL API" cmd /k ".venv\Scripts\python.exe -m uvicorn pixivdl.main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload"

echo Starting PixivDL UI...
start "PixivDL UI" cmd /k "cd /d ""%~dp0frontend"" && npm run dev"

timeout /t 5 /nobreak >nul
start http://127.0.0.1:5173

echo.
echo PixivDL is starting. Keep the API and UI windows open.
