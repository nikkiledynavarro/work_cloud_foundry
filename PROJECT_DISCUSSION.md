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

## 15. How to Test the Apps

### 15.1 Testing via Local Approuter (on your PC)

The local approuter runs on your Windows PC, fetches the app HTML/JS from the CF HTML5 Apps Repository, and serves it at `http://localhost:5000`. This is the best option for testing with **live HR7 data** because you can connect to VPN.

#### Prerequisites
- VPN connected (required for HR7 OData data)
- Node.js installed
- CF CLI installed and logged in
- Git Bash or similar terminal

#### One-time setup (first time only)
```bash
# 1. Open Git Bash and navigate to the project
cd "C:/Users/nikki/OneDrive/Desktop/AI/Codex/Work/neo_to_cf/approuter"

# 2. Install dependencies
npm install
```

#### Every session

> **Before you start:** Make sure **OpenVPN is connected** to `erp-is`. You need both OpenVPN AND
> hr7-proxy.js running for live HR7 data. OpenVPN opens the network tunnel; hr7-proxy.js handles
> the authentication and forwards the calls.

> **Terminal tip:** Use **Git Bash** for these commands. `Ctrl+V` does not work in Git Bash —
> use **right-click → Paste** instead. Or use VS Code terminal (`Ctrl+\``) where `Ctrl+V` works normally.

**Window 1 — Open Git Bash and run:**
```bash
# Step 1: Navigate to the approuter folder
cd C:/Users/nikki/OneDrive/Desktop/AI/Codex/Work/neo_to_cf/approuter

# Step 2: Log in to CF with your BTP email and password
cf login -a https://api.cf.us11.hana.ondemand.com
# Enter: nnavarro@erp-is.com
# Enter: your password when prompted
# You should see: Targeted org ... Targeted space DEV

# Step 3: Run setup — this generates default-env.json AND starts hr7-proxy.js automatically
bash setup.sh
```

> ⚠️ After `bash setup.sh` you will see:
> ```
> ✅ default-env.json created successfully
> HR7 Auth Proxy running on port 5001
> Forwarding to http://10.10.1.76:8001 as NNAVARRO_AI
> ```
> The terminal is now **"stuck"** — this is normal! hr7-proxy.js is running in the foreground.
> **Do NOT close this window.** Open a second Git Bash window for the next step.

**Window 2 — Open a NEW Git Bash window and run:**
```bash
# Step 4: Navigate to the approuter folder
cd C:/Users/nikki/OneDrive/Desktop/AI/Codex/Work/neo_to_cf/approuter

# Step 5: Start the approuter
node server.js
# Wait for: "Application router is listening on port: 5000"
```

**You now have 2 Git Bash windows running:**

| Window | Command | Port | Purpose |
|--------|---------|------|---------|
| Window 1 | `bash setup.sh` (hr7-proxy inside) | 5001 | Forwards OData calls to HR7 with Basic Auth |
| Window 2 | `node server.js` | 5000 | Approuter — serves app from CF HTML5 Repo |

**Why both are needed for live HR7 data:**

| | What it does | Without it |
|---|---|---|
| **OpenVPN** | Opens network tunnel from PC to `10.10.1.76` | hr7-proxy.js can't reach HR7 |
| **hr7-proxy.js** (port 5001) | Adds `Authorization: Basic` header, forwards to HR7 | Approuter has nowhere to send OData calls |
| **node server.js** (port 5000) | Fetches app from CF, routes browser requests | `localhost:5000` connection refused |

> **CF login options:**
> - `cf login -a ...` with **email + password** → simplest, works in any terminal ✅ (recommended)
> - `cf login -a ... --sso` → prompts for one-time passcode (can have paste issues in Git Bash)
> - Use email/password to avoid bracketed paste mode problems in Git Bash

#### Opening an app
Open your Chrome browser and go to:
```
http://localhost:5000/comerpisshiperpdispute/index.html
```

Replace `comerpisshiperpdispute` with any of the 27 app IDs. Full list:

