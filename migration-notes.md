# Neo to Cloud Foundry Fiori Migration Notes

## Source

- Neo global account: `CA6871677TID000000000740533743`
- Neo subaccount: `24fb27fe-9c56-4c6c-8226-8bff9599a446`
- Neo subaccount display name: `Fiori Development Apps`
- Neo technical name: `da56ca735`
- HTML5 applications: `62`
- Started applications: `60`
- Stopped applications: `2`

Inventories:

- `neo-html5-app-inventory.md`
- `neo-destination-inventory.md`

## Target Observed from CF CLI

- API: `https://api.cf.us10-001.hana.ondemand.com`
- Org: `ShipERP - Kyma and CF_joule-4c4by800`
- Space: `dev`

Current CF apps:

- `shiperp-joule-business-api-mcp`

Current CF services:

- `sap_process_automation` (`process-automation-service`, `standard`)
- `shiperp-joule-business-api-destination` (`destination`, `lite`)
- `wz_joule` (`build-workzone-standard`, `foundation`)

No `html5-apps-repo` service instance was visible in the current CF space service list.

## Source Access Findings

Neo cockpit exposes each HTML5 app with:

- `Export` action
- active app URL
- required destination mappings
- Git repository URL under Versioning

Example app: `acesubmitfiling`

- Active version: `1.0.115`
- Required destination: `virtual-hr7-destination`
- Git URL: `https://git.us2.hana.ondemand.com/da56ca735/acesubmitfiling`
- Export endpoint pattern: `/ajax/exportHtml5Application/da56ca735/{appName}?X-ClientSession-Id={csrftoken}`

Codex in-app browser cannot receive downloads, so Neo cockpit `Export` cannot be saved directly through the browser automation surface. External Git access also requires SAP Git credentials/token; unauthenticated access returns `403`.

## Migration Path

1. Obtain app source for each Neo HTML5 app:
   - preferred: clone from `https://git.us2.hana.ondemand.com/da56ca735/{appName}`
   - fallback: manually export ZIPs from Neo cockpit and place them in this workspace
2. For each app, inspect:
   - `manifest.json`
   - `neo-app.json`
   - UI5 version and bootstrap
   - required destinations
   - custom routes and authentication assumptions
3. Convert packaging to Cloud Foundry HTML5 apps repo:
   - app module per UI5 app
   - `com.sap.application.content` deployer module
   - `html5-apps-repo` host service
   - destination service content
   - XSUAA if app-level auth/role collections are needed
4. Map Neo destinations to CF destination service:
   - Internet destinations can usually be recreated directly
   - OnPremise destinations require Cloud Connector mapping in the target subaccount
   - `AppToAppSSO` Neo destinations require redesign or replacement with CF-compatible auth
5. Deploy only after explicit approval.
