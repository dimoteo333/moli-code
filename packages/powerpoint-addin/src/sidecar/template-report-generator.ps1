param(
    [Parameter(Mandatory=$true)][string]$AllowedRoot,
    [Parameter(Mandatory=$true)][string]$TemplatePath,
    [Parameter(Mandatory=$true)][string]$SpecPath,
    [Parameter(Mandatory=$true)][string]$OutputPath,
    [string]$RunToken = '',
    [string]$ProcessMarkerPath = '',
    [string]$PreexistingPowerPointPids = ''
)

$ErrorActionPreference = 'Stop'
$ppt = $null
$source = $null
$presentation = $null
$verify = $null
$tempPath = $null
$markerPath = $null
$powerPointOwned = $false

Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class MoliPowerPointWindow {
    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
}
'@

function Get-FullPath([string]$Path) {
    return [IO.Path]::GetFullPath($Path)
}

function Test-GeneratorOwnsPowerPointProcess([uint32]$ProcessId, [uint32[]]$PreexistingPids) {
    return -not ($PreexistingPids -contains $ProcessId)
}

function Assert-UnderRoot([string]$Path, [string]$Root) {
    $full = Get-FullPath $Path
    $rootFull = (Get-FullPath $Root).TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
    $prefix = $rootFull + [IO.Path]::DirectorySeparatorChar
    if (-not $full.Equals($rootFull, [StringComparison]::OrdinalIgnoreCase) -and -not $full.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'REPORT_PATH_OUTSIDE_WORKDIR'
    }
    return $full
}

function Resolve-SafeExistingPath([string]$Path, [string]$Root) {
    $full = Assert-UnderRoot $Path $Root
    if (-not (Test-Path -LiteralPath $full)) { throw "REPORT_INPUT_NOT_FOUND:$full" }
    $resolved = [string](Resolve-Path -LiteralPath $full).ProviderPath
    [void](Assert-UnderRoot $resolved $Root)
    return $resolved
}

function Get-ShapeText($Shape) {
    try {
        if ($Shape.HasTextFrame -eq -1 -and $Shape.TextFrame.HasText -eq -1) {
            return ([string]$Shape.TextFrame.TextRange.Text).Trim()
        }
    } catch {}
    return ''
}

function Get-ShapeFont($Shape) {
    try { return [string]$Shape.TextFrame.TextRange.Font.Name } catch { return '' }
}

function Get-ShapeDescriptor($Shape) {
    $text = Get-ShapeText $Shape
    $fontName = Get-ShapeFont $Shape
    $fontSize = 0.0
    $bold = $false
    if ($text) {
        try { $fontSize = [double]$Shape.TextFrame.TextRange.Font.Size } catch {}
        try { $bold = ([int]$Shape.TextFrame.TextRange.Font.Bold -ne 0) } catch {}
        if ($fontName -match 'Bold') { $bold = $true }
    }
    return [PSCustomObject]@{
        Id = [int]$Shape.Id
        Shape = $Shape
        Type = [int]$Shape.Type
        Left = [double]$Shape.Left
        Top = [double]$Shape.Top
        Width = [double]$Shape.Width
        Height = [double]$Shape.Height
        Text = $text
        FontName = $fontName
        FontSize = $fontSize
        Bold = $bold
        HasTable = ($Shape.HasTable -eq -1)
    }
}

function Require-One($Candidates, [string]$Slot) {
    $items = @($Candidates)
    if ($items.Count -eq 0) { throw "TEMPLATE_SLOT_NOT_FOUND:$Slot" }
    if ($items.Count -gt 1) { throw "TEMPLATE_SLOT_AMBIGUOUS:$Slot" }
    return $items[0]
}

