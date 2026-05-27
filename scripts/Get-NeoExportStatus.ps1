param(
  [string]$InventoryPath = ".\neo-html5-app-inventory.md",
  [string]$ExportFolder = ".\exports\neo-html5"
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

$resolvedInventory = Resolve-RepoPath $InventoryPath
$resolvedExportFolder = Resolve-RepoPath $ExportFolder

if (-not (Test-Path -LiteralPath $resolvedInventory)) {
  throw "Inventory file not found: $resolvedInventory"
}
New-Item -ItemType Directory -Path $resolvedExportFolder -Force | Out-Null

$rows = Get-Content -LiteralPath $resolvedInventory |
  Where-Object { $_ -match '^\|\s*(Started|Stopped)\s*\|' } |
  ForEach-Object {
    $parts = $_.Trim("|").Split("|") | ForEach-Object { $_.Trim() }
    [pscustomobject]@{
      State = $parts[0]
      Application = $parts[1]
      ActiveVersion = $parts[2]
    }
  }

$status = foreach ($row in $rows) {
  $zipPath = Join-Path $resolvedExportFolder ($row.Application + ".zip")
  [pscustomobject]@{
    State = $row.State
    Application = $row.Application
    ActiveVersion = $row.ActiveVersion
    ExpectedZip = ($row.Application + ".zip")
    Exported = Test-Path -LiteralPath $zipPath
  }
}

$exported = @($status | Where-Object { $_.Exported }).Count
$missing = @($status | Where-Object { -not $_.Exported }).Count

Write-Output "Neo HTML5 export folder: $resolvedExportFolder"
Write-Output "Exported ZIPs: $exported"
Write-Output "Missing ZIPs: $missing"
Write-Output ""
$status | Sort-Object Exported, Application | Format-Table -AutoSize
