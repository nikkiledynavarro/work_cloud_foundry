param(
  [string]$ConfigPath = ".\templates\neo-to-cf-apps.json",
  [string]$ExportFolder = ".\exports\neo-html5",
  [switch]$Clean,
  [switch]$GenerateMta = $true,
  [switch]$BuildMta
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
Add-Type -AssemblyName System.Web.Extensions
$jsonSerializer = New-Object System.Web.Script.Serialization.JavaScriptSerializer
$jsonSerializer.MaxJsonLength = 67108864

function Resolve-RepoPath {
  param([Parameter(Mandatory = $true)][string]$Path)
  if ([System.IO.Path]::IsPathRooted($Path)) {
    return [System.IO.Path]::GetFullPath($Path)
  }
  return [System.IO.Path]::GetFullPath((Join-Path $root $Path))
}

function Write-Utf8NoBom {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Content
  )
  $parent = Split-Path -Parent $Path
  if ($parent) {
    New-Item -ItemType Directory -Path $parent -Force | Out-Null
  }
  [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

function Set-ObjectProperty {
  param(
    [Parameter(Mandatory = $true)][object]$Object,
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][object]$Value
  )
  if ($Object.PSObject.Properties[$Name]) {
    $Object.$Name = $Value
  } else {
    $Object | Add-Member -NotePropertyName $Name -NotePropertyValue $Value
  }
}

function Read-JsonMap {
  param([Parameter(Mandatory = $true)][string]$Path)
  return $jsonSerializer.DeserializeObject((Get-Content -Raw -LiteralPath $Path))
}

function ConvertTo-JsonText {
  param([Parameter(Mandatory = $true)][object]$Value)
  return $jsonSerializer.Serialize($Value)
}

function Ensure-ObjectProperty {
  param(
    [Parameter(Mandatory = $true)][object]$Object,
    [Parameter(Mandatory = $true)][string]$Name
  )
  if (-not $Object.PSObject.Properties[$Name]) {
    $value = [pscustomobject]@{}
    $Object | Add-Member -NotePropertyName $Name -NotePropertyValue $value
  }
  return $Object.$Name
}

function ConvertTo-SafeName {
  param([Parameter(Mandatory = $true)][string]$Value)
  $safe = $Value.ToLowerInvariant() -replace '[^a-z0-9-]', ''
  if (-not $safe) {
    throw "Cannot create a safe technical name from '$Value'."
  }
  return $safe
}

function Copy-ExportToAppFolder {
  param(
    [Parameter(Mandatory = $true)][string]$ZipPath,
    [Parameter(Mandatory = $true)][string]$AppDir
  )

  $temp = Join-Path ([System.IO.Path]::GetTempPath()) ("neo-html5-" + [guid]::NewGuid().ToString("N"))
  New-Item -ItemType Directory -Path $temp -Force | Out-Null
  try {
    Expand-Archive -LiteralPath $ZipPath -DestinationPath $temp -Force
    $sourceRoot = $temp
    if (-not (Test-Path -LiteralPath (Join-Path $sourceRoot "manifest.json"))) {
      $candidate = Get-ChildItem -LiteralPath $temp -Directory |
        Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName "manifest.json") } |
        Select-Object -First 1
      if ($candidate) {
        $sourceRoot = $candidate.FullName
      }
    }
    if (-not (Test-Path -LiteralPath (Join-Path $sourceRoot "manifest.json"))) {
      throw "manifest.json not found inside $ZipPath."
    }

    New-Item -ItemType Directory -Path $AppDir -Force | Out-Null
    Get-ChildItem -LiteralPath $sourceRoot -Force |
      ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination $AppDir -Recurse -Force
      }
  } finally {
    if (Test-Path -LiteralPath $temp) {
      Remove-Item -LiteralPath $temp -Recurse -Force
    }
  }
}

function Update-AppTextNamespaces {
  param(
    [Parameter(Mandatory = $true)][string]$AppDir,
    [string]$OldNamespace,
    [string]$NewNamespace
  )
  if (-not $OldNamespace -or -not $NewNamespace -or $OldNamespace -eq $NewNamespace) {
    return
  }

  $extensions = @(".json", ".js", ".xml", ".properties", ".html", ".yaml", ".yml")
  Get-ChildItem -LiteralPath $AppDir -Recurse -File |
    Where-Object {
      $extensions -contains $_.Extension.ToLowerInvariant() -and
      $_.FullName -notmatch '\\node_modules\\' -and
      $_.FullName -notmatch '\\dist\\'
    } |
    ForEach-Object {
      $text = Get-Content -Raw -LiteralPath $_.FullName
      $updated = $text.Replace($OldNamespace, $NewNamespace)
      if ($updated -ne $text) {
        Write-Utf8NoBom -Path $_.FullName -Content $updated
      }
    }
}