| App | URL |
|-----|-----|
| Cancel ACE Filing | `http://localhost:5000/comerpisshiperpcancelacefiling/index.html` |
| Cancel Pickup Request | `http://localhost:5000/comerpisshiperpcancelpickuprequest/index.html` |
| Cancel Shipment (ECC) | `http://localhost:5000/comerpisshiperpcancelshipment/index.html` |
| Cancel Shipment (EWM) | `http://localhost:5000/comerpisshiperpcancelshipmentewm/index.html` |
| Carrier Performance (ECC) | `http://localhost:5000/comerpisshiperpcarrierperformancereportecc/index.html` |
| Carrier Performance (EWM) | `http://localhost:5000/comerpisshiperpcarrierperformancereportewm/index.html` |
| Close Delivery | `http://localhost:5000/comerpisshiperpclosedelivery/index.html` |
| Create Shipment (ECC) | `http://localhost:5000/comerpisshiperpcreateshipment/index.html` |
| Create Shipment (EWM) | `http://localhost:5000/comerpisshiperpcreateshipmentewm/index.html` |
| Create Shipment V2 (EWM) | `http://localhost:5000/comerpisshiperpcreateshipmentv2ewm/index.html` |
| Dispute | `http://localhost:5000/comerpisshiperpdispute/index.html` |
| Freight Audit | `http://localhost:5000/comerpisshiperpfreightaudit/index.html` |
| Freight Audit Upload | `http://localhost:5000/comerpisshiperpfreightauditupload/index.html` |
| Freight Order Planning | `http://localhost:5000/comerpisshiperpfreightorderplanning/index.html` |
| LTL Planning | `http://localhost:5000/comerpisshiperpltlplanning/index.html` |
| Manual Shipment (ECC) | `http://localhost:5000/comerpisshiperpmanualshipmentecc/index.html` |
| Manual Shipment (EWM) | `http://localhost:5000/comerpisshiperpmanualshipmentewm/index.html` |
| Planning Cockpit | `http://localhost:5000/comerpisshiperpplanningcockpit/index.html` |
| Plan Shipment | `http://localhost:5000/comerpisshiperpplanshipment/index.html` |
| Quick Pack (ECC) | `http://localhost:5000/comerpisshiperpquickpackecc/index.html` |
| Quick Pack (EWM) | `http://localhost:5000/comerpisshiperpquickpackewm/index.html` |
| Request for Pickup | `http://localhost:5000/comerpisshiperprequestforpickup/index.html` |
| Sale Order | `http://localhost:5000/comerpisshiperpsaleorder/index.html` |
| Shipping Dashboard | `http://localhost:5000/comerpisshiperpshippingdashboard/index.html` |
| Submit ACE Filing | `http://localhost:5000/comerpisshiperpsubmitacefiling/index.html` |
| Track Shipment (EWM) | `http://localhost:5000/comerpisshiperptrackshipmentewm/index.html` |
| View ACE Filing | `http://localhost:5000/comerpisshiperpviewacefiling/index.html` |

#### What to expect
- **App loads with live data** → VPN is connected and hr7-proxy.js is running ✅
- **App loads but "No data"** → VPN is off or hr7-proxy.js is not running
- **App is blank/white** → Approuter not running, or setup.sh not run

#### Stopping
```bash
# Kill port 5000 (approuter)
kill $(lsof -ti:5000)

# Kill port 5001 (hr7-proxy)
kill $(lsof -ti:5001)
```

---

### 15.2 Testing via VS Code

> **Key insight:** VS Code IS the same as BAS — BAS is literally VS Code running in your browser.
> Both have the same Simple Browser feature, the same terminal, and the same extension support.
> The difference is: VS Code runs locally (no port-forwarding OAuth issues, VPN works),
> while BAS runs in SAP's cloud.

VS Code supports **three ways to view apps**, identical to BAS:

| Method | How |
|--------|-----|
| **Simple Browser** (inside VS Code) | `Ctrl+Shift+P` → Simple Browser: Show → enter URL |
| **Launch Config** (new Chrome tab) | Run menu → select app → press F5 |
| **Manual URL** (any browser) | Paste `http://localhost:5000/{appId}/index.html` in Chrome |

#### Prerequisites
- Local approuter must already be running (see Section 15.1)
- VS Code installed with the workspace file `shiperp-hr7.code-workspace`

#### Opening the workspace
```
File → Open Workspace from File → 
C:\Users\nikki\OneDrive\Desktop\AI\Codex\Work\neo_to_cf\shiperp-hr7.code-workspace
```

This loads all 27 CF apps (and 30 Neo backup apps) into a single workspace.

#### Method A: Simple Browser (same as BAS)

This is the same experience as BAS — app renders **inside VS Code** without opening a new tab.

