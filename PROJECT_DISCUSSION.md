# ShipERP Neo to Cloud Foundry Migration — Project Discussion
**Date:** 2026-06-04 | **Author:** Nikki Navarro (nnavarro@erp-is.com)
**Repository:** https://github.com/nikkiledynavarro/work_cloud_foundry
**BTP Subaccount:** btp_cf (us11 region)

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
Out of 62 Neo apps, we focused on **27 HR7 apps** (ECC + EWM) because:
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
| cancelshipment | comerpisshiperpcancelshipment | ECC |
| cancelshipmentewm | comerpisshiperpcancelshipmentewm | **EWM** |
| carrierperformancereportecc | comerpisshiperpcarrierperformancereportecc | ECC |
| carrierperformancereportewm | comerpisshiperpcarrierperformancereportewm | **EWM** |
| closedelivery | comerpisshiperpclosedelivery | ECC |
| createshipment | comerpisshiperpcreateshipment | ECC |
| createshipmentewm | comerpisshiperpcreateshipmentewm | **EWM** |
| createshipmentv2ewm | comerpisshiperpcreateshipmentv2ewm | **EWM** |
| dispute | comerpisshiperpdispute | ECC |
| freightaudit | comerpisshiperpfreightaudit | ECC |
| freightauditupload | comerpisshiperpfreightauditupload | ECC |
| freightorderplanning | comerpisshiperpfreightorderplanning | ECC |
| ltlplanning | comerpisshiperpltlplanning | **EWM** |
| manualshipmentecc | comerpisshiperpmanualshipmentecc | ECC |
| manualshipmentewm | comerpisshiperpmanualshipmentewm | **EWM** |
| planningcockpit | comerpisshiperpplanningcockpit | ECC |
| planshipment | comerpisshiperpplanshipment | ECC |
| quickpackecc | comerpisshiperpquickpackecc | ECC |
| quickpackewm | comerpisshiperpquickpackewm | **EWM** |
| requestforpickup | comerpisshiperprequestforpickup | **EWM** |
| saleorder | comerpisshiperpsaleorder | ECC |
| shippingdashboard | comerpisshiperpshippingdashboard | ECC |
| submitacefiling | comerpisshiperpsubmitacefiling | ECC |
| trackshipmentewm | comerpisshiperptrackshipmentewm | **EWM** |
| viewacefiling | comerpisshiperpviewacefiling | ECC |

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

Total CF service instances created: **91** (27 apps × 3 + app-runtime-1779763944)

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

**Fix:** Set `sap.app.id = sap.cloud.service` for all 27 apps (no dots):
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
- `cancelshipment` (ECC) ≠ `cancelshipmentewm` (EWM)
- `createshipment` (ECC) ≠ `createshipmentewm` / `createshipmentv2ewm` (EWM)
- `manualshipmentecc` (ECC) ≠ `manualshipmentewm` (EWM)

### 5.6 XSUAA AppId Fix
Some XSUAA service instances tried to change their `xsappname` during deployment (not allowed after initial creation). Fixed `xs-security.json` files to use the original registered `xsappname`.

### 5.7 Destination: ui5cdn
Added `ui5cdn` destination to BTP Cockpit (`btp_cf` subaccount → Connectivity → Destinations):
- URL: `https://ui5.sap.com`, Type: HTTP, Proxy: Internet, Auth: NoAuthentication

This is a backup for apps served via managed launchpad routes that reference `ui5cdn`.

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
- **URL:** `https://btp-cf-8qsdli3e.launchpad.cfapps.us11.hana.ondemand.com/11387043-4c6f-4c9a-94d6-10e084b8b2d2.comerpisshiperpcancelacefiling.comerpisshiperpcancelacefiling-1.0.0/index.html`
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
  11387043-4c6f-4c9a-94d6-10e084b8b2d2.   ← Site UUID (from BTP HTML5 Applications)
  comerpisshiperpcancelacefiling.           ← sap.cloud.service
  comerpisshiperpcancelacefiling-1.0.0/    ← sap.app.id + version
