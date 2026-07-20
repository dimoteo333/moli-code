# 몰리 코드 PowerPoint 추가 기능 설치 스크립트 (폐쇄망용)
#
# 기본 실행(관리자 권한 불필요):
#   powershell -ExecutionPolicy Bypass -File .\install.ps1
#
# 옵션:
#   -Port 39216      사이드카 포트 (기본 39216)
#   -InstallDir ...  설치 위치 (기본 %LOCALAPPDATA%\MoliCode\PowerPointAddin)
#   -UseCatalog      공유 폴더 카탈로그 방식 사이드로딩 (관리자 필요)
#   -Machine         인증서를 LocalMachine 루트에 설치 (관리자 필요, 확인창 없음)
#   -NoAutoStart     로그온 자동 시작 작업을 만들지 않음

[CmdletBinding()]
param(
    [string]$InstallDir = "$env:LOCALAPPDATA\MoliCode\PowerPointAddin",
    [int]$Port = 39216,
    [switch]$UseCatalog,
    [switch]$Machine,
    [switch]$NoAutoStart
)

$ErrorActionPreference = 'Stop'
$AddinId = '793cb7e1-b614-4694-80ec-78bde900e066'
$TaskName = 'MoliPowerPointSidecar'
$CertFriendlyName = 'MoliCode PowerPoint Sidecar'
$Version = '0.5.0'
$ManifestVersion = '1.0.5.0'

# deploy 루트 = installer\ 의 상위 폴더
$Payload = Split-Path -Parent $PSScriptRoot

Write-Host "=== 몰리 코드 PowerPoint 추가 기능 설치 ($Version) ===" -ForegroundColor Cyan
Write-Host "설치 위치: $InstallDir"
Write-Host "포트: $Port"

# ---------------------------------------------------------------- 0. 검증
foreach ($required in @('web\taskpane.html', 'sidecar\index.cjs', 'manifest\manifest.template.xml')) {
    if (-not (Test-Path (Join-Path $Payload $required))) {
        throw "배포 파일이 없습니다: $required — 압축을 모두 푼 뒤 installer\install.ps1을 실행하세요."
    }
}
if (-not (Test-Path (Join-Path $Payload 'sidecar\node.exe'))) {
    Write-Warning 'sidecar\node.exe가 없습니다. 시스템 PATH의 node를 사용합니다(폐쇄망에서는 권장하지 않음).'
}

# ---------------------------------------------------------------- 1. 파일 복사
# 재설치/업그레이드: 실행 중인 사이드카가 node.exe를 잠그고 있으면 복사가
# 실패하므로 먼저 종료한다.
$running = Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like "*$InstallDir\sidecar\index.cjs*" }
if ($running) {
    Write-Host '[1/6] 기존 사이드카 중지 후 파일 복사...'
    $running | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Milliseconds 800
} else {
    Write-Host '[1/6] 파일 복사...'
}
foreach ($dir in @($InstallDir, "$InstallDir\certs", "$InstallDir\logs", "$InstallDir\workspace", "$InstallDir\manifest")) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
}
foreach ($dir in @('web', 'sidecar', 'cli', 'installer')) {
    $src = Join-Path $Payload $dir
    if (Test-Path $src) {
        Copy-Item -Recurse -Force $src $InstallDir
    }
}
if (Test-Path (Join-Path $Payload 'README.ko.md')) {
    Copy-Item -Force (Join-Path $Payload 'README.ko.md') $InstallDir
}

# ---------------------------------------------------------------- 2. 인증서
Write-Host '[2/6] localhost 인증서 생성/신뢰...'
$cert = Get-ChildItem Cert:\CurrentUser\My |
    Where-Object { $_.FriendlyName -eq $CertFriendlyName -and $_.NotAfter -gt (Get-Date).AddDays(30) } |
    Select-Object -First 1