1. Make sure the approuter is running on port 5000
2. Press `Ctrl+Shift+P` → type **Simple Browser: Show** → Enter
3. Type the URL and press Enter:
```
http://localhost:5000/comerpisshiperpdispute/index.html
```
4. The Fiori app renders inside VS Code — you stay in your editor

> Why VS Code Simple Browser works but BAS Simple Browser sometimes doesn't:
> In VS Code, `localhost:5000` connects directly to YOUR machine — no OAuth needed.
> In BAS, `localhost:5000` goes through SAP's port-forwarding service which requires BTP auth.

#### Method B: Running an app via Launch Config
1. Open VS Code
2. Go to **Run and Debug** (Ctrl+Shift+D or the bug icon in the left sidebar)
3. In the dropdown at the top, select the app you want to test.
   - Apps prefixed with `☁` are CF apps (e.g., `☁ Dispute`)
   - Apps prefixed with `🌐` are the old Neo versions (for comparison)
4. Click the green ▶ **Play** button (or press F5)
5. Chrome opens automatically with the app URL

#### What the launch config does
Each VS Code launch config:
- Opens `http://localhost:5000/{appId}/index.html` in Chrome
- Attaches Chrome DevTools so you can set breakpoints
- Shows console errors directly in VS Code

#### Comparing Neo vs CF
In VS Code you can run the **Neo version** side by side with the **CF version** to compare functionality:
- `🌐 Dispute (Neo)` → old Neo version from backup
- `☁ Dispute` → new CF version

#### Important: approuter must be running first
If the approuter is not running, Chrome will show "This site can't be reached". Start the approuter first (Section 15.1 steps 3-5), then use VS Code.

---

### 15.3 Testing in BAS (SAP Business Application Studio)

BAS testing uses the same approuter concept but runs entirely in the cloud (inside the BAS container). The approuter in BAS fetches apps from CF HTML5 Repo — **no VPN needed** to see the app UI, but OData data will not load (no VPN in cloud).

#### Prerequisites
- BAS dev space `Fiori_App` is running
- CF logged in (via SSO passcode)

#### Step-by-step

**Step 1: Open BAS**
Navigate to your BAS workspace:
```
https://btp-cf-8qsdli3e.us11cf.applicationstudio.cloud.sap
```
Open the `Fiori_App` dev space.

**Step 2: Open a terminal in the project**
In BAS, open a new terminal (`Terminal → New Terminal`).
Make sure it shows `user: work_cloud_foundry $` as the prompt.
If not, click the correct terminal or run:
```bash
cd /home/user/projects/work_cloud_foundry
```

**Step 3: Pull latest code**
```bash
git pull origin main
```

**Step 4: Log in to CF**
```bash
cf login -a https://api.cf.us11.hana.ondemand.com --sso
```
When prompted for "Temporary Authentication Code", go to:
```
https://login.cf.us11.hana.ondemand.com/passcode
```
Copy the code and paste it into the terminal.

**Step 5: Run setup and start approuter**
```bash
cd approuter
bash setup.sh
node server.js &
```
You should see:
```
✅ default-env.json created successfully
✅ server.js created (strips X-Frame-Options for BAS/iframe preview)
Application router is listening on port: 5000
```

**Step 6: Open an app**

**Option A — Via BTP Cockpit (Recommended, works with your BTP session)**
1. Go to BTP Cockpit: `https://apac.cockpit.btp.cloud.sap`
2. Navigate to: `btp_cf subaccount → HTML5 Applications`
3. Find the app you want (e.g., `comerpisshiperpdispute`)
4. Click the app name → it opens in a new tab with the full Fiori UI

**Option B — Direct CF URL (paste in your browser)**
Use this URL pattern with the site UUID `11387043-4c6f-4c9a-94d6-10e084b8b2d2`:
```
https://btp-cf-8qsdli3e.launchpad.cfapps.us11.hana.ondemand.com/
  11387043-4c6f-4c9a-94d6-10e084b8b2d2.{appId}.{appId}-1.0.0/index.html
```

Example for Dispute:
```
https://btp-cf-8qsdli3e.launchpad.cfapps.us11.hana.ondemand.com/11387043-4c6f-4c9a-94d6-10e084b8b2d2.comerpisshiperpdispute.comerpisshiperpdispute-1.0.0/index.html
```

**Option C — BAS Simple Browser (if port-forwarding OAuth works)**
1. Press `Ctrl+Shift+P` in BAS
2. Type `Simple Browser: Show` → Enter
3. Enter: `http://localhost:5000/comerpisshiperpdispute/index.html`