index.html
```

The **Site UUID** (`11387043-4c6f-4c9a-94d6-10e084b8b2d2`) was found by clicking the Error Log icon on an app in BTP Cockpit → HTML5 Applications. The dialog title revealed the full app key including the UUID.

### 7.7 The Launch Config Generator Script
If the CF environment changes (new site UUID, different host), update `scripts/generate-launch-configs.js`:

```js
const CF_CONFIG = {
    host:     'https://btp-cf-8qsdli3e.launchpad.cfapps.us11.hana.ondemand.com',
    siteUuid: '11387043-4c6f-4c9a-94d6-10e084b8b2d2',
    version:  '1.0.0'
};
```

Then run:
```bash
node scripts/generate-launch-configs.js
# Regenerates both ☁ CF Apps and ☁ CF Direct sections in launch.json
# Zero impact on BAS, deployed apps, or approuter
```

---

## 8. How to Test — BAS (Cloud)

BAS (SAP Business Application Studio) is VS Code running in SAP's cloud. It cannot access `localhost` the same way VS Code can — `localhost` in BAS goes through SAP's port-forwarding service which requires BTP OAuth.

### 8.1 Best Option — BTP Cockpit HTML5 Applications (Recommended)
No approuter needed at all:
1. Go to `https://apac.cockpit.btp.cloud.sap`
2. Navigate to: `btp_cf subaccount → HTML5 Applications`
3. Click any app name (e.g., `comerpisshiperpdispute`) → opens in a new tab ✅

### 8.2 CF Direct URL in Browser
Paste directly in your Chrome browser (you must be logged in to BTP):
```
https://btp-cf-8qsdli3e.launchpad.cfapps.us11.hana.ondemand.com/11387043-4c6f-4c9a-94d6-10e084b8b2d2.{appId}.{appId}-1.0.0/index.html
```
Example for Dispute:
```
https://btp-cf-8qsdli3e.launchpad.cfapps.us11.hana.ondemand.com/11387043-4c6f-4c9a-94d6-10e084b8b2d2.comerpisshiperpdispute.comerpisshiperpdispute-1.0.0/index.html
```

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
> If you get "URL does not reference a valid account", use **Option 8.1** instead.

### 8.4 What to Expect in BAS
- **App renders with Fiori UI** ✅ (tabs, buttons, table headers visible)
- **"No data" or OData error** ❌ Expected — BAS has no VPN so HR7 is unreachable
- **Blank white page** — Check setup.sh ran and node server.js is running

---

## 9. Testing Summary and Troubleshooting

### 9.1 Summary Table

| Method | App Source | Local Server | VPN for Data | Best For |
|--------|-----------|-------------|-------------|----------|
| Local Approuter (Chrome) | CF HTML5 Repo | `node server.js` + hr7-proxy | ✅ Yes | Full end-to-end with live data |
| VS Code F5 `☁ CF Apps` | CF HTML5 Repo | Auto-started by F5 | ✅ Yes | Same as above, easier start |
| VS Code F5 `☁ CF Direct` | CF HTML5 Repo | **None** | ✅ + Cloud Connector | Quick CF test, no setup |
| VS Code Integrated Browser | CF HTML5 Repo | `node server.js` needed | ✅ Yes | App inside VS Code editor |
| BAS → BTP Cockpit HTML5 Apps | CF HTML5 Repo | **None** | ❌ No (no VPN in cloud) | Quickest cloud check |
| BAS → CF Direct URL | CF HTML5 Repo | **None** | ❌ No | Share URL with team |
| Work Zone (future) | CF HTML5 Repo | **None** | ❌ (until CC fixed) | Production launchpad |

### 9.2 Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `localhost refused to connect` | Approuter not running | Run `node server.js` |
| `502 Bad Gateway` on OData calls | hr7-proxy.js not running | Run `node hr7-proxy.js` (or restart `bash setup.sh`) |
| `App loads but no data` | VPN not connected | Connect OpenVPN to `erp-is` |
| `ERR_CONNECTION_REFUSED` in VS Code browser | Approuter not started | Press F5 first or run `node server.js` |
| `Blank white page` | Approuter not running or setup.sh not run | Run `bash setup.sh` then `node server.js` |
| `Not Found` on CF URL | Wrong site UUID | Use `11387043-4c6f-4c9a-94d6-10e084b8b2d2` not `560d5bf2` |
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

