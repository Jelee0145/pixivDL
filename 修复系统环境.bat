@echo off
setlocal
chcp 65001 >nul

net session >nul 2>&1
if not "%errorlevel%"=="0" (
  echo Requesting administrator permission...
  mshta "vbscript:CreateObject(""Shell.Application"").ShellExecute(""%~f0"","","",""runas"",1)(window.close)"
  exit /b
)

echo.
echo Repairing Windows Winsock and TCP/IP provider state...
netsh winsock reset
netsh int ip reset
ipconfig /flushdns

echo.
echo Repair completed. Reboot Windows before starting PixivDL again.
echo After reboot, run: rebuild PixivDL env.bat
pause