if (-not $cert) {
    $cert = New-SelfSignedCertificate `
        -DnsName 'localhost' `
        -CertStoreLocation Cert:\CurrentUser\My `
        -FriendlyName $CertFriendlyName `
        -KeyExportPolicy Exportable `
        -KeyAlgorithm RSA -KeyLength 2048 `
        -NotAfter (Get-Date).AddYears(5)
}

$passphrase = [guid]::NewGuid().ToString('N')
$securePass = ConvertTo-SecureString -String $passphrase -Force -AsPlainText
$pfxPath = "$InstallDir\certs\localhost.pfx"
$cerPath = "$InstallDir\certs\localhost.cer"
Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $securePass | Out-Null
Export-Certificate -Cert $cert -FilePath $cerPath | Out-Null

# 현재 사용자만 읽을 수 있도록 제한
icacls "$InstallDir\certs" /inheritance:r /grant:r "${env:USERNAME}:(OI)(CI)F" | Out-Null

# 루트 신뢰 (IE/Trident는 Windows 인증서 저장소를 사용)
$rootThumb = $cert.Thumbprint
if ($Machine) {
    $existing = Get-ChildItem Cert:\LocalMachine\Root | Where-Object { $_.Thumbprint -eq $rootThumb }
    if (-not $existing) {
        Import-Certificate -FilePath $cerPath -CertStoreLocation Cert:\LocalMachine\Root | Out-Null
    }
} else {
    $existing = Get-ChildItem Cert:\CurrentUser\Root | Where-Object { $_.Thumbprint -eq $rootThumb }
    if (-not $existing) {
        Write-Host '  ※ Windows 보안 확인창이 뜨면 [예]를 눌러 주세요 (localhost 인증서 신뢰).' -ForegroundColor Yellow
        Import-Certificate -FilePath $cerPath -CertStoreLocation Cert:\CurrentUser\Root | Out-Null
    }
}

# ---------------------------------------------------------------- 3. config.json
Write-Host '[3/6] 설정 파일 작성...'
$cliPath = $null
if (Test-Path "$InstallDir\cli\moli-code.exe") {
    $cliPath = "$InstallDir\cli\moli-code.exe"
} elseif (Test-Path "$InstallDir\cli\cli.js") {
    $cliPath = "$InstallDir\cli\cli.js"
}
$config = [ordered]@{
    port           = $Port
    certPfxPath    = 'certs/localhost.pfx'
    certPassphrase = $passphrase
    cliPath        = $cliPath
    workDir        = 'workspace'
    excludeTools   = @('ShellTool', 'web_fetch', 'web_search')
    logLevel       = 'info'
}
$config | ConvertTo-Json | Set-Content -Encoding UTF8 "$InstallDir\config.json"

# ---------------------------------------------------------------- 4. 매니페스트
Write-Host '[4/6] 매니페스트 생성...'
$manifest = Get-Content (Join-Path $Payload 'manifest\manifest.template.xml') -Raw -Encoding UTF8
$manifest = $manifest -replace '\{\{PORT\}\}', "$Port" -replace '\{\{VERSION\}\}', $ManifestVersion
$manifestPath = "$InstallDir\manifest\manifest.xml"
Set-Content -Path $manifestPath -Value $manifest -Encoding UTF8

