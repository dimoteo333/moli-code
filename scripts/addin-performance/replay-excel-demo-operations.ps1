param(
    [Parameter(Mandatory=$true)][string]$AllowedRoot,
    [Parameter(Mandatory=$true)][string]$BaseWorkbook,
    [Parameter(Mandatory=$true)][string]$OperationsPath,
    [Parameter(Mandatory=$true)][string]$OraclePath,
    [Parameter(Mandatory=$true)][string]$OutputWorkbook,
    [Parameter(Mandatory=$true)][string]$VerificationPath,
    [int]$RunIndex = 0,
    [switch]$ValidationOnly
)

$ErrorActionPreference = 'Stop'
$comparison = [StringComparison]::OrdinalIgnoreCase
$directorySeparators = [char[]]@([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)

function Assert-AbsolutePath([string]$path, [string]$label) {
    if (-not [IO.Path]::IsPathRooted($path) -or $path -match '^[A-Za-z]:[^\\/]') {
        throw "ABSOLUTE_PATH_REQUIRED:$label"
    }
    return [IO.Path]::GetFullPath($path)
}

function Resolve-InputFile([string]$path, [string]$label) {
    $fullPath = Assert-AbsolutePath $path $label
    if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
        throw "INPUT_FILE_NOT_FOUND:$label"
    }
    return (Resolve-Path -LiteralPath $fullPath).ProviderPath
}

function Test-PathEqual([string]$left, [string]$right) {
    return [string]::Equals($left, $right, $comparison)
}

function Assert-StrictlyContained([string]$path, [string]$root) {
    $rootPrefix = $root.TrimEnd($directorySeparators) + [IO.Path]::DirectorySeparatorChar
    if (-not $path.StartsWith($rootPrefix, $comparison)) {
        throw "OUTPUT_OUTSIDE_ALLOWED_ROOT:$path"
    }
}

function Assert-NoOutputReparsePoint([string]$path, [string]$root) {
    $rootPrefix = $root.TrimEnd($directorySeparators) + [IO.Path]::DirectorySeparatorChar
    $current = $path
    while ($current -and ((Test-PathEqual $current $root) -or $current.StartsWith($rootPrefix, $comparison))) {
        if (Test-Path -LiteralPath $current) {
            $item = Get-Item -LiteralPath $current -Force
            if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
                throw "OUTPUT_REPARSE_POINT:$current"
            }
        }
        if (Test-PathEqual $current $root) { break }
        $parent = [IO.Path]::GetDirectoryName($current)
        if ([string]::IsNullOrEmpty($parent) -or (Test-PathEqual $parent $current)) { break }
        $current = $parent
    }
}

$allowedRootFull = Assert-AbsolutePath $AllowedRoot 'AllowedRoot'
if (-not (Test-Path -LiteralPath $allowedRootFull -PathType Container)) {
    throw 'ALLOWED_ROOT_NOT_FOUND'
}
$allowedRootFull = (Resolve-Path -LiteralPath $allowedRootFull).ProviderPath.TrimEnd($directorySeparators)
$driveRoot = [IO.Path]::GetPathRoot($allowedRootFull).TrimEnd($directorySeparators)
$userProfile = [IO.Path]::GetFullPath([Environment]::GetFolderPath('UserProfile')).TrimEnd($directorySeparators)
if ((Test-PathEqual $allowedRootFull $driveRoot) -or (Test-PathEqual $allowedRootFull $userProfile)) {
    throw "UNSAFE_ALLOWED_ROOT:$allowedRootFull"
}

$baseWorkbookFull = Resolve-InputFile $BaseWorkbook 'BaseWorkbook'
$operationsFull = Resolve-InputFile $OperationsPath 'OperationsPath'
$oracleFull = Resolve-InputFile $OraclePath 'OraclePath'
$outputWorkbookFull = Assert-AbsolutePath $OutputWorkbook 'OutputWorkbook'
$verificationFull = Assert-AbsolutePath $VerificationPath 'VerificationPath'

