param(
  [Parameter(Mandatory = $true)]
  [string]$ZipPath,

  [string]$AppName,

  [string]$Ui5Version = "1.125.1"
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
function Write-Utf8NoBom {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path,
    [Parameter(Mandatory = $true)]
    [string]$Content
  )
  [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

$resolvedZip = Resolve-Path -LiteralPath $ZipPath
if (-not $AppName) {
  $AppName = [System.IO.Path]::GetFileNameWithoutExtension($resolvedZip.Path)
}

$safeAppName = $AppName.ToLowerInvariant()
if ($safeAppName -notmatch '^[a-z0-9._-]+$') {
  throw "AppName '$AppName' must contain only lowercase letters, numbers, dots, underscores, or dashes."
}

$appsDir = Join-Path $root "apps"
$appDir = Join-Path $appsDir $safeAppName
$workspaceZip = Join-Path $root ($safeAppName + ".zip")
$workspaceZipFullPath = [System.IO.Path]::GetFullPath($workspaceZip)

New-Item -ItemType Directory -Path $appsDir -Force | Out-Null
if ($resolvedZip.Path -ne $workspaceZipFullPath) {
  Copy-Item -LiteralPath $resolvedZip.Path -Destination $workspaceZip -Force
}

if (Test-Path -LiteralPath $appDir) {
  Remove-Item -LiteralPath $appDir -Recurse -Force
}
New-Item -ItemType Directory -Path $appDir -Force | Out-Null
Expand-Archive -LiteralPath $workspaceZip -DestinationPath $appDir -Force

$manifestPath = Join-Path $appDir "manifest.json"
$neoAppPath = Join-Path $appDir "neo-app.json"
if (-not (Test-Path -LiteralPath $manifestPath)) {
  throw "manifest.json not found in exported app '$safeAppName'."
}
if (-not (Test-Path -LiteralPath $neoAppPath)) {
  throw "neo-app.json not found in exported app '$safeAppName'."
}

$manifestText = Get-Content -Raw -LiteralPath $manifestPath
$neoApp = Get-Content -Raw -LiteralPath $neoAppPath | ConvertFrom-Json

$routes = @()
foreach ($route in $neoApp.routes) {
  if ($route.target.type -ne "destination") {
    continue
  }

  $path = [string]$route.path
  $entryPath = [string]$route.target.entryPath
  $destination = [string]$route.target.name

  if (-not $path.EndsWith("/")) {
    $path = $path + "/"
  }
  if (-not $entryPath.EndsWith("/")) {
    $entryPath = $entryPath + "/"
  }

  $escapedPath = [regex]::Escape($path)
  $routes += [ordered]@{
    source = "^$escapedPath(.*)$"
    target = "$entryPath`$1"
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

$xsApp = [ordered]@{
  welcomeFile = if ($neoApp.welcomeFile) { [string]$neoApp.welcomeFile } else { "/index.html" }
  authenticationMethod = "route"
  routes = $routes
}
Write-Utf8NoBom -Path (Join-Path $appDir "xs-app.json") -Content (($xsApp | ConvertTo-Json -Depth 10) + [Environment]::NewLine)

$libs = @("sap.ui.core")
$libsMatch = [regex]::Match($manifestText, '"libs"\s*:\s*\{(?<libs>.*?)\}\s*\}', [System.Text.RegularExpressions.RegexOptions]::Singleline)
if ($libsMatch.Success) {
  $parsedLibs = [regex]::Matches($libsMatch.Groups["libs"].Value, '"(?<name>[^"]+)"\s*:') | ForEach-Object {
    $_.Groups["name"].Value
  }
  if ($parsedLibs.Count -gt 0) {
    $libs = @($parsedLibs)
  }
}

$ui5Lines = @(
  'specVersion: "3.0"',
  'metadata:',
  "  name: $safeAppName",
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
foreach ($lib in $libs) {
  $ui5Lines += "    - name: $lib"
}
$ui5Lines += @(
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
  '      - "/di.code-validation.core_issues.json"'
)
Write-Utf8NoBom -Path (Join-Path $appDir "ui5.yaml") -Content (($ui5Lines -join [Environment]::NewLine) + [Environment]::NewLine)

$version = "1.0.0"
$versionMatch = [regex]::Match($manifestText, '"applicationVersion"\s*:\s*\{[^}]*"version"\s*:\s*"(?<version>[^"]+)"', [System.Text.RegularExpressions.RegexOptions]::Singleline)
if ($versionMatch.Success) {
  $version = $versionMatch.Groups["version"].Value
}

$package = [ordered]@{
  name = $safeAppName
  version = $version
  private = $true
  scripts = [ordered]@{
    build = "ui5 build --config=ui5.yaml --clean-dest --dest dist"
  }
  devDependencies = [ordered]@{
    "@ui5/cli" = "^3.11.0"
  }
  ui5 = [ordered]@{
    dependencies = @()
  }
}
Write-Utf8NoBom -Path (Join-Path $appDir "package.json") -Content (($package | ConvertTo-Json -Depth 10) + [Environment]::NewLine)

Write-Output "Imported $safeAppName into $appDir"
Write-Output "Destination routes:"
$routes | Where-Object { $_.destination } | ForEach-Object {
  Write-Output ("- " + $_.source + " -> " + $_.destination + ":" + $_.target)
}