function Get-SlotMap($Slide, [double]$SlideWidth, [double]$SlideHeight) {
    $items = @()
    foreach ($shape in $Slide.Shapes) { $items += Get-ShapeDescriptor $shape }
    $textItems = @($items | Where-Object { $_.Text })
    $datePattern = '(^|[^0-9])(?:[12][0-9]{3}[.\-/][0-9]{1,2}[.\-/][0-9]{1,2}|YYYY[.\-/]MM[.\-/]DD)([^0-9]|$)'
    $departmentPattern = '\uBD80|\uD300|\uBCF8\uBD80|\uC0AC\uC5C5\uBD80'
    $headingPattern = '\uC81C\uBAA9|\uAC1C\uC694|\uACB0\uACFC|\uACFC\uC81C|\uB9AC\uC2A4\uD06C|\uC694\uCCAD'

    $date = Require-One @($textItems | Where-Object { $_.Top -lt ($SlideHeight * 0.34) -and $_.Text -match $datePattern }) 'date'
    $departmentCandidates = @($textItems | Where-Object { $_.Top -lt ($SlideHeight * 0.34) -and $_.Text.Length -le 30 -and $_.Text -match $departmentPattern })
    $rightDepartmentCandidates = @($departmentCandidates | Where-Object { ($_.Left + ($_.Width / 2)) -gt ($SlideWidth * 0.62) })
    if ($rightDepartmentCandidates.Count -eq 1) { $department = $rightDepartmentCandidates[0] }
    else { $department = Require-One $departmentCandidates 'department' }

    $titleCandidates = @($textItems | Where-Object {
        $_.Top -lt ($SlideHeight * 0.22) -and $_.Id -ne $date.Id -and $_.Id -ne $department.Id -and $_.Text -notmatch '^[0-9]+$'
    })
    if ($titleCandidates.Count -eq 0) { throw 'TEMPLATE_SLOT_NOT_FOUND:title' }
    $largestSize = ($titleCandidates | Measure-Object -Property FontSize -Maximum).Maximum
    $title = Require-One @($titleCandidates | Where-Object { [Math]::Abs($_.FontSize - $largestSize) -lt 0.01 }) 'title'

    $tables = @($items | Where-Object { $_.HasTable -and $_.Top -gt ($SlideHeight * 0.15) } | Sort-Object Top)
    if ($tables.Count -lt 1) { throw 'TEMPLATE_SLOT_NOT_FOUND:table' }
    $table = $tables[0]

    $headingCandidates = @($textItems | Where-Object {
        $_.Top -gt ($SlideHeight * 0.14) -and $_.Top -lt ($SlideHeight * 0.80) -and
        $_.Text.Length -le 40 -and $_.Text -notmatch '^[0-9]+$' -and
        $_.Id -ne $title.Id -and $_.Id -ne $date.Id -and $_.Id -ne $department.Id -and
        ($_.Bold -or $_.Text -match $headingPattern)
    } | Sort-Object Top)
    $numberAnchors = @($textItems | Where-Object {
        $_.Text -match '^[123]$' -and $_.Top -gt ($SlideHeight * 0.14) -and $_.Top -lt ($SlideHeight * 0.80)
    } | Sort-Object Top)
    $headings = @()
    if ($numberAnchors.Count -eq 3) {
        for ($headingIndex = 0; $headingIndex -lt 3; $headingIndex++) {
            $anchor = $numberAnchors[$headingIndex]
            $verticalTolerance = [Math]::Max(20.0, [double]$anchor.Height)
            $slotCandidates = @($headingCandidates | Where-Object {
                $_.Left -ge ($anchor.Left + $anchor.Width - 2) -and
                [Math]::Abs(($_.Top + ($_.Height / 2)) - ($anchor.Top + ($anchor.Height / 2))) -le $verticalTolerance
            })
            $headings += Require-One $slotCandidates ("section{0}_heading" -f ($headingIndex + 1))
        }
    } else {
        if ($headingCandidates.Count -eq 0) { throw 'TEMPLATE_SLOT_NOT_FOUND:section_headings' }
        if ($headingCandidates.Count -ne 3) { throw 'TEMPLATE_SLOT_AMBIGUOUS:section_headings' }
        $headings = @($headingCandidates | Sort-Object Top)
    }

    $pageNumbers = @($textItems | Where-Object {
        $_.Top -ge ($SlideHeight * 0.90) -and $_.Text.Length -le 8 -and
        [Math]::Abs(($_.Left + ($_.Width / 2)) - ($SlideWidth / 2)) -le ($SlideWidth * 0.12) -and
        $_.Text -match '^(?:[0-9]+|[0-9]+\s*/\s*[0-9]+)$'
    })
    $pageNumber = $null
    if ($pageNumbers.Count -gt 1) { throw 'TEMPLATE_SLOT_NOT_FOUND:page_number' }
    if ($pageNumbers.Count -eq 1) { $pageNumber = $pageNumbers[0] }

    $bodyCandidates = @($textItems | Where-Object {
        -not $_.Bold -and -not $_.HasTable -and $_.Id -ne $date.Id -and $_.Id -ne $department.Id -and
        $_.Id -ne $title.Id -and ($null -eq $pageNumber -or $_.Id -ne $pageNumber.Id)
    })
    $body1 = Require-One @($bodyCandidates | Where-Object {
        $_.Top -gt $headings[0].Top -and $_.Top -lt $headings[1].Top
    } | Sort-Object Top) 'section1_body'
    $body3 = Require-One @($bodyCandidates | Where-Object {
        $_.Top -gt $headings[2].Top -and $_.Top -lt ($SlideHeight * 0.90)
    } | Sort-Object Top) 'section3_body'
    $middleBodies = @($bodyCandidates | Where-Object {
        $_.Top -gt $headings[1].Top -and $_.Top -lt $headings[2].Top
    } | Sort-Object Top)

    return [PSCustomObject]@{
        Title = $title; Date = $date; Department = $department; Table = $table
        Heading1 = $headings[0]; Heading2 = $headings[1]; Heading3 = $headings[2]
        Body1 = $body1; Body3 = $body3; MiddleBodies = $middleBodies; PageNumber = $pageNumber
    }
}