Assert-StrictlyContained $outputWorkbookFull $allowedRootFull
Assert-StrictlyContained $verificationFull $allowedRootFull
Assert-NoOutputReparsePoint $outputWorkbookFull $allowedRootFull
Assert-NoOutputReparsePoint $verificationFull $allowedRootFull
if (-not [string]::Equals([IO.Path]::GetExtension($outputWorkbookFull), '.xlsx', $comparison)) {
    throw 'OUTPUT_WORKBOOK_MUST_BE_XLSX'
}
if (Test-PathEqual $outputWorkbookFull $verificationFull) {
    throw 'OUTPUT_PATH_COLLISION'
}
foreach ($inputPath in @($baseWorkbookFull, $operationsFull, $oracleFull)) {
    if ((Test-PathEqual $outputWorkbookFull $inputPath) -or (Test-PathEqual $verificationFull $inputPath)) {
        throw 'INPUT_OUTPUT_PATH_COLLISION'
    }
}
foreach ($output in @(
    @{ Label = 'OutputWorkbook'; Path = $outputWorkbookFull },
    @{ Label = 'VerificationPath'; Path = $verificationFull }
)) {
    if (Test-Path -LiteralPath $output.Path) {
        throw "OUTPUT_ALREADY_EXISTS:$($output.Label)"
    }
}

$operationLogJson = Get-Content -LiteralPath $operationsFull -Raw -Encoding UTF8
if (-not $operationLogJson.TrimStart().StartsWith('[')) {
    throw 'INVALID_OPERATION_LOG:top_level_array_required'
}
$parsedRuns = $operationLogJson | ConvertFrom-Json
$runs = @($parsedRuns | ForEach-Object { $_ })
if ($runs.Count -eq 0) {
    throw 'INVALID_OPERATION_LOG:empty'
}

$allowedOperations = @(
    'read_range', 'get_workbook_overview', 'write_range', 'set_formulas',
    'format_range', 'clear_range', 'add_worksheet', 'find', 'get_selection'
)
foreach ($run in $runs) {
    if (-not (($run.runIndex -is [int]) -or ($run.runIndex -is [long])) -or [long]$run.runIndex -lt 1) {
        throw 'INVALID_OPERATION_LOG:invalid_run_index'
    }
    if (-not ($run.kind -is [string]) -or [string]::IsNullOrWhiteSpace([string]$run.kind)) {
        throw "INVALID_OPERATION_LOG:invalid_kind:$($run.runIndex)"
    }
    if (-not ($run.operations -is [array])) {
        throw "INVALID_OPERATION_LOG:operations_array_required:$($run.runIndex)"
    }
    foreach ($operation in @($run.operations | ForEach-Object { $_ })) {
        if ($allowedOperations -notcontains [string]$operation.op) {
            throw "UNSUPPORTED_OPERATION:$($operation.op)"
        }
    }
}

if ($RunIndex -gt 0) {
    $selectedRuns = @($runs | Where-Object { [int]$_.runIndex -eq $RunIndex })
    if ($selectedRuns.Count -ne 1) {
        throw "RUN_INDEX_NOT_FOUND:$RunIndex"
    }
    $selectedRun = $selectedRuns[0]
}
else {
    $selectedRun = $runs[$runs.Count - 1]
}
$operations = @($selectedRun.operations | ForEach-Object { $_ })
$oracle = Get-Content -LiteralPath $oracleFull -Raw -Encoding UTF8 | ConvertFrom-Json
$sourceFormulaOperation = $operations | Where-Object { $_.op -eq 'set_formulas' -and [string]$_.args.range -eq 'J2:J37' } | Select-Object -First 1
$dashboardFormulaOperation = $operations | Where-Object { $_.op -eq 'set_formulas' -and [string]$_.args.range -eq 'B3:B6' } | Select-Object -First 1
if ($null -eq $sourceFormulaOperation -or $null -eq $dashboardFormulaOperation) {
    throw 'REQUIRED_FORMULA_OPERATIONS_MISSING'
}
$sourceSheetName = [string]$sourceFormulaOperation.args.sheet
$dashboardSheetName = [string]$dashboardFormulaOperation.args.sheet

if ($ValidationOnly) {
    [ordered]@{
        ok = $true
        runIndex = [int]$selectedRun.runIndex
        operationCount = $operations.Count
        allowedRoot = $allowedRootFull
    } | ConvertTo-Json -Compress
    return
}