function Get-Ui5Libraries {
  param([Parameter(Mandatory = $true)]$Manifest)
  $libs = @("sap.ui.core")
  $sapUi5 = $Manifest["sap.ui5"]
  if ($sapUi5 -and $sapUi5.ContainsKey("dependencies") -and $sapUi5["dependencies"].ContainsKey("libs")) {
    $names = @($sapUi5["dependencies"]["libs"].Keys)
    if ($names.Count -gt 0) {
      $libs = $names
    }
  }
  return $libs
}

function New-XsApp {
  param(
    [Parameter(Mandatory = $true)]$AppConfig,
    [string]$NeoAppPath,
    [string]$DefaultDestination
  )

  $routes = @()
  if ($AppConfig.routes) {
    foreach ($route in $AppConfig.routes) {
      $routes += [ordered]@{
        source = [string]$route.source
        target = [string]$route.target
        destination = if ($route.destination) { [string]$route.destination } else { [string]$AppConfig.destinationName }
        authenticationType = "xsuaa"
        csrfProtection = $false
      }
    }
  } elseif (Test-Path -LiteralPath $NeoAppPath) {
    $neoApp = Get-Content -Raw -LiteralPath $NeoAppPath | ConvertFrom-Json
    foreach ($route in $neoApp.routes) {
      if ($route.target.type -ne "destination") {
        continue
      }
      $path = [string]$route.path
      $entryPath = [string]$route.target.entryPath
      if (-not $path.EndsWith("/")) {
        $path = $path + "/"
      }
      if (-not $entryPath.EndsWith("/")) {
        $entryPath = $entryPath + "/"
      }
      $routes += [ordered]@{
        source = "^" + [regex]::Escape($path) + "(.*)$"
        target = "$entryPath`$1"
        destination = [string]$route.target.name
        authenticationType = "xsuaa"
        csrfProtection = $false
      }
    }
  } elseif ($AppConfig.odataPath) {
    $destination = if ($AppConfig.destinationName) { [string]$AppConfig.destinationName } else { $DefaultDestination }
    $routes += [ordered]@{
      source = "^/?sap/opu/odata/(.*)$"
      target = "/sap/opu/odata/`$1"
      destination = $destination
      authenticationType = "xsuaa"
      csrfProtection = $false
    }
  }

  $routes += [ordered]@{
    source = "^(.*)$"
    target = '$1'
    service = "html5-apps-repo-rt"
    authenticationType = "xsuaa"
  }

  return [ordered]@{
    welcomeFile = "/index.html"
    authenticationMethod = "route"
    routes = $routes
  }
}

