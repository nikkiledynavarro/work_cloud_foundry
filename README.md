# ShipERP Neo → Cloud Foundry Migration

Lift-and-shift of **62 SAP Fiori HTML5 apps** (27 HR7 + 27 SLS + 8 HD6) from SAP BTP Neo (sunset) to Cloud Foundry. Complete and end-to-end verified.

## Status (2026-06-11)

| Layer | State |
|---|---|
| Deployed apps | **62 / 62** in `btp_cf` subaccount, space `DEV` |
| Backend destinations | 3 subaccount-level (`shiperp-virtual-{hr7,erps4sales,hd6}-destination`) routing through the Cloud Connector tunnel |
| Cloud Connector mappings | 3 (HR7, SLS, HD6) on the SLM CC's `(default)` Location ID |
| Service account | `USER_CF` on all 3 backends |
| OData round-trip | **51 / 65** services live end-to-end; 14 SAP-basis activations pending (see §36) |
| Browser-render | 62 / 62 launchpad URLs render UI5 bootstrap under active SSO (see §34) |
| Code defects | **0** |

## Where to read next

1. **Start at [§35 — MASTER REFERENCE](PROJECT_DISCUSSION.md#35--master-reference-everything-in-one-place-2026-06-11)** in `PROJECT_DISCUSSION.md` for the self-contained current-state document: architecture, every fix made, full Cloud Connector + BTP setup, 8-layer test plan with reproduction scripts, operational runbook, all 8 pending items with close-out steps, and the gotchas list.
2. §0–§34 are the historical record of how the project got here (chronological).
3. §36, §37 are post-§35 addendums: full 65-OData sweep + close-out of pending items 5 + 7.

## Pending items

8 items, none of which is a code defect. Categories:

- **You / RBAC (1):** Work Zone Site build (#41) — needs `Launchpad_Admin` role grant
- **Infrastructure provisioning (2):** Standalone CF approuter quota; dedicated CC Location ID
- **SAP basis team (3):** Rotate `USER_CF`; activate 10 OData services on SLS; activate `ZP_ODAT_FA_RPT_SRV` on HD6
- **Scoped future projects (2):** UI5 1.42 → current modernization; stale `apps/` directory cleanup

See [PROJECT_DISCUSSION.md §35.8](PROJECT_DISCUSSION.md#358--pending-items-with-detailed-why--how-to-close) for step-by-step close-out per item.

## Local dev quick start

```bash
git clone https://github.com/nikkiledynavarro/work_cloud_foundry
cd work_cloud_foundry
node scripts/validate-deployed-apps.js   # expect: 27 HR7 + 27 SLS pass
node scripts/validate-hd6-apps.js         # expect: 8 HD6 pass

# Run a single app locally (needs VPN to HR7 for OData):
cd apps/quickpackecc && npm install && npm start
```

For the **local approuter** that fronts all 3 backends, see [PROJECT_DISCUSSION.md §22 / §24](PROJECT_DISCUSSION.md). For the **CF deploy workflow**, see [§35.7](PROJECT_DISCUSSION.md#357--operational-runbook-everyday-tasks).

## Operational runbook

[§35.7](PROJECT_DISCUSSION.md#357--operational-runbook-everyday-tasks) covers:

- Deploy a code change to a single app
- Mass redeploy all 62 (cross-cutting change)
- Rotate `USER_CF` password (now a 3-destination edit, not a 62-instance sweep)
- Bump versions across all 62 apps + 2 MTAs (`node scripts/bump-version.js patch`)
- Run `npm test` for an app
- Run the full 8-layer test sweep from scratch

## Repo layout

```
apps/                  62 Fiori HTML5 apps, one directory each
approuter/             local dev approuter (server.js routes /hr7, /sls, /hd6 prefixes)
scripts/               utility scripts (validators, namespace fixes, bump-version, open-url)
security/              xs-security-*.json per app
templates/             neo-to-cf-*.json (config used by validators)
.github/workflows/     CI pipeline (validators + JSON parse + npm test smoke)
.vscode/               launch.json (187 configs) + tasks.json (67 tasks)
mta.yaml               MTA for HR7 + SLS
mta-hd6.yaml           MTA for HD6
PROJECT_DISCUSSION.md  the full project history + master reference (§35)
```

## Verifying end-to-end

The 8-layer test plan in [§35.6](PROJECT_DISCUSSION.md#356--detailed-per-layer-test-plan-and-reproduction-steps):

1. Static validators (62 / 62)
2. CF Direct URL HEAD (62 / 62 HTTP 401 — healthy)
3. Live `xs-app.json` via `cf html5-get` (62 / 62 reference `shiperp-virtual-*`)
4. Live `Component-preload.js` embedded `sap.cloud.service` (62 / 62 match current manifest)
5. Local approuter (v22) + HEAD probe per app (62 / 62 HTTP 200)
6. VS Code `launch.json` + `tasks.json` (62 × 3 launch modes + 62 tasks)
7. BAS workspace validators (54 / 54 + 8 / 8)
8. Browser-rendered UI under SSO (62 / 62 HTTP 200 + UI5 markers)
9. OData `$metadata` round-trip via CC tunnel (51 / 65; 14 SAP-basis pending — §36)

## Contributing

This is a complete-state migration repo, not an actively developed product. Changes belong to one of:

- A documented pending item (see [§35.8](PROJECT_DISCUSSION.md))
- A response to a code review (see §32, §37, §38 for the review-fix pattern)
- A new SAP-basis-side activation closing items 8 or 9

Each change should add a section to `PROJECT_DISCUSSION.md` with the *why*, the *what*, and any updated layer coverage.
