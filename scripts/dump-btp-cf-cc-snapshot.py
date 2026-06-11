#!/usr/bin/env python
"""
scripts/dump-btp-cf-cc-snapshot.py

Dump live CF + BTP destination + Cloud Connector state to a structured
Markdown file for backup / audit / disaster-recovery use. Written for
review-fix #6 follow-up + §39 of PROJECT_DISCUSSION.md.

Usage:
    python scripts/dump-btp-cf-cc-snapshot.py

Output:
    docs/btp-cf-cc-snapshot.md

Requires:
    - cf CLI logged into the right org/space
    - Network reachability to destination-configuration.cfapps.us11.hana.ondemand.com
    - The per-app `{app}-destination-content-{app}-destination-service-credentials`
      service keys (created by the MTA deploy; present by default).

Layout of the output file:
    1. CF target (org / space)
    2. CF services (instances)
    3. CF service keys (after §38.1 cleanup, 1 per app-front-service)
    4. Subaccount-level destinations (3 from §27)
    5. Instance-level destinations (per-app, after §27.5 cleanup)
    6. Cloud Connector mappings + resources (§26 documented)
    7. Service-instance-to-app mapping table

Cloud Connector data is sourced from the §26.9 documented config that
produced HTTP 201 on every PUT/POST and was verified live via §34.3 +
§36.2 OData round-trips. The dump does not contact the CC REST API
because credentials are not stored in this script.
"""
import base64
import datetime
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    out_path = "docs/btp-cf-cc-snapshot.md"
    os.makedirs("docs", exist_ok=True)
    out = open(out_path, "w", encoding="utf-8")

    def W(line: str = "") -> None:
        print(line, file=out)

    def H(level: int, text: str) -> None:
        W()
        W("#" * level + " " + text)
        W()

    def code(text: str, lang: str = "") -> None:
        W("```" + lang)
        W(text)
        W("```")

    # ── Header ──
    W("# BTP / CF / Cloud Connector configuration snapshot")
    W()
    W(f"**Captured:** {datetime.datetime.utcnow().isoformat()}Z")
    W("**Capture script:** `scripts/dump-btp-cf-cc-snapshot.py`")
    W()
    W("This file is the disaster-recovery / audit snapshot of the deployed")
    W("state. Pair with `PROJECT_DISCUSSION.md` §35 (master reference) for")
    W("the procedural runbook that produced this state.")
    W()
    W("Layout:")
    W()
    W("1. CF target (org / space)")
    W("2. CF services (instances)")
    W("3. CF service keys")
    W("4. Subaccount-level destinations (3 from §27)")
    W("5. Instance-level destinations (per-app)")
    W("6. Cloud Connector mappings + resources (§26)")
    W("7. Service-instance to app mapping table")

    # ── 1. CF target ──
    H(2, "1. CF target")
    cf_target = subprocess.run(
        ["cf", "target"], capture_output=True, text=True
    ).stdout.strip()
    code(cf_target)

    # ── 2. CF services ──
    H(2, "2. CF services (instances)")
    cf_services = subprocess.run(
        ["cf", "services"], capture_output=True, text=True
    ).stdout.strip()
    n_lines = len(cf_services.splitlines())
    W(f"Output has {n_lines} lines (header + service rows).")
    W()
    code(cf_services)

    # ── 3. CF service keys ──
    H(2, "3. CF service keys")
    keys_text = subprocess.run(
        ["cf", "curl", "/v3/service_credential_bindings?per_page=1000"],
        capture_output=True,
        text=True,
    ).stdout
    try:
        data = json.loads(keys_text)
        bindings = data.get("resources", [])
        keys_only = [k for k in bindings if k.get("type") == "key"]
        W(
            f"Total service credential bindings (keys + app bindings): "
            f"{len(bindings)}. Of those, `type=key`: {len(keys_only)}."
        )
        W()
        W("| Key name | Service instance GUID |")
        W("|---|---|")
        for k in keys_only[:300]:
            rel = (
                k.get("relationships", {})
                .get("service_instance", {})
                .get("data", {})
            )
            W(f"| `{k.get('name', '?')}` | `{rel.get('guid', '?')}` |")
        if len(keys_only) > 300:
            W()
            W(f"_(+{len(keys_only) - 300} more rows truncated)_")
    except Exception as exc:
        W(f"_(API parse failed: {exc})_")

    # ── helpers for destination API ──
    HR7 = [
        "cancelacefiling", "cancelpickuprequest", "cancelshipmentecc",
        "cancelshipmentewm", "carrierperformancereportecc",
        "carrierperformancereportewm", "closedelivery",
        "createshipmentecc", "createshipmentewm", "createshipmentv2ewm",
        "dispute", "freightaudit", "freightauditupload",
        "freightorderplanning", "ltlplanning", "manualshipmentecc",
        "manualshipmentewm", "planshipment", "quickpackecc",
        "quickpackewm", "requestforpickup", "saleorder",
        "shippingdashboard", "submitacefiling", "trackshipmentecc",
        "trackshipmentewm", "viewacefiling",
    ]
    SLS = [app + "sls" for app in HR7]
    HD6 = [
        "cancelhd6", "disputehd6", "eodhd6", "farpthd6",
        "freightaudithd6", "parceldemohd6", "parcelhd6", "trackshipmenthd6",
    ]
    ALL = HR7 + SLS + HD6

    def get_destination_token(svc: str, key: str):
        try:
            sk = subprocess.run(
                ["cf", "service-key", svc, key],
                capture_output=True, text=True,
            ).stdout
            lines = sk.split("\n")
            starts = [i for i, l in enumerate(lines) if l.strip().startswith("{")]
            if not starts:
                return None, None
            creds = json.loads("\n".join(lines[starts[0]:]))["credentials"]
            uaa = creds.get("uaa", creds)
            auth = base64.b64encode(
                (uaa["clientid"] + ":" + uaa["clientsecret"]).encode()
            ).decode()
            req = urllib.request.Request(
                uaa["url"] + "/oauth/token",
                data=b"grant_type=client_credentials",
                headers={
                    "Authorization": "Basic " + auth,
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            )
            tok = json.loads(urllib.request.urlopen(req).read())["access_token"]
            return tok, uaa["uri"]
        except Exception:
            return None, None

    # ── 4. Subaccount-level destinations ──
    H(2, "4. Subaccount-level destinations")
    tok, base = get_destination_token(
        "quickpackecc-destination-service",
        "quickpackecc-destination-content-quickpackecc-destination-service-credentials",
    )
    if not tok:
        W("_(could not get destination-service token)_")
    else:
        try:
            req = urllib.request.Request(
                base + "/destination-configuration/v1/subaccountDestinations",
                headers={"Authorization": "Bearer " + tok},
            )
            dests = json.loads(urllib.request.urlopen(req).read())
            W(f"Total subaccount destinations: {len(dests)}.")
            W()
            for d in dests:
                W(f"### `{d.get('Name')}`")
                W()
                safe = {
                    k: ("«REDACTED»" if k.lower() in ("password", "sapclient") else v)
                    for k, v in d.items()
                }
                code(json.dumps(safe, indent=2), "json")
        except Exception as exc:
            W(f"_(failed: {exc})_")

    # ── 5. Instance destinations ──
    H(2, "5. Instance-level destinations (per-app)")
    W(
        "For each of the 62 per-app destination services, listing the "
        "entries it carries. After §27.5 cleanup, each service holds "
        "the two MTA-managed entries: `{app}-app-front-service` and "
        "`{app}-xsuaa-service`."
    )
    W()
    W("| App | Instance destinations |")
    W("|---|---|")
    ok = fail = 0
    for app in ALL:
        svc = app + "-destination-service"
        key = (
            app + "-destination-content-" + app +
            "-destination-service-credentials"
        )
        tok, base = get_destination_token(svc, key)
        if tok is None:
            W(f"| `{app}` | _(token error)_ |")
            fail += 1
            continue
        try:
            req = urllib.request.Request(
                base + "/destination-configuration/v1/instanceDestinations",
                headers={"Authorization": "Bearer " + tok},
            )
            ds = json.loads(urllib.request.urlopen(req).read())
            names = [d.get("Name", "?") for d in ds]
            cell = ", ".join("`" + n + "`" for n in names)
            W(f"| `{app}` | {cell} |")
            ok += 1
        except Exception as exc:
            W(f"| `{app}` | _(error: {str(exc)[:60]})_ |")
            fail += 1
    W()
    W(f"Successful fetches: {ok} / 62. Failed: {fail}.")

    # ── 6. Cloud Connector mappings ──
    H(2, "6. Cloud Connector mappings + resources")
    W(
        "Source of truth: SLM CC at `https://erpslm1.erp-is.com:8443/` "
        "(default Location ID for the `btp_cf` subaccount)."
    )
    W()
    W(
        "Cross-check via the CC admin UI: "
        "`https://erpslm1.erp-is.com:8443/` → btp_cf subaccount → "
        "*Cloud to On-Premise* → *System Mappings*."
    )
    W()
    W(
        "Mappings documented in §26.9 — all three returned HTTP 201 on "
        "creation and were verified live across all 3 backends via §34.3 + "
        "§36.2 OData round-trips."
    )
    W()
    W("| virtualHost | virtualPort | localHost | localPort | backendType | hostInHeader | Resources |")
    W("|---|---|---|---|---|---|---|")
    W("| `virtual-s4hr7.erp-is.com`  | 50000 | `s4hr7.erp-is.com`       | 50000 | abapSys | VIRTUAL | `/` (PATH_AND_ALL_SUB_PATHS) |")
    W("| `erps4sales.erp-is.com`     | 50000 | `erps4sales.erp-is.com`  | 50000 | abapSys | VIRTUAL | `/` (PATH_AND_ALL_SUB_PATHS) |")
    W("| `virtual-s4hd6.erp-is.com`  |  8000 | `s4hd6.erp-is.com`       |  8001 | abapSys | VIRTUAL | `/` (PATH_AND_ALL_SUB_PATHS) |")

    # ── 7. Service-instance to app map ──
    H(2, "7. Service-instance to app mapping table")
    W("For each of the 62 apps, the 3 CF service instances it owns:")
    W()
    W(
        "| App | app-front-service (html5-apps-repo) | "
        "destination-service | xsuaa-service |"
    )
    W("|---|---|---|---|")
    for app in ALL:
        W(
            f"| `{app}` | `{app}-app-front-service` | "
            f"`{app}-destination-service` | `{app}-xsuaa-service` |"
        )

    # ── Reproduction ──
    H(2, "Reproduction")
    W("Regenerate this snapshot at any time:")
    W()
    code("python scripts/dump-btp-cf-cc-snapshot.py", "bash")
    W()
    W(
        "Requires `cf` logged in to the correct org/space, network "
        "reachability to "
        "`destination-configuration.cfapps.us11.hana.ondemand.com`, and "
        "the per-app destination-content service keys (present by "
        "default after MTA deploy)."
    )
    W()
    W(f"Snapshot generated: {datetime.datetime.utcnow().isoformat()}Z")

    out.close()
    size = os.path.getsize(out_path)
    print(f"Wrote {out_path} ({size} bytes)")


if __name__ == "__main__":
    main()
