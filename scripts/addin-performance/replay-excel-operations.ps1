param(
    [Parameter(Mandatory=$true)][string]$OperationsPath,
    [Parameter(Mandatory=$true)][string]$FixturePath,
    [Parameter(Mandatory=$true)][string]$OutputPath,
    [switch]$ValidationOnly
)

$ErrorActionPreference = 'Stop'
$allowedOps = @(
    'get_workbook_overview', 'read_range', 'write_range', 'set_formulas',
    'get_selection', 'clear_range', 'add_worksheet', 'format_range', 'find'
)
$parsedOperations = Get-Content -LiteralPath $OperationsPath -Raw -Encoding UTF8 | ConvertFrom-Json
$operations = @($parsedOperations | ForEach-Object { $_ })
$fixture = Get-Content -LiteralPath $FixturePath -Raw -Encoding UTF8 | ConvertFrom-Json
$outputFull = [IO.Path]::GetFullPath($OutputPath)
$outputDir = [IO.Path]::GetDirectoryName($outputFull)
if (-not (Test-Path -LiteralPath $outputDir)) {
    New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
}

foreach ($operation in $operations) {
    if ($allowedOps -notcontains [string]$operation.op) {
        throw "Unsupported recorded Excel operation: $($operation.op)"
    }
}

$sheetNames = @(
    $operations |
        Where-Object { $_.op -eq 'add_worksheet' } |
        ForEach-Object { [string]$_.args.name } |
        Select-Object -Unique
)
if ($sheetNames.Count -lt 3) {
    throw 'The operation log does not define the three required worksheets.'
}

if ($ValidationOnly) {
    [ordered]@{
        ok = $true
        operationCount = $operations.Count
        worksheetCount = $sheetNames.Count
    } | ConvertTo-Json -Compress
    return
}

function Get-Sheet($workbook, [string]$name) {
    foreach ($sheet in $workbook.Worksheets) {
        if ([string]$sheet.Name -eq $name) { return $sheet }
    }
    return $null
}

function Set-Grid($range, $rows, [bool]$formula) {
    $rowCount = @($rows).Count
    if ($rowCount -eq 0) { return }
    $columnCount = @($rows[0]).Count
    $target = $range.Resize($rowCount, $columnCount)
    for ($r = 0; $r -lt $rowCount; $r++) {
        if (@($rows[$r]).Count -ne $columnCount) {
            throw 'Recorded Excel grid is not rectangular.'
        }
        for ($c = 0; $c -lt $columnCount; $c++) {
            $cell = $target.Cells.Item($r + 1, $c + 1)
            if ($formula) { $cell.Formula = [string]$rows[$r][$c] }
            else {
                $value = $rows[$r][$c]
                if ($null -eq $value) { $cell.ClearContents() }
                elseif ($value -is [bool]) { $cell.Value2 = [bool]$value }
                elseif ($value -is [byte] -or $value -is [int16] -or $value -is [int32] -or $value -is [int64] -or $value -is [single] -or $value -is [double] -or $value -is [decimal]) {
                    $cell.Value2 = [double]$value
                }
                else { $cell.Value2 = [string]$value }
            }
        }
    }
}

function Convert-HexColor([string]$hex) {
    $value = $hex.TrimStart('#')
    if ($value -notmatch '^[0-9A-Fa-f]{6}$') { throw "Invalid color: $hex" }
    $r = [Convert]::ToInt32($value.Substring(0,2), 16)
    $g = [Convert]::ToInt32($value.Substring(2,2), 16)
    $b = [Convert]::ToInt32($value.Substring(4,2), 16)
    return $r + (256 * $g) + (65536 * $b)
}