# ---------------------------------------------------------------- 5. 사이드로딩 등록
Write-Host '[5/6] PowerPoint 사이드로딩 등록...'
if ($UseCatalog) {
    # 공유 폴더 카탈로그 (TrustedCatalogs는 UNC 경로만 지원 → SMB 공유 필요, 관리자 권한)
    $shareName = 'MoliPowerPointAddin'
    if (-not (Get-SmbShare -Name $shareName -ErrorAction SilentlyContinue)) {
        New-SmbShare -Name $shareName -Path "$InstallDir\manifest" -ReadAccess $env:USERNAME | Out-Null
    }
    $catalogUrl = "\\$env:COMPUTERNAME\$shareName"
    $catalogId = [guid]::NewGuid().ToString()
    $catKey = "HKCU:\Software\Microsoft\Office\16.0\WEF\TrustedCatalogs\{$catalogId}"
    New-Item -Path $catKey -Force | Out-Null
    Set-ItemProperty -Path $catKey -Name 'Id' -Value "{$catalogId}"
    Set-ItemProperty -Path $catKey -Name 'Url' -Value $catalogUrl
    Set-ItemProperty -Path $catKey -Name 'Flags' -Value 1 -Type DWord
    Write-Host "  공유 폴더 카탈로그: $catalogUrl"
    Write-Host '  PowerPoint에서: 파일 > 옵션 > 보안 센터 > 보안 센터 설정 > 신뢰할 수 있는 추가 기능 카탈로그 확인'
} else {
    # 개발자 레지스트리 사이드로딩 (관리자 불필요, UNC 불필요)
    $devKey = 'HKCU:\Software\Microsoft\Office\16.0\WEF\Developer'
    if (-not (Test-Path $devKey)) {
        New-Item -Path $devKey -Force | Out-Null
    }
    Set-ItemProperty -Path $devKey -Name $AddinId -Value $manifestPath
}

# ---------------------------------------------------------------- 6. 사이드카 자동 시작
Write-Host '[6/6] 사이드카 시작...'
$nodeExe = "$InstallDir\sidecar\node.exe"
if (-not (Test-Path $nodeExe)) {
    $nodeExe = 'node.exe'
}
$vbsPath = "$InstallDir\start-sidecar.vbs"
$vbs = @"
Set sh = CreateObject("Wscript.Shell")
' 실행 위치(배포 폴더 등)를 잠그지 않도록 작업 디렉터리를 설치 폴더로 고정
sh.CurrentDirectory = "$InstallDir"
sh.Run """$nodeExe"" ""$InstallDir\sidecar\index.cjs"" --config ""$InstallDir\config.json""", 0, False
"@
Set-Content -Path $vbsPath -Value $vbs -Encoding ASCII

if (-not $NoAutoStart) {
    $action = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument "`"$vbsPath`""
    $trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero)
    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
}

# 지금 바로 시작 + 헬스체크
Start-Process -FilePath 'wscript.exe' -ArgumentList "`"$vbsPath`"" -WindowStyle Hidden
Write-Host '  사이드카 응답 대기 중...'
$oldCallback = [Net.ServicePointManager]::ServerCertificateValidationCallback
[Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }
# Windows PowerShell 5.1 기본값은 TLS 1.2를 포함하지 않아 Node HTTPS와 협상이
# 실패할 수 있다 (사이드카가 정상이어도 경고가 뜨는 원인).
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
$healthy = $false
foreach ($i in 1..20) {
    Start-Sleep -Milliseconds 500
    try {
        $res = Invoke-WebRequest -Uri "https://localhost:$Port/health" -UseBasicParsing -TimeoutSec 3
        if ($res.StatusCode -eq 200) { $healthy = $true; break }
    } catch { }
}
[Net.ServicePointManager]::ServerCertificateValidationCallback = $oldCallback

Write-Host ''
if ($healthy) {
    Write-Host '=== 설치 완료 ===' -ForegroundColor Green
} else {
    Write-Warning "사이드카가 아직 응답하지 않습니다. 로그 확인: $InstallDir\logs\sidecar.log"
}
Write-Host '다음 순서로 사용을 시작하세요:'
Write-Host '  1. 실행 중인 PowerPoint를 모두 닫고 다시 시작합니다.'
if ($UseCatalog) {
    Write-Host '  2. 삽입 > 내 추가 기능 > [공유 폴더] 탭 > "몰리 코드 for PowerPoint" 선택'
} else {
    Write-Host '  2. 삽입 > 내 추가 기능 > [개발자] 탭(또는 목록) > "몰리 코드 for PowerPoint" 선택'
    Write-Host '     (개발자 탭이 보이지 않으면 -UseCatalog 옵션으로 다시 설치해 보세요. 관리자 권한 필요)'
}
Write-Host "  3. 문제 발생 시 로그: $InstallDir\logs\sidecar.log"