function Release-ComObject($value) {
    if ($null -ne $value -and [Runtime.InteropServices.Marshal]::IsComObject($value)) {
        [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($value)
    }
}

function Get-Worksheet([string]$name) {
    try {
        return $script:workbook.Worksheets.Item($name)
    }
    catch {
        throw "WORKSHEET_NOT_FOUND:$name"
    }
}

function Get-OperationRange($operationArgs) {
    $sheet = Get-Worksheet ([string]$operationArgs.sheet)
    try {
        $range = $sheet.Range([string]$operationArgs.range)
        return ,$range
    }
    finally {
        Release-ComObject $sheet
    }
}

function Set-Grid($operationArgs, [string]$property) {
    $rows = @($operationArgs.$property)
    if ($rows.Count -eq 0) {
        throw "EMPTY_GRID:$property"
    }
    $firstRow = @($rows[0])
    if ($firstRow.Count -eq 0) {
        throw "EMPTY_GRID_ROW:$property"
    }
    $range = Get-OperationRange $operationArgs
    $target = $null
    try {
        $target = $range.Resize($rows.Count, $firstRow.Count)
        for ($rowIndex = 0; $rowIndex -lt $rows.Count; $rowIndex++) {
            $row = @($rows[$rowIndex])
            if ($row.Count -ne $firstRow.Count) {
                throw "NON_RECTANGULAR_GRID:$property"
            }
            for ($columnIndex = 0; $columnIndex -lt $row.Count; $columnIndex++) {
                $cell = $null
                try {
                    $cell = $target.Cells.Item($rowIndex + 1, $columnIndex + 1)
                    if ($property -eq 'formulas') {
                        $cell.Formula = [string]$row[$columnIndex]
                    }
                    else {
                        $value = $row[$columnIndex]
                        if ($null -eq $value) {
                            $cell.ClearContents() | Out-Null
                        }
                        elseif ($value -is [bool]) {
                            $cell.Value2 = [bool]$value
                        }
                        elseif ($value -is [byte] -or $value -is [int16] -or $value -is [int32] -or $value -is [int64] -or $value -is [single] -or $value -is [double] -or $value -is [decimal]) {
                            $cell.Value2 = [double]$value
                        }
                        else {
                            $cell.Value2 = [string]$value
                        }
                    }
                }
                finally {
                    Release-ComObject $cell
                }
            }
        }
    }
    finally {
        Release-ComObject $target
        Release-ComObject $range
    }
}

function Convert-HexColor([string]$hex) {
    $value = $hex.TrimStart('#')
    if ($value -notmatch '^[0-9A-Fa-f]{6}$') {
        throw "INVALID_COLOR:$hex"
    }
    $red = [Convert]::ToInt32($value.Substring(0, 2), 16)
    $green = [Convert]::ToInt32($value.Substring(2, 2), 16)
    $blue = [Convert]::ToInt32($value.Substring(4, 2), 16)
    return $red + (256 * $green) + (65536 * $blue)
}

function Invoke-WriteRange($operationArgs) {
    Set-Grid $operationArgs 'values'
}

function Invoke-SetFormulas($operationArgs) {
    Set-Grid $operationArgs 'formulas'
}

function Invoke-FormatRange($operationArgs) {
    $range = Get-OperationRange $operationArgs
    try {
        if ($null -ne $operationArgs.numberFormat) { $range.NumberFormat = [string]$operationArgs.numberFormat }
        if ($null -ne $operationArgs.bold) { $range.Font.Bold = [bool]$operationArgs.bold }
        if ($null -ne $operationArgs.fillColor) { $range.Interior.Color = Convert-HexColor ([string]$operationArgs.fillColor) }
        if ($null -ne $operationArgs.fontColor) { $range.Font.Color = Convert-HexColor ([string]$operationArgs.fontColor) }
    }
    finally {
        Release-ComObject $range
    }
}

function Invoke-ClearRange($operationArgs) {
    $range = Get-OperationRange $operationArgs
    try {
        switch ([string]$operationArgs.applyTo) {
            'formats' { $range.ClearFormats() | Out-Null }
            'all' { $range.Clear() | Out-Null }
            default { $range.ClearContents() | Out-Null }
        }
    }
    finally {
        Release-ComObject $range
    }
}

function Invoke-AddWorksheet($operationArgs) {
    $name = [string]$operationArgs.name
    if ([string]::IsNullOrWhiteSpace($name)) {
        throw 'WORKSHEET_NAME_REQUIRED'
    }
    $worksheets = $null
    $sheet = $null
    try {
        $worksheets = $script:workbook.Worksheets
        try {
            $sheet = $worksheets.Item($name)
            throw "WORKSHEET_ALREADY_EXISTS:$name"
        }
        catch {
            if ($_.Exception.Message -like 'WORKSHEET_ALREADY_EXISTS:*') { throw }
        }
        $sheet = $worksheets.Add()
        $sheet.Name = $name
    }
    finally {
        Release-ComObject $sheet
        Release-ComObject $worksheets
    }
}

function Get-FormulaCount($range) {
    $count = 0
    for ($row = 1; $row -le [int]$range.Rows.Count; $row++) {
        for ($column = 1; $column -le [int]$range.Columns.Count; $column++) {
            $cell = $null
            try {
                $cell = $range.Cells.Item($row, $column)
                if ([bool]$cell.HasFormula) { $count++ }
            }
            finally {
                Release-ComObject $cell
            }
        }
    }
    return $count
}

function Get-FormulaErrorCount($verifiedWorkbook) {
    $xlCellTypeFormulas = -4123
    $xlErrors = 16
    $xlNoCellsFound = -2146827284
    $errorCount = 0
    foreach ($sheet in $verifiedWorkbook.Worksheets) {
        $usedRange = $null
        $errorCells = $null
        try {
            $usedRange = $sheet.UsedRange
            try {
                $errorCells = $usedRange.SpecialCells($xlCellTypeFormulas, $xlErrors)
                $errorCount += [int]$errorCells.Count
            }
            catch {
                if (-not ($_.Exception -is [Runtime.InteropServices.COMException]) -or $_.Exception.HResult -ne $xlNoCellsFound) {
                    throw
                }
            }
        }
        finally {
            Release-ComObject $errorCells
            Release-ComObject $usedRange
        }
    }
    return $errorCount
}

function Assert-NumericEqual($actual, $expected, [string]$label) {
    if ([decimal]$actual -ne [decimal]$expected) {
        throw "ORACLE_MISMATCH:$label"
    }
}

$outputDirectory = [IO.Path]::GetDirectoryName($outputWorkbookFull)
$verificationDirectory = [IO.Path]::GetDirectoryName($verificationFull)
foreach ($directory in @($outputDirectory, $verificationDirectory | Select-Object -Unique)) {
    if (-not (Test-Path -LiteralPath $directory)) {
        New-Item -ItemType Directory -Force -Path $directory | Out-Null
    }
}

$excel = $null
$script:workbook = $null
$verifiedWorkbook = $null
$sourceSheet = $null
$dashboardSheet = $null
try {
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $excel.DisplayAlerts = $false
    $script:workbook = $excel.Workbooks.Open($baseWorkbookFull, 0, $false)

    foreach ($operation in $operations) {
        switch ([string]$operation.op) {
            'read_range' { }
            'get_workbook_overview' { }
            'write_range' { Invoke-WriteRange $operation.args }
            'set_formulas' { Invoke-SetFormulas $operation.args }
            'format_range' { Invoke-FormatRange $operation.args }
            'clear_range' { Invoke-ClearRange $operation.args }
            'add_worksheet' { Invoke-AddWorksheet $operation.args }
            'find' { }
            'get_selection' { }
            default { throw "UNSUPPORTED_OPERATION:$($operation.op)" }
        }
    }

    $excel.CalculateFullRebuild()
    $script:workbook.SaveAs($outputWorkbookFull, 51)
    $script:workbook.Close($false)
    Release-ComObject $script:workbook
    $script:workbook = $null

    $verifiedWorkbook = $excel.Workbooks.Open($outputWorkbookFull, 0, $true)
    $sourceSheet = $verifiedWorkbook.Worksheets.Item($sourceSheetName)
    $dashboardSheet = $verifiedWorkbook.Worksheets.Item($dashboardSheetName)

    $rows = [int]$sourceSheet.UsedRange.Rows.Count - 1
    if ($rows -ne 36) { throw "ROW_COUNT_MISMATCH:$rows" }

    $resultRange = $sourceSheet.Range('J2:J37')
    $summaryKpiRange = $dashboardSheet.Range('B3:B6')
    $summaryDepartmentRange = $dashboardSheet.Range('B10:C13')
    try {
        $resultFormulaCount = Get-FormulaCount $resultRange
        $summaryKpiFormulaCount = Get-FormulaCount $summaryKpiRange
        $summaryDepartmentFormulaCount = Get-FormulaCount $summaryDepartmentRange
        $summaryFormulaCount = $summaryKpiFormulaCount + $summaryDepartmentFormulaCount
        if ($resultFormulaCount -ne 36) {
            $missingFormulaCells = @()
            for ($row = 1; $row -le [int]$resultRange.Rows.Count; $row++) {
                for ($column = 1; $column -le [int]$resultRange.Columns.Count; $column++) {
                    $cell = $null
                    try {
                        $cell = $resultRange.Cells.Item($row, $column)
                        if (-not [bool]$cell.HasFormula) {
                            $missingFormulaCells += [string]$cell.Address($false, $false)
                        }
                    }
                    finally {
                        Release-ComObject $cell
                    }
                }
            }
            throw "RESULT_FORMULA_COUNT_MISMATCH:${resultFormulaCount}:$($missingFormulaCells -join ',')"
        }
        if ($summaryFormulaCount -ne 12) { throw "SUMMARY_FORMULA_COUNT_MISMATCH:${summaryFormulaCount}:KPI=${summaryKpiFormulaCount}:DEPARTMENT=${summaryDepartmentFormulaCount}" }
    }
    finally {
        Release-ComObject $summaryDepartmentRange
        Release-ComObject $summaryKpiRange
        Release-ComObject $resultRange
    }

    Assert-NumericEqual $dashboardSheet.Range('B3').Value2 $oracle.totalAmount 'totalAmount'
    Assert-NumericEqual $dashboardSheet.Range('B4').Value2 $oracle.normalCount 'normalCount'
    Assert-NumericEqual $dashboardSheet.Range('B5').Value2 $oracle.exceptionCount 'exceptionCount'
    Assert-NumericEqual $dashboardSheet.Range('B6').Value2 $oracle.exceptionAmount 'exceptionAmount'

    for ($departmentIndex = 0; $departmentIndex -lt 4; $departmentIndex++) {
        $row = $departmentIndex + 10
        $department = [string]$dashboardSheet.Cells.Item($row, 1).Value2
        $expected = $oracle.byDepartment.PSObject.Properties[$department].Value
        if ($null -eq $expected) { throw "ORACLE_DEPARTMENT_MISSING:$row" }
        Assert-NumericEqual $dashboardSheet.Cells.Item($row, 2).Value2 $expected.amount "$department.amount"
        Assert-NumericEqual $dashboardSheet.Cells.Item($row, 3).Value2 $expected.exceptionCount "$department.exceptionCount"
    }

    $chartObjects = $dashboardSheet.ChartObjects()
    $chartObject = $null
    $chart = $null
    $series = $null
    try {
        $chartCount = [int]$chartObjects.Count
        if ($chartCount -ne 1) { throw "CHART_COUNT_MISMATCH:$chartCount" }
        $chartObject = $chartObjects.Item(1)
        $chart = $chartObject.Chart
        $series = $chart.SeriesCollection(1)
        $chartSourceNonblank = $true
        $chartSourceValueCount = 0
        foreach ($value in $series.Values) {
            $chartSourceValueCount++
            if ($null -eq $value -or [string]$value -eq '') {
                $chartSourceNonblank = $false
            }
        }
        if ($chartSourceValueCount -eq 0 -or -not $chartSourceNonblank) {
            throw 'CHART_SOURCE_BLANK'
        }
    }
    finally {
        Release-ComObject $series
        Release-ComObject $chart
        Release-ComObject $chartObject
        Release-ComObject $chartObjects
    }

    $formulaErrors = Get-FormulaErrorCount $verifiedWorkbook
    if ($formulaErrors -ne 0) { throw "FORMULA_ERRORS_FOUND:$formulaErrors" }

    $verification = [ordered]@{
        reopened = $true
        rows = $rows
        exceptionCount = [int]$dashboardSheet.Range('B5').Value2
        chartCount = $chartCount
        formulaErrors = $formulaErrors
        resultFormulaCount = $resultFormulaCount
        summaryFormulaCount = $summaryFormulaCount
        chartSourceNonblank = $chartSourceNonblank
        application = 'Microsoft Excel COM'
        outputWorkbook = $outputWorkbookFull
        runIndex = [int]$selectedRun.runIndex
    }

    $verifiedWorkbook.Close($false)
    Release-ComObject $verifiedWorkbook
    $verifiedWorkbook = $null

    $verificationJson = $verification | ConvertTo-Json -Depth 8
    [IO.File]::WriteAllText($verificationFull, $verificationJson + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
    [ordered]@{
        ok = $true
        outputWorkbook = $outputWorkbookFull
        verificationPath = $verificationFull
        verification = $verification
    } | ConvertTo-Json -Depth 8 -Compress
}
catch {
    throw "REPLAY_FAILED:$($_.Exception.Message):$($_.ScriptStackTrace)"
}
finally {
    Release-ComObject $dashboardSheet
    Release-ComObject $sourceSheet
    if ($verifiedWorkbook) {
        try { $verifiedWorkbook.Close($false) } catch { }
        Release-ComObject $verifiedWorkbook
    }
    if ($script:workbook) {
        try { $script:workbook.Close($false) } catch { }
        Release-ComObject $script:workbook
    }
    if ($excel) {
        try { $excel.Quit() } catch { }
        Release-ComObject $excel
    }
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}
