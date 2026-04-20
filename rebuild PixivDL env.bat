@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
cd /d "%~dp0"

set "PYLAUNCH="
for %%V in (3.13 3.12 3.11) do (
  py -%%V -c "import asyncio; print('ok')" >nul 2>nul
  if "!errorlevel!"=="0" (
    set "PYLAUNCH=py -%%V"
    goto :python_found
  )
)

python -c "import asyncio; print('ok')" >nul 2>nul
if "%errorlevel%"=="0" set "PYLAUNCH=python"

:python_found
if "%PYLAUNCH%"=="" (
  echo No working Python 3.11+ found.
  echo Run 修复系统环境.bat as Administrator, reboot, then run this file again.
  pause
  exit /b 1
)

echo Using Python: %PYLAUNCH%
if exist ".venv" rmdir /s /q ".venv"
%PYLAUNCH% -m venv ".venv"
if not "%errorlevel%"=="0" (
  echo Failed to create .venv.
  pause
  exit /b 1
)

".venv\Scripts\python.exe" -m pip install --upgrade pip
if not "%errorlevel%"=="0" (
  echo Failed to upgrade pip.
  pause
  exit /b 1
)

".venv\Scripts\python.exe" -m pip install -e ".[dev]"
if not "%errorlevel%"=="0" (
  echo Failed to install backend dependencies.
  pause
  exit /b 1
)

node -e "const major=Number(process.versions.node.split('.')[0]); if (major > 24) { console.error('Install Node.js LTS 22 or 24, current is '+process.version); process.exit(1) } console.log(process.version)"
if not "%errorlevel%"=="0" (
  echo Node.js is missing, broken, or too new.
  echo Install Node.js LTS 22 or 24, then run this file again.
  pause
  exit /b 1
)

npm --version >nul
if not "%errorlevel%"=="0" (
  echo npm failed to start.
  echo Reinstall Node.js LTS 22 or 24, then run this file again.
  pause
  exit /b 1
)

cd /d "%~dp0frontend"
npm install
if not "%errorlevel%"=="0" (
  echo Failed to install frontend dependencies.
  pause
  exit /b 1
)

echo.
echo PixivDL environment rebuilt successfully.
pause