> ⚠️ Note: Simple Browser may not work if the BAS workspace's port-forwarding OAuth is broken. Use Option A or B instead.

#### What to expect in BAS
- **App renders with Fiori UI** ✅ (tabs, buttons, table columns visible)
- **"No data" or OData 403 error** → Expected! BAS has no VPN so HR7 is unreachable
- **Blank white page** → Check that `bash setup.sh` ran and `node server.js` is running

---

### 15.4 Testing Summary Table

| Test Method | Where | Setup Required | Live HR7 Data | Best For |
|-------------|--------|----------------|---------------|----------|
| Local Approuter | PC browser (`localhost:5000`) | VPN + `bash setup.sh` + `node server.js` | ✅ Yes (with VPN) | Full end-to-end testing with data |
| VS Code Simple Browser | Inside VS Code panel | Same as above + open workspace | ✅ Yes (with VPN) | App in editor without leaving VS Code |
| VS Code Launch Config (F5) | New Chrome tab | Same as above | ✅ Yes (with VPN) | Debugging JS with DevTools attached |
| BAS Simple Browser | Inside BAS panel | CF login + `bash setup.sh` + `node server.js` | ❌ No VPN in cloud | UI rendering check inside BAS |
| BAS - BTP Cockpit | New browser tab | Just BTP login (no approuter needed) | ❌ No VPN in cloud | Quickest CF test — click app name |
| BAS - Direct CF URL | Any browser tab | Just BTP login (no approuter needed) | ❌ No VPN in cloud | Share URL with team |
| Work Zone (future) | Any browser tab | Work Zone tile setup | ❌ (until Cloud Connector fixed) | Production launchpad testing |

> **VS Code = BAS for testing.** Both use the same Simple Browser, same terminal commands,
> same localhost URLs. The only difference: VS Code has direct localhost access (no OAuth
> for port-forwarding), so `Ctrl+Shift+P → Simple Browser` always works in VS Code.

---

### 15.5 Troubleshooting Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| App is blank/white | Approuter not running | Run `node server.js` |
| "Cannot find module server.js" | setup.sh not run yet | Run `bash setup.sh` first |
| "CF not logged in" | setup.sh fails early | Run `cf login --sso` first |
| "No data" in app | VPN not connected | Connect VPN, restart hr7-proxy.js |
| OData 403 error in BAS | No VPN in cloud | Expected — only UI check possible in BAS |
| "FAILED: Routes quota exceeded" | CF org has routes: 0 | Cannot deploy CF apps in btp_cf subaccount |
| Blank in CF Launchpad URL | Old URL (wrong site UUID) | Use `11387043-4c6f-4c9a-94d6-10e084b8b2d2` not `560d5bf2` |
| "URL does not reference valid account" | BAS port-forwarding broken | Use BTP Cockpit HTML5 Applications instead |
| Can't paste in Git Bash (`Ctrl+V` does nothing) | MinTTY doesn't support Ctrl+V | Use right-click → Paste, or use VS Code terminal |
| `bash: $'\E[200~cd': command not found` | Bracketed paste mode wrapping pasted text in escape codes | Type `printf '\e[?2004l'` to disable, then paste again |
| `unknown flag 'sso-passcode VALUE'` | Paste merged flag name and value into one string | Use `cf login` with email/password instead of `--sso-passcode` |
| `User authentication failed` (first attempt) | Wrong password typed | Re-enter the correct password — CF allows retry |

---

## 16. How the Local Approuter Connects to CF

### 16.0 Architecture Overview

The local approuter is a **bridge** between your browser and CF. It runs on your PC and does two things:
1. Fetches the app HTML/JS/CSS from CF HTML5 Repository (using OAuth tokens)
2. Proxies OData calls to the HR7 SAP backend (via hr7-proxy.js on port 5001)

---

