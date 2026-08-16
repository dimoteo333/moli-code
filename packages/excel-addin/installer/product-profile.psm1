Set-StrictMode -Version Latest

$script:RequiredIconFields = @(
    'app16',
    'app32',
    'app64',
    'app80',
    'ribbon16',
    'ribbon32',
    'ribbon80'
)
$script:AccountingReportId = 'accounting-report'
$script:AccountingReportAgentName = 'global-accounting-report'
$script:AccountingToolAllowlist = @(
    'mcp__excel__excel_get_workbook_overview',
    'mcp__excel__excel_read_range',
    'mcp__excel__excel_find',
    'mcp__excel__excel_get_selection',
    'mcp__excel__excel_add_worksheet',
    'mcp__excel__excel_write_range',
    'mcp__excel__excel_set_formulas',
    'mcp__excel__excel_format_range'
)

function Test-MoliProperty {
    param(
        [Parameter(Mandatory = $true)]$Object,
        [Parameter(Mandatory = $true)][string]$Name
    )

    if ($null -eq $Object) {
        return $false
    }
    if ($Object -is [System.Collections.IDictionary]) {
        return $Object.Keys -ccontains $Name
    }
    return $null -ne $Object.PSObject.Properties[$Name]
}

function Get-MoliRequiredProperty {
    param(
        [Parameter(Mandatory = $true)]$Object,
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$Context
    )

    if (-not (Test-MoliProperty -Object $Object -Name $Name)) {
        throw "Invalid product profile catalog: $Context.$Name is required."
    }
    if ($Object -is [System.Collections.IDictionary]) {
        return ,$Object[$Name]
    }
    return ,$Object.$Name
}

function Assert-MoliNonEmptyString {
    param(
        [Parameter(Mandatory = $false)]$Value,
        [Parameter(Mandatory = $true)][string]$Context
    )

    if ($Value -isnot [string] -or [string]::IsNullOrWhiteSpace($Value)) {
        throw "Invalid product profile catalog: $Context must be a non-empty string."
    }
}

function Get-MoliRequiredArray {
    param(
        [Parameter(Mandatory = $true)]$Object,
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$Context,
        [switch]$NonEmpty
    )

    $value = Get-MoliRequiredProperty -Object $Object -Name $Name -Context $Context
    if ($value -isnot [System.Array]) {
        throw "Invalid product profile catalog: $Context.$Name must be an array."
    }
    if ($NonEmpty -and $value.Count -eq 0) {
        throw "Invalid product profile catalog: $Context.$Name must not be empty."
    }
    return ,$value
}

function Assert-MoliStringArray {
    param(
        [Parameter(Mandatory = $true)][AllowEmptyCollection()][System.Array]$Values,
        [Parameter(Mandatory = $true)][string]$Context,
        [switch]$NonEmpty
    )

    if ($NonEmpty -and $Values.Count -eq 0) {
        throw "Invalid product profile catalog: $Context must not be empty."
    }
    for ($index = 0; $index -lt $Values.Count; $index++) {
        Assert-MoliNonEmptyString -Value $Values[$index] -Context "$Context[$index]"
    }
}

function Assert-MoliUniqueIds {
    param(
        [Parameter(Mandatory = $true)][AllowEmptyCollection()][string[]]$Ids,
        [Parameter(Mandatory = $true)][string]$Kind
    )

    $seen = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::Ordinal)
    foreach ($id in $Ids) {
        if (-not $seen.Add($id)) {
            throw "Invalid product profile catalog: duplicate $Kind ID `"$id`"."
        }
    }
}

function Assert-MoliUniqueAgentNames {
    param(
        [Parameter(Mandatory = $true)][AllowEmptyCollection()][string[]]$Names
    )

    $seen = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::Ordinal)
    foreach ($name in $Names) {
        if (-not $seen.Add($name)) {
            throw "Invalid product profile catalog: duplicate Global agent name `"$name`"."
        }
    }
}

function Assert-MoliRelativeIconPath {
    param(
        [Parameter(Mandatory = $false)]$Value,
        [Parameter(Mandatory = $true)][string]$Context
    )

    Assert-MoliNonEmptyString -Value $Value -Context $Context
    $isSafe = $Value -cmatch '^assets/(?:[A-Za-z0-9][A-Za-z0-9._-]*)(?:/[A-Za-z0-9][A-Za-z0-9._-]*)*$'
    if (-not $isSafe) {
        throw "Invalid product profile catalog: $Context must be a safe normalized relative icon path under assets/."
    }
}

