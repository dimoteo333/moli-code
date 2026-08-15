param(
    [Parameter(Mandatory=$true)][string]$SpecPath,
    [Parameter(Mandatory=$true)][string]$OutputPath,
    [string]$RunToken = '',
    [string]$ProcessMarkerPath = '',
    [string]$PreexistingPowerPointPids = ''
)

$ErrorActionPreference = 'Stop'
$font = '원신한'
$navy = 0x552A00
$blue = 0xB56A00
$light = 0xF5F1EA
$white = 0xFFFFFF
$dark = 0x333333
$spec = Get-Content -LiteralPath $SpecPath -Raw -Encoding UTF8 | ConvertFrom-Json
$tempPath = [IO.Path]::Combine([IO.Path]::GetDirectoryName($OutputPath), ([IO.Path]::GetFileNameWithoutExtension($OutputPath) + '.tmp.pptx'))
$powerPointOwned = $false

Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class MoliLegacyPowerPointWindow {
    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
}
'@

function Test-GeneratorOwnsPowerPointProcess([uint32]$ProcessId, [uint32[]]$PreexistingPids) {
    return -not ($PreexistingPids -contains $ProcessId)
}

$fontLocations = @(
    @{ Scope = 'CurrentUser'; Path = 'Registry::HKEY_CURRENT_USER\Software\Microsoft\Windows NT\CurrentVersion\Fonts' },
    @{ Scope = 'LocalMachine'; Path = 'Registry::HKEY_LOCAL_MACHINE\Software\Microsoft\Windows NT\CurrentVersion\Fonts' }
)
$fontInstalled = $false
foreach ($location in $fontLocations) {
    if (Test-Path $location.Path) {
        $properties = (Get-ItemProperty -LiteralPath $location.Path).PSObject.Properties
        if ($properties | Where-Object { $_.Name -like "$font*" }) {
            $fontInstalled = $true
            break
        }
    }
}
if (-not $fontInstalled) { throw "FONT_NOT_FOUND: $font" }

function Add-Text($slide, [string]$text, [double]$left, [double]$top, [double]$width, [double]$height, [double]$size, [int]$color, [bool]$bold=$false) {
    $shape = $slide.Shapes.AddTextbox(1, $left, $top, $width, $height)
    $shape.TextFrame.TextRange.Text = $text
    $shape.TextFrame.MarginLeft = 0
    $shape.TextFrame.MarginRight = 0
    $shape.TextFrame.MarginTop = 0
    $shape.TextFrame.MarginBottom = 0
    $shape.TextFrame.WordWrap = -1
    $shape.TextFrame.TextRange.Font.Name = $font
    $shape.TextFrame.TextRange.Font.NameFarEast = $font
    $shape.TextFrame.TextRange.Font.Size = $size
    $shape.TextFrame.TextRange.Font.Color.RGB = $color
    $shape.TextFrame.TextRange.Font.Bold = $(if ($bold) { -1 } else { 0 })
    return $shape
}

function Add-Header($slide, [string]$label, [int]$page) {
    $bar = $slide.Shapes.AddShape(1, 0, 0, 595.28, 17)
    $bar.Fill.ForeColor.RGB = $navy
    $bar.Line.Visible = 0
    Add-Text $slide $label 42 30 450 20 9 $blue $true | Out-Null
    Add-Text $slide ("{0:D2}" -f $page) 528 30 25 20 9 $navy $true | Out-Null
}

function Join-Bullets($items) {
    if (-not $items) { return '• 해당 사항 없음' }
    return (($items | ForEach-Object { "• $_" }) -join "`r`n")
}

