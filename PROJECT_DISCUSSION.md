# ShipERP Neo to Cloud Foundry Migration — Project Discussion
**Date:** 2026-06-04  
**Author:** Claude (AI assistant) + Nikki Navarro (nnavarro@erp-is.com)  
**Repository:** https://github.com/nikkiledynavarro/work_cloud_foundry  
**BTP Subaccount:** btp_cf (erpintegratedsolutionsllcdbashiperp-01, us11)

---

## 1. Project Goal

Migrate ShipERP's 62 Fiori HTML5 apps from SAP BTP **Neo** environment to SAP BTP **Cloud Foundry (CF)** HTML5 Applications Repository, and make them testable via:
- Local approuter (localhost:5000 on developer PC)
- VS Code launch configs
- SAP Business Application Studio (BAS)
- SAP Build Work Zone (Standard Edition)

---

## 2. Why This Migration?

- SAP Neo environment is being deprecated
- CF is the modern SAP BTP runtime with better integration (Work Zone, managed approuter, MTA deployments)
- CF HTML5 Apps Repository allows centralized app hosting without running your own server
- Work Zone provides a unified launchpad for all Fiori apps

---

## 3. App Inventory and Classification

### Starting Point
- **62 apps** exported from Neo
- Apps connected to different backend systems: HR7 (ECC+EWM), HD6, S23, SLS

### Decision: Focus on HR7 Apps
We narrowed scope to **27 HR7 apps** because:
- HR7 is ShipERP's main production-like system
- Other destinations (HD6, SLS) have fewer apps and different complexity
- HR7 apps use `virtual-hr7-destination` (Cloud Connector to `10.10.1.76:8001`)

### The 27 HR7 Apps (ECC + EWM)
| App Folder | CF App ID | Type |
|------------|-----------|------|
| cancelacefiling | comerpisshiperpcancelacefiling | ECC |
| cancelpickuprequest | comerpisshiperpcancelpickuprequest | ECC |
| cancelshipment | comerpisshiperpcancelshipment | ECC |
| cancelshipmentewm | comerpisshiperpcancelshipmentewm | EWM |
| carrierperformancereportecc | comerpisshiperpcarrierperformancereportecc | ECC |
| carrierperformancereportewm | comerpisshiperpcarrierperformancereportewm | EWM |
| closedelivery | comerpisshiperpclosedelivery | ECC |
| createshipment | comerpisshiperpcreateshipment | ECC |
| createshipmentewm | comerpisshiperpcreateshipmentewm | EWM |
| createshipmentv2ewm | comerpisshiperpcreateshipmentv2ewm | EWM |
| dispute | comerpisshiperpdispute | ECC |
| freightaudit | comerpisshiperpfreightaudit | ECC |
| freightauditupload | comerpisshiperpfreightauditupload | ECC |
| freightorderplanning | comerpisshiperpfreightorderplanning | ECC |
| ltlplanning | comerpisshiperpltlplanning | EWM |
| manualshipmentecc | comerpisshiperpmanualshipmentecc | ECC |
| manualshipmentewm | comerpisshiperpmanualshipmentewm | EWM |
| planningcockpit | comerpisshiperpplanningcockpit | ECC |
| planshipment | comerpisshiperpplanshipment | ECC |
| quickpackecc | comerpisshiperpquickpackecc | ECC |
| quickpackewm | comerpisshiperpquickpackewm | EWM |
| requestforpickup | comerpisshiperprequestforpickup | EWM |
| saleorder | comerpisshiperpsaleorder | ECC |
| shippingdashboard | comerpisshiperpshippingdashboard | ECC |
| submitacefiling | comerpisshiperpsubmitacefiling | ECC |
| trackshipmentewm | comerpisshiperptrackshipmentewm | EWM |
| viewacefiling | comerpisshiperpviewacefiling | ECC |

---

## 4. MTA Structure

### What is MTA?
Multi-Target Application (MTA) is SAP's standard deployment descriptor for CF. It bundles multiple modules and services into one deployable archive.