function Assert-MoliAccountingToolAllowlist {
    param(
        [Parameter(Mandatory = $true)][string]$ToolId,
        [Parameter(Mandatory = $true)][AllowEmptyCollection()][System.Array]$Tools
    )

    if ($ToolId -cne $script:AccountingReportId) {
        return
    }
    if ($Tools.Count -ne $script:AccountingToolAllowlist.Count) {
        throw 'Invalid product profile catalog: accounting-report tools must exactly match the approved Excel allowlist in order.'
    }
    for ($index = 0; $index -lt $Tools.Count; $index++) {
        if ($Tools[$index] -cne $script:AccountingToolAllowlist[$index]) {
            throw 'Invalid product profile catalog: accounting-report tools must exactly match the approved Excel allowlist in order.'
        }
    }
}

function Test-MoliJsonObject {
    param([Parameter(Mandatory = $false)]$Value)

    return $Value -is [System.Collections.IDictionary] -or
        $Value -is [System.Management.Automation.PSCustomObject]
}

function Test-MoliJsonNumber {
    param([Parameter(Mandatory = $false)]$Value)

    return $Value -is [byte] -or
        $Value -is [sbyte] -or
        $Value -is [int16] -or
        $Value -is [uint16] -or
        $Value -is [int32] -or
        $Value -is [uint32] -or
        $Value -is [int64] -or
        $Value -is [uint64] -or
        $Value -is [single] -or
        $Value -is [double] -or
        $Value -is [decimal]
}

function Assert-MoliOptionalObjectSettings {
    param(
        [Parameter(Mandatory = $true)]$Agent,
        [Parameter(Mandatory = $true)][string]$AgentContext
    )

    if (Test-MoliProperty -Object $Agent -Name 'modelConfig') {
        $modelConfig = $Agent.modelConfig
        if (-not (Test-MoliJsonObject -Value $modelConfig)) {
            throw "Invalid product profile catalog: $AgentContext.modelConfig must be an object."
        }
        if (Test-MoliProperty -Object $modelConfig -Name 'model') {
            if ($modelConfig.model -isnot [string]) {
                throw "Invalid product profile catalog: $AgentContext.modelConfig.model must be a string."
            }
        }
        foreach ($numericName in @('temp', 'top_p')) {
            if (Test-MoliProperty -Object $modelConfig -Name $numericName) {
                $numericValue = $modelConfig.$numericName
                if (-not (Test-MoliJsonNumber -Value $numericValue)) {
                    throw "Invalid product profile catalog: $AgentContext.modelConfig.$numericName must be numeric."
                }
            }
        }
    }

    if (Test-MoliProperty -Object $Agent -Name 'runConfig') {
        $runConfig = $Agent.runConfig
        if (-not (Test-MoliJsonObject -Value $runConfig)) {
            throw "Invalid product profile catalog: $AgentContext.runConfig must be an object."
        }
        foreach ($numericName in @('max_time_minutes', 'max_turns')) {
            if (Test-MoliProperty -Object $runConfig -Name $numericName) {
                $numericValue = $runConfig.$numericName
                if (-not (Test-MoliJsonNumber -Value $numericValue)) {
                    throw "Invalid product profile catalog: $AgentContext.runConfig.$numericName must be numeric."
                }
            }
        }
    }
}

