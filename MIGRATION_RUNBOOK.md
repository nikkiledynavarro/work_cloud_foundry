# Neo Export to CF Migration Runbook

## Current Status

Completed for first app:

- Downloaded Neo export: `acesubmitfiling.zip`
- Extracted app: `apps/acesubmitfiling`
- Added CF route descriptor: `apps/acesubmitfiling/xs-app.json`
- Added UI5 build descriptor: `apps/acesubmitfiling/ui5.yaml`
- Added app package metadata: `apps/acesubmitfiling/package.json`
- Added initial MTA: `mta.yaml`
- Added XSUAA descriptor: `xs-security.json`
- Added reusable importer: `scripts/import-neo-html5-export.ps1`
- Added MTA app-list updater: `scripts/update-mta-apps.ps1`
- Verified local UI5 build with `npm.cmd run build`

## Why ZIP Export Is Enough

The Neo `Export` ZIP contains the deployed UI5 application files, including:

- `manifest.json`
- `neo-app.json`
- `Component.js`
- `Component-preload.js`
- views, controllers, fragments, i18n, CSS, and image assets

Git is optional. It is useful for history and bulk cloning, but not required for Cloud Foundry migration if the exported ZIP is available.

## Repeat Process for Each Neo App

1. Open the app in Neo Cockpit.
2. Click the `Export` action.
3. Confirm the ZIP lands in `C:\Users\nikki\Downloads`.
4. Copy the ZIP into this workspace.
5. Extract it under `apps/<appName>`.
6. Read `neo-app.json` and map every destination route into `xs-app.json`.
7. Add the app module to `mta.yaml`.
8. Build locally.
9. Deploy only after explicit approval.

The importer automates steps 4-6:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\import-neo-html5-export.ps1 -ZipPath "$env:USERPROFILE\Downloads\<appName>.zip" -AppName <appName>
```

After importing one or more apps, regenerate the MTA app module list:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\update-mta-apps.ps1
```

## First App Details

App: `acesubmitfiling`

Neo route:

```json
{
  "path": "/sap/opu/odata/",
  "target": {
    "type": "destination",
    "name": "virtual-hr7-destination",
    "entryPath": "/sap/opu/odata/"
  }
}
```

CF route (current — post-§27 clean destination architecture):

```json
{
  "source": "^/sap/opu/odata/(.*)$",
  "target": "/sap/opu/odata/$1",
  "destination": "shiperp-virtual-hr7-destination",
  "authenticationType": "xsuaa",
  "csrfProtection": false
}
```

> **Destination architecture note:** As of `2026-06-10` (`PROJECT_DISCUSSION.md` §27) the three backend destinations live at the **subaccount level** under the names `shiperp-virtual-hr7-destination`, `shiperp-virtual-erps4sales-destination`, and `shiperp-virtual-hd6-destination`. The per-app `destination` service instances no longer carry their own `virtual-*` copies — apps resolve them by fall-through from instance level to subaccount level. SLS and HD6 routes follow the same shape (substitute the right destination name).

## Target Prerequisites Before Deployment

The CF target needs:

- `html5-apps-repo` service with `app-host` plan
- `destination` service with `HTML5Runtime_enabled`
- `xsuaa` service
- `shiperp-virtual-hr7-destination` (and `shiperp-virtual-erps4sales-destination` / `shiperp-virtual-hd6-destination` for SLS / HD6 apps) available at the **subaccount level**
- Cloud Connector mapping for `virtual-s4hr7.erp-is.com:50000` (HR7), `erps4sales.erp-is.com:50000` (SLS), `virtual-s4hd6.erp-is.com:8000` (HD6) — see `PROJECT_DISCUSSION.md` §26
- Credentials/auth strategy for the on-premise destinations (currently `USER_CF` Basic Auth — see `PROJECT_DISCUSSION.md` §21.1)

Backend destinations are intentionally not created in `mta.yaml` because they require secrets and target Cloud Connector configuration. Create or validate them separately before deployment.

## Known Notes

- `mbt` is not installed locally, so the full MTA archive build has not been run yet.
- `npm.cmd install` reported vulnerabilities in build dependencies. I did not run audit fix because it can alter UI5 build behavior.
- The app has cross-navigation hashes to related apps, including `cancelacehr7` and `viewacefiling`; those should be migrated together for the workflow to work end to end.
