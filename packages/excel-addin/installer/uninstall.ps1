# 몰리 코드 Excel 추가 기능 제거 스크립트
#
#   powershell -ExecutionPolicy Bypass -File .\uninstall.ps1
#   -KeepCert : 인증서는 남겨둠
#   -InstallDir : 설치 위치 (기본 %LOCALAPPDATA%\MoliCode\ExcelAddin)

[CmdletBinding()]
param(
    [string]$InstallDir = "$env:LOCALAPPDATA\MoliCode\ExcelAddin",
    [switch]$KeepCert
)

$ErrorActionPreference = 'Continue'
$AddinId = '51ef4b60-29f7-442c-99b4-93419c6e68e2'
$TaskName = 'MoliExcelSidecar'
$CertFriendlyName = 'MoliCode Excel Sidecar'

Write-Host '=== 몰리 코드 Excel 추가 기능 제거 ===' -ForegroundColor Cyan

# 1. 사이드카 프로세스 종료
Write-Host '[1/5] 사이드카 종료...'
Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and $_.CommandLine -like "*$InstallDir\sidecar\index.cjs*" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

# 2. 예약 작업 제거
Write-Host '[2/5] 자동 시작 작업 제거...'
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

# 3. 레지스트리 사이드로딩 제거
Write-Host '[3/5] 사이드로딩 등록 해제...'
$devKey = 'HKCU:\Software\Microsoft\Office\16.0\WEF\Developer'
if (Test-Path $devKey) {
    Remove-ItemProperty -Path $devKey -Name $AddinId -ErrorAction SilentlyContinue
}
# 이 설치가 만든 TrustedCatalogs 항목 제거 (Url이 MoliExcelAddin 공유를 가리키는 것)
$catRoot = 'HKCU:\Software\Microsoft\Office\16.0\WEF\TrustedCatalogs'
if (Test-Path $catRoot) {
    Get-ChildItem $catRoot | ForEach-Object {
        $url = (Get-ItemProperty -Path $_.PSPath -ErrorAction SilentlyContinue).Url
        if ($url -like '*\MoliExcelAddin') {
            Remove-Item -Path $_.PSPath -Recurse -Force
        }
    }
}
Get-SmbShare -Name 'MoliExcelAddin' -ErrorAction SilentlyContinue |
    ForEach-Object { Remove-SmbShare -Name $_.Name -Force -ErrorAction SilentlyContinue }

# 4. 인증서 제거
if (-not $KeepCert) {
    Write-Host '[4/5] 인증서 제거...'
    foreach ($store in @('Cert:\CurrentUser\My', 'Cert:\CurrentUser\Root', 'Cert:\LocalMachine\Root')) {
        Get-ChildItem $store -ErrorAction SilentlyContinue |
            Where-Object { $_.FriendlyName -eq $CertFriendlyName -or $_.Subject -eq 'CN=localhost' -and $_.Issuer -eq 'CN=localhost' -and $_.FriendlyName -eq $CertFriendlyName } |
            ForEach-Object { Remove-Item -Path $_.PSPath -Force -ErrorAction SilentlyContinue }
    }
} else {
    Write-Host '[4/5] 인증서 유지(-KeepCert)'
}

# 5. 설치 폴더 삭제
Write-Host '[5/5] 설치 폴더 삭제...'
Remove-Item -Path $InstallDir -Recurse -Force -ErrorAction SilentlyContinue

Write-Host ''
Write-Host '=== 제거 완료 ===' -ForegroundColor Green
Write-Host '참고: Excel이 추가 기능을 캐시하는 경우 아래 폴더를 비우면 완전히 사라집니다:'
Write-Host "  $env:LOCALAPPDATA\Microsoft\Office\16.0\Wef\"