function Get-MoliProductProfileCatalog {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$CatalogPath
    )

    if (-not (Test-Path -LiteralPath $CatalogPath -PathType Leaf)) {
        throw "Unable to load product profile catalog: $CatalogPath"
    }

    try {
        Add-Type -AssemblyName System.Web.Extensions
        $serializer = New-Object System.Web.Script.Serialization.JavaScriptSerializer
        $catalogJson = Get-Content -LiteralPath $CatalogPath -Raw -Encoding UTF8
        $catalog = $serializer.DeserializeObject($catalogJson)
    } catch {
        throw "Unable to load product profile catalog: $($_.Exception.Message)"
    }

    $schemaVersion = Get-MoliRequiredProperty -Object $catalog -Name 'schemaVersion' -Context 'catalog'
    if ($schemaVersion -ne 1 -or $schemaVersion -is [string]) {
        throw 'Invalid product profile catalog: schemaVersion must be 1.'
    }

    [System.Array]$editions = Get-MoliRequiredArray -Object $catalog -Name 'editions' -Context 'catalog'
    [System.Array]$globalTools = Get-MoliRequiredArray -Object $catalog -Name 'globalTools' -Context 'catalog'

    $editionIds = @()
    for ($editionIndex = 0; $editionIndex -lt $editions.Count; $editionIndex++) {
        $edition = $editions[$editionIndex]
        $editionContext = "editions[$editionIndex]"
        foreach ($name in @('id', 'menuLabel', 'displayName', 'description')) {
            $value = Get-MoliRequiredProperty -Object $edition -Name $name -Context $editionContext
            Assert-MoliNonEmptyString -Value $value -Context "$editionContext.$name"
        }
        $editionIds += $edition.id

        $icons = Get-MoliRequiredProperty -Object $edition -Name 'icons' -Context $editionContext
        if ($null -eq $icons -or $icons -is [string] -or $icons -is [System.Array]) {
            throw "Invalid product profile catalog: $editionContext.icons must be an object."
        }
        foreach ($iconName in $script:RequiredIconFields) {
            $iconPath = Get-MoliRequiredProperty -Object $icons -Name $iconName -Context "$editionContext.icons"
            Assert-MoliRelativeIconPath -Value $iconPath -Context "$editionContext.icons.$iconName"
        }

        [System.Array]$defaultGlobalTools = Get-MoliRequiredArray -Object $edition -Name 'defaultGlobalTools' -Context $editionContext
        Assert-MoliStringArray -Values $defaultGlobalTools -Context "$editionContext.defaultGlobalTools"
    }
    Assert-MoliUniqueIds -Ids $editionIds -Kind 'edition'

    $globalToolIds = @()
    $globalAgentNames = @()
    for ($toolIndex = 0; $toolIndex -lt $globalTools.Count; $toolIndex++) {
        $globalTool = $globalTools[$toolIndex]
        $toolContext = "globalTools[$toolIndex]"
        $toolId = Get-MoliRequiredProperty -Object $globalTool -Name 'id' -Context $toolContext
        Assert-MoliNonEmptyString -Value $toolId -Context "$toolContext.id"
        $globalToolIds += $toolId

        $agent = Get-MoliRequiredProperty -Object $globalTool -Name 'agent' -Context $toolContext
        if ($null -eq $agent -or $agent -is [string] -or $agent -is [System.Array]) {
            throw "Invalid product profile catalog: $toolContext.agent must be an object."
        }
        foreach ($name in @('name', 'description')) {
            $value = Get-MoliRequiredProperty -Object $agent -Name $name -Context "$toolContext.agent"
            Assert-MoliNonEmptyString -Value $value -Context "$toolContext.agent.$name"
        }
        $agentName = $agent.name
        $globalAgentNames += $agentName
        if ($toolId -ceq $script:AccountingReportId -and $agentName -cne $script:AccountingReportAgentName) {
            throw "Invalid product profile catalog: Global tool `"$($script:AccountingReportId)`" must use agent name `"$($script:AccountingReportAgentName)`"."
        }
        if ($toolId -cne $script:AccountingReportId -and $agentName -ceq $script:AccountingReportAgentName) {
            throw "Invalid product profile catalog: agent name `"$($script:AccountingReportAgentName)`" is reserved for Global tool `"$($script:AccountingReportId)`"."
        }
        foreach ($name in @('tools', 'systemPromptLines')) {
            [System.Array]$values = Get-MoliRequiredArray -Object $agent -Name $name -Context "$toolContext.agent" -NonEmpty
            Assert-MoliStringArray -Values $values -Context "$toolContext.agent.$name" -NonEmpty
        }
        Assert-MoliAccountingToolAllowlist -ToolId $toolId -Tools $agent.tools
        Assert-MoliOptionalObjectSettings -Agent $agent -AgentContext "$toolContext.agent"
    }
    Assert-MoliUniqueIds -Ids $globalToolIds -Kind 'Global tool'
    Assert-MoliUniqueAgentNames -Names $globalAgentNames

    $knownGlobalToolIds = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::Ordinal)
    foreach ($toolId in $globalToolIds) {
        $null = $knownGlobalToolIds.Add($toolId)
    }
    foreach ($edition in $editions) {
        foreach ($toolId in @($edition.defaultGlobalTools)) {
            if (-not $knownGlobalToolIds.Contains($toolId)) {
                throw "Invalid product profile catalog: edition `"$($edition.id)`" references unknown Global tool `"$toolId`"."
            }
        }
    }

    return $catalog
}