### 16.1 Local Approuter Flow (localhost:5000)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        YOUR PC                                       │
│                                                                       │
│   ┌──────────┐    ①  open URL    ┌──────────────────────────────┐   │
│   │  Chrome  │ ──────────────── ▶│  node server.js              │   │
│   │ Browser  │                   │  (approuter on port 5000)     │   │
│   └──────────┘                   └──────────────────────────────┘   │
│        ▲                                  │            │             │
│        │  ④ HTML+JS+CSS                   │ ② fetch    │ ③ OData     │
│        │  rendered in browser             │   app      │   calls     │
│        │                                  ▼            ▼             │
│        │                         ┌──────────┐  ┌──────────────┐     │
│        └─────────────────────────│  CF HTML5│  │ hr7-proxy.js │     │
│          (app content + data)     │   Repo   │  │  port 5001   │     │
│                                   │ (cloud)  │  └──────────────┘     │
└───────────────────────────────────┼──────────┼────────┼──────────────┘
                                    │          │        │ ⑤ via VPN
                              OAuth │          │        ▼
                              token │          │  ┌──────────────┐
                                    │          │  │  HR7 System  │
                                    ▼          │  │ 10.10.1.76   │
                          ┌──────────────────┐ │  │  :8001       │
                          │  SAP BTP         │ │  └──────────────┘
                          │  html5-apps-repo │ │
                          │  app-runtime     │◀┘
                          │  service         │
                          └──────────────────┘
```

**What each step does:**
1. You open `http://localhost:5000/{appId}/index.html` in Chrome
2. `server.js` (approuter) authenticates to CF using credentials from `default-env.json` and fetches the app's HTML/JS/CSS files from CF HTML5 Repository
3. App's OData calls (e.g., `GET /sap/opu/odata/...`) are forwarded to `hr7-proxy.js` on port 5001
4. App content is returned and rendered in your browser
5. `hr7-proxy.js` forwards the OData calls to HR7 (`10.10.1.76:8001`) via your VPN connection

---

### 16.2 CF Direct Flow (CF Launchpad URL)

When you use the CF Direct URL (BTP Cockpit → HTML5 Applications), there is **no local server** at all:

```
┌──────────────────────────────────────────────────────────────────┐
│  YOUR PC (just a browser)                                         │
│                                                                    │
│   ┌──────────┐   open CF URL                                      │
│   │  Chrome  │ ─────────────────────────────────────────────────▶│
│   │ Browser  │                                                     │
│   └──────────┘                                                     │
│        ▲                                                           │
│        │  HTML+JS+CSS rendered                                     │
└────────┼───────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│  SAP BTP Cloud                                                       │
│                                                                       │
│  ┌────────────────────────┐       ┌──────────────────────────────┐  │
│  │  SAP Managed Approuter │──────▶│  CF HTML5 Apps Repository    │  │
│  │  (launchpad.cfapps...) │       │  (your deployed app files)   │  │
│  └────────────────────────┘       └──────────────────────────────┘  │
│              │                                                        │
│              │ OData calls via                                        │
│              ▼ Cloud Connector                                        │
│  ┌─────────────────────────┐                                         │
│  │  virtual-hr7-destination│──── needs Cloud Connector ────▶ HR7    │
│  │  (BTP Destination svc)  │     (not yet fully configured)          │
│  └─────────────────────────┘                                         │
└──────────────────────────────────────────────────────────────────────┘
```

**Key difference:** SAP hosts everything — their managed approuter fetches the app from CF HTML5 Repo and serves it to your browser. No local server needed. OData calls to HR7 need Cloud Connector (not VPN).

---

### 16.3 Side-by-Side Comparison

```
LOCAL APPROUTER                          CF DIRECT
──────────────────────────               ──────────────────────────────────
Browser                                  Browser
   │                                        │
   ▼                                        ▼
localhost:5000                          btp-cf-8qsdli3e.launchpad.cfapps...
(node server.js on YOUR PC)             (SAP's managed approuter in cloud)
   │                                        │
   ├── GET app files ──────────────────────▶┤
   │   (via OAuth token from               │── GET app files ──────────────▶
   │    default-env.json)                  │   (authenticated via BTP session)
   │                                       │
   ▼                                       ▼
CF HTML5 Repository ◀────────────── CF HTML5 Repository
(same source!)                       (same source!)
   │                                       │
   ├── OData calls ──────────────────      ├── OData calls ──────────────
   │   via hr7-proxy.js:5001              │   via Cloud Connector
   │   via VPN to 10.10.1.76:8001         │   via virtual-hr7-destination
   │                                       │
   ▼                                       ▼
HR7 System ✅ (VPN works)             HR7 System ⚠️ (needs Cloud Connector)
```

---

### 16.4 What `setup.sh` Does

`bash setup.sh` prepares the local approuter to connect to CF by creating two files:

