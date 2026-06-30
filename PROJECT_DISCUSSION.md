# ShipERP Neo → Cloud Foundry Migration

**Repository:** https://github.com/nikkiledynavarro/work_cloud_foundry
**Author:** Nikki Navarro (nnavarro@erp-is.com)
**Last refresh:** 2026-06-11 · current HEAD: `a3deda8`

This is the reference document for the end state. It describes what is deployed, how it works, how to operate it, what is tested, and what is still open. The chronological history of how each piece got here — including every review-fix pass, every diagnosis, and every false start — lives in `PROJECT_DISCUSSION_OLD.md` (4 500 lines, §0–§41). Read that one if you need the *story*; read this one if you need the *state*.

---

## Table of Contents

1. [Executive summary](#1-executive-summary)
2. [Architecture](#2-architecture)
3. [Deployed apps](#3-deployed-apps)
4. [BTP destinations](#4-btp-destinations)
5. [Cloud Connector](#5-cloud-connector)
6. [Service-account credentials](#6-service-account-credentials)
7. [Repo layout](#7-repo-layout)
8. [Local dev runbook](#8-local-dev-runbook)
9. [Operational runbook](#9-operational-runbook)
10. [Test plan — 9 layers](#10-test-plan--9-layers)
11. [Pending items](#11-pending-items)
12. [Configuration backup](#12-configuration-backup)
13. [CI](#13-ci)
14. [Gotchas](#14-gotchas)
15. [Reference URLs](#15-reference-urls)
16. [Glossary](#16-glossary)

---

## 1. Executive summary

Lift-and-shift of **62 SAP Fiori HTML5 apps** (27 HR7 + 27 SLS + 8 HD6) from SAP BTP Neo (sunset) to Cloud Foundry on the same global account. Complete and end-to-end verified.

| Aspect | State |
|---|---|
| Deployed apps | **62 / 62** in `btp_cf` subaccount, space `DEV` |
| Backend destinations | 3 subaccount-level (`shiperp-virtual-{hr7,erps4sales,hd6}-destination`) routing through the Cloud Connector tunnel |
| Cloud Connector mappings | 3 (HR7, SLS, HD6) on the SLM CC's `(default)` Location ID |
| Service account | `USER_CF` on all 3 backends |
| OData round-trip | **51 / 65** services live end-to-end; 14 SAP-basis activations pending |
| Browser-render | 62 / 62 launchpad URLs render UI5 under active SSO |
| Code defects | **0** |
| Pending items | 7 (all RBAC, infrastructure, SAP basis, or future-scope) |

## 2. Architecture

```
                ┌──────────────────────────────────────────────────────────────┐
                │                       User's browser                         │
                │                  (active XSUAA SSO session)                  │
                └───────────────────────┬──────────────────────────────────────┘
                                        │ https://btp-cf-8qsdli3e.launchpad.cfapps.us11.hana.ondemand.com
                                        │     /{dest-svc-GUID}.{cloud.service}.{cloud.service}-1.0.0/index.html
                                        ▼
                ┌──────────────────────────────────────────────────────────────┐
                │           Managed Application Router (SAP-hosted)            │
                │   reads each app's xs-app.json bundled in html5-apps-repo    │
                └──────┬────────────────────────────────────────────────┬──────┘
                       │ static content                                 │ /sap/opu/odata/* route
                       │                                                ▼
                       │                       ┌────────────────────────────────────────┐
                       │                       │     Destination Service lookup         │
                       │                       │  1. instance level (62 services) ─ none│
                       │                       │  2. subaccount level ─ shiperp-virtual-│
                       │                       │     {hr7,erps4sales,hd6}-destination   │
                       │                       └─────────────────┬──────────────────────┘
                       │                                         │
                       │                                         │ Basic Auth (USER_CF / Shiperp1)
                       │                                         │ ProxyType=OnPremise
                       │                                         │ HTML5DynamicDestination=true
                       │                                         ▼
                       │                       ┌────────────────────────────────────────┐
                       │                       │      Cloud Connector tunnel            │
                       │                       │  (SLM CC @ erpslm1.erp-is.com:8443,    │
                       │                       │   (default) Location ID)               │
                       │                       └─────────────────┬──────────────────────┘
                       │                                         │
                       │                                         ▼
                       │   ┌─────────────────────┐  ┌─────────────────────┐  ┌──────────────────┐
                       │   │  HR7  10.10.1.76    │  │ SLS erps4sales      │  │ HD6 10.10.1.60   │
                       │   │  :8001 (NetWeaver)  │  │ .erp-is.com:50000   │  │  :8001 (S/4HC)   │
                       │   │  SAP GUI / OData    │  │ S/4HANA on-prem     │  │ S/4 Cloud Dev    │
                       │   └─────────────────────┘  └─────────────────────┘  └──────────────────┘
                       │
                       ▼  (62 × app-host instances, one per app)
                ┌──────────────────────────────────────────────────────────────┐
                │   Component-preload.js, manifest.json, controllers, views    │
                │   Built from apps/<app>/ at deploy time, packaged as <app>.zip│
                │   Served by the html5-apps-repo CF service                   │
                └──────────────────────────────────────────────────────────────┘
```

## 3. Deployed apps

**62 apps, three groups by backend.**

| Group | Count | Backend | Apps |
|---|---|---|---|
| HR7 | 27 | NetWeaver at `10.10.1.76:8001` via CC | `cancelacefiling`, `cancelpickuprequest`, `cancelshipmentecc`, `cancelshipmentewm`, `carrierperformancereportecc`, `carrierperformancereportewm`, `closedelivery`, `createshipmentecc`, `createshipmentewm`, `createshipmentv2ewm`, `dispute`, `freightaudit`, `freightauditupload`, `freightorderplanning`, `ltlplanning`, `manualshipmentecc`, `manualshipmentewm`, `planshipment`, `quickpackecc`, `quickpackewm`, `requestforpickup`, `saleorder`, `shippingdashboard`, `submitacefiling`, `trackshipmentecc`, `trackshipmentewm`, `viewacefiling` |
| SLS | 27 | S/4HANA at `erps4sales.erp-is.com:50000` via CC | Each HR7 app name + `sls` suffix |
| HD6 | 8 | S/4HC Cloud Dev at `s4hd6.erp-is.com:8001` via CC | `cancelhd6`, `disputehd6`, `eodhd6`, `farpthd6`, `freightaudithd6`, `parceldemohd6`, `parcelhd6`, `trackshipmenthd6` |

Each app owns 3 CF service instances (`{app}-app-front-service` on `html5-apps-repo`, `{app}-destination-service` on `destination`, `{app}-xsuaa-service` on `xsuaa`).

## 4. BTP destinations

### Subaccount-level (3 — the active routing)

| Name | Backend | URL | Auth | Properties |
|---|---|---|---|---|
| `shiperp-virtual-hr7-destination` | HR7 | `http://virtual-s4hr7.erp-is.com:50000` | BasicAuthentication / `USER_CF` | `Type=HTTP`, `ProxyType=OnPremise`, `HTML5DynamicDestination=true`, `WebIDEEnabled=true`, `WebIDEUsage=odata_abap,ui5_execute_abap,dev_abap` |
| `shiperp-virtual-erps4sales-destination` | SLS | `http://erps4sales.erp-is.com:50000` | BasicAuthentication / `USER_CF` | (same as above) |
| `shiperp-virtual-hd6-destination` | HD6 | `http://virtual-s4hd6.erp-is.com:8000` | BasicAuthentication / `USER_CF` | (same as above) |

These three are the single source of truth. Every app's `xs-app.json` route `^/sap/opu/odata/(.*)$` targets the matching destination by group.

### Instance-level (per app)

Each of the 62 `{app}-destination-service` instances holds **only the two MTA-managed entries**: `{app}-app-front-service` and `{app}-xsuaa-service`. There are no `virtual-*` entries at instance level — those were removed; the managed approuter now falls through to the subaccount-level destinations above for the OData route.

### Setup procedure (when rebuilding)

To recreate the 3 subaccount destinations:

1. Get a destination-service admin token from any per-app key (e.g. `quickpackecc-destination-content-quickpackecc-destination-service-credentials`):

```bash
cf service-key quickpackecc-destination-service \
    quickpackecc-destination-content-quickpackecc-destination-service-credentials
# JSON has credentials.uaa.{url, clientid, clientsecret, uri}
```

```bash
curl -X POST <uaa.url>/oauth/token \
     -u <clientid>:<clientsecret> \
     -d grant_type=client_credentials
# returns access_token
```

2. POST each destination:

```bash
curl -X POST https://destination-configuration.cfapps.us11.hana.ondemand.com/destination-configuration/v1/subaccountDestinations \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{
       "Name": "shiperp-virtual-hr7-destination",
       "Type": "HTTP",
       "URL": "http://virtual-s4hr7.erp-is.com:50000",
       "Authentication": "BasicAuthentication",
       "ProxyType": "OnPremise",
       "User": "USER_CF",
       "Password": "Shiperp1",
       "HTML5DynamicDestination": "true",
       "WebIDEEnabled": "true",
       "WebIDEUsage": "odata_abap,ui5_execute_abap,dev_abap"
     }'
# expect HTTP 201
```

Repeat for SLS (URL `http://erps4sales.erp-is.com:50000`) and HD6 (URL `http://virtual-s4hd6.erp-is.com:8000`).

## 5. Cloud Connector

### Active configuration

SLM CC at `https://erpslm1.erp-is.com:8443/` is connected to the `btp_cf` subaccount on the `(default)` Location ID. It carries three system mappings:

| virtualHost | virtualPort | localHost | localPort | backendType | hostInHeader | Resources |
|---|---|---|---|---|---|---|
| `virtual-s4hr7.erp-is.com` | 50000 | `s4hr7.erp-is.com` | 50000 | abapSys | VIRTUAL | `/` (PATH_AND_ALL_SUB_PATHS) |
| `erps4sales.erp-is.com` | 50000 | `erps4sales.erp-is.com` | 50000 | abapSys | VIRTUAL | `/` (PATH_AND_ALL_SUB_PATHS) |
| `virtual-s4hd6.erp-is.com` | 8000 | `s4hd6.erp-is.com` | 8001 | abapSys | VIRTUAL | `/` (PATH_AND_ALL_SUB_PATHS) |

### Setup procedure (when rebuilding)

Admin UI at `https://erpslm1.erp-is.com:8443/`, credentials `Administrator` / `Shiperp1`.

1. **Add system mapping** per backend via the CC REST API:

```
PUT https://erpslm1.erp-is.com:8443/api/v1/configuration/subaccounts/{tenantId}/systemMappings
Authorization: Basic Administrator:Shiperp1
Content-Type: application/json

{
  "virtualHost":  "virtual-s4hr7.erp-is.com",
  "virtualPort":  "50000",
  "localHost":    "s4hr7.erp-is.com",
  "localPort":    "50000",
  "protocol":     "HTTP",
  "backendType":  "abapSys",
  "hostInHeader": "VIRTUAL",
  "description":  "Migration: HR7 OData"
}
```

2. **Add `/` resource** per mapping:

```
POST https://erpslm1.erp-is.com:8443/api/v1/configuration/subaccounts/{tenantId}/systemMappings/{mappingId}/resources

{
  "id":           "/",
  "enabled":      true,
  "exactMatchOnly": false,
  "accessPolicy": "PATH_AND_ALL_SUB_PATHS",
  "description":  "Migration: allow all OData paths"
}
```

A mapping without at least one resource is rejected by the CC at request time.

3. **Verify** in the admin UI under btp_cf subaccount → *Cloud To On-Premise → System Mappings* — all three rows should show green with the `/` resource enabled.

### Constraint

One physical CC instance can hold only **one** connection per subaccount. The SLM CC is already at `(default)`, so we cannot move the migration mappings to an isolated `shiperp_fiori_apps` Location ID from the same CC. That requires a second physical CC instance — tracked under pending item #3.

## 6. Service-account credentials

The single shared service account `USER_CF / Shiperp1` runs every OData call through every destination. Currently rotated. To rotate again:

```bash
TOKEN=...  # destination-service admin token

for d in shiperp-virtual-hr7-destination \
         shiperp-virtual-erps4sales-destination \
         shiperp-virtual-hd6-destination ; do
  curl -X PUT \
       -H "Authorization: Bearer $TOKEN" \
       -H "Content-Type: application/json" \
       https://destination-configuration.cfapps.us11.hana.ondemand.com/destination-configuration/v1/subaccountDestinations \
       -d "{ \"Name\":\"$d\", ..., \"Password\":\"<new pw>\" }"
done
```

No app redeploy needed; the managed approuter picks up the new credential on the next OData call. SAP basis side: update `USER_CF` on HR7, SLS, and HD6 backends to the same new password before the BTP-side change.

## 7. Repo layout

```
apps/                  62 Fiori HTML5 apps, one directory each
approuter/             local dev approuter (server.js routes /hr7, /sls, /hd6 prefixes)
docs/                  config snapshot + handoff docs
scripts/               utility scripts:
  - validate-deployed-apps.js
  - validate-hd6-apps.js
  - bump-version.js
  - dump-btp-cf-cc-snapshot.py
  - open-url.js
  - fix-hd6-namespaces.js, fix-hd6-titles.js, fix-hr7-titles.js, fix-sls-titles.js (historical one-shots)
  - others (Apply-CfBackendDestinations.ps1, etc.)
security/              xs-security-{app}.json per app — XSUAA config inputs
templates/             neo-to-cf-*.json (active config) + _archived/ (Neo source snapshots)
.github/workflows/     CI pipeline
.vscode/               launch.json (187 configs: 62 × 3 launch modes + 1 helper) + tasks.json (67 tasks)
mta.yaml               MTA for HR7 + SLS
mta-hd6.yaml           MTA for HD6
README.md              GitHub entry point
PROJECT_DISCUSSION.md  this file (current state reference)
PROJECT_DISCUSSION_OLD.md  4 500-line chronological history of how we got here
```

## 8. Local dev runbook

### Run a single app via UI5 dev server

```bash
cd apps/quickpackecc
npm install
npm start
# UI5 serve on http://localhost:8080
```

In VS Code: `🌐 quickpackecc (Local Source)` launch entry does the same.

### Run all-backend local approuter

```bash
node approuter/hr7-proxy.js          # binds 127.0.0.1:5001
cd approuter && node server.js       # binds 0.0.0.0:5000
```

The local approuter publishes per-backend prefixes:
- `localhost:5000/comerpisshiperp<app>/index.html` — app shell
- `localhost:5000/hr7/sap/opu/odata/...` — HR7 OData (proxied through `hr7-proxy.js`)
- `localhost:5000/sls/sap/opu/odata/...` — needs `SLS_PROXY_URL` env var, otherwise stub URL returns ECONNREFUSED
- `localhost:5000/hd6/sap/opu/odata/...` — needs `HD6_PROXY_URL` env var, otherwise stub URL returns ECONNREFUSED

The HR7 path requires VPN to the SAP network. SLS/HD6 paths require their own proxies (not bundled). The local approuter is **dev-only** — auth disabled, CSRF off, `strictSSL: false`.

In VS Code: `🚀 Start ShipERP (Proxy + Approuter)` task does both.

## 9. Operational runbook

### Deploy a code change to a single app

```bash
cd apps/<app>
git pull
rm -rf dist
npm run build
npm run package
cf html5-push -r dist <app>-app-front-service
```

The `-r` flag is required by `html5-apps-repo` when redeploying the same version (app version stays at `1.0.0` per current convention; see pending item versioning).

### Mass redeploy all 62 apps

The pattern is the same per app, scripted serially. Takes ~45–60 min with SAPUI5 deps already cached locally.

### Bump versions across all 62 apps + 2 MTAs

```bash
node scripts/bump-version.js patch            # 1.0.0 → 1.0.1, MTAs 0.0.1 → 0.0.2
node scripts/bump-version.js minor            # 1.0.0 → 1.1.0
node scripts/bump-version.js major            # 1.0.0 → 2.0.0
node scripts/bump-version.js patch --dry-run  # preview, no writes
```

The script does **not** touch `manifest.json`'s `sap.app.applicationVersion.version` — that field determines the launchpad URL path `comerpisshiperp{app}-<version>/index.html` in `html5-apps-repo`. Bumping it would create parallel `1.0.1/` paths alongside the existing `1.0.0/`. The team decides if/when to extend the helper.

### Rotate `USER_CF` password

Three subaccount destinations to update — see [§6](#6-service-account-credentials).

### Snapshot the BTP / CF / CC state

```bash
python scripts/dump-btp-cf-cc-snapshot.py
# overwrites docs/btp-cf-cc-snapshot.md
```

Captures CF target, all service instances, all service keys, all subaccount destinations (full property dump with passwords redacted), per-app instance destinations, CC mapping configuration, and the service-to-app mapping table. Commit the resulting file so git history shows when the deployed state changes. Suggested cadence: after every deploy or destination edit; monthly otherwise.

### Run the full 9-layer test sweep

See [§10](#10-test-plan--9-layers). End-to-end wall clock: ~20–25 min.

## 10. Test plan — 9 layers

Coverage at HEAD:

| Layer | What it proves | Coverage | How to reproduce |
|---|---|---|---|
| **1** Static validators | manifest / xs-app / package consistency + expected destination per app | **62 / 62** | `node scripts/validate-deployed-apps.js && node scripts/validate-hd6-apps.js` |
| **2** CF Direct URL HEAD (unauthed) | route alive + XSUAA enforced | **62 / 62 HTTP 401** | Extract URLs from `.vscode/launch.json` and HEAD each |
| **3** Live `xs-app.json` via `cf html5-get` | every app references `shiperp-virtual-*` | **62 / 62** | `cf html5-get /comerpisshiperp<app>-1.0.0/xs-app.json -n <app>-app-front-service` per app |
| **3b** Live `Component-preload.js` `sap.cloud.service` | embedded value matches current manifest | **62 / 62** | Same `cf html5-get` against the preload file; grep for `"service":"comerpisshiperp<app>"` |
| **4** Local approuter (v22) + HEAD per app | dev approuter serves every cloud-service slug | **62 / 62 HTTP 200** | Boot `hr7-proxy.js` + `server.js`; curl `localhost:5000/comerpisshiperp<app>/index.html` |
| **5** VS Code launch.json + tasks.json | every app has 3 launch modes + 1 task | **62 / 62** | Static walk: 187 launch configs + 67 tasks |
| **6** BAS workspace validators | Node v22.13.1 BAS runtime produces the same results | **54 / 54 + 8 / 8** | In BAS terminal: `git pull && node scripts/validate-deployed-apps.js && node scripts/validate-hd6-apps.js` |
| **7** Browser-rendered UI under SSO | UI5 bootstrap served under XSUAA session | **62 / 62** | Inject `__urls` map into an SSO'd tab; `Promise.all(... fetch(url, { credentials: 'include' }))`; check `<edmx:Edmx>` / UI5 markers in body |
| **8** OData `$metadata` via CC tunnel | full BTP → CC → SAP chain delivers data | **51 / 65 OK + 14 SAP-basis pending** | Inject `__probes` map (app + OData URI from manifest); `fetch(<launchpad>/<odata>$metadata, { credentials: 'include' })` per probe |

### Layer 8 — the 14 pending SAP-basis-side activations

Every failure is `/IWFND/MED/170` (SAP Gateway: "No service found for namespace") — the request reached the SAP backend; the SAP backend itself reports the OData service isn't activated there. **Not a project / BTP / CF defect.**

13 affect SLS (10 distinct services), 1 affects HD6:

| Service | Affected apps | Backend | Activation path |
|---|---|---|---|
| `serperp/ace_srv` | `cancelacefilingsls`, `submitacefilingsls`, `viewacefilingsls` | SLS | `/IWFND/MAINT_SERVICE` → Add Service |
| `serperp/rfp_srv` | `cancelpickuprequestsls`, `requestforpickupsls` | SLS | `/IWFND/MAINT_SERVICE` |
| `serperp/carrperf_srv` | `carrierperformancereporteccsls` | SLS | `/IWFND/MAINT_SERVICE` |
| `serperp/ewm_cp_srv` | `carrierperformancereportewmsls` | SLS | `/IWFND/MAINT_SERVICE` |
| `sap/zerpis_close_delivery_srv` | `closedeliverysls` | SLS | `/IWFND/MAINT_SERVICE` |
| `serperp/shipewm_v2_srv` | `createshipmentv2ewmsls` | SLS | `/IWFND/MAINT_SERVICE` |
| `serperp/fa_upl_srv` | `freightaudituploadsls` | SLS | `/IWFND/MAINT_SERVICE` |
| `serperp/ltlplan_srv` | `ltlplanningsls` | SLS | `/IWFND/MAINT_SERVICE` |
| `serperp/ewm_tuv_srv` | `planshipmentsls` | SLS | `/IWFND/MAINT_SERVICE` |
| `serperp/ewm_qp_srv` | `quickpackewmsls` | SLS | `/IWFND/MAINT_SERVICE` |
| `sap/ZP_ODAT_FA_RPT_SRV` | `farpthd6` (secondary service) | HD6 | Communication Arrangement (S/4HC pattern) |

Every one of the 10 SLS services has a working twin on HR7 at the same path. The metadata definitions exist in the ABAP repository; activation on the SLS system is a one-click registration per service.

## 11. Pending items

7 items, all organizational / future-scope. **No open code defects.**

| # | Item | Owner | Close-out path |
|---|---|---|---|
| **1** | Work Zone Site (68 tiles = 62 apps + 6 SAP tcodes) | User → me | User grants `Launchpad_Admin` role collection (Cockpit → Security → Role Collections → Launchpad_Admin → Users → Add `nnavarro@erp-is.com`); relogin to WZ; tell Claude. ~3 min user, ~90 min Claude to drive catalog + role + site + page + tiles + publish. Channel + tile inventory locked in. |
| **2** | Standalone CF approuter (`shiperp-fiori-test-approuter`) | CF org admin | Assign quota to space; remove `no-route: true` in `approuter/manifest.yml`; `cf push -f approuter/manifest.yml` |
| **3** | Dedicated CC Location ID (`shiperp_fiori_apps`) | IT | Install second physical CC instance; connect to `btp_cf` at the new Location ID; recreate the 3 mappings + `/` resources; add `CloudConnectorLocationId: shiperp_fiori_apps` to the 3 subaccount destinations; delete the mappings from the SLM CC |
| **4** | Rotate `USER_CF` credential | SAP basis | Pick a new password; update `USER_CF` on HR7, SLS, HD6; update the 3 subaccount destinations via [§6](#6-service-account-credentials) |
| **6** | UI5 1.42 / 1.30 modernization | Future scope (1–2 weeks) | Per app: bump `manifest.json` `minUI5Version`, run `@ui5/linter` to surface deprecations, rewrite `jQuery.sap.*` / `sap.ui.getCore()` / `sap.ui.xmlfragment` / synchronous JSON loads, retest. Item 6.1 forward-motion step: run `@ui5/linter` against all 33 apps to size the backlog (no code changes, ~30 min) |
| **8** | Activate 10 OData services on SLS | SAP basis | `/IWFND/MAINT_SERVICE` on the SLS S/4HANA system — see [§10 layer 8](#layer-8--the-14-pending-sap-basis-side-activations) table; estimated ~1 hour basis time |
| **9** | Activate `ZP_ODAT_FA_RPT_SRV` on HD6 | SAP basis | *Display Communication Arrangements* Fiori app on HD6 → find or create ShipERP arrangement → add `ZP_ODAT_FA_RPT_SRV` to inbound services |

Items 5, 7, 10 from earlier passes were closed (`npm test` stubs everywhere, `scripts/bump-version.js` helper, 24 stale `apps/` directories removed).

### Operational items adjacent to migration (not in #1–#9)

These came up during session discussion. They're known and tracked but out of strict migration scope:

- End-user role-collection assignments — implicit dependency of #1
- Monitoring / alerting on the live BTP → CC → SAP chain
- CC failover (single physical CC today — implicit in #3)
- Performance baseline measurements
- User communication + Neo subaccount decommission plan
- Local 4.1 GB `node_modules` dedupe — workspace monorepo restructuring
- Bump-version not integrated into deployment — §8 caveat

## 12. Configuration backup

`docs/btp-cf-cc-snapshot.md` is a regeneratable backup of every BTP / CF / CC configuration this project produced. Regenerate via:

```bash
python scripts/dump-btp-cf-cc-snapshot.py
```

Captures: CF target, all 191 service instances, all 189 service keys, all 18 subaccount destinations (full property dump, passwords redacted), per-app instance destinations, CC mapping configuration, and the service-to-app mapping table.

Useful as audit trail (commit after every change), disaster-recovery reference (rebuild the destination layer from this file), and drift detection (diff against the committed version).

## 13. CI

`.github/workflows/ci.yml` runs on every push to `main` and every PR. Two jobs:

- **validators + JSON parse + npm test smoke**: runs `validate-deployed-apps.js`, `validate-hd6-apps.js`, parses every app's `manifest.json` / `xs-app.json` / `package.json` to confirm validity, then runs `npm test` per app expecting exit 0.
- **bump-version dry-run**: invokes `node scripts/bump-version.js patch --dry-run` and asserts no files were modified.

What CI does **not** run: the OData round-trip from §10 layer 8 (needs an authenticated XSUAA session, can't be done from a headless GitHub Actions runner).

## 14. Gotchas

- **CF CLI sessions expire mid-batch.** Recovery: `cf login --sso` with a passcode from `https://login.cf.us11.hana.ondemand.com/passcode` (works without password entry if the browser is already SSO-authenticated).
- **Bash scripts that end with `[ -n "$EMPTY_VAR" ] && echo`.** Test returns exit 1 when var is empty; the script appears to "fail" even though substance succeeded. Append `; true` or `exit 0`.
- **`@ui5/cli` build wipes `dist/` with `--clean-dest`.** Edit `apps/<app>/<source-tree>`, not anything inside `dist/`.
- **`MSYS_NO_PATHCONV=1` is required** for `cf html5-get` on Git Bash / MSYS, because the leading `/` in the path argument is otherwise translated into a Windows path.
- **`Component-preload.js` is a build-time snapshot of the manifest.** If you rename `sap.cloud.service` and skip `npm run build`, the preload still carries the old value and the deployed app uses the old identity. Source of nearly every "the app looks fine in source but behaves wrong on CF" class of bug.
- **Managed approuter destination lookup is instance-first, subaccount-second.** Removing an instance-level entry causes the next request to find the subaccount one. Adding an instance-level entry overrides the subaccount.
- **BAS auto-formats `launch.json` and `tasks.json` on save.** Touching either of those files in BAS produces a 2 600+ line "diff" against the canonical formatting. If you edit in BAS, `git diff` before committing to confirm the change is intentional.
- **Work Zone Content Channel does not auto-refresh.** If you deploy new apps, rename `sap.cloud.service`, or change manifests, the channel keeps its cached snapshot from the last refresh. Click the refresh icon in Channel Manager.

## 15. Reference URLs

| Purpose | URL |
|---|---|
| BTP cockpit (APAC region) | https://apac.cockpit.btp.cloud.sap |
| Global account | https://apac.cockpit.btp.cloud.sap/cockpit#/globalaccount/bf67959e-10af-4b43-a123-0831bfd59574/accountModel |
| `btp_cf` subaccount | https://apac.cockpit.btp.cloud.sap/cockpit#/globalaccount/bf67959e-10af-4b43-a123-0831bfd59574/subaccount/eecc9986-a678-4206-b6b5-4a486cd0a4fe/ |
| Cloud Connector admin | https://erpslm1.erp-is.com:8443/ |
| CF API | https://api.cf.us11.hana.ondemand.com |
| CF SSO passcode (for `cf login --sso`) | https://login.cf.us11.hana.ondemand.com/passcode |
| Destination Configuration API | https://destination-configuration.cfapps.us11.hana.ondemand.com/destination-configuration/v1/ |
| Work Zone admin (`btp_cf`) | https://btp-cf-8qsdli3e.dt.launchpad.cfapps.us11.hana.ondemand.com/sites |
| Launchpad runtime | https://btp-cf-8qsdli3e.launchpad.cfapps.us11.hana.ondemand.com/ |
| BAS workspace `ws-gvpy5` | https://btp-cf-8qsdli3e.us11cf.applicationstudio.cloud.sap/index.html#ws-gvpy5 |
| GitHub repo | https://github.com/nikkiledynavarro/work_cloud_foundry |

## 16. Glossary

- **Cloud Connector (CC)** — SAP-shipped Java service running inside the customer network. Tunnels selected on-prem HTTP/RFC endpoints to BTP without VPN at the app level.
- **Destination service** — BTP service storing connection metadata (URL, auth, proxy, custom properties) consumed by the SAP Cloud SDK / managed approuter / Web IDE / BAS.
- **`html5-apps-repo`** — BTP service hosting static content of HTML5 apps. `cf html5-push -r` ships content here; the managed approuter serves from here.
- **Managed Application Router** — SAP-hosted approuter that BTP provides automatically for HTML5 apps. Reads `xs-app.json` bundled with each app, applies XSUAA auth, proxies OData calls through the destination service.
- **XSUAA** — SAP's XS Advanced UAA. OAuth2-style identity service that gates access to CF apps and BTP services; issues tokens; enforces scopes; ties an authenticated user to role collections.
- **Role Collection** — BTP-level grouping of XSUAA roles assigned to users. `Launchpad_Admin` is what's needed to create Work Zone sites; `Launchpad_Admin_Read_Only` is what `nnavarro` currently has.
- **`sap.cloud.service`** — identifier inside `manifest.json` that Work Zone uses to associate a launchpad tile with its app. **Must** match exactly between the manifest, the destination's metadata, and the embedded snapshot inside `Component-preload.js`.
- **MTA** — Multi-Target Application: SAP packaging format used to deploy multiple modules (HTML5 content, destination-content, xsuaa) as a single unit. Built with `mbt build`, deployed with `cf deploy`. This repo has two: `mta.yaml` (HR7 + SLS) and `mta-hd6.yaml` (HD6).
- **"§27 clean destination architecture"** (referenced from `PROJECT_DISCUSSION_OLD.md`) — the migration from 62 per-app `virtual-*` destination entries to 3 subaccount-level `shiperp-virtual-*` destinations. The single biggest architectural cleanup in this project.

---

*If you need the chronological history of how each piece arrived (every review-fix pass, every diagnosis, every false start), read [`PROJECT_DISCUSSION_OLD.md`](PROJECT_DISCUSSION_OLD.md) — 4 500 lines covering §0–§41. The file you're reading is the current-state reference; that file is the journal.*
