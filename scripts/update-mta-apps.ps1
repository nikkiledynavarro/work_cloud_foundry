$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$appsRoot = Join-Path $root "apps"
$mtaPath = Join-Path $root "mta.yaml"

if (-not (Test-Path -LiteralPath $appsRoot)) {
  throw "Apps folder not found: $appsRoot"
}

$apps = Get-ChildItem -LiteralPath $appsRoot -Directory |
  Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName "manifest.json") } |
  Sort-Object Name

if ($apps.Count -eq 0) {
  throw "No apps found under $appsRoot"
}

$lines = @(
  '_schema-version: "3.2"',
  'ID: shiperp-fiori-neo-migration',
  'version: 0.0.1',
  'description: Migrated ShipERP Neo HTML5 applications for SAP BTP Cloud Foundry.',
  '',
  'modules:'
)

foreach ($app in $apps) {
  $name = $app.Name
  $lines += @(
    "  - name: $name",
    '    type: html5',
    "    path: apps/$name",
    '    build-parameters:',
    '      builder: custom',
    '      commands:',
    '        - npm install',
    '        - npm run build',
    '      build-result: dist',
    '      supported-platforms: []',
    ''
  )
}

$lines += @(
  '  - name: shiperp-fiori-content',
  '    type: com.sap.application.content',
  '    path: .',
  '    requires:',
  '      - name: shiperp-fiori-html5-repo-host',
  '        parameters:',
  '          content-target: true',
  '    build-parameters:',
  '      build-result: resources',
  '      requires:'
)

foreach ($app in $apps) {
  $name = $app.Name
  $lines += @(
    "        - name: $name",
    '          artifacts:',
    "            - $name.zip",
    '          target-path: resources/'
  )
}

$lines += @(
  '',
  '  - name: shiperp-fiori-destination-content',
  '    type: com.sap.application.content',
  '    requires:',
  '      - name: shiperp-fiori-destination',
  '        parameters:',
  '          content-target: true',
  '      - name: shiperp-fiori-html5-repo-host',
  '        parameters:',
  '          service-key:',
  '            name: shiperp-fiori-html5-repo-host-key',
  '      - name: shiperp-fiori-uaa',
  '        parameters:',
  '          service-key:',
  '            name: shiperp-fiori-uaa-key',
  '    parameters:',
  '      content:',
  '        instance:',
  '          destinations:',
  '            - Name: shiperp-fiori-html5-repo-host',
  '              ServiceInstanceName: shiperp-fiori-html5-repo-host',
  '              ServiceKeyName: shiperp-fiori-html5-repo-host-key',
  '              sap.cloud.service: shiperp.fiori',
  '            - Name: shiperp-fiori-uaa',
  '              Authentication: OAuth2UserTokenExchange',
  '              ServiceInstanceName: shiperp-fiori-uaa',
  '              ServiceKeyName: shiperp-fiori-uaa-key',
  '              sap.cloud.service: shiperp.fiori',
  '          existing_destinations_policy: update',
  '    build-parameters:',
  '      no-source: true',
  '',
  'resources:',
  '  - name: shiperp-fiori-html5-repo-host',
  '    type: org.cloudfoundry.managed-service',
  '    parameters:',
  '      service: html5-apps-repo',
  '      service-plan: app-host',
  '',
  '  - name: shiperp-fiori-destination',
  '    type: org.cloudfoundry.managed-service',
  '    parameters:',
  '      service: destination',
  '      service-plan: lite',
  '      config:',
  '        HTML5Runtime_enabled: true',
  '',
  '  - name: shiperp-fiori-uaa',
  '    type: org.cloudfoundry.managed-service',
  '    parameters:',
  '      service: xsuaa',
  '      service-plan: application',
  '      path: ./xs-security.json'
)

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($mtaPath, (($lines -join [Environment]::NewLine) + [Environment]::NewLine), $utf8NoBom)

Write-Output "Updated mta.yaml with $($apps.Count) app module(s):"
$apps | ForEach-Object { Write-Output ("- " + $_.Name) }
