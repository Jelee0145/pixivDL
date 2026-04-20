$ErrorActionPreference = "Stop"

function Test-Admin {
    return ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
        [Security.Principal.WindowsBuiltInRole]::Administrator
    )
}

if (-not (Test-Admin)) {
    Write-Host "Requesting administrator permission to repair Windows network providers..."
    Start-Process powershell -Verb RunAs -ArgumentList @(
        "-NoExit",
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-File", "`"$PSCommandPath`""
    )
    exit 0
}

Write-Host ""
Write-Host "Repairing Windows Winsock and TCP/IP provider state..." -ForegroundColor Cyan
netsh winsock reset
netsh int ip reset
ipconfig /flushdns

Write-Host ""
Write-Host "Repair step completed. Reboot Windows before starting PixivDL again." -ForegroundColor Green
Write-Host "After reboot, run: D:\pixivdl\rebuild PixivDL env.bat"