```
setup.sh
   │
   ├── calls: cf service-key app-runtime-1779763944 html5-runtime-test-key
   │          (gets OAuth credentials from CF)
   │
   ├── creates: default-env.json
   │            ┌─────────────────────────────────────────────────┐
   │            │ PORT: 5000                                       │
   │            │ destinations:                                    │
   │            │   - ui5cdn → https://ui5.sap.com                │
   │            │   - virtual-hr7-destination → localhost:5001     │
   │            │ VCAP_SERVICES:                                   │
   │            │   html5-apps-repo credentials (OAuth tokens)    │
   │            └─────────────────────────────────────────────────┘
   │
   └── creates: server.js
                ┌─────────────────────────────────────────────────┐
                │ Starts approuter + strips X-Frame-Options header │
                │ (allows iframe embedding in VS Code/BAS)         │
                └─────────────────────────────────────────────────┘
```

`default-env.json` is **gitignored** — it contains your CF service key credentials. Running `setup.sh` regenerates it fresh each session using your current CF login.

---



### 16.1 BAS is VS Code in the browser

SAP Business Application Studio (BAS) is built on VS Code. They share the same UI, same terminal, same Simple Browser feature, and same extension support. From a features perspective, they are the same tool.

However, for **testing apps**, there is one fundamental difference:

| | VS Code (local) | BAS (cloud) |
|---|---|---|
| Runs on | Your PC | SAP's cloud server |
| `localhost:5000` means | Your machine's port 5000 | BAS container's port 5000 |
| Accessing localhost | Direct — no auth needed | Goes through **SAP port-forwarding** → requires BTP OAuth |

---

### 16.2 Why VS Code Simple Browser works but BAS Simple Browser often doesn't

**VS Code Simple Browser:**
```
Browser (your PC) → iframe → http://localhost:5000 → YOUR machine directly
No middleman, no OAuth, always works
```

**BAS Simple Browser:**
```
Browser (your PC) → iframe → SAP port-forwarding (https://port5000-ws-XXXX.us11cf.applicationstudio.cloud.sap)
                                          ↓
                              Requires BTP OAuth (XSUAA)
                                          ↓
                              Sometimes: "URL does not reference a valid account" → BROKEN
```

The BAS port-forwarding OAuth is tied to the workspace session and can expire or become invalid. This is a BTP infrastructure limitation — not a code issue.

---

### 16.3 Can BAS use CF URLs in Simple Browser?

No — for a different reason. CF Launchpad URLs return `X-Frame-Options: SAMEORIGIN` in the response headers.

```
BAS Simple Browser (iframe on btp-cf-8qsdli3e.us11cf.applicationstudio.cloud.sap)
    → tries to load CF URL (btp-cf-8qsdli3e.launchpad.cfapps.us11.hana.ondemand.com)
    → Different origins → X-Frame-Options: SAMEORIGIN → BLOCKED
```

Our `server.js` (local approuter wrapper) strips this header, which is why the local approuter approach can work in VS Code Simple Browser. But we cannot strip this header from SAP's managed launchpad.

**The best BAS testing approach:** Use **BTP Cockpit → HTML5 Applications → click app name** — this opens a new tab (not an iframe), so X-Frame-Options doesn't matter.

---

### 16.4 VS Code Run & Debug — 3 Groups Explained

The `.vscode/launch.json` now has 3 groups in the Run & Debug dropdown:

#### Group 1: ☁ CF Apps (e.g., `☁ cancelacefiling (CF)`)
- **URL:** `http://localhost:5000/comerpisshiperpcancelacefiling/index.html`
- App HTML/JS/CSS is **fetched from CF HTML5 Repository** by the local approuter
- The approuter runs on your PC and authenticates to CF to get the app content
- OData calls: `browser → approuter → hr7-proxy.js → HR7` (needs VPN)
- **Requires:** `node server.js` running + VPN connected
- **Best for:** Full end-to-end testing with live HR7 data

#### Group 2: ☁ CF Direct (e.g., `☁ cancelacefiling (CF Direct)`)
- **URL:** `https://btp-cf-8qsdli3e.launchpad.cfapps.us11.hana.ondemand.com/11387043-4c6f-4c9a-94d6-10e084b8b2d2.comerpisshiperpcancelacefiling.comerpisshiperpcancelacefiling-1.0.0/index.html`
- App loads **directly from SAP's managed launchpad** — no local server needed at all
- OData calls go through Cloud Connector to HR7 (requires Cloud Connector setup)
- **Requires:** BTP login in browser only
- **Best for:** Quick UI check, testing the actual deployed version, no setup needed