### 11.2 CF Direct URL Pattern (All 27 Apps)

Base: `https://btp-cf-8qsdli3e.launchpad.cfapps.us11.hana.ondemand.com/11387043-4c6f-4c9a-94d6-10e084b8b2d2.`

| App | Append to base |
|-----|---------------|
| cancelacefiling | `comerpisshiperpcancelacefiling.comerpisshiperpcancelacefiling-1.0.0/index.html` |
| cancelpickuprequest | `comerpisshiperpcancelpickuprequest.comerpisshiperpcancelpickuprequest-1.0.0/index.html` |
| cancelshipment | `comerpisshiperpcancelshipment.comerpisshiperpcancelshipment-1.0.0/index.html` |
| cancelshipmentewm | `comerpisshiperpcancelshipmentewm.comerpisshiperpcancelshipmentewm-1.0.0/index.html` |
| carrierperformancereportecc | `comerpisshiperpcarrierperformancereportecc.comerpisshiperpcarrierperformancereportecc-1.0.0/index.html` |
| carrierperformancereportewm | `comerpisshiperpcarrierperformancereportewm.comerpisshiperpcarrierperformancereportewm-1.0.0/index.html` |
| closedelivery | `comerpisshiperpclosedelivery.comerpisshiperpclosedelivery-1.0.0/index.html` |
| createshipment | `comerpisshiperpcreateshipment.comerpisshiperpcreateshipment-1.0.0/index.html` |
| createshipmentewm | `comerpisshiperpcreateshipmentewm.comerpisshiperpcreateshipmentewm-1.0.0/index.html` |
| createshipmentv2ewm | `comerpisshiperpcreateshipmentv2ewm.comerpisshiperpcreateshipmentv2ewm-1.0.0/index.html` |
| dispute | `comerpisshiperpdispute.comerpisshiperpdispute-1.0.0/index.html` |
| freightaudit | `comerpisshiperpfreightaudit.comerpisshiperpfreightaudit-1.0.0/index.html` |
| freightauditupload | `comerpisshiperpfreightauditupload.comerpisshiperpfreightauditupload-1.0.0/index.html` |
| freightorderplanning | `comerpisshiperpfreightorderplanning.comerpisshiperpfreightorderplanning-1.0.0/index.html` |
| ltlplanning | `comerpisshiperpltlplanning.comerpisshiperpltlplanning-1.0.0/index.html` |
| manualshipmentecc | `comerpisshiperpmanualshipmentecc.comerpisshiperpmanualshipmentecc-1.0.0/index.html` |
| manualshipmentewm | `comerpisshiperpmanualshipmentewm.comerpisshiperpmanualshipmentewm-1.0.0/index.html` |
| planningcockpit | `comerpisshiperpplanningcockpit.comerpisshiperpplanningcockpit-1.0.0/index.html` |
| planshipment | `comerpisshiperpplanshipment.comerpisshiperpplanshipment-1.0.0/index.html` |
| quickpackecc | `comerpisshiperpquickpackecc.comerpisshiperpquickpackecc-1.0.0/index.html` |
| quickpackewm | `comerpisshiperpquickpackewm.comerpisshiperpquickpackewm-1.0.0/index.html` |
| requestforpickup | `comerpisshiperprequestforpickup.comerpisshiperprequestforpickup-1.0.0/index.html` |
| saleorder | `comerpisshiperpsaleorder.comerpisshiperpsaleorder-1.0.0/index.html` |
| shippingdashboard | `comerpisshiperpshippingdashboard.comerpisshiperpshippingdashboard-1.0.0/index.html` |
| submitacefiling | `comerpisshiperpsubmitacefiling.comerpisshiperpsubmitacefiling-1.0.0/index.html` |
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
| HR7 live data in CF | ❌ OData 502/403 | Configure Cloud Connector to expose `virtual-s4hr7.erp-is.com` |
| Work Zone tiles | ❌ Not configured | Work Zone admin access → add 27 apps as tiles |
| shippingdashboard full OVP | ⚠️ Partial | Needs Work Zone for Overview Page library |
| BAS port-forwarding | ⚠️ May not work | BTP subaccount port-forwarding config |

---

*Last updated: 2026-06-05*
