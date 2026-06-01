# Neo to Cloud Foundry Migration Handoff

Saved: 2026-05-31  
Workspace: `C:\Users\nikki\OneDrive\Desktop\AI\Codex\Work\neo_to_cf`

## Scope

This discussion covered migration of SAP Fiori/UI5 HTML5 applications from the Neo environment to Cloud Foundry, with SAP Business Application Studio (BAS), GitHub, Destination Service, and SAP Build Work Zone considered as parts of the target workflow.

The active Cloud Foundry target is:

```text
API endpoint: https://api.cf.us11.hana.ondemand.com
Org: ERP Integrated Solutions, LLC   dba ShipERP._btp-cf-8qsdli3e
Space: DEV
Subaccount subdomain: btp-cf-8qsdli3e
Subaccount ID: eecc9986-a678-4206-b6b5-4a486cd0a4fe
```

Do not deploy migration resources to the Joule subaccount.

## Repository Setup

Neo exports and Cloud Foundry converted files are maintained separately:

```text
Neo source repository:
https://github.com/nikkiledynavarro/work_neo.git

Cloud Foundry repository:
https://github.com/nikkiledynavarro/work_cloud_foundry.git
```

The Cloud Foundry repository was imported into BAS. The converted source in BAS/Git is intended to match the source deployed to CF.

Recent Cloud Foundry repository commits:

```text
4861ecf Keep migrated app destinations in sync
d1e6afc Remove stale shipping dashboard start URL
6e95582 Add reusable Fiori test approuter
```

## Migrated Not-Done Apps

Only the following nine applications from the Not Done list were adjusted and deployed during the later migration phase:

| Neo App | New Project Name | CF App Name |
| --- | --- | --- |
| `trackshipment` | `TrackShipment` | `trackshipment` |
| `trackshipmentewm` | `TrackShipmentEWM` | `trackshipmentewm` |
| `disputehr7` / `dispute` | `Dispute` | `dispute` |
| `closedelivery` | `closedelivery` | `closedelivery` |
| `freightaudit` | `FreightAudit` | `freightaudit` |
| `saleorder` | `SaleOrder` | `saleorder` |
| `quickpackhr7` | `QuickPackECC` | `quickpackecc` |
| `quickpackewm` | `QuickPackEWM` | `quickpackewm` |
| `shippingdashboardhr7` | `ShippingDashboard` | `shippingdashboard` |

Completed apps were not intentionally changed during this phase.

## CF Service Pattern

Each migrated app uses the expected service pattern:

```text
<app>-app-front-service      html5-apps-repo / app-host
<app>-destination-service    destination / lite
<app>-xsuaa-service          xsuaa / application
```

The app-front service typically has:

```text
1 content deployment credential key
1 declared app-front service key
```

The destination service typically has:

```text
1 content deployment credential key
```

The XSUAA service typically has:

```text
1 declared service key
```

Temporary destination administration keys were removed after destination updates.

## Destination Mapping

The final live backend destination mapping for the nine apps is:

| App | Destinations |
| --- | --- |
| `trackshipment` | `virtual-hd6-destination` |
| `trackshipmentewm` | `virtual-hr7-destination` |
| `dispute` | `virtual-hr7-destination` |
| `closedelivery` | `virtual-hr7-destination` |
| `freightaudit` | `virtual-hd6-destination` |
| `saleorder` | `virtual-hr7-destination` |
| `quickpackecc` | `virtual-hr7-destination` |
| `quickpackewm` | `virtual-hr7-destination` |
| `shippingdashboard` | `Northwind`, `virtual-hr7-destination` |

The validated Cloud Connector URL convention is:

```text
virtual-hr7-destination -> http://virtual-s4hr7.erp-is.com:50000
virtual-hd6-destination -> http://virtual-s4hd6.erp-is.com:8000
Northwind               -> https://services.odata.org
```

The local Cloud Foundry destination template was corrected to use `http://` for HR7 and HD6, matching the live CF destination instances and the existing completed-app convention.

## Runtime Validation

The nine apps were confirmed in the CF HTML5 Application Repository.

Core repository checks passed for every app:

```text
manifest.json -> HTTP 200
Component.js  -> HTTP 200
xs-app.json   -> HTTP 200
```

The following apps do not currently contain `index.html`:

```text
saleorder
quickpackecc
shippingdashboard
```

Their core UI5 component files are present. Work Zone can still launch UI5 components from repository metadata, but these three apps should receive focused launch testing after Work Zone authoring access is available.

Validation reports:

```text
artifacts\notdone-html5-runtime-file-audit.csv
artifacts\notdone-live-destination-audit.csv
artifacts\notdone-live-destination-shape-audit.csv
artifacts\notdone-live-destination-template-audit.csv
```

## Work Zone Status

The SAP Build Work Zone `HTML5 Apps` channel was refreshed successfully. The migrated apps are discoverable in Content Explorer.

Publication is not complete because the signed-in account does not currently expose:

```text
Content Manager Add/Import action
Site Directory Create action
```

This indicates missing Work Zone authoring or administration access. After the required role collection is assigned, the remaining Work Zone tasks are:

1. Refresh the `HTML5 Apps` channel if needed.
2. Import the migrated apps into local content.
3. Assign apps to a role or group.
4. Create or update a site.
5. Publish the site.
6. Launch-test the nine migrated apps.

No CF redeployment should be required solely for Work Zone publication.

## Standalone Test Approuter

A reusable standalone test approuter was added to the Cloud Foundry repository:

```text
approuter\
manifest-test-approuter.yml
```

It was prepared for HR7, HD6, and Shipping Dashboard testing.

Deployment could not be completed because the CF organization or space has reached:

```text
route quota
memory quota
application instance quota
```

CF SSH is also disabled, so SSH tunneling could not be used as a fallback. The temporary stopped approuter placeholders were deleted from CF after the failed test attempt.

The approuter can be deployed later after quota is increased.

## CF Cleanup

The following unwanted CF resources were removed earlier from CF only:

```text
zpkwporeport
rulesmanager
rulesmanager2
rulesmanagertony
```

Their BAS or Git source files were not removed.

## Automation Files

Key reusable migration automation files:

```text
scripts\Convert-NeoHtml5ExportsToCf.ps1
scripts\Apply-CfBackendDestinations.ps1
scripts\Convert-NeoDestinationInventoryToCfTemplate.ps1
scripts\Generate-NeoToCfConfigFromExports.ps1
scripts\Get-NeoExportStatus.ps1
templates\neo-to-cf-not-done-renamed.json
templates\cf-destinations-from-neo.json
docs\neo-to-cf-automation.md
```

## Next Actions

1. Ask a BTP administrator to assign Work Zone authoring or administration access in the `btp_cf` subaccount.
2. Ask a CF administrator to increase route, memory, and app-instance quotas if direct standalone approuter testing is required.
3. After Work Zone access is assigned, import and publish the nine migrated apps.
4. Run focused launch tests for all nine apps, especially `saleorder`, `quickpackecc`, and `shippingdashboard`.
5. Continue migration of remaining apps only after the first batch is accepted.

## Security Note

Credentials shared during the discussion are intentionally not stored in this file. Use interactive login or environment-scoped credentials only. Do not commit passwords, service secrets, or tokens.
