param(
  [string]$NeoInventoryPath = ".\neo-destination-inventory.md",
  [string]$NeededDestinationsPath = ".\templates\destinations-needed.json",
  [string]$OutputPath = ".\templates\cf-destinations-from-neo.json"
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot

function Resolve-RepoPath {
  param([Parameter(Mandatory = $true)][string]$Path)
  if ([System.IO.Path]::IsPathRooted($Path)) {
    return [System.IO.Path]::GetFullPath($Path)
  }
  return [System.IO.Path]::GetFullPath((Join-Path $root $Path))
}

$inventoryPath = Resolve-RepoPath $NeoInventoryPath
$neededPath = Resolve-RepoPath $NeededDestinationsPath
$outPath = Resolve-RepoPath $OutputPath

if (-not (Test-Path -LiteralPath $inventoryPath)) {
  throw "Neo destination inventory not found: $inventoryPath"
}
if (-not (Test-Path -LiteralPath $neededPath)) {
  throw "Needed destinations file not found: $neededPath"
}

$needed = Get-Content -Raw -LiteralPath $neededPath | ConvertFrom-Json
$neededNames = @($needed.destinationNames)

$rows = @{}
Get-Content -LiteralPath $inventoryPath | ForEach-Object {
  $line = $_.Trim()
  if ($line -notmatch '^\|\s*HTTP\s*\|') { return }

  $cells = $line.Trim('|').Split('|') | ForEach-Object { $_.Trim() }
  if ($cells.Count -lt 5) { return }

  $name = $cells[1]
  $rows[$name] = [pscustomobject]@{
    Type = $cells[0]
    Name = $name
    Authentication = $cells[2]
    ProxyType = $cells[3]
    URL = ($cells[4] -replace '^`|`$', '')
  }
}

$destinations = @()
$missing = @()
foreach ($name in $neededNames) {
  if (-not $rows.ContainsKey($name)) {
    $missing += $name
    continue
  }

  $src = $rows[$name]
  $destination = [ordered]@{
    Name = $src.Name
    Type = $src.Type
    URL = $src.URL
    ProxyType = $src.ProxyType
    Authentication = $src.Authentication
    Description = "Migrated from Neo destination inventory"
    AdditionalProperties = [ordered]@{}
  }

  if ($src.ProxyType -eq "OnPremise") {
    $destination.AdditionalProperties.CloudConnectorLocationId = ""
  }

  if ($src.Authentication -eq "BasicAuthentication") {
    $destination.User = ""
    $destination.Password = ""
    $destination.SecretRequired = $true
  } else {
    $destination.SecretRequired = $false
  }

  $destinations += $destination
}

$result = [ordered]@{
  generatedAt = (Get-Date).ToString("s")
  sourceInventory = $inventoryPath
  notes = @(
    "Secrets cannot be exported back from Neo. Fill User/Password for BasicAuthentication destinations before applying.",
    "Fill CloudConnectorLocationId only if the CF subaccount uses a non-default Cloud Connector location."
  )
  missingFromInventory = $missing
  destinations = $destinations
}

$outDir = Split-Path -Parent $outPath
New-Item -ItemType Directory -Path $outDir -Force | Out-Null
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($outPath, (($result | ConvertTo-Json -Depth 20) + [Environment]::NewLine), $utf8NoBom)

Write-Output "Wrote CF destination template: $outPath"
Write-Output ("Destinations: " + $destinations.Count)
if ($missing.Count -gt 0) {
  Write-Warning ("Missing from Neo inventory: " + ($missing -join ", "))
}