function ConvertTo-MoliXmlAttribute {
    param([Parameter(Mandatory = $true)][string]$Value)

    return [System.Security.SecurityElement]::Escape($Value)
}

function New-MoliManifestXml {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$TemplatePath,
        [Parameter(Mandatory = $true)]$Plan,
        [Parameter(Mandatory = $true)][int]$Port,
        [Parameter(Mandatory = $true)][string]$Version
    )

    if (-not (Test-Path -LiteralPath $TemplatePath -PathType Leaf)) {
        throw "Manifest template was not found: $TemplatePath"
    }
    $template = Get-Content -LiteralPath $TemplatePath -Raw -Encoding UTF8
    $replacements = [ordered]@{
        PORT           = "$Port"
        VERSION        = ConvertTo-MoliXmlAttribute -Value $Version
        DISPLAY_NAME   = ConvertTo-MoliXmlAttribute -Value $Plan.displayName
        DESCRIPTION    = ConvertTo-MoliXmlAttribute -Value $Plan.description
        APP_ICON_32    = $Plan.icons.app32
        APP_ICON_80    = $Plan.icons.app80
        RIBBON_ICON_16 = $Plan.icons.ribbon16
        RIBBON_ICON_32 = $Plan.icons.ribbon32
        RIBBON_ICON_80 = $Plan.icons.ribbon80
    }

    $rendered = $template
    foreach ($name in $replacements.Keys) {
        $placeholder = "{{$name}}"
        if (-not $template.Contains($placeholder)) {
            throw "Manifest template is missing required placeholder $placeholder."
        }
        $rendered = $rendered.Replace($placeholder, [string]$replacements[$name])
    }
    if ($rendered -match '\{\{[^{}]+\}\}') {
        throw "Unresolved manifest placeholder: $($Matches[0])"
    }
    try {
        $null = [xml]$rendered
    } catch {
        throw "Rendered manifest is not valid XML: $($_.Exception.Message)"
    }

    return $rendered
}