function Update-Manifest {
  param(
    [Parameter(Mandatory = $true)][string]$ManifestPath,
    [Parameter(Mandatory = $true)]$AppConfig,
    [Parameter(Mandatory = $true)][string]$SapCloudService
  )

  $manifest = Read-JsonMap -Path $ManifestPath
  $sapApp = $manifest["sap.app"]
  if (-not $sapApp) {
    throw "sap.app section not found in $ManifestPath."
  }

  # Allow overriding only the manifest app id without touching code namespaces.
  if ($AppConfig.PSObject.Properties["sapAppId"] -and $AppConfig.sapAppId) {
    $sapApp["id"] = [string]$AppConfig.sapAppId
  } elseif ($AppConfig.newNamespace) {
    $sapApp["id"] = [string]$AppConfig.newNamespace
  }
  if ($AppConfig.title) {
    $sapApp["title"] = [string]$AppConfig.title
  }
  if ($AppConfig.description) {
    $sapApp["description"] = [string]$AppConfig.description
  }

  if ($AppConfig.odataPath -and $sapApp.ContainsKey("dataSources")) {
    $firstDataSourceName = @($sapApp["dataSources"].Keys) | Select-Object -First 1
    if ($firstDataSourceName) {
      $sapApp["dataSources"][$firstDataSourceName]["uri"] = ([string]$AppConfig.odataPath).TrimStart("/")
    }
  }

  if (-not $sapApp.ContainsKey("crossNavigation")) {
    $sapApp["crossNavigation"] = @{}
  }
  if (-not $sapApp["crossNavigation"].ContainsKey("inbounds")) {
    $sapApp["crossNavigation"]["inbounds"] = @{}
  }
  $inbounds = $sapApp["crossNavigation"]["inbounds"]
  $semanticObject = if ($AppConfig.semanticObject) { [string]$AppConfig.semanticObject } else { [string]$AppConfig.appName }
  $action = if ($AppConfig.action) { [string]$AppConfig.action } else { "display" }
  $inboundName = $semanticObject + ($action.Substring(0, 1).ToUpperInvariant() + $action.Substring(1))
  $inbounds[$inboundName] = @{
    "semanticObject" = $semanticObject
    "action" = $action
    "title" = if ($AppConfig.title) { [string]$AppConfig.title } else { [string]$AppConfig.appName }
    "subTitle" = if ($AppConfig.subTitle) { [string]$AppConfig.subTitle } else { "" }
    "icon" = if ($AppConfig.icon) { [string]$AppConfig.icon } else { "sap-icon://app" }
    "signature" = @{
      "parameters" = @{}
      "additionalParameters" = "allowed"
    }
  }

  $manifest["sap.cloud"] = @{
    "public" = $true
    "service" = $SapCloudService
  }

  Write-Utf8NoBom -Path $ManifestPath -Content ((ConvertTo-JsonText -Value $manifest) + [Environment]::NewLine)
  return $manifest
}