function Set-PreservedText($Descriptor, [string]$Text) {
    $range = $Descriptor.Shape.TextFrame.TextRange
    $fontName = [string]$range.Font.Name
    $farEastName = [string]$range.Font.NameFarEast
    $fontSize = [double]$range.Font.Size
    $bold = [int]$range.Font.Bold
    $Descriptor.Shape.TextFrame.AutoSize = 0
    try { $Descriptor.Shape.TextFrame2.AutoSize = 0 } catch {}
    $range.Text = $Text
    if ($fontName) { $range.Font.Name = $fontName }
    if ($farEastName) { $range.Font.NameFarEast = $farEastName }
    if ($fontSize -gt 0) { $range.Font.Size = $fontSize }
    $range.Font.Bold = $bold
}

function Join-Bullets($Bullets) {
    $marker = [string][char]0x00B7
    $allBullets = @($Bullets) + @($args)
    return (($allBullets | ForEach-Object { "$marker $_" }) -join "`r`n")
}

function Set-Table($TableDescriptor, $Section) {
    $table = $TableDescriptor.Shape.Table
    if ($table.Columns.Count -ne 4) { throw 'TEMPLATE_SLOT_NOT_FOUND:table_columns' }
    $targetRows = 1 + @($Section.rows).Count
    if ($targetRows -lt 2 -or $targetRows -gt 5) { throw 'REPORT_SPEC_INVALID:table_rows' }
    while ($table.Rows.Count -gt $targetRows) { $table.Rows.Item($table.Rows.Count).Delete() }
    while ($table.Rows.Count -lt $targetRows) { [void]$table.Rows.Add() }
    for ($column = 1; $column -le 4; $column++) {
        $cell = $table.Cell(1, $column).Shape
        $fontName = [string]$cell.TextFrame.TextRange.Font.Name
        $farEastName = [string]$cell.TextFrame.TextRange.Font.NameFarEast
        $fontSize = [double]$cell.TextFrame.TextRange.Font.Size
        $bold = [int]$cell.TextFrame.TextRange.Font.Bold
        $cell.TextFrame.TextRange.Text = [string]$Section.columns[$column - 1]
        if ($fontName) { $cell.TextFrame.TextRange.Font.Name = $fontName }
        if ($farEastName) { $cell.TextFrame.TextRange.Font.NameFarEast = $farEastName }
        if ($fontSize -gt 0) { $cell.TextFrame.TextRange.Font.Size = $fontSize }
        $cell.TextFrame.TextRange.Font.Bold = $bold
    }
    for ($row = 2; $row -le $targetRows; $row++) {
        for ($column = 1; $column -le 4; $column++) {
            $cell = $table.Cell($row, $column).Shape
            $fontName = [string]$cell.TextFrame.TextRange.Font.Name
            $farEastName = [string]$cell.TextFrame.TextRange.Font.NameFarEast
            $fontSize = [double]$cell.TextFrame.TextRange.Font.Size
            $bold = [int]$cell.TextFrame.TextRange.Font.Bold
            $cell.TextFrame.TextRange.Text = [string]$Section.rows[$row - 2][$column - 1]
            if ($fontName) { $cell.TextFrame.TextRange.Font.Name = $fontName }
            if ($farEastName) { $cell.TextFrame.TextRange.Font.NameFarEast = $farEastName }
            if ($fontSize -gt 0) { $cell.TextFrame.TextRange.Font.Size = $fontSize }
            $cell.TextFrame.TextRange.Font.Bold = $bold
        }
    }
}

