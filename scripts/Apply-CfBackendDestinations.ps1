param(
  [string]$ConfigPath = ".\templates\cf-destinations-from-neo.json",
  [string[]]$DestinationNames = @("virtual-hr7-destination", "virtual-hd6-destination", "virtual-erps4sales-destination", "Northwind"),
  [string[]]$AppNames = @(),
  [Parameter(Mandatory = $true)][string]$User,
  [Parameter(Mandatory = $true)][string]$Password,
  [string]$ServiceKeyName = "backend-destinations-admin-key",
  [switch]$PruneUnreferenced,
  [switch]$WhatIf
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

function Invoke-CfJson {
  param([Parameter(Mandatory = $true)][string[]]$Args)
  $output = & cf @Args 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw ($output -join [Environment]::NewLine)
  }

  $text = $output -join [Environment]::NewLine
  $start = $text.IndexOf("{")
  if ($start -lt 0) {
    throw "No JSON object returned from: cf $($Args -join ' ')"
  }
  return ($text.Substring($start) | ConvertFrom-Json)
}

function Get-Token {
  param([Parameter(Mandatory = $true)]$Credentials)

  $uaa = if ($Credentials.credentials.uaa) { $Credentials.credentials.uaa } else { $Credentials.credentials }
  $pair = "{0}:{1}" -f $uaa.clientid, $uaa.clientsecret
  $basic = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes($pair))

  $response = Invoke-RestMethod `
    -Method Post `
    -Uri ($uaa.url.TrimEnd("/") + "/oauth/token") `
    -Headers @{ Authorization = "Basic $basic" } `
    -ContentType "application/x-www-form-urlencoded" `
    -Body "grant_type=client_credentials"

  return $response.access_token
}

function Ensure-ServiceKey {
  param(
    [Parameter(Mandatory = $true)][string]$ServiceName,
    [Parameter(Mandatory = $true)][string]$KeyName
  )

  $keys = (& cf service-keys $ServiceName 2>&1) -join [Environment]::NewLine
  if ($LASTEXITCODE -ne 0) {
    if ($keys -match "not found") {
      Write-Warning "Skipping missing service instance $ServiceName"
      return $false
    }
    throw $keys
  }
  if ($keys -notmatch [regex]::Escape($KeyName)) {
    if ($WhatIf) {
      Write-Output "Would create service key $KeyName for $ServiceName"
    } else {
      & cf create-service-key $ServiceName $KeyName | Out-Null
      if ($LASTEXITCODE -ne 0) {
        throw "Failed to create service key $KeyName for $ServiceName"
      }
    }
  }
  return $true
}

function Get-AppDestinationUsage {
  $usage = @{}
  Get-ChildItem -LiteralPath (Join-Path $root "apps") -Directory | ForEach-Object {
    if ($AppNames.Count -gt 0 -and $AppNames -notcontains $_.Name) { return }
    $xsAppPath = Join-Path $_.FullName "xs-app.json"
    if (-not (Test-Path -LiteralPath $xsAppPath)) { return }

    try {
      $xsApp = Get-Content -Raw -LiteralPath $xsAppPath | ConvertFrom-Json
      $used = @($xsApp.routes | Where-Object { $_.destination -and ($DestinationNames -contains [string]$_.destination) } | ForEach-Object { [string]$_.destination } | Sort-Object -Unique)
      if ($used.Count -gt 0) {
        $usage[$_.Name] = $used
      }
    } catch {
      Write-Warning "Could not parse $xsAppPath`: $($_.Exception.Message)"
    }
  }
  return $usage
}

$config = Get-Content -Raw -LiteralPath (Resolve-RepoPath $ConfigPath) | ConvertFrom-Json
$AppNames = @($AppNames | ForEach-Object { ([string]$_).Split(",") } | ForEach-Object { $_.Trim() } | Where-Object { $_ })
$destinationByName = @{}
foreach ($destination in $config.destinations) {
  if ($DestinationNames -contains [string]$destination.Name) {
    $destinationByName[[string]$destination.Name] = $destination
  }
}

