$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$venvDir = Join-Path $root ".venv"
$frontendDir = Join-Path $root "frontend"

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
    return @{ ExitCode = $process.ExitCode; StdOut = $stdout.Trim(); StdErr = $stderr.Trim() }
}

function Test-Python($launcher) {
    $parts = $launcher.Split(" ", 2)
    $args = if ($parts.Count -gt 1) { "$($parts[1]) " } else { "" }
    $result = Invoke-Capture $parts[0] ($args + '-c "import sys, asyncio; print(sys.version)"')
    return $result.ExitCode -eq 0
}

Set-Location $root

$pythonLauncher = $null
foreach ($candidate in @("py -3.13", "py -3.12", "py -3.11", "python")) {
    $exe = $candidate.Split(" ", 2)[0]
    if ((Get-Command $exe -ErrorAction SilentlyContinue) -and (Test-Python $candidate)) {
        $pythonLauncher = $candidate
        break
    }
}

if (-not $pythonLauncher) {
    throw "No working Python was found. Run 修复系统环境.bat as Administrator, reboot, then try again."
}

if (Test-Path $venvDir) {
    Remove-Item -LiteralPath $venvDir -Recurse -Force
}

Write-Host "Using Python: $pythonLauncher"
Invoke-Expression "$pythonLauncher -m venv `"$venvDir`""
& (Join-Path $venvDir "Scripts\python.exe") -m pip install --upgrade pip
& (Join-Path $venvDir "Scripts\python.exe") -m pip install -e ".[dev]"

$nodeCheck = Invoke-Capture "node" "-e `"const major=Number(process.versions.node.split('.')[0]); if (major > 24) process.exit(1); console.log(process.version)`""
if ($nodeCheck.ExitCode -ne 0) {
    throw "Node.js is missing or too new. Install Node.js LTS 22 or 24, then run this script again."
}

$npmCheck = Invoke-Capture "npm" "--version"
if ($npmCheck.ExitCode -ne 0) {
    throw "npm failed to start. Reinstall Node.js LTS, then run this script again."
}

Set-Location $frontendDir
npm install

Write-Host ""
Write-Host "PixivDL environment rebuilt successfully." -ForegroundColor Green
