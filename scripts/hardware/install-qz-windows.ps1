# Run on the Windows counter. Downloads the official signed QZ Tray installer.
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$qzExecutable = Join-Path $env:ProgramFiles 'QZ Tray\qz-tray.exe'
if (-not (Test-Path $qzExecutable)) {
    $qzArchitecture = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } else { 'x86_64' }
    $qzInstaller = Join-Path $env:TEMP "pharm-qz-tray-2.2.5-$qzArchitecture.exe"
    Invoke-WebRequest -UseBasicParsing -Uri "https://github.com/qzind/tray/releases/download/v2.2.5/qz-tray-2.2.5-$qzArchitecture.exe" -OutFile $qzInstaller
    $qzSignature = Get-AuthenticodeSignature $qzInstaller
    if ($qzSignature.Status -ne 'Valid' -or $qzSignature.SignerCertificate.Subject -notmatch 'QZ INDUSTRIES') {
        throw 'QZ Tray installer signature could not be verified. Installer was not executed.'
    }
    $qzInstallProcess = Start-Process -FilePath $qzInstaller -ArgumentList '/S' -Wait -PassThru
    if ($qzInstallProcess.ExitCode -ne 0) { throw "QZ Tray installer exited with code $($qzInstallProcess.ExitCode)." }
}
if (-not (Test-Path $qzExecutable)) { throw 'QZ Tray executable was not found after installation.' }
if (-not (Get-Process -Name 'qz-tray' -ErrorAction SilentlyContinue)) {
    Start-Process -FilePath $qzExecutable
}
Write-Output 'QZ Tray is installed and launch was requested. Open Pharm hardware settings and allow its connection request.'