$ppt = $null
$presentation = $null
$verify = $null
try {
    $preexistingPids = @()
    foreach ($pidText in ($PreexistingPowerPointPids -split ',')) {
        $parsedPid = 0
        if ([UInt32]::TryParse($pidText.Trim(), [ref]$parsedPid)) { $preexistingPids += $parsedPid }
    }
    $ppt = New-Object -ComObject PowerPoint.Application
    $ppt.Visible = -1
    $powerPointProcessId = [uint32]0
    [void][MoliLegacyPowerPointWindow]::GetWindowThreadProcessId([IntPtr]([int64]$ppt.HWND), [ref]$powerPointProcessId)
    if ($powerPointProcessId -le 0) { throw 'POWERPOINT_PROCESS_ID_UNAVAILABLE' }
    $powerPointOwned = Test-GeneratorOwnsPowerPointProcess $powerPointProcessId $preexistingPids
    if ($ProcessMarkerPath) { [IO.File]::WriteAllText($ProcessMarkerPath, [string]$powerPointProcessId, [Text.Encoding]::ASCII) }
    $presentation = $ppt.Presentations.Add()
    $presentation.PageSetup.SlideWidth = 595.28
    $presentation.PageSetup.SlideHeight = 841.89

    $s1 = $presentation.Slides.Add(1, 12)
    Add-Header $s1 'DIGITAL OPERATIONS · RESPONSIBLE EXECUTIVE REPORT' 1
    Add-Text $s1 '책임자 제출용' 42 82 180 24 12 $blue $true | Out-Null
    Add-Text $s1 $spec.title 42 120 510 86 28 $navy $true | Out-Null
    Add-Text $s1 $spec.date 42 214 220 24 11 $dark $false | Out-Null
    $box = $s1.Shapes.AddShape(1, 42, 276, 511, 168)
    $box.Fill.ForeColor.RGB = $light
    $box.Line.Visible = 0
    Add-Text $s1 '회의 목적' 64 300 160 25 14 $navy $true | Out-Null
    Add-Text $s1 $spec.purpose 64 340 463 76 13 $dark $false | Out-Null
    Add-Text $s1 '핵심 논의' 42 490 180 25 15 $navy $true | Out-Null
    Add-Text $s1 (Join-Bullets $spec.discussions) 42 530 511 190 12 $dark $false | Out-Null
    Add-Text $s1 (($spec.meta | Select-Object -First 4) -join '  |  ') 42 783 511 20 8 $dark $false | Out-Null

    $s2 = $presentation.Slides.Add(2, 12)
    Add-Header $s2 'DECISIONS & ACTION ITEMS' 2
    Add-Text $s2 '결정 사항' 42 75 220 32 22 $navy $true | Out-Null
    Add-Text $s2 (Join-Bullets $spec.decisions) 42 125 511 220 12 $dark $false | Out-Null
    Add-Text $s2 '실행 과제' 42 380 220 32 22 $navy $true | Out-Null
    $rows = [Math]::Max(2, $spec.actions.Count + 1)
    $tableShape = $s2.Shapes.AddTable($rows, 3, 42, 430, 511, 235)
    $table = $tableShape.Table
    $headers = @('실행 과제','담당자','완료 예정일')
    for ($c=1; $c -le 3; $c++) {
        $cell = $table.Cell(1,$c).Shape
        $cell.TextFrame.TextRange.Text = $headers[$c-1]
        $cell.Fill.ForeColor.RGB = $navy
        $cell.TextFrame.TextRange.Font.Color.RGB = $white
        $cell.TextFrame.TextRange.Font.Bold = -1
    }
    for ($r=0; $r -lt $spec.actions.Count; $r++) {
        $values = @($spec.actions[$r].task, $spec.actions[$r].owner, $spec.actions[$r].due)
        for ($c=1; $c -le 3; $c++) {
            $cell = $table.Cell($r+2,$c).Shape
            $cell.TextFrame.TextRange.Text = $values[$c-1]
            $cell.Fill.ForeColor.RGB = $(if (($r % 2) -eq 0) { $white } else { $light })
            $cell.TextFrame.TextRange.Font.Color.RGB = $dark
        }
    }
    foreach ($row in $table.Rows) { foreach ($cell in $row.Cells) { $cell.Shape.TextFrame.TextRange.Font.Name = $font; $cell.Shape.TextFrame.TextRange.Font.NameFarEast = $font; $cell.Shape.TextFrame.TextRange.Font.Size = 10 } }

    $s3 = $presentation.Slides.Add(3, 12)
    Add-Header $s3 'RISKS, CONTROLS & NEXT STEP' 3
    Add-Text $s3 '위험 및 대응' 42 75 260 32 22 $navy $true | Out-Null
    Add-Text $s3 (Join-Bullets $spec.risks) 42 130 511 390 12 $dark $false | Out-Null
    $nextBox = $s3.Shapes.AddShape(1, 42, 565, 511, 150)
    $nextBox.Fill.ForeColor.RGB = $light
    $nextBox.Line.Visible = 0
    Add-Text $s3 '다음 회의 / 승인 일정' 64 592 260 28 15 $navy $true | Out-Null
    Add-Text $s3 (Join-Bullets $spec.nextMeeting) 64 638 455 52 12 $dark $false | Out-Null
    Add-Text $s3 '자동 생성 결과는 원천 자료와 대조 후 책임자에게 제출합니다.' 42 783 511 20 9 $blue $true | Out-Null

    $presentation.SaveAs($tempPath, 24)
    $presentation.Close()
    $presentation = $null
    $verify = $ppt.Presentations.Open($tempPath, -1, 0, 0)
    if ($verify.Slides.Count -ne 3) { throw '재열기 검증 실패: 슬라이드 수가 3이 아닙니다.' }
    if ([Math]::Abs($verify.PageSetup.SlideWidth - 595.28) -gt 1 -or [Math]::Abs($verify.PageSetup.SlideHeight - 841.89) -gt 1) { throw '재열기 검증 실패: A4 세로 크기가 아닙니다.' }
    foreach ($slide in $verify.Slides) {
        foreach ($shape in $slide.Shapes) {
            if ($shape.HasTextFrame -and $shape.TextFrame.HasText -and [string]$shape.TextFrame.TextRange.Font.Name -ne $font) {
                throw "FONT_MISMATCH: $($shape.TextFrame.TextRange.Font.Name)"
            }
            if ($shape.HasTable) {
                for ($rowIndex=1; $rowIndex -le $shape.Table.Rows.Count; $rowIndex++) {
                    for ($columnIndex=1; $columnIndex -le $shape.Table.Columns.Count; $columnIndex++) {
                        $cellFont = [string]$shape.Table.Cell($rowIndex,$columnIndex).Shape.TextFrame.TextRange.Font.Name
                        if ($cellFont -ne $font) { throw "FONT_MISMATCH: $cellFont" }
                    }
                }
            }
        }
    }
    $verify.Close()
    $verify = $null
    Move-Item -LiteralPath $tempPath -Destination $OutputPath -Force
    Write-Output $OutputPath
}
finally {
    if ($verify) { try { $verify.Close() } catch {} }
    if ($presentation) { try { $presentation.Close() } catch {} }
    if ($ppt -and $powerPointOwned) { try { $ppt.Quit() } catch {} }
    foreach ($obj in @($verify,$presentation,$ppt)) { if ($obj) { [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($obj) } }
    [GC]::Collect(); [GC]::WaitForPendingFinalizers()
    if (Test-Path -LiteralPath $tempPath) { Remove-Item -LiteralPath $tempPath -Force -ErrorAction SilentlyContinue }
}