### MTA.yaml Structure (per app, x27)
Each of the 27 apps has 3 MTA modules and 3 resources:

```
Modules:
  {app}                     → type: html5 (builds the UI5 app)
  {app}-app-content         → type: com.sap.application.content (uploads zip to HTML5 repo)
  {app}-destination-content → type: com.sap.application.content (configures destinations)

Resources:
  {app}-app-front-service   → html5-apps-repo app-host plan (stores the app content)
  {app}-destination-service → destination service lite plan
  {app}-xsuaa-service       → XSUAA application plan (authentication)
```

### Why Per-App Services?
Each app gets its own service instances so they can be deployed/updated independently, and XSUAA scopes are app-specific.

---

## 5. Key Fixes Made During Migration

### 5.1 CDN URL Fix
**Problem:** Apps used CDN URL `sapui5.hana.ondemand.com` (old, deprecated) or absolute `ui5.sap.com` URLs that don't work inside CF managed launchpad.

**Fix (Phase 1 - Local testing):** Changed to relative `src="resources/sap-ui-core.js"` so the local approuter proxies to `ui5cdn` destination.

**Fix (Phase 2 - CF testing):** Changed to absolute `src="https://ui5.sap.com/resources/sap-ui-core.js"` because:
- The per-app `xs-app.json` has no `ui5cdn` route
- The managed launchpad's catch-all route sends `resources/` requests to HTML5 repo (not CDN)
- Absolute URL loads UI5 directly from CDN without any routing

**Why absolute URL works everywhere:**
- Local approuter: browser loads directly from CDN ✅
- VS Code: same ✅
- BAS managed launchpad: same ✅
- Work Zone: same ✅

### 5.2 sap.app.id Fix
**Problem:** Our apps had `sap.app.id` with dots (e.g., `com.erpis.shiperp.dispute`). The CF Launchpad URL uses dots as separators between site UUID, service name, and app ID. Dots inside the app ID break URL routing → "Not Found".

**Example broken URL:**
```
{site-id}.comerpisshiperpdispute.com.erpis.shiperp.disputepkw-1.0.0/index.html
```
The router sees `com` as the third segment, not `com.erpis.shiperp.disputepkw-1.0.0`.

**Fix:** Set `sap.app.id = sap.cloud.service` for all 27 apps (no dots):
```json
"sap.app": { "id": "comerpisshiperpdispute" }
"sap.cloud": { "service": "comerpisshiperpdispute" }
```

**Result:** URL becomes:
```
{site-id}.comerpisshiperpdispute.comerpisshiperpdispute-1.0.0/index.html
```
Routing works correctly.

### 5.3 manifest.json sap.cloud.service Fix
The `sap.cloud.service` in `manifest.json` is how the app registers itself in the HTML5 Apps Repository and how the managed launchpad finds it. All 27 apps were given the naming convention: `comerpisshiperp` + app name.

### 5.4 XSUAA AppId Fix
During CF deployment, some XSUAA service instances tried to change their `xsappname` property. XSUAA doesn't allow changing `xsappname` after initial creation.

**Fix:** Updated the `xs-security.json` files for affected apps to use the ORIGINAL `xsappname` that was registered when the service was first created.

### 5.5 shippingdashboard OVP Issue
The `shippingdashboard` app used `sap.ovp` (Overview Page) library which is an Enterprise library only available in Work Zone — not in the public UI5 CDN.

**Fix:** Replaced `sap.ovp` library reference with `sap.m, sap.f, sap.ui.layout` (standard libraries) in the `index.html`. The app still needs proper OVP configuration in Work Zone for full functionality.

### 5.6 resourceroots Namespace Fix
Some apps had hardcoded old namespace paths in `data-sap-ui-resourceroots` that didn't match the actual Component.js namespace. This caused "module not found" errors.

**Fix:** Updated `data-sap-ui-resourceroots` in each app's `index.html` with the correct namespace-to-path mappings.

### 5.7 ECC vs EWM Separation
A critical requirement: ECC apps and EWM apps are DIFFERENT apps targeting different SAP modules. They must never be mixed.