foreach ($name in $DestinationNames) {
  if (-not $destinationByName.ContainsKey($name)) {
    throw "Destination $name is missing in $ConfigPath"
  }
}

$usageByApp = Get-AppDestinationUsage
if ($usageByApp.Count -eq 0) {
  throw "No apps reference the selected destinations: $($DestinationNames -join ', ')"
}

foreach ($appName in ($usageByApp.Keys | Sort-Object)) {
  $serviceName = "$appName-destination-service"
  $serviceExists = Ensure-ServiceKey -ServiceName $serviceName -KeyName $ServiceKeyName
  if (-not $serviceExists) { continue }

  if ($WhatIf) {
    foreach ($destinationName in $usageByApp[$appName]) {
      Write-Output "Would upsert $destinationName into $serviceName"
    }
    continue
  }

  $serviceKey = Invoke-CfJson -Args @("service-key", $serviceName, $ServiceKeyName)
  $token = Get-Token -Credentials $serviceKey
  $serviceCredentials = if ($serviceKey.credentials.uaa) { $serviceKey.credentials.uaa } else { $serviceKey.credentials }
  $baseUri = $serviceCredentials.uri.TrimEnd("/")

  foreach ($destinationName in $usageByApp[$appName]) {
    $src = $destinationByName[$destinationName]
    $payload = [ordered]@{
      Name = [string]$src.Name
      Type = [string]$src.Type
      URL = [string]$src.URL
      ProxyType = [string]$src.ProxyType
      Authentication = [string]$src.Authentication
      Description = "Migrated from Neo destination inventory"
      HTML5DynamicDestination = "true"
      WebIDEEnabled = "true"
      WebIDEUsage = "odata_abap,ui5_execute_abap,dev_abap"
    }

    if ([string]$src.Authentication -eq "BasicAuthentication") {
      $payload["User"] = $User
      $payload["Password"] = $Password
    }

    foreach ($property in $src.AdditionalProperties.PSObject.Properties) {
      if ($property.Value) {
        $payload[$property.Name] = [string]$property.Value
      }
    }

    $json = $payload | ConvertTo-Json -Depth 20
    $headers = @{ Authorization = "Bearer $token" }
    $destinationUri = "$baseUri/destination-configuration/v1/instanceDestinations/$destinationName"
    $collectionUri = "$baseUri/destination-configuration/v1/instanceDestinations"

    try {
      try {
        Invoke-RestMethod -Method Delete -Uri $destinationUri -Headers $headers | Out-Null
      } catch {
        $statusCode = $null
        if ($_.Exception.Response) {
          $statusCode = [int]$_.Exception.Response.StatusCode
        }
        if ($statusCode -ne 404) {
          throw
        }
      }

      Invoke-RestMethod -Method Post -Uri $collectionUri -Headers $headers -ContentType "application/json" -Body $json | Out-Null
      Write-Output "Upserted $destinationName into $serviceName"
    } catch {
      throw "Failed to upsert $destinationName into $serviceName`: $($_.Exception.Message)"
    }
  }

  if ($PruneUnreferenced) {
    $managedNames = @($DestinationNames | Sort-Object -Unique)
    $usedNames = @($usageByApp[$appName] | Sort-Object -Unique)
    $unusedNames = @($managedNames | Where-Object { $usedNames -notcontains $_ })

    foreach ($destinationName in $unusedNames) {
      $destinationUri = "$baseUri/destination-configuration/v1/instanceDestinations/$destinationName"
      if ($WhatIf) {
        Write-Output "Would delete unreferenced $destinationName from $serviceName"
        continue
      }

      try {
        Invoke-RestMethod -Method Delete -Uri $destinationUri -Headers @{ Authorization = "Bearer $token" } | Out-Null
        Write-Output "Deleted unreferenced $destinationName from $serviceName"
      } catch {
        $statusCode = $null
        if ($_.Exception.Response) {
          $statusCode = [int]$_.Exception.Response.StatusCode
        }
        if ($statusCode -ne 404) {
          throw "Failed to delete unreferenced $destinationName from $serviceName`: $($_.Exception.Message)"
        }
      }
    }
  }
}
