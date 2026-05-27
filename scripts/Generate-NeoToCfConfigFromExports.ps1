param(
  [string]$ExportFolder = ".\\exports\\neo-html5",
  [string]$OutputConfig = ".\\templates\\neo-to-cf-hr7-sls.json",
  [ValidateSet("hr7-sls","rest","all")]
  [string]$Mode = "hr7-sls",
  [switch]$IncludeHr7 = $true,
  [switch]$IncludeSls = $true
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Add-Type -AssemblyName System.Web.Extensions
$jsonSerializer = New-Object System.Web.Script.Serialization.JavaScriptSerializer
$jsonSerializer.MaxJsonLength = 67108864

function Read-JsonMap {
  param([Parameter(Mandatory = $true)][string]$Path)
  return $jsonSerializer.DeserializeObject((Get-Content -Raw -LiteralPath $Path))
}
function Resolve-RepoPath {
  param([Parameter(Mandatory = $true)][string]$Path)
  if ([System.IO.Path]::IsPathRooted($Path)) {
    return [System.IO.Path]::GetFullPath($Path)
  }
  return [System.IO.Path]::GetFullPath((Join-Path $root $Path))
}

function To-SafeAppName {
  param([Parameter(Mandatory = $true)][string]$Value)
  $safe = $Value.ToLowerInvariant()
  if ($safe -notmatch '^[a-z0-9._-]+$') {
    throw "Invalid appName '$Value'. Use only lowercase letters, numbers, dots, underscores, or dashes."
  }
  return $safe
}

function To-SapCloudService {
  param([string]$AppName)
  # Must be unique per HTML5 app to avoid collisions in CF HTML5 App Repo.
  $sanitized = ($AppName -replace '[^A-Za-z0-9]', '').ToLowerInvariant()
  if (-not $sanitized) { throw "Cannot derive sapCloudService from appName '$AppName'." }
  return ("comerpisshiperp" + $sanitized)
}

$resolvedExport = Resolve-RepoPath $ExportFolder
$resolvedOut = Resolve-RepoPath $OutputConfig

if (-not (Test-Path -LiteralPath $resolvedExport)) {
  throw "Export folder not found: $resolvedExport"
}

$zips = Get-ChildItem -LiteralPath $resolvedExport -File -Filter *.zip | Sort-Object Name
if ($zips.Count -eq 0) {
  throw "No ZIP files found in: $resolvedExport"
}

$targets = foreach ($zip in $zips) {
  $name = [System.IO.Path]::GetFileNameWithoutExtension($zip.Name)
  $isHr7 = $name.ToLowerInvariant().Contains("hr7")
  $isSls = $name.ToLowerInvariant().Contains("sls")

  if ($Mode -eq "all") { $zip; continue }
  if ($Mode -eq "rest") {
    if (-not $isHr7 -and -not $isSls) { $zip }
    continue
  }

  # Back-compat: hr7-sls defaults to the existing Include* switches.
  if (($isHr7 -and $IncludeHr7) -or ($isSls -and $IncludeSls)) { $zip }
}

if (-not $targets -or $targets.Count -eq 0) {
  throw "No matching exports found. IncludeHr7=$IncludeHr7 IncludeSls=$IncludeSls"
}

$apps = @()

foreach ($zip in $targets) {
  $appName = To-SafeAppName ([System.IO.Path]::GetFileNameWithoutExtension($zip.Name))
  $temp = Join-Path ([System.IO.Path]::GetTempPath()) ("neo-export-" + [guid]::NewGuid().ToString("N"))
  New-Item -ItemType Directory -Path $temp -Force | Out-Null
  try {
    Expand-Archive -LiteralPath $zip.FullName -DestinationPath $temp -Force

    $manifestPath = Join-Path $temp "manifest.json"
    $neoAppPath = Join-Path $temp "neo-app.json"

    if (-not (Test-Path -LiteralPath $manifestPath)) {
      $nested = Get-ChildItem -LiteralPath $temp -Directory |
        Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName "manifest.json") } |
        Select-Object -First 1
      if ($nested) {
        $manifestPath = Join-Path $nested.FullName "manifest.json"
        $neoAppPath = Join-Path $nested.FullName "neo-app.json"
      }
    }

    $sapAppId = $null
    $title = $null
    $description = $null
    $odataPath = $null
    if (Test-Path -LiteralPath $manifestPath) {
      $m = Read-JsonMap -Path $manifestPath
      $sapApp = $m["sap.app"]
      if ($sapApp) {
        $sapAppId = [string]$sapApp["id"]
        $title = [string]$sapApp["title"]
        $description = [string]$sapApp["description"]
        if ($sapApp.ContainsKey("dataSources")) {
          $firstDsName = @($sapApp["dataSources"].Keys) | Select-Object -First 1
          if ($firstDsName) {
            $odataPath = [string]$sapApp["dataSources"][$firstDsName]["uri"]
          }
        }
      }
    }

    $routesDestinations = @()
    if (Test-Path -LiteralPath $neoAppPath) {
      $neo = Get-Content -Raw -LiteralPath $neoAppPath | ConvertFrom-Json
      foreach ($r in ($neo.routes | Where-Object { $_.target -and $_.target.type -eq "destination" })) {
        if ($r.target.name) { $routesDestinations += [string]$r.target.name }
      }
    }

    $service = To-SapCloudService -AppName $appName
    $semantic = ($appName -replace '[^A-Za-z0-9]', ' ')
    $semantic = ($semantic -split '\\s+' | Where-Object { $_ }) -join ''
    if (-not $semantic) { $semantic = $appName }

    $apps += [ordered]@{
      enabled = $true
      neoZip = $zip.Name
      appName = $appName
      title = if ($title) { $title } else { $appName }
      description = if ($description) { $description } else { "" }
      oldNamespace = $sapAppId
      newNamespace = $sapAppId
      sapCloudService = $service
      semanticObject = $semantic
      action = "display"
      subTitle = ""
      icon = "sap-icon://app"
      destinationName = if ($routesDestinations.Count -gt 0) { $routesDestinations[0] } else { "" }
      odataPath = if ($odataPath) { $odataPath } else { "" }
      routes = @()
    }
  } finally {
    if (Test-Path -LiteralPath $temp) {
      Remove-Item -LiteralPath $temp -Recurse -Force
    }
  }
}

$config = [ordered]@{
  mtaId = if ($Mode -eq "rest") { "shiperp-fiori-neo-migration-rest" } elseif ($Mode -eq "all") { "shiperp-fiori-neo-migration-all" } else { "shiperp-fiori-neo-migration-hr7-sls" }
  mtaDescription = if ($Mode -eq "rest") { "Migrated ShipERP Neo HTML5 apps (excluding HR7 and SLS)." } elseif ($Mode -eq "all") { "Migrated ShipERP Neo HTML5 apps (all exports)." } else { "Migrated ShipERP Neo HTML5 apps connected to HR7 and SLS." }
  ui5Version = "1.125.1"
  defaultDestination = if ($Mode -eq "hr7-sls") { "virtual-hr7-destination" } else { "" }
  apps = $apps
}

$outDir = Split-Path -Parent $resolvedOut
New-Item -ItemType Directory -Path $outDir -Force | Out-Null
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($resolvedOut, (($config | ConvertTo-Json -Depth 50) + [Environment]::NewLine), $utf8NoBom)

Write-Output "Wrote config: $resolvedOut"
Write-Output ("Apps: " + $apps.Count)