- `cancelshipment` (ECC) vs `cancelshipmentewm` (EWM) — different apps
- `createshipment` (ECC, based on parcelhr7) vs `createshipmentewm` (EWM) — different
- `manualshipmentecc` (ECC) vs `manualshipmentewm` (EWM) — different
- `carrierperformancereportecc` (ECC) vs `carrierperformancereportewm` (EWM) — different

### 5.8 setup.sh Bug Fix
The `approuter/setup.sh` script that generates `default-env.json` for local testing was missing the `sap.cloud.service` property in the VCAP_SERVICES credentials. This caused the approuter to fail with "html5-apps-repo service not bound" error.

**Fix:** Added `"sap.cloud.service": "html5-apps-repo-rt"` to the credentials section in setup.sh.

### 5.9 server.js for BAS iframe
**Problem:** BAS Simple Browser is an iframe. The CF HTML5 Apps Repository returns `X-Frame-Options: SAMEORIGIN` which prevents iframe embedding.

**Fix:** Created `approuter/server.js` — a wrapper around the standard approuter that intercepts `res.setHeader()` and strips the `X-Frame-Options` header. This is generated by `setup.sh` for local/BAS testing only (gitignored).

### 5.10 ui5cdn Destination in BTP Cockpit
When the managed launchpad serves apps (without the `ui5cdn` route in per-app xs-app.json, and before we switched to absolute CDN URL), the destination `ui5cdn` needed to exist at the subaccount level.

**Fix:** Created `ui5cdn` destination in BTP Cockpit → Connectivity → Destinations:
- URL: `https://ui5.sap.com`
- Type: HTTP, Proxy: Internet, Auth: NoAuthentication

This is now redundant since we use absolute CDN URL, but it's a good practice to have.

---

## 6. Testing Infrastructure

### 6.1 Local Approuter (PC)
**How:** Run `node server.js` in the `approuter/` directory  
**URL pattern:** `http://localhost:5000/{appId}/index.html`  
**What it does:** Fetches apps from CF HTML5 Repo using OAuth tokens from `app-runtime-1779763944` service key  
**Requires:** VPN for HR7 OData data; hr7-proxy.js for backend calls

**Setup commands:**
```bash
cd approuter
bash setup.sh   # generates default-env.json and server.js
node server.js  # starts approuter on port 5000
```

### 6.2 VS Code Launch Configs
**How:** `.vscode/launch.json` with 55 configurations  
**What it does:** Opens `http://localhost:5000/{appId}/index.html` in Chrome when pressing F5 or clicking Run  
**Requires:** Local approuter already running

### 6.3 BAS (SAP Business Application Studio)
**How:** Same setup.sh + node server.js in BAS terminal  
**Challenge:** BAS port-forwarding OAuth was broken in workspace `dha3l`; new workspace `gvpy5` works  
**URL pattern:** `http://localhost:5000/{appId}/index.html` in Simple Browser  
**Note:** BAS doesn't have VPN so HR7 OData calls show "Access denied" — the UI loads but no data

### 6.4 CF Managed Launchpad (BTP Cockpit)
**How:** Go to BTP Cockpit → HTML5 Applications → click app name  
**URL pattern:**
```
https://btp-cf-8qsdli3e.launchpad.cfapps.us11.hana.ondemand.com/
  {site-uuid}.{appId}.{appId}-1.0.0/index.html
```
Where `site-uuid = 11387043-4c6f-4c9a-94d6-10e084b8b2d2`

**Note:** This is the "Managed Application Router provided by SAP Build Work Zone, standard edition" — NOT the Work Zone site tiles. It's a direct URL to deployed apps.

---

## 7. CF Deployment Process

### Build
```bash
export PATH="$PATH:/c/Program Files (x86)/GnuWin32/bin"  # Windows: adds make to PATH
mbt build
```
Produces: `mta_archives/shiperp-fiori-cf-migration_0.0.1.mtar`