function Get-AllSlideText($Slide) {
    $parts = @()
    foreach ($shape in $Slide.Shapes) {
        $text = Get-ShapeText $shape
        if ($text) { $parts += $text }
        if ($shape.HasTable -eq -1) {
            for ($row = 1; $row -le $shape.Table.Rows.Count; $row++) {
                for ($column = 1; $column -le $shape.Table.Columns.Count; $column++) {
                    $parts += [string]$shape.Table.Cell($row, $column).Shape.TextFrame.TextRange.Text
                }
            }
        }
    }
    return ($parts -join "`n")
}

$root = Get-FullPath $AllowedRoot
if (-not (Test-Path -LiteralPath $root -PathType Container)) { throw 'REPORT_ALLOWED_ROOT_NOT_FOUND' }
$root = [string](Resolve-Path -LiteralPath $root).ProviderPath
$template = Resolve-SafeExistingPath $TemplatePath $root
$specFile = Resolve-SafeExistingPath $SpecPath $root
$output = Assert-UnderRoot $OutputPath $root
$outputDirectory = [IO.Path]::GetDirectoryName($output)
if (-not (Test-Path -LiteralPath $outputDirectory -PathType Container)) { throw 'REPORT_OUTPUT_DIR_NOT_FOUND' }
$outputDirectory = [string](Resolve-Path -LiteralPath $outputDirectory).ProviderPath
[void](Assert-UnderRoot $outputDirectory $root)
if ([IO.Path]::GetExtension($template) -ne '.pptx') { throw 'REPORT_TEMPLATE_INVALID' }
if ([IO.Path]::GetExtension($output) -ne '.pptx') { throw 'REPORT_OUTPUT_INVALID' }
if (Test-Path -LiteralPath $output) { throw 'REPORT_OUTPUT_ALREADY_EXISTS' }
if (-not $RunToken) { $RunToken = [Guid]::NewGuid().ToString('N') }
if ($RunToken -notmatch '^[A-Za-z0-9-]{1,80}$') { throw 'REPORT_RUN_TOKEN_INVALID' }
if (-not $ProcessMarkerPath) { $ProcessMarkerPath = Join-Path $outputDirectory ($RunToken + '.powerpoint.pid') }
$markerPath = Assert-UnderRoot $ProcessMarkerPath $root
if ([IO.Path]::GetDirectoryName($markerPath) -ne $outputDirectory) { throw 'REPORT_PATH_OUTSIDE_WORKDIR' }
if (Test-Path -LiteralPath $markerPath) { throw 'REPORT_PROCESS_MARKER_EXISTS' }
$tempPath = Join-Path $outputDirectory (([IO.Path]::GetFileNameWithoutExtension($output)) + '.' + $RunToken + '.tmp.pptx')
[void](Assert-UnderRoot $tempPath $root)

$spec = Get-Content -LiteralPath $specFile -Raw -Encoding UTF8 | ConvertFrom-Json
$pages = @($spec.pages)
if ($pages.Count -lt 1 -or $pages.Count -gt 3) { throw 'REPORT_SPEC_INVALID:pages' }
$preexistingPids = @()
if ($PreexistingPowerPointPids) {
    foreach ($pidText in $PreexistingPowerPointPids.Split(',')) {
        [uint32]$parsedPid = 0
        if (-not [uint32]::TryParse($pidText, [ref]$parsedPid) -or $parsedPid -le 0) {
            throw 'REPORT_PREEXISTING_PID_INVALID'
        }
        $preexistingPids += $parsedPid
    }
}

