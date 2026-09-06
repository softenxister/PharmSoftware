param([Parameter(Mandatory=$true)][string]$CertificatePath)
$ErrorActionPreference = 'Stop'
$qzDirectory = Join-Path $env:ProgramFiles 'QZ Tray'
$qzConsole = Join-Path $qzDirectory 'qz-tray-console.exe'
if (-not (Test-Path $qzConsole)) { throw 'Install QZ Tray first.' }
$certificate = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($CertificatePath)
if ($certificate.Subject -notmatch 'CN=Pharm Counter' -or $certificate.HasPrivateKey) {
    throw 'Expected the public Pharm Counter certificate only.'
}
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    $arguments = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"' + $PSCommandPath + '"'), '-CertificatePath', ('"' + $CertificatePath + '"'))
    $child = Start-Process powershell.exe -Verb RunAs -ArgumentList $arguments -Wait -PassThru
    if ($child.ExitCode -ne 0) { throw "QZ trust setup exited with code $($child.ExitCode)." }
    # Launch as the counter user, not from the elevated installer.
    Start-Process (Join-Path $qzDirectory 'qz-tray.exe')
    exit 0
}
$override = Join-Path $qzDirectory 'override.crt'
if (Test-Path $override) {
    $existing = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($override)
    if ($existing.Thumbprint -ne $certificate.Thumbprint) {
        throw 'A different QZ trust certificate is already installed; it was not replaced.'
    }
} else {
    Copy-Item -LiteralPath $CertificatePath -Destination $override
}
# QZ's supported certificate allowlist operation trusts this identity only.
& $qzConsole --allow $override
if ($LASTEXITCODE -ne 0) { throw 'QZ could not allow the Pharm certificate.' }
Get-Process -Name 'qz-tray' -ErrorAction SilentlyContinue |
    Where-Object { $_.Path -eq (Join-Path $qzDirectory 'qz-tray.exe') } |
    Stop-Process
Write-Output "Pharm certificate trusted: $($certificate.Thumbprint)"
