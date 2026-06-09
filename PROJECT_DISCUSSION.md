# ShipERP Neo to Cloud Foundry Migration — Project Discussion
**Date:** 2026-06-07 | **Author:** Nikki Navarro (nnavarro@erp-is.com)
**Repository:** https://github.com/nikkiledynavarro/work_cloud_foundry
**BTP Subaccount:** btp_cf (us11 region)

> **Recent Updates (2026-06-07):**
> - Removed `planningcockpit` (was TM, not HR7 ECC/EWM)
> - Renamed all paired ECC apps to use explicit `ecc` suffix matching EWM convention:
>   `cancelshipment` → `cancelshipmentecc`, `createshipment` → `createshipmentecc`, `trackshipment` → `trackshipmentecc`
> - All 27 HR7 apps deployed to CF as `public` and visible via direct URLs
> - Fixed mislabel: `planshipment` is **EWM** (uses `ewm_tuv_srv`), not ECC
> - **Deployed 11 SLS apps** targeting the ERP S4 SALES system at `erps4sales.erp-is.com` — same pattern as HR7. Created `virtual-erps4sales-destination` in btp_cf.
> - **Total CF apps now: 38** (27 HR7 + 11 SLS)

---

## Table of Contents
1. [Project Overview](#1-project-overview)
2. [App Inventory — The 27 HR7 Apps](#2-app-inventory--the-27-hr7-apps)
3. [Architecture — How Everything Connects](#3-architecture--how-everything-connects)
4. [MTA Structure](#4-mta-structure)
5. [Key Technical Fixes](#5-key-technical-fixes)
6. [How to Test — Local Approuter](#6-how-to-test--local-approuter)
7. [How to Test — VS Code](#7-how-to-test--vs-code)
8. [How to Test — BAS (Cloud)](#8-how-to-test--bas-cloud)
9. [Testing Summary and Troubleshooting](#9-testing-summary-and-troubleshooting)
10. [CF Deployment Process](#10-cf-deployment-process)
11. [Reference](#11-reference)
12. [Runbooks — Manual UI Steps](#12-runbooks--manual-ui-steps)
13. [Pending Issues — Known Gaps to Close](#13-pending-issues--known-gaps-to-close)

---

## 1. Project Overview

### Goal
Migrate ShipERP's 62 Fiori HTML5 apps from SAP BTP **Neo** to SAP BTP **Cloud Foundry (CF)** HTML5 Applications Repository.

### Why
- SAP Neo environment is being deprecated
- CF is the modern SAP BTP runtime — better integration with Work Zone, managed approuter, MTA deployments
- CF HTML5 Apps Repository allows centralized app hosting
- Work Zone provides a unified launchpad for all Fiori apps

### Scope
Out of 62 Neo apps, we focused on **27 HR7 Apps** (ECC + EWM) because:
- HR7 is ShipERP's main production-like system (`10.10.1.76:8001`)
- Other destinations (HD6, SLS, S23) have fewer apps and different complexity
- All 27 apps use the same `virtual-hr7-destination` backend

---

## 2. App Inventory — The 27 HR7 Apps

> **Important:** ECC and EWM apps are DIFFERENT — never combine them.

| App Folder | CF App ID | Type |
|-----------|-----------|------|
| cancelacefiling | comerpisshiperpcancelacefiling | ECC |
| cancelpickuprequest | comerpisshiperpcancelpickuprequest | ECC |
| cancelshipmentecc | comerpisshiperpcancelshipmentecc | ECC |
| cancelshipmentewm | comerpisshiperpcancelshipmentewm | **EWM** |
| carrierperformancereportecc | comerpisshiperpcarrierperformancereportecc | ECC |
| carrierperformancereportewm | comerpisshiperpcarrierperformancereportewm | **EWM** |
| closedelivery | comerpisshiperpclosedelivery | ECC |
| createshipmentecc | comerpisshiperpcreateshipmentecc | ECC |
| createshipmentewm | comerpisshiperpcreateshipmentewm | **EWM** |
| createshipmentv2ewm | comerpisshiperpcreateshipmentv2ewm | **EWM** |
| dispute | comerpisshiperpdispute | ECC |
| freightaudit | comerpisshiperpfreightaudit | ECC |
| freightauditupload | comerpisshiperpfreightauditupload | ECC |
| freightorderplanning | comerpisshiperpfreightorderplanning | ECC |
| ltlplanning | comerpisshiperpltlplanning | **EWM** |
| manualshipmentecc | comerpisshiperpmanualshipmentecc | ECC |
| manualshipmentewm | comerpisshiperpmanualshipmentewm | **EWM** |
| planshipment | comerpisshiperpplanshipment | **EWM** |
| quickpackecc | comerpisshiperpquickpackecc | ECC |
| quickpackewm | comerpisshiperpquickpackewm | **EWM** |
| requestforpickup | comerpisshiperprequestforpickup | **EWM** |
| saleorder | comerpisshiperpsaleorder | ECC |
| shippingdashboard | comerpisshiperpshippingdashboard | ECC |
| submitacefiling | comerpisshiperpsubmitacefiling | ECC |
| trackshipmentecc | comerpisshiperptrackshipmentecc | ECC |
| trackshipmentewm | comerpisshiperptrackshipmentewm | **EWM** |
| viewacefiling | comerpisshiperpviewacefiling | ECC |

**HR7 Totals:** 17 ECC + 10 EWM = 27 apps

### 2.2 SLS Apps Inventory (27 Apps)

Targeting the **ERP S4 SALES** system (`erps4sales.erp-is.com`, system ID `SLS`) via the `virtual-erps4sales-destination` destination.

**Naming convention:** Each SLS app name = matching HR7 app name + `sls` suffix. One SLS app per HR7 app, no exceptions.

| # | HR7 App | SLS App | CF App ID |
|---|---------|---------|-----------|
| 1 | cancelacefiling | cancelacefilingsls | comerpisshiperpcancelacefilingsls |
| 2 | cancelpickuprequest | cancelpickuprequestsls | comerpisshiperpcancelpickuprequestsls |
| 3 | cancelshipmentecc | cancelshipmenteccsls | comerpisshiperpcancelshipmenteccsls |
| 4 | cancelshipmentewm | cancelshipmentewmsls | comerpisshiperpcancelshipmentewmsls |
| 5 | carrierperformancereportecc | carrierperformancereporteccsls | comerpisshiperpcarrierperformancereporteccsls |
| 6 | carrierperformancereportewm | carrierperformancereportewmsls | comerpisshiperpcarrierperformancereportewmsls |
| 7 | closedelivery | closedeliverysls | comerpisshiperpclosedeliverysls |
| 8 | createshipmentecc | createshipmenteccsls | comerpisshiperpcreateshipmenteccsls |
| 9 | createshipmentewm | createshipmentewmsls | comerpisshiperpcreateshipmentewmsls |
| 10 | createshipmentv2ewm | createshipmentv2ewmsls | comerpisshiperpcreateshipmentv2ewmsls |
| 11 | dispute | disputesls | comerpisshiperpdisputesls |
| 12 | freightaudit | freightauditsls | comerpisshiperpfreightauditsls |
| 13 | freightauditupload | freightaudituploadsls | comerpisshiperpfreightaudituploadsls |
| 14 | freightorderplanning | freightorderplanningsls | comerpisshiperpfreightorderplanningsls |
| 15 | ltlplanning | ltlplanningsls | comerpisshiperpltlplanningsls |
| 16 | manualshipmentecc | manualshipmenteccsls | comerpisshiperpmanualshipmenteccsls |
| 17 | manualshipmentewm | manualshipmentewmsls | comerpisshiperpmanualshipmentewmsls |
| 18 | planshipment | planshipmentsls | comerpisshiperpplanshipmentsls |
| 19 | quickpackecc | quickpackeccsls | comerpisshiperpquickpackeccsls |
| 20 | quickpackewm | quickpackewmsls | comerpisshiperpquickpackewmsls |
| 21 | requestforpickup | requestforpickupsls | comerpisshiperprequestforpickupsls |
| 22 | saleorder | saleordersls | comerpisshiperpsaleordersls |
| 23 | shippingdashboard | shippingdashboardsls | comerpisshiperpshippingdashboardsls |
| 24 | submitacefiling | submitacefilingsls | comerpisshiperpsubmitacefilingsls |
| 25 | trackshipmentecc | trackshipmenteccsls | comerpisshiperptrackshipmenteccsls |
| 26 | trackshipmentewm | trackshipmentewmsls | comerpisshiperptrackshipmentewmsls |
| 27 | viewacefiling | viewacefilingsls | comerpisshiperpviewacefilingsls |

**SLS Total:** 27 apps (perfect 1:1 pairing with HR7)

**Grand Total in CF:** 27 HR7 + 27 SLS = **54 apps**

### 2.1 ECC ↔ EWM Symmetry
Six business functions exist in both ECC and EWM flavors. Naming follows the explicit `ecc` / `ewm` suffix convention:

| ECC version | EWM counterpart |
|-------------|----------------|
| cancelshipmentecc | cancelshipmentewm |
| carrierperformancereportecc | carrierperformancereportewm |
| createshipmentecc | createshipmentewm + createshipmentv2ewm |
| manualshipmentecc | manualshipmentewm |
| quickpackecc | quickpackewm |
| trackshipmentecc | trackshipmentewm |

---

## 3. Architecture — How Everything Connects

### 3.1 Local Approuter Flow (localhost:5000)

```
┌─────────────────────────────────────────────────────────────────┐
│  YOUR PC                                                          │
│                                                                   │
│  ┌──────────┐  ① open URL  ┌───────────────────────────────┐   │
│  │  Chrome  │ ────────────▶│  node server.js               │   │
│  │ Browser  │              │  (approuter on port 5000)      │   │
│  └──────────┘              └───────────────────────────────┘   │
│       ▲                            │              │              │
│       │  ④ HTML+JS+CSS             │ ② fetch app  │ ③ OData     │
│       │  rendered                  ▼              ▼              │
│       │                   ┌──────────────┐  ┌────────────────┐  │
│       └───────────────────│  CF HTML5    │  │ hr7-proxy.js   │  │
│         (app + data)       │  Repository  │  │  port 5001     │  │
│                            │  (cloud)     │  └────────────────┘  │
└────────────────────────────┼─────────────┼────────┼──────────────┘
                             │             │        │ ⑤ via VPN
                       OAuth │             │        ▼
                       token │             │  ┌──────────────┐
                             │             │  │  HR7 System  │
                             ▼             │  │ 10.10.1.76   │
                   ┌──────────────────┐    │  │  :8001       │
                   │  SAP BTP         │    │  └──────────────┘
                   │  html5-apps-repo │◀───┘
                   │  app-runtime     │
                   └──────────────────┘
```

**What each step does:**
1. You open `http://localhost:5000/{appId}/index.html` in Chrome
2. `server.js` fetches app HTML/JS/CSS from CF HTML5 Repository using OAuth tokens from `default-env.json`
3. App OData calls (`/sap/opu/odata/...`) are forwarded to `hr7-proxy.js` on port 5001
4. App content is rendered in your browser
5. `hr7-proxy.js` forwards OData calls to HR7 (`10.10.1.76:8001`) via VPN with Basic Auth header

### 3.2 CF Direct Flow (BTP Launchpad URL — no local server)

```
  YOUR PC (browser only)
       │
       ▼
  Chrome → CF Launchpad URL
                │
                ▼
  ┌─────────────────────────────────────────────────┐
  │  SAP BTP Cloud                                   │
  │                                                   │
  │  SAP Managed Approuter ──▶ CF HTML5 Repository  │
  │  (launchpad.cfapps...)        (your app files)   │
  │          │                                        │
  │          ▼ via Cloud Connector                    │
  │  virtual-hr7-destination ──▶ HR7 System          │
  └─────────────────────────────────────────────────┘
```

No local server needed. App is served entirely from SAP's cloud infrastructure.

### 3.3 Why Three Things Are Needed for Local Testing

| Component | Port | Role | Without It |
|-----------|------|------|------------|
| **OpenVPN** | — | Opens network tunnel to `10.10.1.76` | hr7-proxy can't reach HR7 |
| **hr7-proxy.js** | 5001 | Adds `Authorization: Basic` header, forwards to HR7 | Approuter gets 502 Bad Gateway |
| **node server.js** | 5000 | Fetches app from CF, serves to browser | `localhost:5000` connection refused |

> Think of it this way: **OpenVPN = opens the road. hr7-proxy.js = the car with the right credentials.**

### 3.4 What `setup.sh` Creates

```
bash setup.sh
   │
   ├── Calls: cf service-key app-runtime-1779763944 html5-runtime-test-key
   │
   ├── Creates: default-env.json
   │   (CF OAuth credentials + destination config for approuter)
   │
   ├── Creates: server.js
   │   (approuter wrapper that strips X-Frame-Options header)
   │
   └── Starts: node hr7-proxy.js  ← terminal stays running here
```

`default-env.json` and `server.js` are **gitignored** — they contain credentials and are generated fresh each session.

---

## 4. MTA Structure

Each of the 27 apps has **3 modules** and **3 service resources** in `mta.yaml`:

```
Modules (per app):
  {app}                     → type: html5        (builds the UI5 app)
  {app}-app-content         → deploys zip to HTML5 Repo
  {app}-destination-content → configures BTP destinations

Resources (per app):
  {app}-app-front-service   → html5-apps-repo app-host   (stores app files)
  {app}-destination-service → destination service lite   (routing config)
  {app}-xsuaa-service       → XSUAA application plan     (authentication)
```

Total CF service instances created: **82** (27 apps × 3 + app-runtime-1779763944)

---

## 5. Key Technical Fixes

### 5.1 Absolute UI5 CDN URL
**Problem:** Apps used relative `src="resources/sap-ui-core.js"`. The CF managed launchpad doesn't have a `ui5cdn` route, so the file was never found → blank page.

**Fix:** Changed all 27 `index.html` files to use:
```html
<script src="https://ui5.sap.com/resources/sap-ui-core.js" ...>
```
This works in ALL environments (local, VS Code, BAS, Work Zone) without any destination configuration.

### 5.2 sap.app.id Fix (Removes Dots)
**Problem:** `sap.app.id = com.erpis.shiperp.dispute` (dots). The CF Launchpad URL uses `.` as separators:
```
{site-uuid}.{sap.cloud.service}.{sap.app.id}pkw-1.0.0/index.html
```
Dots inside the app ID break URL routing → "Not Found".

**Fix:** Set `sap.app.id = sap.cloud.service` for All 27 apps (no dots):
```
comerpisshiperpdispute.comerpisshiperpdisputepkw-1.0.0  ← works ✅
comerpisshiperpdispute.com.erpis.shiperp.disputepkw-1.0.0  ← broken ❌
```

### 5.3 setup.sh — sap.cloud.service Fix
**Problem:** `default-env.json` was missing `"sap.cloud.service": "html5-apps-repo-rt"` in the credentials. The approuter failed to find the HTML5 service binding.

**Fix:** Added the field to the credentials section in `setup.sh`.

### 5.4 server.js — X-Frame-Options Fix
**Problem:** CF HTML5 Repository returns `X-Frame-Options: SAMEORIGIN`. The VS Code/BAS integrated browser (iframe) can't embed the app.

**Fix:** Created `server.js` — wraps the approuter and intercepts `res.setHeader()` to strip the `X-Frame-Options` header for local testing.

### 5.5 ECC vs EWM Separation
Critical requirement: ECC and EWM apps serve different SAP modules and must never be mixed.
- `cancelshipmentecc` (ECC) ≠ `cancelshipmentewm` (EWM)
- `createshipmentecc` (ECC) ≠ `createshipmentewm` / `createshipmentv2ewm` (EWM)
- `manualshipmentecc` (ECC) ≠ `manualshipmentewm` (EWM)

### 5.6 XSUAA AppId Fix
Some XSUAA service instances tried to change their `xsappname` during deployment (not allowed after initial creation). Fixed `xs-security.json` files to use the original registered `xsappname`.

### 5.7 Destination: ui5cdn
Added `ui5cdn` destination to BTP Cockpit (`btp_cf` subaccount → Connectivity → Destinations):
- URL: `https://ui5.sap.com`, Type: HTTP, Proxy: Internet, Auth: NoAuthentication

This is a backup for apps served via managed launchpad routes that reference `ui5cdn`.

### 5.8 ECC Suffix Naming Convention (2026-06-07)
**Problem:** Some Neo apps had a plain name for the ECC version and an explicit `ewm` suffix for the EWM counterpart, creating ambiguous naming:
- `cancelshipment` (ECC, no suffix) vs `cancelshipmentewm` (EWM, explicit)
- `createshipment` (ECC, no suffix) vs `createshipmentewm` / `createshipmentv2ewm` (EWM, explicit)
- `trackshipment` (ECC, no suffix — was deployed as `trackshipmenterp`) vs `trackshipmentewm`

**Fix:** When an EWM counterpart exists, the ECC version now uses an explicit `ecc` suffix to mirror the EWM convention. This matches what `manualshipmentecc`/`manualshipmentewm` and `quickpackecc`/`quickpackewm` already did. Apps WITHOUT an EWM counterpart (`dispute`, `saleorder`, `shippingdashboard`, `closedelivery`, etc.) keep their plain names.

**Renamed apps:**
| Old name | New name | CF App ID |
|----------|----------|-----------|
| cancelshipment | **cancelshipmentecc** | comerpisshiperpcancelshipmentecc |
| createshipment | **createshipmentecc** | comerpisshiperpcreateshipmentecc |
| trackshipment / trackshipmenterp | **trackshipmentecc** | comerpisshiperptrackshipmentecc |

Each rename touched: folder name, `manifest.json` (sap.app.id, sap.cloud.service, semanticObject), `package.json`, `ui5.yaml`, `xs-app.json`, `mta.yaml` modules and resources, `xs-security-*.json` file, `.vscode/launch.json` + `tasks.json`, workspace file.

### 5.9 Removed: planningcockpit (Wrong Classification)
Originally migrated as an "ECC" app, but `planningcockpit` actually uses `serptm/PLANNING_SRV` — a **Transportation Management (TM)** service, not ECC or EWM. Since the Neo launchpad never had a tile for it, and HR7 doesn't run TM, it was removed entirely from CF, mta.yaml, project files, and security descriptors.

---

## 6. How to Test — Local Approuter

The local approuter runs on your PC, fetches app content from CF HTML5 Repository, and serves it at `http://localhost:5000`. Best option for testing with **live HR7 data**.

### 6.1 Prerequisites
- **OpenVPN** connected to `erp-is`
- Node.js installed
- Git Bash installed

### 6.2 First-Time Setup (run once ever)
```bash
# In Git Bash:
cd C:/Users/nikki/OneDrive/Desktop/AI/Codex/Work/neo_to_cf/approuter
npm install
```

### 6.3 Every Session

> **Git Bash tip:** `Ctrl+V` does NOT work — use **right-click → Paste**.
> Alternatively, open the terminal inside VS Code (`Ctrl+\``) where `Ctrl+V` works normally.

**Window 1 — Open Git Bash:**
```bash
# Step 1: Navigate to approuter folder
cd C:/Users/nikki/OneDrive/Desktop/AI/Codex/Work/neo_to_cf/approuter

# Step 2: Log in to CF
cf login -a https://api.cf.us11.hana.ondemand.com
# Enter: nnavarro@erp-is.com
# Enter: your password
# You should see: Targeted org ... Targeted space DEV

# Step 3: Run setup (creates credentials + starts hr7-proxy on port 5001)
bash setup.sh
```

After Step 3 you will see:
```
✅ default-env.json created successfully
server.js created
=== Starting HR7 Auth Proxy on port 5001 ===
Keep this terminal open — open a NEW terminal and run: node server.js
HR7 Auth Proxy running on port 5001
Forwarding to http://10.10.1.76:8001 as NNAVARRO_AI
```
**The terminal is now "stuck" — this is normal. DO NOT close this window.**

**Window 2 — Open a NEW Git Bash (or VS Code terminal):**
```bash
cd C:/Users/nikki/OneDrive/Desktop/AI/Codex/Work/neo_to_cf/approuter
node server.js
# Wait for: "Application router is listening on port: 5000"
```

### 6.4 Opening Apps

Open Chrome and go to any of these URLs:

| App | URL |
|-----|-----|
| Cancel ACE Filing | `http://localhost:5000/comerpisshiperpcancelacefiling/index.html` |
| Cancel Pickup Request | `http://localhost:5000/comerpisshiperpcancelpickuprequest/index.html` |
| Cancel Shipment (ECC) | `http://localhost:5000/comerpisshiperpcancelshipmentecc/index.html` |
| Cancel Shipment (EWM) | `http://localhost:5000/comerpisshiperpcancelshipmentewm/index.html` |
| Carrier Performance (ECC) | `http://localhost:5000/comerpisshiperpcarrierperformancereportecc/index.html` |
| Carrier Performance (EWM) | `http://localhost:5000/comerpisshiperpcarrierperformancereportewm/index.html` |
| Close Delivery | `http://localhost:5000/comerpisshiperpclosedelivery/index.html` |
| Create Shipment (ECC) | `http://localhost:5000/comerpisshiperpcreateshipmentecc/index.html` |
| Create Shipment (EWM) | `http://localhost:5000/comerpisshiperpcreateshipmentewm/index.html` |
| Create Shipment V2 (EWM) | `http://localhost:5000/comerpisshiperpcreateshipmentv2ewm/index.html` |
| Dispute | `http://localhost:5000/comerpisshiperpdispute/index.html` |
| Freight Audit | `http://localhost:5000/comerpisshiperpfreightaudit/index.html` |
| Freight Audit Upload | `http://localhost:5000/comerpisshiperpfreightauditupload/index.html` |
| Freight Order Planning | `http://localhost:5000/comerpisshiperpfreightorderplanning/index.html` |
| LTL Planning | `http://localhost:5000/comerpisshiperpltlplanning/index.html` |
| Manual Shipment (ECC) | `http://localhost:5000/comerpisshiperpmanualshipmentecc/index.html` |
| Manual Shipment (EWM) | `http://localhost:5000/comerpisshiperpmanualshipmentewm/index.html` |
| Plan Shipment | `http://localhost:5000/comerpisshiperpplanshipment/index.html` |
| Quick Pack (ECC) | `http://localhost:5000/comerpisshiperpquickpackecc/index.html` |
| Quick Pack (EWM) | `http://localhost:5000/comerpisshiperpquickpackewm/index.html` |
| Request for Pickup | `http://localhost:5000/comerpisshiperprequestforpickup/index.html` |
| Sale Order | `http://localhost:5000/comerpisshiperpsaleorder/index.html` |
| Shipping Dashboard | `http://localhost:5000/comerpisshiperpshippingdashboard/index.html` |
| Submit ACE Filing | `http://localhost:5000/comerpisshiperpsubmitacefiling/index.html` |
| Track Shipment (ECC) | `http://localhost:5000/comerpisshiperptrackshipmentecc/index.html` |
| Track Shipment (EWM) | `http://localhost:5000/comerpisshiperptrackshipmentewm/index.html` |
| View ACE Filing | `http://localhost:5000/comerpisshiperpviewacefiling/index.html` |

### 6.5 Stopping
```bash
kill $(lsof -ti:5000)   # stops approuter
kill $(lsof -ti:5001)   # stops hr7-proxy
```

---

## 7. How to Test — VS Code

> **BAS is VS Code in the browser.** They share the same features. The key difference:
> VS Code accesses `localhost` directly (no auth issues). BAS routes `localhost` through
> SAP's port-forwarding service which can have OAuth issues.

### 7.1 Opening the Workspace

**Option A — From VS Code Welcome page (quickest)**
When VS Code opens, look in the **Recent** section on the Welcome tab.
Click **`shiperp-hr7 (Workspace)`** — it loads everything automatically.

**Option B — From the menu**
```
File → Open Workspace from File →
C:\Users\nikki\OneDrive\Desktop\AI\Codex\Work\neo_to_cf\shiperp-hr7.code-workspace
```

**Option C — Double-click in Windows File Explorer**
```
C:\Users\nikki\OneDrive\Desktop\AI\Codex\Work\neo_to_cf\shiperp-hr7.code-workspace
```

> If apps are not visible in the Explorer panel, the workspace is not loaded — use one of the options above.
> The Explorer should show **SHIPERP-HR7 (WORKSPACE)** at the top with all app folders listed.

### 7.2 First-Time Git Bash Setup (run once ever)
Before using VS Code F5 for the first time, you must run `setup.sh` once from Git Bash to create `default-env.json`:
```bash
cd C:/Users/nikki/OneDrive/Desktop/AI/Codex/Work/neo_to_cf/approuter
cf login -a https://api.cf.us11.hana.ondemand.com
bash setup.sh
```
After this, `default-env.json` stays on your PC. You only need to re-run `setup.sh` if CF credentials expire.

### 7.3 Daily VS Code Workflow (after first-time setup)
1. Connect **OpenVPN** to `erp-is`
2. Open `shiperp-hr7 (Workspace)` in VS Code
3. Press `Ctrl+Shift+D` → **Run & Debug** panel opens
4. In the dropdown, select an app from the **`☁ CF Apps`** group
5. Press **F5** — VS Code automatically starts hr7-proxy + approuter, then opens Chrome

### 7.4 VS Code Run & Debug Groups

The dropdown has **3 groups**:

#### ☁ CF Apps (e.g., `☁ cancelacefiling (CF)`)
- **URL:** `http://localhost:5000/comerpisshiperpcancelacefiling/index.html`
- App fetched **from CF HTML5 Repository** via local approuter
- F5 auto-starts hr7-proxy (port 5001) and approuter (port 5000)
- **Needs:** OpenVPN on | **Best for:** Full testing with live HR7 data

#### ☁ CF Direct (e.g., `☁ cancelacefiling (CF Direct)`)
- **URL:** `https://btp-cf-8qsdli3e.launchpad.cfapps.us11.hana.ondemand.com/a167a84f-0812-44fd-86e6-01c300d56f26.comerpisshiperpcancelacefiling.comerpisshiperpcancelacefiling-1.0.0/index.html`
- App loads **directly from CF** — no local server needed
- **Needs:** BTP login in browser only | **Best for:** Quick UI check, no setup required

#### 🌐 Local Source (e.g., `🌐 cancelacefiling (Local Source)`)
- **URL:** `http://localhost:8080/index.html`
- App runs **from your local source files** — changes visible immediately
- **Needs:** `npx ui5 serve` in the app folder | **Best for:** Active code development

### 7.5 Integrated Browser Inside VS Code
Instead of opening Chrome, you can view apps inside VS Code:
1. Press `Ctrl+Shift+P` → type `brow` → select **`Browser: Open Integrated Browser`**
2. In the URL bar of the browser panel, type: `http://localhost:5000/{appId}/index.html`

> ⚠️ If you see **"Failed to Load Page — ERR_CONNECTION_REFUSED"**, the approuter is not running.
> Start it first with F5 or `node server.js`, then reload.

> **Note:** `Simple Browser: Show` is an alternative but may not appear when GitHub Copilot Chat is installed.
> Use `Browser: Open Integrated Browser` instead.

### 7.6 How the CF Direct URL Was Built

The CF Direct URL has 4 parts:
```
https://btp-cf-8qsdli3e.launchpad.cfapps.us11.hana.ondemand.com/
  a167a84f-0812-44fd-86e6-01c300d56f26.   ← Site UUID (from BTP HTML5 Applications)
  comerpisshiperpcancelacefiling.           ← sap.cloud.service
  comerpisshiperpcancelacefiling-1.0.0/    ← sap.app.id + version
index.html
```

The **UUID** in the CF Direct URL (`a167a84f-0812-44fd-86e6-01c300d56f26`) is **NOT a Work Zone Site UUID** — despite the variable name in the launch config script. It's actually the **GUID of one app's destination-service instance** (in our case, `cancelacefiling-destination-service`). The CF managed launchpad uses it to establish the auth/route context, then serves whatever app is named in the next URL segment.

Each of the 27 apps has its OWN destination-service GUID. Any of them works equivalently as the URL prefix. The launch config script just picks one and reuses it across all apps for consistency. Verified via:
```bash
cf curl /v3/service_instances/a167a84f-0812-44fd-86e6-01c300d56f26
# → name: cancelacefiling-destination-service
```

### 7.7 The Launch Config Generator Script
If the CF environment changes (new destination GUID, different host), update `scripts/generate-launch-configs.js`:

```js
const CF_CONFIG = {
    host:     'https://btp-cf-8qsdli3e.launchpad.cfapps.us11.hana.ondemand.com',
    siteUuid: 'a167a84f-0812-44fd-86e6-01c300d56f26',  // misnomer — actually a destination-service GUID
    version:  '1.0.0'
};
```

> **Heads-up:** The variable is named `siteUuid` for historical reasons but is actually any one app's destination-service GUID. To find a current valid one if this stops working, run:
> ```bash
> cf curl '/v3/service_instances?per_page=300' | python3 -c "
>   import sys,json
>   for r in json.load(sys.stdin)['resources']:
>     if r['name'].endswith('-destination-service') and 'comerpisshiperp' in r['name']:
>       print(r['name'], r['guid']); break
> "
> ```

Then run:
```bash
node scripts/generate-launch-configs.js
# Regenerates both ☁ CF Apps and ☁ CF Direct sections in launch.json
# Zero impact on BAS, deployed apps, or approuter
```

---

## 8. How to Test — BAS (Cloud)

BAS (SAP Business Application Studio) is VS Code running in SAP's cloud.

> **⚠️ Important reality check (2026-06-07):** Until the Cloud Connector exposes the HR7 system to the btp_cf subaccount (see §12.2), BAS testing is **UI-rendering only** — OData calls will fail with 502 because the CC tunnel from BTP cloud → on-premise HR7 isn't configured. BAS has no VPN and can't use the local approuter, so this is a hard blocker for data-dependent testing.
>
> For **live data testing** today, use **Local Approuter** (§6 or VS Code F5 `☁ CF Apps`). That path uses your laptop's VPN directly to ECC HR7 — completely bypasses the CC.

### 8.1 Best Option — BTP Cockpit HTML5 Applications (UI Review)
No approuter needed at all:
1. Go to `https://apac.cockpit.btp.cloud.sap`
2. Navigate to: `btp_cf subaccount → HTML5 Applications`
3. Click any app name (e.g., `comerpisshiperpdispute`) → opens in a new tab ✅

The UI loads from CF HTML5 Apps Repository — works without VPN or CC. OData calls within the app will fail until §12.2 is resolved.

### 8.2 CF Direct URL in Browser (UI Review)
Paste directly in your Chrome browser (you must be logged in to BTP):
```
https://btp-cf-8qsdli3e.launchpad.cfapps.us11.hana.ondemand.com/{anyDestServiceGuid}.{appId}.{appId}-1.0.0/index.html
```
Example for Dispute:
```
https://btp-cf-8qsdli3e.launchpad.cfapps.us11.hana.ondemand.com/a167a84f-0812-44fd-86e6-01c300d56f26.comerpisshiperpdispute.comerpisshiperpdispute-1.0.0/index.html
```

> The first UUID segment is any deployed app's destination-service GUID (see §7.6). Same caveat — UI loads, OData fails until §12.2 is resolved.

### 8.3 BAS Approuter (if port-forwarding OAuth works)
If you want to run the approuter inside BAS:

```bash
# In BAS terminal (work_cloud_foundry $):

# Step 1: Pull latest code
git pull origin main

# Step 2: Login to CF
cf login -a https://api.cf.us11.hana.ondemand.com
# Enter email and password

# Step 3: Setup and start
cd approuter
bash setup.sh
# Terminal stays running (hr7-proxy on port 5001)

# Step 4: Open a NEW BAS terminal, then:
node server.js
# Wait for: "Application router is listening on port: 5000"
```

Then open a URL in your browser:
`http://localhost:5000/{appId}/index.html`

> ⚠️ **BAS port-forwarding may not work** — this depends on the BTP subaccount configuration.
> Even when it does work, OData still fails because BAS's hr7-proxy has no VPN to reach `10.10.1.76`. Use **Option 8.1** for UI review instead.

### 8.4 What to Expect in BAS Today
- ✅ **App renders with Fiori UI** (tabs, buttons, table headers, dialogs)
- ✅ **Click navigation works** (route changes, view transitions)
- ❌ **Tables / lists are empty** (OData 502 — CC tunnel for HR7 not configured for btp_cf)
- ❌ **Error popups about failed OData calls** (expected)
- ❌ **Blank white page** = setup.sh didn't run OR node server.js isn't running

### 8.5 When BAS Testing WILL Have Data
Once §12.2 is resolved (rsantos adds HR7 system mapping to btp_cf in Cloud Connector), BAS testing will get real data automatically — no app changes needed. The current `virtual-hr7-destination` config is correct; the only missing piece is the CC mapping.

---

## 9. Testing Summary and Troubleshooting

### 9.1 Summary Table

| Method | App Source | Local Server | OData Path | Has Live Data Today? | Best For |
|--------|-----------|-------------|-----------|---------------------|----------|
| Local Approuter (Chrome) | CF HTML5 Repo | `node server.js` + hr7-proxy | hr7-proxy → VPN → 10.10.1.76:8001 (ECC) | ✅ Yes | Full end-to-end with live ECC data |
| VS Code F5 `☁ CF Apps` | CF HTML5 Repo | Auto-started by F5 | Same as above | ✅ Yes | Same as above, easier start |
| VS Code F5 `☁ CF Direct` | CF HTML5 Repo | **None** | BTP destination → CC → S/4 HR7 | ❌ Until §12.2 | UI review only (today) |
| VS Code Integrated Browser | CF HTML5 Repo | `node server.js` needed | hr7-proxy → VPN | ✅ Yes | App inside VS Code editor |
| BAS → BTP Cockpit HTML5 Apps | CF HTML5 Repo | **None** | BTP destination → CC → S/4 HR7 | ❌ Until §12.2 | UI review only (today) |
| BAS → CF Direct URL | CF HTML5 Repo | **None** | BTP destination → CC → S/4 HR7 | ❌ Until §12.2 | Share URL with team for UI review |
| Work Zone (future) | CF HTML5 Repo | **None** | BTP destination → CC → S/4 HR7 | ❌ Until §12.2 | Production launchpad |

> **Why two HR7 data paths?** Local Approuter targets the **ECC HR7** at `10.10.1.76:8001` via your laptop's VPN. All cloud-based paths (CF Direct, BAS, Work Zone) target the **S/4HANA HR7** at `virtual-s4hr7.erp-is.com:50000` via the BTP destination service + Cloud Connector. They're two different production systems — see §12.2 for the full breakdown.

### 9.2 Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `localhost refused to connect` | Approuter not running | Run `node server.js` |
| `502 Bad Gateway` on OData calls | hr7-proxy.js not running | Run `node hr7-proxy.js` (or restart `bash setup.sh`) |
| `App loads but no data` | VPN not connected | Connect OpenVPN to `erp-is` |
| `ERR_CONNECTION_REFUSED` in VS Code browser | Approuter not started | Press F5 first or run `node server.js` |
| `Blank white page` | Approuter not running or setup.sh not run | Run `bash setup.sh` then `node server.js` |
| `Not Found` on CF URL | Wrong site UUID | Use `a167a84f-0812-44fd-86e6-01c300d56f26` not `560d5bf2` |
| `URL does not reference valid account` | BAS port-forwarding broken | Use BTP Cockpit HTML5 Applications instead |
| `Ctrl+V` doesn't paste in Git Bash | MinTTY doesn't support Ctrl+V | Use right-click → Paste |
| `bash: $'\E[200~cd': command not found` | Bracketed paste mode | Type `printf '\e[?2004l'` to disable, then paste |
| `unknown flag 'sso-passcode VALUE'` | Paste issue with `--sso-passcode` | Use `cf login` with email/password instead |
| `FAILED: Routes quota exceeded` | CF org has routes: 0 | Cannot deploy CF apps in btp_cf subaccount |

---

## 10. CF Deployment Process

### 10.1 Build
```bash
# Windows (Git Bash) — add GnuWin32 make to PATH first
export PATH="$PATH:/c/Program Files (x86)/GnuWin32/bin"
mbt build
# Output: mta_archives/shiperp-fiori-cf-migration_0.0.1.mtar
```

### 10.2 Deploy
```bash
cf login -a https://api.cf.us11.hana.ondemand.com
cf deploy mta_archives/shiperp-fiori-cf-migration_0.0.1.mtar -f
# Takes ~5-10 minutes for 27 apps
```

### 10.3 What Deployment Creates
In `btp_cf/DEV` CF space:
- **No running CF apps** (HTML5 apps don't run as CF apps)
- **91 service instances**: 27x app-host + 27x destination + 27x XSUAA + app-runtime

### 10.4 Regenerate Launch Configs After Deploy
```bash
node scripts/generate-launch-configs.js
git add .vscode/launch.json && git commit -m "chore: regenerate CF launch configs"
```

---

## 11. Reference

### 11.1 Important URLs

| Purpose | URL |
|---------|-----|
| BTP Cockpit | https://apac.cockpit.btp.cloud.sap |
| HTML5 Applications | BTP Cockpit → btp_cf → HTML5 Applications |
| BAS | https://btp-cf-8qsdli3e.us11cf.applicationstudio.cloud.sap |
| CF Passcode | https://login.cf.us11.hana.ondemand.com/passcode |
| GitHub Repo | https://github.com/nikkiledynavarro/work_cloud_foundry |
| CF API | https://api.cf.us11.hana.ondemand.com |

### 11.2 CF Direct URL Pattern (All 27 apps)

The URL structure is:
```
{launchpad-host}/{destination-service-guid}.{sap.cloud.service}.{sap.app.id}-{version}/index.html
```

The first UUID segment is the GUID of **any** deployed app's `*-destination-service` instance — it's NOT a Work Zone Site UUID. The CF managed launchpad uses it to establish the auth/route context, then serves whatever app is named in the next URL segment. All 27 destination-service GUIDs are interchangeable in this position.

We use `cancelacefiling-destination-service`'s GUID (`a167a84f-0812-44fd-86e6-01c300d56f26`) by convention for all 27 URLs.

Base: `https://btp-cf-8qsdli3e.launchpad.cfapps.us11.hana.ondemand.com/a167a84f-0812-44fd-86e6-01c300d56f26.`

| App | Append to base |
|-----|---------------|
| cancelacefiling | `comerpisshiperpcancelacefiling.comerpisshiperpcancelacefiling-1.0.0/index.html` |
| cancelpickuprequest | `comerpisshiperpcancelpickuprequest.comerpisshiperpcancelpickuprequest-1.0.0/index.html` |
| cancelshipmentecc | `comerpisshiperpcancelshipmentecc.comerpisshiperpcancelshipmentecc-1.0.0/index.html` |
| cancelshipmentewm | `comerpisshiperpcancelshipmentewm.comerpisshiperpcancelshipmentewm-1.0.0/index.html` |
| carrierperformancereportecc | `comerpisshiperpcarrierperformancereportecc.comerpisshiperpcarrierperformancereportecc-1.0.0/index.html` |
| carrierperformancereportewm | `comerpisshiperpcarrierperformancereportewm.comerpisshiperpcarrierperformancereportewm-1.0.0/index.html` |
| closedelivery | `comerpisshiperpclosedelivery.comerpisshiperpclosedelivery-1.0.0/index.html` |
| createshipmentecc | `comerpisshiperpcreateshipmentecc.comerpisshiperpcreateshipmentecc-1.0.0/index.html` |
| createshipmentewm | `comerpisshiperpcreateshipmentewm.comerpisshiperpcreateshipmentewm-1.0.0/index.html` |
| createshipmentv2ewm | `comerpisshiperpcreateshipmentv2ewm.comerpisshiperpcreateshipmentv2ewm-1.0.0/index.html` |
| dispute | `comerpisshiperpdispute.comerpisshiperpdispute-1.0.0/index.html` |
| freightaudit | `comerpisshiperpfreightaudit.comerpisshiperpfreightaudit-1.0.0/index.html` |
| freightauditupload | `comerpisshiperpfreightauditupload.comerpisshiperpfreightauditupload-1.0.0/index.html` |
| freightorderplanning | `comerpisshiperpfreightorderplanning.comerpisshiperpfreightorderplanning-1.0.0/index.html` |
| ltlplanning | `comerpisshiperpltlplanning.comerpisshiperpltlplanning-1.0.0/index.html` |
| manualshipmentecc | `comerpisshiperpmanualshipmentecc.comerpisshiperpmanualshipmentecc-1.0.0/index.html` |
| manualshipmentewm | `comerpisshiperpmanualshipmentewm.comerpisshiperpmanualshipmentewm-1.0.0/index.html` |
| planshipment | `comerpisshiperpplanshipment.comerpisshiperpplanshipment-1.0.0/index.html` |
| quickpackecc | `comerpisshiperpquickpackecc.comerpisshiperpquickpackecc-1.0.0/index.html` |
| quickpackewm | `comerpisshiperpquickpackewm.comerpisshiperpquickpackewm-1.0.0/index.html` |
| requestforpickup | `comerpisshiperprequestforpickup.comerpisshiperprequestforpickup-1.0.0/index.html` |
| saleorder | `comerpisshiperpsaleorder.comerpisshiperpsaleorder-1.0.0/index.html` |
| shippingdashboard | `comerpisshiperpshippingdashboard.comerpisshiperpshippingdashboard-1.0.0/index.html` |
| submitacefiling | `comerpisshiperpsubmitacefiling.comerpisshiperpsubmitacefiling-1.0.0/index.html` |
| trackshipmentecc | `comerpisshiperptrackshipmentecc.comerpisshiperptrackshipmentecc-1.0.0/index.html` |
| trackshipmentewm | `comerpisshiperptrackshipmentewm.comerpisshiperptrackshipmentewm-1.0.0/index.html` |
| viewacefiling | `comerpisshiperpviewacefiling.comerpisshiperpviewacefiling-1.0.0/index.html` |

### 11.3 File Structure

```
neo_to_cf/
├── apps/                          ← 27 CF apps + Neo backup apps
│   └── {appname}/
│       ├── index.html             ← UI5 bootstrap (absolute CDN URL)
│       ├── manifest.json          ← sap.app.id = sap.cloud.service (no dots)
│       ├── xs-app.json            ← per-app routing for managed launchpad
│       └── Component.js           ← UI5 component
├── approuter/
│   ├── setup.sh                   ← generates credentials + starts hr7-proxy
│   ├── xs-app.json                ← LOCAL approuter routing config
│   ├── package.json               ← @sap/approuter dependency
│   ├── default-env.json           ← GITIGNORED — CF credentials for local dev
│   ├── server.js                  ← GITIGNORED — strips X-Frame-Options header
│   └── hr7-proxy.js               ← GITIGNORED — local HR7 proxy on port 5001
├── scripts/
│   └── generate-launch-configs.js ← regenerates VS Code launch configs
├── security/
│   └── xs-security-{app}.json     ← XSUAA security descriptors (27 files)
├── .vscode/
│   ├── launch.json                ← 3 groups: CF Apps, CF Direct, Local Source
│   └── tasks.json                 ← auto-starts hr7-proxy + approuter on F5
├── mta.yaml                       ← MTA deployment descriptor (27 apps)
├── .gitignore                     ← excludes credentials, server.js, dist/
├── shiperp-hr7.code-workspace     ← VS Code workspace (open this file)
└── PROJECT_DISCUSSION.md          ← this file
```

### 11.4 Known Limitations & Next Steps

| Item | Status | What's Needed |
|------|--------|--------------|
| All 27 apps deployed to CF | ✅ Done | Verified via `cf html5-list` |
| Apps accessible via CF Direct URL | ✅ Done | See section 11.2 |
| HR7 live data in CF | ❌ OData 502/403 | Configure Cloud Connector to expose `virtual-s4hr7.erp-is.com` |
| Work Zone Site tiles | ⚠️ Partial | Some tiles still missing — see section 9 for known cases |
| shippingdashboard full OVP | ⚠️ Partial | Needs Work Zone for Overview Page library |
| BAS port-forwarding | ⚠️ May not work | BTP subaccount port-forwarding config |

---

## 12. Runbooks — Manual UI Steps

### 12.1 Add Renamed Apps to Work Zone Site

When you rename an app (e.g., `cancelshipment` → `cancelshipmentecc`), the CF deployment is automated but the **Work Zone Site tile** must be added manually because:
- Work Zone Site tile editing requires user-context tokens (not service credentials)
- The Site config is owned by SAP Build Work Zone Standard subscription
- No CF CLI command exists for tile assignment

**When to run this runbook:**
- After renaming an app (today: `cancelshipmentecc`, `createshipmentecc`, `trackshipmentecc`)
- After deploying a brand-new app
- After deleting an app (to remove the stale tile)

**Step-by-step:**

1. **Open BTP Cockpit** → https://apac.cockpit.btp.cloud.sap
2. Navigate to **btp_cf** subaccount (us11 region)
3. Left sidebar → **Services** → **Instances and Subscriptions**
4. Find **SAP Build Work Zone, Standard Edition** → click the link/Go to Application
5. You're now in Work Zone Site Director. Left sidebar has:
   - **Site Directory** (sites you've created)
   - **Channel Manager** (where HTML5 apps are registered)
   - **Content Manager** (where tiles/catalogs/groups are configured)
6. Open **Channel Manager** → **HTML5 Apps**
   - Verify your renamed apps appear here. If missing, click **+ Add Channel** and re-sync from html5-apps-repo
7. Open **Content Manager** → **Apps**
   - Search for the renamed app (e.g., `comerpisshiperpcancelshipmentecc`)
   - If it's NOT in the list, click **+ New App** → Type: SAP Fiori → pick from Channel Manager
   - Set: Title (`Cancel Shipment ECC`), Subtitle (`HR7`), Icon, Semantic Object (`cancelshipecc`), Action (`display`)
8. Open **Content Manager** → **Catalogs**
   - Find the catalog used by your site (likely "HR7 Apps")
   - Click it → **+ Add Apps** → select your renamed app → Save
9. Open **Content Manager** → **Groups** (if your Site uses groups)
   - Add the app to the relevant group (e.g., "HR7 ECC Apps")
10. Open **Site Directory** → click your Site (UUID `a167a84f-0812-44fd-86e6-01c300d56f26`)
11. **Publish** the site (top right) → wait ~30s for cache to update
12. Open the launchpad URL → verify the new tile appears

**Remove stale tile** (for the OLD `cancelshipment` etc.):
- Content Manager → Apps → search OLD name (e.g., `cancelshipment`) → Delete
- Then re-publish the Site

### 12.2 Cloud Connector for HR7 Live Data — Investigation & Status

#### Background: Two Different "HR7" Systems

A critical clarification surfaced during this investigation: there are **two different SAP systems** both called "HR7" in different contexts.

| System | Where referenced | What it is |
|--------|------------------|------------|
| **ECC HR7** at `10.10.1.76:8001` | Your CLAUDE.md, local hr7-proxy.js, VPN-only access | Classic NetWeaver/ECC system. Used for your personal dev testing via local approuter. User: `NNAVARRO_AI`. |
| **S/4HANA HR7** at `virtual-s4hr7.erp-is.com:50000` | Both Neo and CF `virtual-hr7-destination` | Modern S/4HANA system. What all 27 deployed apps actually targeted in production. User: `PWANGDALI`. |

The Neo apps have been running against the **S/4HANA HR7** (port 50000), not the ECC HR7 (port 8001). The local approuter happens to use the ECC HR7 because that's what VPN access is convenient for.

> **For CF production:** the destination already points at S/4HANA HR7. You do NOT need to change this — it matches what Neo used.

#### Investigation Findings (2026-06-07)

**Cloud Connector Setup**
- Connector ID `643440000B8211E898F8D9F60A0A0136` — **one physical CC** serves both Neo and btp_cf
- Connection initiated by `rsantos@erp-is.com`
- CC Version `2.18.0`, single instance (HA inactive)

**Per-subaccount system mappings (in the CC):**
| Subaccount Connection | Exposes `virtual-s4hr7.erp-is.com:50000`? | Notes |
|----------------------|-------------------------------------------|-------|
| Neo (`Fiori Development Apps`) | ✅ Yes — Neo apps work | Mapping created when Neo apps were deployed |
| **btp_cf (us11)** | ❌ **No** | Only `erps42023`, `erps42023cd`, `s4std21` are mapped |

**Destination comparison:**
| Property | Neo `virtual-hr7-destination` | CF `virtual-hr7-destination` |
|----------|------------------------------|------------------------------|
| URL | `https://virtual-s4hr7.erp-is.com:50000` | `http://virtual-s4hr7.erp-is.com:50000` (server normalizes to http even when set to https) |
| User | (Neo creds) | `PWANGDALI` |
| Password | (Neo creds) | `ERPPassword1` |
| ProxyType | `OnPremise` | `OnPremise` |
| ProxyProtocol | (HTTPS) | `HTTPS` (fixed 2026-06-07) |
| CloudConnectorLocationId | (default) | (cleared 2026-06-07 — was `a`) |

#### Fixes Already Applied to btp_cf Destination

Applied via Destination Service API (Python script using subaccount destination service credentials):

1. **Removed `CloudConnectorLocationId=a`** — was pointing at a non-existent location, since the connected CC has Location ID `(default)`.
2. **Changed `ProxyProtocol` from `HTTP` to `HTTPS`** — matches what Neo's working configuration uses.
3. **Attempted URL `http://`→`https://` change** — API accepts the change (returns `Count: 1`) but the server normalizes the URL back to `http://`. This is likely a server-side rule (perhaps requiring a destination trust certificate). It probably doesn't matter for runtime since `ProxyProtocol` controls the CC-to-backend protocol; the URL field is mostly informational at this point.

#### The Remaining Blocker — Action Needed from `rsantos`

The Cloud Connector has the HR7 system mapping for Neo but NOT for btp_cf. `rsantos` needs to extend the existing mapping (no new mapping to create):

**Step-by-step for rsantos:**

1. Open Cloud Connector admin UI on the CC host (typically `https://localhost:8443`)
2. Switch to **Configuration → Cloud → Subaccounts**
3. Confirm both connections are listed:
   - Neo: subdomain `da56ca735` (Fiori Development Apps)
   - btp_cf: subaccount ID `eecc9986-a678-4206-b6b5-4a486cd0a4fe`
4. Click the **Neo subaccount connection** → **Cloud To On-Premise** → find the `virtual-s4hr7.erp-is.com:50000` system mapping
5. Note the **Internal Host** and **Internal Port** it points at (this is the actual S/4 HR7 endpoint)
6. Switch to the **btp_cf subaccount connection** → **Cloud To On-Premise** → **+ Add System Mapping**
   - Back-end Type: `ABAP System` (or whatever Neo's mapping uses)
   - Protocol: `HTTPS` (match Neo)
   - Internal Host: *(same as step 5)*
   - Internal Port: *(same as step 5)*
   - Virtual Host: `virtual-s4hr7.erp-is.com`
   - Virtual Port: `50000`
   - Principal Type: `None` (or whatever Neo uses)
   - Save
7. Under the new system mapping → **Resources** → **+ Add**
   - URL Path: `/sap/opu/odata/`
   - Access Policy: `Path And All Sub-Paths`
   - Save
8. Verify: in BTP Cockpit → btp_cf → Connectivity → Cloud Connectors, the `(default)` location now lists `virtual-s4hr7.erp-is.com:50000` as **Available**

After this, OData calls from CF apps will route correctly: `CF app → BTP destination service → Cloud Connector → S/4 HR7`.

#### Verification Test (after rsantos is done)

1. Open BTP Cockpit → btp_cf → Connectivity → Destinations → `virtual-hr7-destination`
2. Click **Check Connection** — should return HTTP 200 or 401 (both mean network path works; 401 just means auth was checked at the backend)
3. Open any deployed CF app (e.g., `comerpisshiperpdispute`) via direct URL
4. Open browser DevTools → Network tab — OData calls to `/sap/opu/odata/...` should return real data (not 502/403)

#### Known Limitations Still Open

| Item | Status | What's needed |
|------|--------|---------------|
| `rsantos` adds HR7 system mapping for btp_cf | ⏳ Pending external action | Message rsantos with §12.2 steps above |
| HTTPS URL "stickiness" in CF destination | ⚠️ Server normalizes to http | May need destination trust cert uploaded; not blocking if ProxyProtocol is HTTPS |
| Whether ECC HR7 (10.10.1.76:8001) should ALSO have a CF destination | ❓ Decision | Only needed if apps want ECC data, not S/4 data |

---

## 13. Pending Issues — Known Gaps to Close

These are the remaining items to fix or wait on. None block the deployment itself — all 54 apps are live and accessible via the BTP Cockpit HTML5 Applications page click-through. The list below is what stands between "deployed" and "production-ready end-user experience."

### 13.1 BLOCKER — Cloud Connector mappings missing for `btp_cf`

| System | Destination in BTP | CC mapping for btp_cf? |
|--------|-------------------|------------------------|
| HR7 (S/4HANA) | `virtual-hr7-destination` → `virtual-s4hr7.erp-is.com:50000` | ❌ Not added |
| SLS (ERP S4 SALES) | `virtual-erps4sales-destination` → `erps4sales.erp-is.com:50000` | ❌ Not added |

**Result today:** Every app's UI loads correctly but OData calls fail with the standard "Sorry, a technical error occurred!" popup because the Cloud Connector tunnel from CF cloud → on-premise back-end isn't extended to the `btp_cf` subaccount yet.

**Action needed:** `rsantos@erp-is.com` to add BOTH system mappings to the btp_cf subaccount connection in the same Cloud Connector that already serves Neo. See §12.2 for full step-by-step.

### 13.2 sap.cloud.service mismatch on 9 renamed SLS apps

When we renamed `quickpacksls` → `quickpackeccsls` and similar (see §2.2), the cleanup-then-redeploy cycle left some destination-content registrations pointing at the OLD `sap.cloud.service`. Symptom: clicking the app in BTP Cockpit HTML5 Applications generates a URL like `…/{destGuid}.comerpisshiperpquickpacksls.comerpisshiperpquickpackeccsls-1.0.0/index.html` — `sap.cloud.service` segment is the old name but `sap.app.id` segment is the new name, and the launchpad returns "File not found."

**Affected apps (9):**
- `cancelshipmenteccsls` (was `cancelsls`)
- `createshipmenteccsls` (was `parcelsls`)
- `createshipmentewmsls` (was `shipewmsls`)
- `freightorderplanningsls` (was `freightordersls`)
- `manualshipmenteccsls` (was `manualsls`)
- `manualshipmentewmsls` (was `manualewmsls`)
- `quickpackeccsls` (was `quickpacksls`)
- `saleordersls` (was `salesordersls`)
- `trackshipmentewmsls` (was `trackshipmentsls`)

**Not affected** (deployed fresh, no rename):
- All other 18 SLS apps + `trackshipmenteccsls` (new clone)
- All 27 HR7 apps

**Attempts so far (2026-06-08):**

1. ✅ Updated `sap.cloud.service` in all 18 instance destinations (9 apps × 2 entries each) via Destination Service API — destinations now correctly report the new name when queried directly
2. ✅ Updated stale `app_host_id` fields in destinations to point to current app-host service GUIDs
3. ✅ Re-ran targeted `cf deploy -m {app}-app-content -m {app}-destination-content` for all 9 apps
4. ✅ Deleted html5-apps-repo content + re-pushed via `cf html5-push`
5. ✅ Recreated quickpackeccsls-app-front-service from scratch + re-pushed

**Result after all fixes:**
- Querying the destination service API directly returns the correct `sap.cloud.service` ✅
- Cockpit click STILL generates URL with old `comerpisshiperpquickpacksls` segment (cached somewhere in BTP cockpit / launchpad) ❌
- Direct URL with corrected segments now returns "Internal Server Error" (was "Not Found") — closer but still broken

**Root cause confirmed:** The BTP cockpit's HTML5 Applications view and the launchpad's Common Data Model (CDM) have a metadata cache that doesn't refresh from the destination service even after the destination contents are updated. The cache appears to retain the original `sap.cloud.service` value from when the app was FIRST pushed.

**Recommended workarounds:**
1. **Wait 24h** — BTP caches typically expire within a day; re-test then
2. **Delete the html5-apps-repo subscription / re-subscribe** — forces full CDM regen (heavy-handed)
3. **Open SAP support ticket** — request CDM cache refresh for the subaccount
4. **Live with the bug** — these 9 apps are still listed in the cockpit and can be accessed via their HR7-equivalent (e.g., `quickpackecc` works perfectly; the SLS version with no data backing right now is academic until rsantos fixes CC)

**Not affected** (deployed fresh, no rename): All other 18 SLS apps + `trackshipmenteccsls` + all 27 HR7 apps work via cockpit click.

### 13.3 Cosmetic — i18n appTitle still says "Cancel" / "Parcel" etc.

When apps render in the launchpad header, the title comes from `i18n/i18n.properties` `appTitle=…`. The original Neo titles like "Cancel", "Parcel", "TrackShipment" are still there for several apps. These look unfinished next to the otherwise clean `Cancel Shipment ECC SLS` naming.

**Affected:** Most renamed and cloned apps still have their original Neo `appTitle`. The 9 SLS apps in §13.2 have proper titles ("Cancel Shipment ECC SLS"); the other 18 still have the original.

**Effort:** Low — sed across `i18n/i18n.properties` files, rebuild, redeploy. Deferred until Work Zone tiles are configured (because that's when titles actually become user-visible).

### 13.4 BAS Source Control panel doesn't recognize the workspace as a git repo

When clicking the Source Control icon in BAS sidebar, it shows "The folder currently open doesn't have a Git repository" even though `git pull` works fine in the terminal at the same path. This is purely a BAS UI quirk — git operations all work via the terminal. Not blocking anything.

### 13.5 BAS terminal occasionally drops typed input via Chrome remote control

The xterm.js terminal in BAS sometimes ignores keyboard events when driven via Chrome MCP. Manual typing always works. Workaround: paste commands directly or click into the terminal more precisely before typing. Not blocking, just an automation friction point.

### 13.6 Work Zone Site Directory is empty

The `btp_cf` subaccount has Build Work Zone Standard subscribed, but no Site has been created yet. This means there's no branded launchpad with tile grouping/roles. Users access apps via the BTP Cockpit HTML5 Applications page click-through or direct CF launchpad URLs. See §12.1 for the runbook to set up a Site when you want one.

### 13.7 Orphan destination registration causing "1 Configuration issue" in cockpit

Cockpit → HTML5 Applications shows one yellow banner: a destination (`560d5bf2-cb58-41b1-9ef6-c3620a69f9f4`) still points to a deleted html5-apps-repo instance (`5e7a8a82-f190-485c-9050-4b194afc2256`). This is residue from the §13.2 quickpackeccsls-app-front-service recreate. No live app depends on it. Cleanup is just an API delete of the orphan destination entry — non-blocking, can be batched with the next maintenance pass.

### 13.8 VS Code `☁ CF Direct` launch entries all share one stale destination service GUID

All 108 entries in the `☁ CF Direct` launch group (`.vscode/launch.json`) hardcode the destination service GUID `a167a84f-0812-44fd-86e6-01c300d56f26` into their launchpad URLs:

```
https://btp-cf-8qsdli3e.launchpad.cfapps.us11.hana.ondemand.com/
  a167a84f-0812-44fd-86e6-01c300d56f26.comerpisshiperp{app}.comerpisshiperp{app}-1.0.0/
  index.html
```

This GUID predates the per-app destination service split — each app now has its own destination service with its own GUID (e.g. `quickpackeccsls = 524c354f-...`, `cancelshipmenteccsls = b837b085-...`, `freightorderplanningsls = 142c95cd-...`, see §15.3). The Managed Application Router resolves URLs by `{destinationServiceGUID}.{sap.cloud.service}.{sap.app.id}-{version}` and a mismatched GUID returns 404 / "File not found". So almost every "CF Direct" F5 entry is broken on click.

The cockpit click-through path is unaffected because the cockpit dynamically looks up each app's destination service GUID at click time (proved in §15.3 — all 9 renamed apps loaded fine via cockpit). The `(CF)` group (the `localhost:5000` entries that go via the local approuter) is also unaffected.

Fix: regenerate the `☁ CF Direct` URLs from `cf service {app}-destination-service --guid` per app. Tracked as future cleanup; not blocking because the cockpit click is the recommended quick-launch path anyway.

---

## 14. Recovery — "I opened BAS and can't find the apps"

If BAS shows **"NO FOLDER OPENED"** and Explorer is empty, the workspace just isn't pointing at the project folder. The repo is still on disk. Do this:

### 14.1 Re-open the existing folder (most common case)

1. In BAS, click **File → Open Workspace** (or the **Open Folder** button in the empty Explorer panel).
2. Navigate to `/home/user/projects/neo_to_cf` and click **Open**.
   - If that path doesn't exist, the dev space may have been reset — go to §14.2.
3. Once the folder opens, the 54 `apps/`, `mta.yaml`, `PROJECT_DISCUSSION.md`, `.vscode/`, etc. should all be visible.
4. Open a terminal (**Terminal → New Terminal**) and run `git status` to confirm you're on `main` and clean.
5. Run `git pull origin main` to pick up any commits made from the Windows side (e.g. the §13.2 fix in commit `484f3d6`).

### 14.2 Dev space was reset / folder is gone — re-clone

If `/home/user/projects/neo_to_cf` no longer exists (BAS dev space was rebuilt, storage wiped, or you're on a fresh dev space):

```bash
cd ~/projects
git clone https://github.com/nikkiledynavarro/work_cloud_foundry.git neo_to_cf
cd neo_to_cf
```

Then **File → Open Workspace** → pick `/home/user/projects/neo_to_cf`.

After cloning, BAS-local files that aren't tracked in git will be missing:
- `.env` (CF credentials) — re-paste from the Windows copy at `C:/Users/nikki/OneDrive/Desktop/AI/Codex/Work/neo_to_cf/.env`
- `node_modules/` — run `npm install` in the project root if you need to build locally
- Cloud Foundry CLI is already pre-installed in BAS dev spaces — log in with `cf login -a https://api.cf.us11.hana.ondemand.com --sso`

### 14.3 Folder is open but apps look stale / empty

If the folder is open but you see fewer than 54 apps under `apps/`, or files look like an old branch:

```bash
git status                    # see what branch / dirty state
git fetch origin
git log --oneline -5           # confirm latest commit matches GitHub
git pull origin main           # pull latest
```

If there are conflicts from BAS-local edits to `.vscode/launch.json` or `.vscode/tasks.json`:
```bash
git stash
git pull origin main
git stash drop                 # discard BAS-local edits; canonical configs come from git
```

### 14.4 Quick sanity check

Once the folder is open, run these to confirm you have the full migration state:
```bash
ls apps/ | wc -l               # should be 54+ (27 HR7 + 27 SLS, plus a few legacy)
grep -c "^  - name:.*-app-content$" mta.yaml   # should be 54
git log --oneline -5           # should show 484f3d6 (sap.cloud.service fix) at top
```

If any of those don't match, you're not on `main` HEAD — `git pull` again.

---

## 15. BAS and CF Test Status (2026-06-09)

### 15.1 Completed verification

- BAS dev space `ws-dha3l` is accessible and `WORK_CLOUD_FOUNDRY` is open.
- The repository is on branch `main`.
- All 54 scoped applications compile successfully: 27 HR7 and 27 SLS.
- `scripts/validate-deployed-apps.js` passes for all 54 application definitions.
- `cf html5-list` reports exactly 54 deployed HTML5 applications: 27 HR7 and 27 SLS.
- No CF service instances are reported as failed, pending, or in progress.
- The BAS locale warnings for `en_US.UTF-8` are non-blocking.
- §13.2 runtime bug fixed in commit `484f3d6` (also pushed to origin/main): nine renamed SLS apps had stale `sap.cloud.service` values inside `mta.yaml` destination-content blocks, and `quickpackeccsls` + `saleordersls` were missing `index.html` entirely. After redeploying their `-app-content` and `-destination-content` modules, destination metadata is fully populated (correct `sap.cloud.service`, `app_host_id`, `clientId`, etc.) and `quickpackeccsls` now serves the SAP UI5 bootstrap via the Managed Application Router (tab title `ShipERP` instead of `File not found`). This means a successful `cf html5-list` count alone is **not** sufficient to declare an app working — the destination registration and the zip's `index.html` both have to be present too.

### 15.2 Pending verification

1. **Runtime UI launch test for all 54 applications**
   - Successful builds and HTML5 Repository deployment do not prove that every application opens and renders correctly.
   - Each application still needs an authenticated browser launch test.

2. **SAP Build Work Zone test**
   - Work Zone authoring remains on hold because the current user cannot create or change the required site content.
   - Tiles, roles, catalogs, spaces/pages, and navigation cannot yet be verified.

3. **Standalone CF approuter test**
   - The temporary app `shiperp-fiori-test-approuter` is stopped.
   - The current CF org quota allows `0 MB` application memory, `0` application instances, and `0` routes.
   - An administrator must assign runtime memory, instance, and route quota before this approuter can start.

4. **Backend functional tests**
   - HR7 and SLS destination routing must still be tested from running applications.
   - Test authentication, OData/service calls, Cloud Connector reachability, authorization, and application-specific actions.

5. **End-to-end acceptance test**
   - After either Work Zone access or CF approuter quota becomes available, smoke-test all 54 applications and record per-app pass/fail results.

No application source files or deployed CF resources were changed during this verification.

### 15.3 Runtime verification of the 9 renamed SLS apps (2026-06-09, post-§13.2 fix)

After landing commit `484f3d6` (mta.yaml `destinations:` fix + missing `index.html` for `quickpackeccsls`/`saleordersls`), each of the 9 renamed SLS apps was launched via the BTP Cockpit → HTML5 Applications → "Run the active version" click and the resulting browser tab title recorded:

| App | Tab title | Status |
|---|---|---|
| `quickpackeccsls` | ShipERP | ✅ |
| `cancelshipmenteccsls` | ShipERP - Cancel | ✅ |
| `createshipmenteccsls` | Parcel - Create Shipment | ✅ |
| `manualshipmenteccsls` | manual - Manual Shipment ECC | ✅ |
| `createshipmentewmsls` | Parcel - Create Shipment | ✅ |
| `manualshipmentewmsls` | manual - Manual Shipment EMM | ✅ |
| `trackshipmentewmsls` | Track Shipment | ✅ |
| `saleordersls` | ShipERP | ✅ |
| `freightorderplanningsls` | ShipERP - Freight Order Planning | ✅ |

A non-default tab title proves the Managed Application Router resolved the route, the html5-apps-repo served `index.html`, UI5 bootstrapped, and `manifest.json` was read. Page bodies are blank because the OData backend is still unreachable from `btp_cf` — that is the §13.1 Cloud Connector blocker, not a deploy bug. Title spellings ("manual", "EMM", "Parcel") reflect §13.3 — the manifest titles were copied from the HR7 source apps without rebranding.

### 15.4 Configuration issue found in cockpit during audit

The BTP Cockpit → HTML5 Applications page shows a single yellow "1 Configuration issue" banner:

> Failed to get metadata, response status code: 400. Please check the service instance exists..
> Destination: `560d5bf2-cb58-41b1-9ef6-c3620a69f9f4`, html5-apps-repo instance: `5e7a8a82-f190-485c-9050-4b194afc2256`

The referenced html5-apps-repo instance GUID no longer exists — this is residue from the earlier `quickpackeccsls-app-front-service` recreate cycle during §13.2 troubleshooting. The instance was deleted but a destination still points at it. None of the 54 live apps depend on this. Tracked as §13.7.

### 15.5 VS Code F5 launch configuration audit

`.vscode/launch.json` inventory after this audit:

| Group | Count | Mechanism | Status |
|---|---|---|---|
| `🚀 Services Only` | 1 | Local proxy + approuter, no app open | OK |
| `🌐 Local Source` | 27 | `npm.cmd start` in `apps/{app}`, opens `localhost:8080/index.html` | OK (was 26; added `trackshipmentecc` this audit) |
| `☁ CF Apps` | 54 | Local approuter at `localhost:5000/comerpisshiperp{app}/index.html` | OK — all 54 apps covered, no stale renamed-app refs |
| `☁ CF Direct` | 54 | Direct managed-launchpad URL with hardcoded destination service GUID | **Broken** — all 54 share `a167a84f-...` which is stale (see §13.8) |

`.vscode/tasks.json` inventory: 4 infrastructure tasks (proxy, approuter, combined, stop) + 27 `Start {app} locally` tasks — one per HR7 app. `Start trackshipmentecc locally` was added in this audit to match the new launch entry; both reference `${workspaceFolder}/apps/trackshipmentecc` which exists.

Both `launch.json` and `tasks.json` parse as valid JSON after the edits (`node -e 'JSON.parse(require("fs").readFileSync(...))'` for each).

Platform note: all entries use `runtimeExecutable: powershell.exe` and tasks use `cmd.exe` — Windows VS Code only. BAS (Linux) can't use F5; BAS uses the cockpit click-through path documented in §11.2 / §15.3.

End-to-end F5 runtime tests for both `🌐 Local Source` and `☁ CF Apps` groups still require VPN connectivity to `virtual-s4hr7.erp-is.com:50000` (HR7) and the equivalent SLS endpoint — same §13.1 Cloud Connector blocker as the BAS runtime path.

### 15.6 §13.3 + §13.8 cleanup pass (2026-06-09)

Two cleanup scripts added under `scripts/`:

**`scripts/fix-sls-titles.js`** — §13.3 source fix. Walks every `apps/*sls/` and:
1. Sets `<title>` in `index.html` to the canonical `"{App Name} SLS"` form (was a mix of inherited Neo titles like `ShipERP - Cancel`, `Parcel - Create Shipment`, `TUV`, `ltlplanning`, etc.).
2. Adds `appTitle=` to `i18n/i18n.properties` for any SLS app missing it.

Ran once; 27 `index.html` titles rewritten, 1 `appTitle` added (`shippingdashboardsls`). Hand-edited 4 stragglers the script couldn't reach automatically:
- `carrierperformancereporteccsls/i18n/i18n_en.properties` — uses `_en` suffix.
- `disputesls/i18n/i18n.properties` — appTitle was `Freight Audit Dispute App` (Neo legacy); now `Dispute SLS`.
- `freightauditsls/i18n/i18n.properties` — appTitle was just `Freight Audit`; now `Freight Audit SLS`.
- `carrierperformancereportewmsls/i18n/i18n_en.properties` — was `EWM Carrier Performance Report`; now `Carrier Performance Report EWM SLS`.

The fix is source-only — the CF launchpad will keep showing the old titles until each app is rebuilt + redeployed (`mbt build -p cf && cf deploy mta_archives/*.mtar -f -m '<sls>-app-content'` per app, or the full MTA redeploy of the 27 SLS app-content modules). HR7 apps were intentionally not touched (out of scope for this round, and a few share the same Neo-era titles that look "wrong" but are baseline-correct).

**`scripts/regen-cf-direct-urls.js`** — §13.8 source fix. Walks every `☁ {app} (CF Direct)` entry in `.vscode/launch.json`, calls `cf service {app}-destination-service --guid` for each, and rewrites the launchpad URL with the correct per-app GUID. Requires `cf login` before running; aborts with a non-zero exit code if any app's GUID can't be resolved. Not executed in this commit because the Windows CF session was expired — the user runs it after `cf login -a https://api.cf.us11.hana.ondemand.com --sso`.

---

*Last updated: 2026-06-09 — §15.6 records the §13.3 + §13.8 cleanup pass. `scripts/fix-sls-titles.js` applied: 27 index.html titles + 1 missing appTitle + 4 hand-fixed stragglers. `scripts/regen-cf-direct-urls.js` ready to run after `cf login`. HR7 source untouched. CF redeploy of the SLS apps is deferred — source is correct, launchpad still serves the old titles until then.*

## 16. HD6 Migration (2026-06-10)

Nine Neo applications that use HD6 were converted and deployed as an isolated MTA. Existing HR7 and SLS application files and deployments were not changed.

| Neo project | Cloud Foundry app |
|---|---|
| `cancel` | `cancelhd6` |
| `dispute` | `disputehd6` |
| `eod` | `eodhd6` |
| `farpt` | `farpthd6` |
| `freightaudit` | `freightaudithd6` |
| `parcel` | `parcelhd6` |
| `parceldemo` | `parceldemohd6` |
| `trackshipment` | `trackshipmenthd6` |
| `zpkwporeport` | `zpkwporeporthd6` |

### 16.1 Deployment result

- CF target: API `https://api.cf.us11.hana.ondemand.com`
- Organization: `ERP Integrated Solutions, LLC   dba ShipERP._btp-cf-8qsdli3e`
- Space: `DEV`
- MTA: `shiperp-fiori-hd6`, version `0.0.1`
- HTML5 applications deployed: 9
- Service instances created: 27
  - 9 `html5-apps-repo` `app-host`
  - 9 `destination` `lite`
  - 9 `xsuaa` `application`
- All 27 service operations report `create succeeded`.
- `scripts/validate-hd6-apps.js` passes.
- The existing validator still passes for 27 HR7 and 27 SLS definitions.

### 16.2 Pending HD6 runtime dependency

All nine apps route backend requests through `virtual-hd6-destination`.
The destination is not present in the target subaccount as of 2026-06-10.
The expected definition recorded from Neo is:

- URL: `http://virtual-s4hd6.erp-is.com:8000`
- Type: `HTTP`
- Proxy type: `OnPremise`
- Authentication: `BasicAuthentication`

The exported inventory does not contain the HD6 backend secret. Do not reuse HR7 or SLS credentials. Runtime backend calls will remain unavailable until the HD6 destination is created with valid credentials and its Cloud Connector mapping is verified.