### Deploy
```bash
cf login -a https://api.cf.us11.hana.ondemand.com --sso
cf deploy mta_archives/shiperp-fiori-cf-migration_0.0.1.mtar -f
```

### What Deployment Creates
Per-app service instances in CF:
- 27x `{app}-app-front-service` (html5-apps-repo app-host)
- 27x `{app}-destination-service` (destination service)
- 27x `{app}-xsuaa-service` (XSUAA)
- 1x `app-runtime-1779763944` (html5-apps-repo runtime, pre-existing)

Total: 91 service instances in `btp_cf` subaccount

---

## 8. Key Architecture Decisions

### Decision: No Standalone CF Approuter
We attempted to deploy a standalone CF approuter as a CF application. This failed because:
- CF org `SUBSCRIPTION_QUOTA` has `routes: 0` (no CF app routes allowed)
- BTP subscription plan doesn't allocate CF app routes for this subaccount
- The apps are served purely via HTML5 Apps Repository + managed launchpad

### Decision: Per-App xs-app.json (Not Shared)
Each app has its own `xs-app.json` for the managed launchpad routing. This is the standard SAP approach for HTML5 apps in CF.

The per-app `xs-app.json` has:
```json
{
  "authenticationMethod": "route",
  "routes": [
    { "source": "^/sap/opu/odata/", "destination": "virtual-hr7-destination" },
    { "source": "^(.*)$", "service": "html5-apps-repo-rt" }
  ]
}
```

### Decision: Absolute UI5 CDN URL
Using `https://ui5.sap.com/resources/sap-ui-core.js` (absolute) instead of `resources/sap-ui-core.js` (relative) is the correct approach for production CF apps. It:
- Works in ALL environments without destination configuration
- Is faster (no proxy hop)
- Is the SAP-recommended approach for CF HTML5 apps

### Decision: sap.app.id = sap.cloud.service
Setting both manifest.json properties to the same no-dots value (`comerpisshiperp{appname}`) is required for the CF Launchpad URL to work. The dots-notation format breaks URL routing.

---

## 9. Known Limitations and Next Steps

### Limitation 1: HR7 Live Data
Apps show "Access denied to system virtual-s4hr7.erp-is.com:50000" in BAS/CF without VPN. This is expected.

**To fix:** Configure Cloud Connector to expose `virtual-s4hr7.erp-is.com` (or `10.10.1.76:8001`) as a virtual host. The destination `virtual-hr7-destination` in BTP already exists and points to the correct OnPremise host. The Cloud Connector just needs to map the virtual host to the internal IP.

### Limitation 2: Work Zone Tiles
Apps are accessible via direct URL (BTP Cockpit → HTML5 Applications) but NOT yet configured as tiles in Work Zone Site Manager.

**To complete Work Zone setup:**
1. Open Work Zone Site Manager at `https://btp-cf-8qsdli3e.launchpad.cfapps.us11.hana.ondemand.com`
2. Add the 27 apps as Content Items
3. Create groups/pages for ECC apps and EWM apps
4. Publish to the site
5. Users can then access via the Work Zone launchpad

### Limitation 3: shippingdashboard Full Functionality
The `shippingdashboard` app uses OVP (Overview Page) which requires Work Zone for full functionality. Currently, it displays basic Fiori UI.