$excel = $null
$workbook = $null
$verified = $null
try {
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $excel.DisplayAlerts = $false
    $workbook = $excel.Workbooks.Add()

    foreach ($operation in $operations) {
        $args = $operation.args
        switch ([string]$operation.op) {
            'add_worksheet' {
                $name = [string]$args.name
                $sheet = Get-Sheet $workbook $name
                if (-not $sheet) {
                    $sheet = $workbook.Worksheets.Add()
                    $sheet.Name = $name
                }
                $sheet.Activate() | Out-Null
            }
            'write_range' {
                $sheet = Get-Sheet $workbook ([string]$args.sheet)
                if (-not $sheet) { throw "Worksheet not found: $($args.sheet)" }
                Set-Grid $sheet.Range([string]$args.range) @($args.values) $false
            }
            'set_formulas' {
                $sheet = Get-Sheet $workbook ([string]$args.sheet)
                if (-not $sheet) { throw "Worksheet not found: $($args.sheet)" }
                Set-Grid $sheet.Range([string]$args.range) @($args.formulas) $true
            }
            'format_range' {
                $sheet = Get-Sheet $workbook ([string]$args.sheet)
                if (-not $sheet) { throw "Worksheet not found: $($args.sheet)" }
                $range = $sheet.Range([string]$args.range)
                if ($null -ne $args.numberFormat) { $range.NumberFormat = [string]$args.numberFormat }
                if ($null -ne $args.bold) { $range.Font.Bold = [bool]$args.bold }
                if ($null -ne $args.fillColor) { $range.Interior.Color = Convert-HexColor ([string]$args.fillColor) }
                if ($null -ne $args.fontColor) { $range.Font.Color = Convert-HexColor ([string]$args.fontColor) }
            }
            'clear_range' {
                $sheet = Get-Sheet $workbook ([string]$args.sheet)
                if (-not $sheet) { throw "Worksheet not found: $($args.sheet)" }
                $range = $sheet.Range([string]$args.range)
                if ([string]$args.applyTo -eq 'formats') { $range.ClearFormats() }
                elseif ([string]$args.applyTo -eq 'all') { $range.Clear() }
                else { $range.ClearContents() }
            }
            default { }
        }
    }

    foreach ($sheetName in $sheetNames) {
        $sheet = Get-Sheet $workbook $sheetName
        if ($sheet) { $sheet.UsedRange.Columns.AutoFit() | Out-Null }
    }
    $excel.CalculateFull()
    $workbook.SaveAs($outputFull, 51)
    $workbook.Close($false)
    $workbook = $null

    $verified = $excel.Workbooks.Open($outputFull, 0, $true)
    $rawSheet = Get-Sheet $verified $sheetNames[0]
    $weeklySheet = Get-Sheet $verified $sheetNames[1]
    $monthlySheet = Get-Sheet $verified $sheetNames[2]
    if (-not $rawSheet -or -not $weeklySheet -or -not $monthlySheet) {
        throw 'Reopen verification failed: required worksheet missing.'
    }
    $weeklyTotals = @()
    for ($row = 2; $row -le 6; $row++) {
        $weeklyTotals += [long]$weeklySheet.Cells.Item($row, 4).Value2
    }
    $expectedWeekly = @($fixture.weeks | ForEach-Object { [long]$_.total })
    if (($weeklyTotals -join ',') -ne ($expectedWeekly -join ',')) {
        throw 'Reopen verification failed: weekly totals differ from fixture.'
    }
    $monthTotal = [long]$monthlySheet.Cells.Item(2, 2).Value2
    $weeklyGrandTotal = [long]$weeklySheet.Cells.Item(7, 4).Value2
    if ($monthTotal -ne [long]$fixture.monthTotal -or $weeklyGrandTotal -ne [long]$fixture.monthTotal) {
        throw 'Reopen verification failed: monthly or weekly grand total differs.'
    }
    $receiptCount = [int]$rawSheet.UsedRange.Rows.Count - 1
    if ($receiptCount -ne @($fixture.rows).Count) {
        throw 'Reopen verification failed: receipt row count differs.'
    }
    $verified.Close($false)
    $verified = $null

    [ordered]@{
        ok = $true
        outputPath = $outputFull
        operationCount = $operations.Count
        receiptCount = $receiptCount
        weeklyTotals = $weeklyTotals
        weeklyGrandTotal = $weeklyGrandTotal
        monthTotal = $monthTotal
        reopened = $true
        application = 'Microsoft Excel COM'
    } | ConvertTo-Json -Compress
}
finally {
    if ($verified) { try { $verified.Close($false) } catch {} }
    if ($workbook) { try { $workbook.Close($false) } catch {} }
    if ($excel) { try { $excel.Quit() } catch {} }
    foreach ($object in @($verified, $workbook, $excel)) {
        if ($object) { [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($object) }
    }
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}