function Resolve-MoliInstallPlan {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]$Catalog,
        [Parameter(Mandatory = $true)][string]$Edition,
        [Parameter(Mandatory = $true)][string]$InstallDir,
        [Parameter(Mandatory = $true)][int]$Port,
        [Parameter(Mandatory = $true)][string]$Version,
        [Parameter(Mandatory = $true)][string]$AddinId,
        [Parameter(Mandatory = $true)][string]$ManifestTemplatePath,
        [string]$ProfileCatalogPath = 'profiles/product-profiles.json'
    )

    $editionId = $Edition.ToLowerInvariant()
    $profile = @($Catalog.editions) | Where-Object { $_.id -ceq $editionId } | Select-Object -First 1
    if ($null -eq $profile) {
        throw "Product edition `"$editionId`" is not defined by the product profile catalog."
    }

    $icons = [ordered]@{}
    foreach ($iconName in $script:RequiredIconFields) {
        $icons[$iconName] = $profile.icons.$iconName
    }
    $plan = [pscustomobject][ordered]@{
        edition                 = $editionId
        menuLabel               = $profile.menuLabel
        displayName             = $profile.displayName
        description             = $profile.description
        icons                   = [pscustomobject]$icons
        enabledGlobalTools      = @($profile.defaultGlobalTools)
        profileCatalogPath      = $ProfileCatalogPath
        addinId                 = $AddinId
        installDir              = $InstallDir
        configPath              = Join-Path $InstallDir 'config.json'
        manifestOutputPath      = Join-Path $InstallDir 'manifest\manifest.xml'
        profileCatalogOutputPath = Join-Path $InstallDir $ProfileCatalogPath
    }
    $manifestXml = New-MoliManifestXml -TemplatePath $ManifestTemplatePath -Plan $plan -Port $Port -Version $Version

    return [pscustomobject]@{
        Plan        = $plan
        ManifestXml = $manifestXml
    }
}

function Invoke-MoliFileDeployment {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$PayloadPath,
        [Parameter(Mandatory = $true)]$Plan,
        [Parameter(Mandatory = $true)][string]$RenderedManifest,
        [Parameter(Mandatory = $true)][int]$Port,
        [Parameter(Mandatory = $true)][string]$CertPassphrase
    )

    # Recheck this focused write boundary before its first mutation. The
    # installer supplies a resolved plan; direct callers cannot skip the
    # edition, catalog-path, or rendered-manifest checks.
    if ($Plan.edition -cnotin @('standard', 'global')) {
        throw 'File deployment requires a resolved Standard or Global install plan.'
    }
    if ($Plan.profileCatalogPath -cne 'profiles/product-profiles.json') {
        throw 'File deployment requires profileCatalogPath profiles/product-profiles.json.'
    }
    Assert-MoliNonEmptyString -Value $Plan.installDir -Context 'install plan installDir'
    if ($RenderedManifest -match '\{\{[^{}]+\}\}') {
        throw "Unresolved manifest placeholder: $($Matches[0])"
    }
    try {
        $null = [xml]$RenderedManifest
    } catch {
        throw "Rendered manifest is not valid XML: $($_.Exception.Message)"
    }
    $profileCatalogSource = Join-Path $PayloadPath 'profiles\product-profiles.json'
    if (-not (Test-Path -LiteralPath $profileCatalogSource -PathType Leaf)) {
        throw "Product profile catalog was not found in the payload: $profileCatalogSource"
    }

    $installDir = $Plan.installDir
    foreach ($dir in @($installDir, "$installDir\manifest")) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
    Copy-Item -LiteralPath (Join-Path $PayloadPath 'profiles') -Recurse -Force -Destination $installDir

    $cliPath = $null
    if (Test-Path -LiteralPath "$installDir\cli\moli-code.exe" -PathType Leaf) {
        $cliPath = "$installDir\cli\moli-code.exe"
    } elseif (Test-Path -LiteralPath "$installDir\cli\cli.js" -PathType Leaf) {
        $cliPath = "$installDir\cli\cli.js"
    }
    $config = [ordered]@{
        port               = $Port
        certPfxPath        = 'certs/localhost.pfx'
        certPassphrase     = $CertPassphrase
        cliPath            = $cliPath
        workDir            = 'workspace'
        excludeTools       = @('ShellTool', 'web_fetch', 'web_search')
        logLevel           = 'info'
        edition            = $Plan.edition
        profileCatalogPath = $Plan.profileCatalogPath
        enabledGlobalTools = @($Plan.enabledGlobalTools)
    }
    $config | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $installDir 'config.json') -Encoding UTF8
    Set-Content -LiteralPath (Join-Path $installDir 'manifest\manifest.xml') -Value $RenderedManifest -Encoding UTF8
}

function Get-MoliPostInstallGuidance {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]$Plan,
        [switch]$UseCatalog
    )

    Assert-MoliNonEmptyString -Value $Plan.displayName -Context 'install plan displayName'

    $addInLocation = if ($UseCatalog) {
        '[공유 폴더] 탭'
    } else {
        '[개발자] 탭(또는 목록)'
    }
    $guidance = @(
        '다음 순서로 사용을 시작하세요:',
        '  1. 실행 중인 Excel을 모두 닫고 다시 시작합니다.',
        "  2. 삽입 > 내 추가 기능 > $addInLocation > `"$($Plan.displayName)`" 선택"
    )
    if (-not $UseCatalog) {
        $guidance += '     (개발자 탭이 보이지 않으면 -UseCatalog 옵션으로 다시 설치해 보세요. 관리자 권한 필요)'
    }
    $guidance += "  3. 문제 발생 시 로그: $($Plan.installDir)\logs\sidecar.log"

    return $guidance
}

Export-ModuleMember -Function Get-MoliProductProfileCatalog, Resolve-MoliInstallPlan, Invoke-MoliFileDeployment, Get-MoliPostInstallGuidance