function Write-Ui5Yaml {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$AppName,
    [Parameter(Mandatory = $true)][string]$Ui5Version,
    [Parameter(Mandatory = $true)][string[]]$Libraries
  )

  $lines = @(
    'specVersion: "3.0"',
    'metadata:',
    "  name: $AppName",
    'type: application',
    'resources:',
    '  configuration:',
    '    paths:',
    '      webapp: .',
    'framework:',
    '  name: SAPUI5',
    "  version: `"$Ui5Version`"",
    '  libraries:'
  )
  foreach ($lib in $Libraries) {
    $lines += "    - name: $lib"
  }
  $lines += @(
    'builder:',
    '  resources:',
    '    excludes:',
    '      - "/node_modules/**"',
    '      - "/package.json"',
    '      - "/package-lock.json"',
    '      - "/ui5.yaml"',
    '      - "/dist/**"',
    '      - "/test/**"',
    '      - "/localService/**"',
    '      - "/manifest-bundle.zip"',
    '      - "/di.code-validation.core_issues.json"'
  )
  Write-Utf8NoBom -Path $Path -Content (($lines -join [Environment]::NewLine) + [Environment]::NewLine)
}

function Write-PackageJson {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$AppName,
    [Parameter(Mandatory = $true)][string]$Version
  )

  $package = [ordered]@{
    name = $AppName
    version = $Version
    private = $true
    scripts = [ordered]@{
      build = "ui5 build --config=ui5.yaml --clean-dest --dest dist"
      package = "cd dist && bestzip $AppName.zip *"
    }
    devDependencies = [ordered]@{
      "@ui5/cli" = "^3.11.0"
      bestzip = "^2.2.1"
    }
    ui5 = [ordered]@{
      dependencies = @()
    }
  }
  Write-Utf8NoBom -Path $Path -Content (($package | ConvertTo-Json -Depth 20) + [Environment]::NewLine)
}

function Write-XsSecurity {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$XsAppName,
    [Parameter(Mandatory = $true)][string]$Title
  )

  $security = [ordered]@{
    xsappname = $XsAppName
    "tenant-mode" = "dedicated"
    scopes = @(
      [ordered]@{
        name = '$XSAPPNAME.User'
        description = "Access $Title"
      }
    )
    "role-templates" = @(
      [ordered]@{
        name = "User"
        description = "Access $Title"
        "scope-references" = @('$XSAPPNAME.User')
      }
    )
  }
  Write-Utf8NoBom -Path $Path -Content (($security | ConvertTo-Json -Depth 20) + [Environment]::NewLine)
}

function Write-MtaYaml {
  param(
    [Parameter(Mandatory = $true)]$Config,
    [Parameter(Mandatory = $true)][array]$ProcessedApps
  )

  $mtaId = if ($Config.mtaId) { [string]$Config.mtaId } else { "shiperp-fiori-neo-migration" }
  $description = if ($Config.mtaDescription) { [string]$Config.mtaDescription } else { "Migrated Neo HTML5 applications for SAP BTP Cloud Foundry." }
  $lines = @(
    '_schema-version: "3.2"',
    "ID: $mtaId",
    'version: 0.0.1',
    "description: $description",
    '',
    'modules:'
  )

  foreach ($app in $ProcessedApps) {
    $name = $app.AppName
    $lines += @(
      "  - name: $name",
      '    type: html5',
      "    path: apps/$name",
      '    build-parameters:',
      '      builder: custom',
      '      commands:',
      '        - npm install',
      '        - npm run build',
      '        - npm run package',
      '      build-result: dist',
      '      supported-platforms: []',
      ''
    )
  }

  foreach ($app in $ProcessedApps) {
    $name = $app.AppName
    $service = $app.SapCloudService
    $contentDir = "resources/$name"
    $lines += @(
      "  - name: $name-app-content",
      '    type: com.sap.application.content',
      '    path: .',
      '    requires:',
      "      - name: $name-app-front-service",
      '        parameters:',
      '          content-target: true',
      '    build-parameters:',
      "      build-result: $contentDir",
      '      requires:',
      "        - name: $name",
      '          artifacts:',
      "            - $name.zip",
      "          target-path: $contentDir/",
      '',
      "  - name: $name-destination-content",
      '    type: com.sap.application.content',
      '    requires:',
      "      - name: $name-destination-service",
      '        parameters:',
      '          content-target: true',
      "      - name: $name-app-front-service",
      '        parameters:',
      '          service-key:',
      "            name: $name-app-front-service-key",
      "      - name: $name-xsuaa-service",
      '        parameters:',
      '          service-key:',
      "            name: $name-xsuaa-service-key",
      '    parameters:',
      '      content:',
      '        instance:',
      '          destinations:',
      "            - Name: $name-app-front-service",
      "              ServiceInstanceName: $name-app-front-service",
      "              ServiceKeyName: $name-app-front-service-key",
      "              sap.cloud.service: $service",
      "            - Name: $name-xsuaa-service",
      '              Authentication: OAuth2UserTokenExchange',
      "              ServiceInstanceName: $name-xsuaa-service",
      "              ServiceKeyName: $name-xsuaa-service-key",
      "              sap.cloud.service: $service",
      '          existing_destinations_policy: update',
      '    build-parameters:',
      '      no-source: true',
      ''
    )
  }

  $lines += @('resources:')
  foreach ($app in $ProcessedApps) {
    $name = $app.AppName
    $xsSecurityPath = $app.XsSecurityRelativePath.Replace("\", "/")
    $lines += @(
      "  - name: $name-app-front-service",
      '    type: org.cloudfoundry.managed-service',
      '    parameters:',
      '      service: html5-apps-repo',
      '      service-plan: app-host',
      '',
      "  - name: $name-destination-service",
      '    type: org.cloudfoundry.managed-service',
      '    parameters:',
      '      service: destination',
      '      service-plan: lite',
      '      config:',
      '        HTML5Runtime_enabled: true',
      '',
      "  - name: $name-xsuaa-service",
      '    type: org.cloudfoundry.managed-service',
      '    parameters:',
      '      service: xsuaa',
      '      service-plan: application',
      "      path: ./$xsSecurityPath",
      ''
    )
  }

  Write-Utf8NoBom -Path (Join-Path $root "mta.yaml") -Content (($lines -join [Environment]::NewLine) + [Environment]::NewLine)
}

$resolvedConfig = Resolve-RepoPath $ConfigPath
$resolvedExportFolder = Resolve-RepoPath $ExportFolder
if (-not (Test-Path -LiteralPath $resolvedConfig)) {
  throw "Config file not found: $resolvedConfig"
}
if (-not (Test-Path -LiteralPath $resolvedExportFolder)) {
  New-Item -ItemType Directory -Path $resolvedExportFolder -Force | Out-Null
  throw "Export folder was created but has no Neo ZIP exports yet: $resolvedExportFolder"
}

$config = Get-Content -Raw -LiteralPath $resolvedConfig | ConvertFrom-Json
$appsRoot = Join-Path $root "apps"
$securityRoot = Join-Path $root "security"
New-Item -ItemType Directory -Path $appsRoot -Force | Out-Null
New-Item -ItemType Directory -Path $securityRoot -Force | Out-Null

$processedApps = @()
$failedApps = @()
foreach ($appConfig in $config.apps) {
  if ($appConfig.PSObject.Properties["enabled"] -and -not $appConfig.enabled) {
    continue
  }

  $appName = ConvertTo-SafeName ([string]$appConfig.appName)
  $zipName = if ($appConfig.neoZip) { [string]$appConfig.neoZip } else { "$appName.zip" }
  $zipPath = if ([System.IO.Path]::IsPathRooted($zipName)) { $zipName } else { Join-Path $resolvedExportFolder $zipName }

  try {
    if (-not (Test-Path -LiteralPath $zipPath)) {
      throw "Neo export ZIP not found: $zipPath"
    }

    $appDir = Join-Path $appsRoot $appName
    if ((Test-Path -LiteralPath $appDir) -and $Clean) {
      Remove-Item -LiteralPath $appDir -Recurse -Force
    }
    Copy-ExportToAppFolder -ZipPath $zipPath -AppDir $appDir
    Update-AppTextNamespaces -AppDir $appDir -OldNamespace ([string]$appConfig.oldNamespace) -NewNamespace ([string]$appConfig.newNamespace)

    $sapCloudService = if ($appConfig.sapCloudService) { [string]$appConfig.sapCloudService } else { ($appConfig.newNamespace -replace '[^A-Za-z0-9]', '').ToLowerInvariant() }
    $manifestPath = Join-Path $appDir "manifest.json"
    $manifest = Update-Manifest -ManifestPath $manifestPath -AppConfig $appConfig -SapCloudService $sapCloudService

    $version = "1.0.0"
    $sapApp = $manifest["sap.app"]
    if ($sapApp.ContainsKey("applicationVersion") -and $sapApp["applicationVersion"].ContainsKey("version")) {
      $version = [string]$sapApp["applicationVersion"]["version"]
    }

    $xsApp = New-XsApp -AppConfig $appConfig -NeoAppPath (Join-Path $appDir "neo-app.json") -DefaultDestination ([string]$config.defaultDestination)
    Write-Utf8NoBom -Path (Join-Path $appDir "xs-app.json") -Content (($xsApp | ConvertTo-Json -Depth 50) + [Environment]::NewLine)
    Write-Ui5Yaml -Path (Join-Path $appDir "ui5.yaml") -AppName $appName -Ui5Version ([string]$config.ui5Version) -Libraries (Get-Ui5Libraries -Manifest $manifest)
    Write-PackageJson -Path (Join-Path $appDir "package.json") -AppName $appName -Version $version

    $xsSecurityRelativePath = Join-Path "security" "xs-security-$appName.json"
    Write-XsSecurity -Path (Join-Path $root $xsSecurityRelativePath) -XsAppName $sapCloudService -Title ([string]$appConfig.title)

    $processedApps += [pscustomobject]@{
      AppName = $appName
      SapCloudService = $sapCloudService
      XsSecurityRelativePath = $xsSecurityRelativePath
    }
    Write-Output "Prepared $appName from $zipName"
  } catch {
    $failedApps += [pscustomobject]@{
      AppName = $appName
      Zip = $zipName
      Error = $_.Exception.Message
    }
    Write-Warning "Skipping $appName ($zipName): $($_.Exception.Message)"
    continue
  }
}

if ($processedApps.Count -eq 0) {
  throw "No enabled apps found in config: $resolvedConfig"
}

if ($GenerateMta) {
  Write-MtaYaml -Config $config -ProcessedApps $processedApps
  Write-Output "Generated mta.yaml for $($processedApps.Count) app(s)."
}

if ($BuildMta) {
  Push-Location $root
  try {
    npx.cmd mbt build
  } finally {
    Pop-Location
  }
}

if ($failedApps.Count -gt 0) {
  Write-Warning ("Skipped " + $failedApps.Count + " app(s) due to errors: " + (($failedApps | ForEach-Object { $_.AppName }) -join ", "))
}

Write-Output "Done. Export folder: $resolvedExportFolder"
