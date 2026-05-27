# Neo to Cloud Foundry Fiori Migration Automation

This project uses a local, repeatable migration flow. SAP Business Application Studio is optional; the migration is driven by Neo export ZIP files, a JSON config, MTA build, and CF deploy.

## 1. Export all Neo HTML5 apps

Create one local folder for all Neo app exports:

```powershell
New-Item -ItemType Directory -Force .\exports\neo-html5
```

In Neo Cockpit, export or download each HTML5 app ZIP and save every ZIP into:

```text
C:\Users\nikki\OneDrive\Desktop\AI\Codex\Work\neo_to_cf\exports\neo-html5
```

Use the original Neo app name for the ZIP where possible, for example:

```text
acesubmitfiling.zip
cancelacefiling.zip
viewacefiling.zip
```

Check export coverage before running the all-app conversion:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Get-NeoExportStatus.ps1
```

## 2. Configure apps to migrate

Copy and edit:

```text
templates\neo-to-cf-apps.json
```

For each app, add one entry under `apps`. The important fields are:

```json
{
  "enabled": true,
  "neoZip": "acesubmitfiling.zip",
  "appName": "submitacefiling",
  "title": "Submit ACE Filing",
  "oldNamespace": "com.erpis.shiperp.ACESubmitFiling",
  "newNamespace": "com.erpis.shiperp.submitacefiling",
  "sapCloudService": "comerpisshiperpsubmitacefiling",
  "semanticObject": "SubmitACEFiling",
  "action": "display",
  "destinationName": "virtual-hr7-destination",
  "odataPath": "/sap/opu/odata/serperp/ace_srv/"
}
```

## 3. Generate CF-ready app folders and MTA

Run:

```powershell
.\scripts\Convert-NeoHtml5ExportsToCf.ps1 -Clean
```

If Windows blocks local PowerShell scripts, use a one-time bypass for this command:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Convert-NeoHtml5ExportsToCf.ps1 -Clean
```

The script creates or updates:

```text
apps\<appName>
apps\<appName>\manifest.json
apps\<appName>\xs-app.json
apps\<appName>\package.json
apps\<appName>\ui5.yaml
security\xs-security-<appName>.json
mta.yaml
```

For each app, the generated `mta.yaml` defines these CF services:

```text
<appName>-app-front-service      html5-apps-repo / app-host
<appName>-destination-service    destination / lite
<appName>-xsuaa-service          xsuaa / application
```

## 4. Build the MTAR

```powershell
npx.cmd mbt build
```

Or let the converter build after generation:

```powershell
.\scripts\Convert-NeoHtml5ExportsToCf.ps1 -Clean -BuildMta
```

## 5. Deploy only after approval

Target the correct CF org and space:

```powershell
cf target
```

Expected target:

```text
API endpoint: https://api.cf.us11.hana.ondemand.com
space: DEV
```

Deploy:

```powershell
cf deploy .\mta_archives\<mta-id>_0.0.1.mtar -f
```

## 6. Verify

```powershell
cf services
cf html5-list
```

The HTML5 app should appear in `cf html5-list`. Work Zone exposure is a separate step and can remain skipped until the Work Zone role/access issue is fixed.