try {
    try {
        $ppt = New-Object -ComObject PowerPoint.Application
        [uint32]$powerPointProcessId = 0
        [void][MoliPowerPointWindow]::GetWindowThreadProcessId([IntPtr]([int64]$ppt.HWND), [ref]$powerPointProcessId)
        if ($powerPointProcessId -le 0) { throw 'REPORT_PROCESS_ATTRIBUTION_FAILED' }
        $powerPointOwned = Test-GeneratorOwnsPowerPointProcess $powerPointProcessId $preexistingPids
        [IO.File]::WriteAllText($markerPath, [string]$powerPointProcessId, [Text.Encoding]::ASCII)
        $source = $ppt.Presentations.Open($template, -1, 0, 0)
    } catch { throw "TEMPLATE_OPEN_FAILED:$($_.Exception.Message)" }
    if ($source.Slides.Count -ne 1) { throw 'TEMPLATE_SLOT_NOT_FOUND:single_source_slide' }
    if ([Math]::Abs([double]$source.PageSetup.SlideWidth - 595.25) -gt 0.5 -or [Math]::Abs([double]$source.PageSetup.SlideHeight - 841.88) -gt 0.5) {
        throw 'TEMPLATE_SLOT_NOT_FOUND:a4_portrait'
    }
    [void](Get-SlotMap $source.Slides.Item(1) $source.PageSetup.SlideWidth $source.PageSetup.SlideHeight)
    try { $source.SaveCopyAs($tempPath, 24) } catch { throw "REPORT_SAVE_FAILED:$($_.Exception.Message)" }
    $source.Close(); $source = $null

    try { $presentation = $ppt.Presentations.Open($tempPath, 0, 0, 0) }
    catch { throw "TEMPLATE_OPEN_FAILED:$($_.Exception.Message)" }
    for ($index = 2; $index -le $pages.Count; $index++) { [void]$presentation.Slides.Item(1).Duplicate() }

    $expectedFonts = @()
    for ($index = 1; $index -le $pages.Count; $index++) {
        $slide = $presentation.Slides.Item($index)
        $slots = Get-SlotMap $slide $presentation.PageSetup.SlideWidth $presentation.PageSetup.SlideHeight
        $page = $pages[$index - 1]
        $expectedFonts += [PSCustomObject]@{
            Title = $slots.Title.FontName; Date = $slots.Date.FontName; Department = $slots.Department.FontName
            Heading1 = $slots.Heading1.FontName; Heading2 = $slots.Heading2.FontName; Heading3 = $slots.Heading3.FontName
            Body1 = $slots.Body1.FontName; Body3 = $slots.Body3.FontName
            TitleSize = $slots.Title.FontSize; DateSize = $slots.Date.FontSize; DepartmentSize = $slots.Department.FontSize
            Heading1Size = $slots.Heading1.FontSize; Heading2Size = $slots.Heading2.FontSize; Heading3Size = $slots.Heading3.FontSize
            Body1Size = $slots.Body1.FontSize; Body3Size = $slots.Body3.FontSize
        }
        $titleText = [string]$spec.title
        if ($null -eq $slots.PageNumber -and $pages.Count -gt 1) { $titleText += " ($index/$($pages.Count))" }
        Set-PreservedText $slots.Title $titleText
        Set-PreservedText $slots.Date ([string]$spec.date)
        Set-PreservedText $slots.Department ([string]$spec.department)
        Set-PreservedText $slots.Heading1 ([string]$page.section1.heading)
        Set-PreservedText $slots.Heading2 ([string]$page.section2.heading)
        Set-PreservedText $slots.Heading3 ([string]$page.section3.heading)
        Set-PreservedText $slots.Body1 (Join-Bullets $page.section1.bullets)
        Set-PreservedText $slots.Body3 (Join-Bullets $page.section3.bullets)
        foreach ($middleBody in @($slots.MiddleBodies)) { Set-PreservedText $middleBody '' }
        if ($null -ne $slots.PageNumber) { Set-PreservedText $slots.PageNumber ([string]$index) }
        Set-Table $slots.Table $page.section2
    }

    try { $presentation.Save() } catch { throw "REPORT_SAVE_FAILED:$($_.Exception.Message)" }
    $presentation.Close(); $presentation = $null
    try { $verify = $ppt.Presentations.Open($tempPath, -1, 0, 0) }
    catch { throw "REPORT_REOPEN_FAILED:$($_.Exception.Message)" }
    if ($verify.Slides.Count -ne $pages.Count) { throw 'REPORT_REOPEN_FAILED:slide_count' }
    $a4 = ([Math]::Abs([double]$verify.PageSetup.SlideWidth - 595.25) -le 0.5 -and [Math]::Abs([double]$verify.PageSetup.SlideHeight - 841.88) -le 0.5)
    if (-not $a4) { throw 'REPORT_REOPEN_FAILED:a4_portrait' }

    $missing = @()
    $offSlide = 0
    $overflow = 0
    for ($index = 1; $index -le $pages.Count; $index++) {
        $slide = $verify.Slides.Item($index)
        $slots = Get-SlotMap $slide $verify.PageSetup.SlideWidth $verify.PageSetup.SlideHeight
        $fonts = $expectedFonts[$index - 1]
        foreach ($role in @('Title','Date','Department','Heading1','Heading2','Heading3','Body1','Body3')) {
            if ((Get-ShapeFont $slots.$role.Shape) -ne $fonts.$role) { throw "FONT_MISMATCH:$role" }
            $sizeRole = $role + 'Size'
            try {
                $actualSize = [double]$slots.$role.Shape.TextFrame.TextRange.Font.Size
                if ($actualSize -lt ([double]$fonts.$sizeRole - 0.01)) { $overflow++ }
            } catch { $overflow++ }
        }
        $allText = Get-AllSlideText $slide
        $page = $pages[$index - 1]
        $required = @([string]$spec.title, [string]$spec.date, [string]$spec.department,
            [string]$page.section1.heading, [string]$page.section2.heading, [string]$page.section3.heading)
        $required += @($page.section1.bullets)
        $required += @($page.section2.columns)
        foreach ($row in @($page.section2.rows)) { $required += @($row) }
        $required += @($page.section3.bullets)
        foreach ($text in $required) { if (-not $allText.Contains([string]$text)) { $missing += "page${index}:$text" } }

        foreach ($shape in $slide.Shapes) {
            if ([double]$shape.Left -lt -0.5 -or [double]$shape.Top -lt -0.5 -or
                ([double]$shape.Left + [double]$shape.Width) -gt ([double]$verify.PageSetup.SlideWidth + 0.5) -or
                ([double]$shape.Top + [double]$shape.Height) -gt ([double]$verify.PageSetup.SlideHeight + 0.5)) { $offSlide++ }
            if ($shape.HasTextFrame -eq -1 -and $shape.TextFrame.HasText -eq -1) {
                try {
                    $usableHeight = [Math]::Max(0, [double]$shape.Height - [double]$shape.TextFrame2.MarginTop - [double]$shape.TextFrame2.MarginBottom)
                    if ([double]$shape.TextFrame2.TextRange.BoundHeight -gt ($usableHeight + 0.5)) { $overflow++ }
                } catch {}
            }
            if ($shape.HasTable -eq -1) {
                for ($rowIndex = 1; $rowIndex -le $shape.Table.Rows.Count; $rowIndex++) {
                    for ($columnIndex = 1; $columnIndex -le $shape.Table.Columns.Count; $columnIndex++) {
                        $cell = $shape.Table.Cell($rowIndex, $columnIndex).Shape
                        try {
                            $cellUsableHeight = [Math]::Max(0, [double]$cell.Height - [double]$cell.TextFrame2.MarginTop - [double]$cell.TextFrame2.MarginBottom)
                            if ([double]$cell.TextFrame2.TextRange.BoundHeight -gt ($cellUsableHeight + 0.5)) { $overflow++ }
                        } catch {}
                    }
                }
            }
        }
    }
    if ($offSlide -gt 0 -or $overflow -gt 0) { throw "REPORT_OVERFLOW:off=$offSlide,overflow=$overflow" }
    if ($missing.Count -gt 0) { throw "REPORT_REOPEN_FAILED:missing_text:$($missing -join ',')" }
    $verify.Close(); $verify = $null
    try { [IO.File]::Move($tempPath, $output) } catch { throw "REPORT_SAVE_FAILED:$($_.Exception.Message)" }
    $tempPath = $null
    [PSCustomObject]@{
        outputPath = $output; reopened = $true; slideCount = $pages.Count; a4 = $a4
        missingRequiredText = @(); offSlideObjects = $offSlide; overflowShapes = $overflow
    } | ConvertTo-Json -Compress
}
finally {
    if ($verify) { try { $verify.Close() } catch {} }
    if ($presentation) { try { $presentation.Close() } catch {} }
    if ($source) { try { $source.Close() } catch {} }
    if ($ppt -and $powerPointOwned) { try { $ppt.Quit() } catch {} }
    foreach ($object in @($verify, $presentation, $source, $ppt)) {
        if ($object) { try { [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($object) } catch {} }
    }
    [GC]::Collect(); [GC]::WaitForPendingFinalizers()
    if ($tempPath -and (Test-Path -LiteralPath $tempPath)) { Remove-Item -LiteralPath $tempPath -Force -ErrorAction SilentlyContinue }
    if ($markerPath -and (Test-Path -LiteralPath $markerPath)) { Remove-Item -LiteralPath $markerPath -Force -ErrorAction SilentlyContinue }
}
