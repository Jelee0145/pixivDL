$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$frontendDir = Join-Path $root "frontend"
$venvDir = Join-Path $root ".venv"
$venvPython = Join-Path $root ".venv\Scripts\python.exe"
$apiUrl = "http://127.0.0.1:8000"
$uiUrl = "http://127.0.0.1:5173"

function Write-Step($message) {
    Write-Host ""
    Write-Host "==> $message" -ForegroundColor Cyan
}

function Test-Command($name) {
    return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

function Invoke-Capture($file, $arguments) {
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $file
    $psi.Arguments = $arguments
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.UseShellExecute = $false
    $process = [System.Diagnostics.Process]::Start($psi)
    $stdout = $process.StandardOutput.ReadToEnd()
    $stderr = $process.StandardError.ReadToEnd()
    $process.WaitForExit()
    return @{
        ExitCode = $process.ExitCode
        StdOut = $stdout.Trim()
        StdErr = $stderr.Trim()
    }
}

function Test-PythonCandidate($candidate) {
    $parts = $candidate.Split(" ", 2)
    $args = if ($parts.Count -gt 1) { "$($parts[1]) " } else { "" }
    $result = Invoke-Capture $parts[0] ($args + '-c "import sys, asyncio; print(sys.version_info[:3])"')
    return $result.ExitCode -eq 0
}

function Find-Python {
    $launchers = @("py -3.13", "py -3.12", "py -3.11")
    foreach ($launcher in $launchers) {
        $parts = $launcher.Split(" ", 2)
        if ((Test-Command $parts[0]) -and (Test-PythonCandidate $launcher)) {
            return $launcher
        }
    }
    if ((Test-Command "python") -and (Test-PythonCandidate "python")) {
        return "python"
    }
    throw "No working Python 3.11+ was found. Run scripts\repair-environment.ps1 as Administrator, reboot, then start again."
}

function Test-VenvPython {
    if (-not (Test-Path $venvPython)) {
        return $false
    }
    $result = Invoke-Capture $venvPython '-c "import sys, asyncio; print(sys.version_info[:3])"'
    return $result.ExitCode -eq 0
}

function Test-Port($port) {
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $iar = $client.BeginConnect("127.0.0.1", $port, $null, $null)
        $connected = $iar.AsyncWaitHandle.WaitOne(300, $false)
        if ($connected) {
            $client.EndConnect($iar)
            return $true
        }
        return $false
    } catch {
        return $false
    } finally {
        $client.Close()
    }
}

function Wait-Http($url, $seconds) {
    $deadline = (Get-Date).AddSeconds($seconds)
    while ((Get-Date) -lt $deadline) {
        try {
            Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2 | Out-Null
            return $true
        } catch {
            Start-Sleep -Milliseconds 500
        }
    }
    return $false
}

Set-Location $root

Write-Step "Checking Python"
if (-not (Test-VenvPython)) {
    if (Test-Path $venvDir) {
        Write-Host "Existing .venv is not usable. Recreating it." -ForegroundColor Yellow
        Remove-Item -LiteralPath $venvDir -Recurse -Force
    }
    $pythonLauncher = Find-Python
    Write-Host "Using Python launcher: $pythonLauncher"
    Invoke-Expression "$pythonLauncher -m venv `"$venvDir`""
}

Write-Step "Installing backend dependencies"
& $venvPython -m pip install --upgrade pip
& $venvPython -m pip install -e ".[dev]"

Write-Step "Checking Node.js and npm"
if (-not (Test-Command "node") -or -not (Test-Command "npm")) {
    throw "node/npm was not found. Install Node.js LTS."
}
$nodeCheck = Invoke-Capture "node" "-e `"const major=Number(process.versions.node.split('.')[0]); if (major > 24) { console.error('Node.js '+process.version+' is not LTS for this app. Install Node.js LTS 22 or 24.'); process.exit(1) } console.log(process.version)`""
if ($nodeCheck.ExitCode -ne 0) {
    throw $nodeCheck.StdErr
}
$npmCheck = Invoke-Capture "npm" "--version"
if ($npmCheck.ExitCode -ne 0) {
    throw "npm failed to start. Run scripts\repair-environment.ps1 as Administrator, reboot, then install Node.js LTS."
}

Write-Step "Installing frontend dependencies"
Set-Location $frontendDir
if (-not (Test-Path (Join-Path $frontendDir "node_modules"))) {
    npm install
}

Set-Location $root

if (Test-Port 8000) {
    Write-Host "Port 8000 is already in use. Skipping API startup." -ForegroundColor Yellow
} else {
    Write-Step "Starting API"
    Start-Process powershell -ArgumentList @(
        "-NoExit",
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-File", "`"$root\scripts\run-api.ps1`""
    ) -WorkingDirectory $root
}

if (Test-Port 5173) {
    Write-Host "Port 5173 is already in use. Skipping UI startup." -ForegroundColor Yellow
} else {
    Write-Step "Starting UI"
    Start-Process powershell -ArgumentList @(
        "-NoExit",
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-File", "`"$root\scripts\run-frontend.ps1`""
    ) -WorkingDirectory $frontendDir
}

Write-Step "Waiting for services"
$apiReady = Wait-Http "$apiUrl/api/health" 30
$uiReady = Wait-Http $uiUrl 45

if ($apiReady -and $uiReady) {
    Write-Host "PixivDL is ready: $uiUrl" -ForegroundColor Green
    Start-Process $uiUrl
} elseif ($apiReady) {
    Write-Host "API is ready, but UI did not respond yet. Check the UI window logs." -ForegroundColor Yellow
    Start-Process $apiUrl
} else {
    Write-Host "Services were not ready in time. Check the opened PowerShell window logs." -ForegroundColor Yellow
}