### Limitation 4: BAS Port-Forwarding
BAS port-forwarding OAuth (`port{PORT}-ws-{ID}.authentication.us11.hana.ondemand.com`) shows "URL does not reference a valid account" — this is a BTP subaccount configuration issue, not a code issue. The workaround is to use the CF Managed Launchpad URL directly (which works in the user's authenticated browser).

---

## 10. File Structure Reference

```
neo_to_cf/
├── apps/                          # 27 CF HR7 apps (+ Neo backups)
│   ├── {appname}/
│   │   ├── index.html            # UI5 bootstrap (absolute CDN URL)
│   │   ├── manifest.json         # sap.app.id = sap.cloud.service
│   │   ├── xs-app.json           # per-app routing for managed launchpad
│   │   ├── Component.js          # UI5 component
│   │   ├── webapp/               # (some apps have webapp/ subfolder)
│   │   ├── ui5.yaml              # UI5 build config
│   │   └── package.json          # npm build scripts
├── approuter/
│   ├── setup.sh                  # generates default-env.json + server.js
│   ├── xs-app.json               # LOCAL approuter routing
│   ├── package.json              # @sap/approuter dependency
│   ├── default-env.json          # GITIGNORED - CF credentials for local
│   ├── server.js                 # GITIGNORED - strips X-Frame-Options
│   └── hr7-proxy.js              # GITIGNORED - local HR7 proxy on port 5001
├── security/
│   └── xs-security-{app}.json    # XSUAA security descriptors (27 files)
├── .vscode/
│   ├── launch.json               # 55 VS Code debug configurations
│   └── tasks.json                # Start approuter + proxy tasks
├── mta.yaml                      # MTA deployment descriptor (27 apps)
├── .gitignore                    # Excludes credentials, server.js, dist/
├── shiperp-hr7.code-workspace    # VS Code workspace with all 63 folders
└── PROJECT_DISCUSSION.md         # This file
```

---

## 11. Git History Summary

| Commit | Description |
|--------|-------------|
| Initial | Neo app export and CF structure setup |
| feat | Added 27 HR7 apps to mta.yaml |
| fix(manifest) | Set sap.app.id = sap.cloud.service (no dots) |
| fix(approuter) | Added sap.cloud.service to setup.sh credentials |
| fix(approuter) | Auto-generate server.js in setup.sh |
| fix(index) | Use absolute UI5 CDN URL for all 27 apps |
| feat(approuter) | Add standalone CF approuter (later reverted) |
| revert(approuter) | Remove CF approuter (route quota = 0) |

---

## 12. Important URLs

| Purpose | URL |
|---------|-----|
| BTP Cockpit | https://apac.cockpit.btp.cloud.sap |
| HTML5 Applications | https://apac.cockpit.btp.cloud.sap → btp_cf → HTML5 Applications |
| BAS (current workspace) | https://btp-cf-8qsdli3e.us11cf.applicationstudio.cloud.sap |
| Work Zone (Future) | https://btp-cf-8qsdli3e.launchpad.cfapps.us11.hana.ondemand.com |
| Sample Dispute App | https://btp-cf-8qsdli3e.launchpad.cfapps.us11.hana.ondemand.com/11387043-4c6f-4c9a-94d6-10e084b8b2d2.comerpisshiperpdispute.comerpisshiperpdispute-1.0.0/index.html |
| CF API | https://api.cf.us11.hana.ondemand.com |
| GitHub Repo | https://github.com/nikkiledynavarro/work_cloud_foundry |

---

## 13. CF URL Pattern for All 27 Apps

Base URL: `https://btp-cf-8qsdli3e.launchpad.cfapps.us11.hana.ondemand.com/`  
Site UUID: `11387043-4c6f-4c9a-94d6-10e084b8b2d2`

| App Name | CF URL Suffix |
|----------|--------------|
| cancelacefiling | `11387043...comerpisshiperpcancelacefiling.comerpisshiperpcancelacefiling-1.0.0/index.html` |
| cancelpickuprequest | `11387043...comerpisshiperpcancelpickuprequest.comerpisshiperpcancelpickuprequest-1.0.0/index.html` |
| cancelshipment | `11387043...comerpisshiperpcancelshipment.comerpisshiperpcancelshipment-1.0.0/index.html` |
| cancelshipmentewm | `11387043...comerpisshiperpcancelshipmentewm.comerpisshiperpcancelshipmentewm-1.0.0/index.html` |
| carrierperformancereportecc | `11387043...comerpisshiperpcarrierperformancereportecc.comerpisshiperpcarrierperformancereportecc-1.0.0/index.html` |
| carrierperformancereportewm | `11387043...comerpisshiperpcarrierperformancereportewm.comerpisshiperpcarrierperformancereportewm-1.0.0/index.html` |
| closedelivery | `11387043...comerpisshiperpclosedelivery.comerpisshiperpclosedelivery-1.0.0/index.html` |
| createshipment | `11387043...comerpisshiperpcreateshipment.comerpisshiperpcreateshipment-1.0.0/index.html` |
| createshipmentewm | `11387043...comerpisshiperpcreateshipmentewm.comerpisshiperpcreateshipmentewm-1.0.0/index.html` |
| createshipmentv2ewm | `11387043...comerpisshiperpcreateshipmentv2ewm.comerpisshiperpcreateshipmentv2ewm-1.0.0/index.html` |
| dispute | `11387043...comerpisshiperpdispute.comerpisshiperpdispute-1.0.0/index.html` |
| freightaudit | `11387043...comerpisshiperpfreightaudit.comerpisshiperpfreightaudit-1.0.0/index.html` |
| freightauditupload | `11387043...comerpisshiperpfreightauditupload.comerpisshiperpfreightauditupload-1.0.0/index.html` |
| freightorderplanning | `11387043...comerpisshiperpfreightorderplanning.comerpisshiperpfreightorderplanning-1.0.0/index.html` |
| ltlplanning | `11387043...comerpisshiperpltlplanning.comerpisshiperpltlplanning-1.0.0/index.html` |
| manualshipmentecc | `11387043...comerpisshiperpmanualshipmentecc.comerpisshiperpmanualshipmentecc-1.0.0/index.html` |
| manualshipmentewm | `11387043...comerpisshiperpmanualshipmentewm.comerpisshiperpmanualshipmentewm-1.0.0/index.html` |
| planningcockpit | `11387043...comerpisshiperpplanningcockpit.comerpisshiperpplanningcockpit-1.0.0/index.html` |
| planshipment | `11387043...comerpisshiperpplanshipment.comerpisshiperpplanshipment-1.0.0/index.html` |
| quickpackecc | `11387043...comerpisshiperpquickpackecc.comerpisshiperpquickpackecc-1.0.0/index.html` |
| quickpackewm | `11387043...comerpisshiperpquickpackewm.comerpisshiperpquickpackewm-1.0.0/index.html` |
| requestforpickup | `11387043...comerpisshiperprequestforpickup.comerpisshiperprequestforpickup-1.0.0/index.html` |
| saleorder | `11387043...comerpisshiperpsaleorder.comerpisshiperpsaleorder-1.0.0/index.html` |
| shippingdashboard | `11387043...comerpisshiperpshippingdashboard.comerpisshiperpshippingdashboard-1.0.0/index.html` |
| submitacefiling | `11387043...comerpisshiperpsubmitacefiling.comerpisshiperpsubmitacefiling-1.0.0/index.html` |
| trackshipmentewm | `11387043...comerpisshiperptrackshipmentewm.comerpisshiperptrackshipmentewm-1.0.0/index.html` |
| viewacefiling | `11387043...comerpisshiperpviewacefiling.comerpisshiperpviewacefiling-1.0.0/index.html` |

*(Replace `11387043...` with `11387043-4c6f-4c9a-94d6-10e084b8b2d2`)*

---

## 14. What "No Data" Means in Testing

When you open an app and see the UI but no records (or an OData error), it means:

1. **In BAS/CF without VPN:** The app can't reach HR7 (`10.10.1.76:8001` or `virtual-s4hr7.erp-is.com`). This is normal — BAS runs in the cloud and the HR7 system is on-premise. Cloud Connector bridges this gap but needs proper configuration.

2. **In local testing with VPN:** If VPN is connected and `hr7-proxy.js` is running on port 5001, the app should show live HR7 data.

3. **In CF with Cloud Connector:** The `virtual-hr7-destination` destination exists and points to the HR7 system via Cloud Connector. Once the Cloud Connector properly exposes the HR7 internal host as `virtual-s4hr7.erp-is.com`, live data will appear in CF too.

---

*Document generated: 2026-06-04*
*Next session: Configure Cloud Connector for HR7, then set up Work Zone tiles*