#### Group 3: 🌐 Local Source (e.g., `🌐 cancelacefiling (Local Source)`)
- **URL:** `http://localhost:8080/index.html`
- App runs **directly from your local source files** — no CF, no deployment
- Uses `ui5 serve` in the app folder (hot reload — see changes instantly)
- **Requires:** `npx ui5 serve` in the app folder + VPN
- **Best for:** Active development — editing code and seeing changes immediately

#### Quick comparison

| | ☁ CF Apps | ☁ CF Direct | 🌐 Local Source |
|---|---|---|---|
| App source | CF HTML5 Repo | CF HTML5 Repo | Your PC files |
| Local server needed | `node server.js` | **None** | `npx ui5 serve` |
| VPN needed for data | Yes | Yes (+ Cloud Connector) | Yes |
| See code changes immediately | No (redeploy needed) | No (redeploy needed) | **Yes** |
| Use case | Full local test | Quick CF test | Active development |

---

### 16.5 How the CF Direct URL was discovered

The CF Direct URL has 4 parts:

```
https://btp-cf-8qsdli3e.launchpad.cfapps.us11.hana.ondemand.com/
  11387043-4c6f-4c9a-94d6-10e084b8b2d2.    ← Part 2: Site UUID
  comerpisshiperpcancelacefiling.            ← Part 3: sap.cloud.service
  comerpisshiperpcancelacefiling-1.0.0/     ← Part 4: sap.app.id + version
index.html
```

**Part 1 — Host:**
`btp-cf-8qsdli3e` is your BTP subaccount subdomain (same as in your BAS URL).
`launchpad.cfapps.us11.hana.ondemand.com` is SAP's standard managed launchpad domain for the `us11` region.

**Part 2 — Site UUID (`11387043-4c6f-4c9a-94d6-10e084b8b2d2`):**
Discovered by accident — when clicking the Error Log icon for `comerpisshiperpdispute` in BTP Cockpit → HTML5 Applications, the dialog title showed:
```
11387043-4c6f-4c9a-94d6-10e084b8b2d2.comerpisshiperpdispute.comerpisshiperpdispute-1.0.0 - Error Log
```
This revealed the full app key including the site UUID. This UUID represents the "Managed Application Router provided by SAP Build Work Zone, standard edition" which is automatically created when you subscribe to SAP Build Work Zone.

**Part 3 & 4 — App ID (appears twice):**
Both `sap.cloud.service` and `sap.app.id` from `manifest.json`. This is why we fixed both to the same no-dots value (`comerpisshiperp{appname}`) — if `sap.app.id` contained dots (like `com.erpis.shiperp.cancelacefiling`), the URL routing would break because the launchpad uses `.` as a separator between parts.

**Version (`1.0.0`):**
Comes from the MTA deployment. The HTML5 Apps Repository stores each deployed version.

---

### 16.6 The Launch Config Generator Script

**File:** `scripts/generate-launch-configs.js`

**Why it exists:** The CF Direct URL contains the site UUID (`11387043-...`), which could change if the subaccount is recreated. Having it in 27 separate launch configs would mean updating 27 places manually.

**How it works:**
1. Reads the 27 CF app names from `mta.yaml` (source of truth for which apps are in CF)
2. Reads each app's `sap.cloud.service` from its `manifest.json`
3. Generates both `☁ CF Apps` (local) and `☁ CF Direct` (CF URL) sections
4. Merges into `launch.json` preserving all other configs unchanged

**The CF config is in ONE place at the top of the script:**
```js
const CF_CONFIG = {
    host:     'https://btp-cf-8qsdli3e.launchpad.cfapps.us11.hana.ondemand.com',
    siteUuid: '11387043-4c6f-4c9a-94d6-10e084b8b2d2',
    version:  '1.0.0'
};
```

**To regenerate after a CF environment change:**
```bash
node scripts/generate-launch-configs.js
# → Updates launch.json automatically
# → Zero impact on BAS, CF apps, local approuter, or mta.yaml
```

**Impact on other environments:** None. `launch.json` only controls how VS Code opens the browser. It has no effect on deployed CF apps, BAS, or the local approuter.

---

*Document generated: 2026-06-04*
*Next session: Configure Cloud Connector for HR7, then set up Work Zone tiles*
