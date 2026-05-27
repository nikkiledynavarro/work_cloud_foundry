param(
  [string]$ConfigPath = ".\\templates\\neo-to-cf-hr7-sls.json"
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

$p = Resolve-RepoPath $ConfigPath
if (-not (Test-Path -LiteralPath $p)) {
  throw "Config not found: $p"
}

$cfg = Get-Content -Raw -LiteralPath $p | ConvertFrom-Json
foreach ($a in $cfg.apps) {
  $san = ($a.appName -replace '[^A-Za-z0-9]', '').ToLowerInvariant()
  $a.sapCloudService = "comerpisshiperp$san"
}

$cfg.mtaId = "shiperp-fiori-neo-migration-hr7-sls"
$cfg.mtaDescription = "Migrated ShipERP Neo HTML5 apps connected to HR7 and SLS."

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($p, (($cfg | ConvertTo-Json -Depth 60) + [Environment]::NewLine), $utf8NoBom)

$dupes = $cfg.apps | Group-Object sapCloudService | Where-Object { $_.Count -gt 1 }
if ($dupes) {
  throw ("sapCloudService not unique: " + (($dupes | ForEach-Object { $_.Name + '=' + $_.Count }) -join ', '))
}

Write-Output "Updated sapCloudService for $($cfg.apps.Count) apps in $p"
