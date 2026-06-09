#!/usr/bin/env node
/**
 * scripts/regen-cf-direct-urls.js
 *
 * §13.8 cleanup. The ☁ CF Direct group in .vscode/launch.json was
 * generated when all apps shared one destination-service instance.
 * After the per-app destination-service split, each app has its own
 * GUID — but the launch entries still hardcode the old shared GUID
 * a167a84f-0812-44fd-86e6-01c300d56f26 and therefore 404 on click.
 *
 * This script:
 *   1) Reads every "☁ {app} (CF Direct)" entry in launch.json
 *   2) Calls `cf service {app}-destination-service --guid` for each
 *   3) Rewrites the launchpad URL with the correct per-app GUID
 *
 * Requirements:
 *   - Logged in to the CF API endpoint that hosts the deployed apps
 *     (`cf target` should show org "ERP Integrated Solutions, LLC
 *     dba ShipERP._btp-cf-8qsdli3e" / space "dev").
 *
 * Run from repo root: node scripts/regen-cf-direct-urls.js
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const launchPath = path.join(root, ".vscode", "launch.json");
const launch = JSON.parse(fs.readFileSync(launchPath, "utf8"));

// URL pattern this script understands:
//   https://btp-cf-8qsdli3e.launchpad.cfapps.us11.hana.ondemand.com/
//     {GUID}.{cloudService}.{cloudService}-{version}/index.html
const LAUNCHPAD_HOST =
  "https://btp-cf-8qsdli3e.launchpad.cfapps.us11.hana.ondemand.com";

function getGuid(app) {
  try {
    const out = execSync(`cf service ${app}-destination-service --guid`, {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
    if (/^[0-9a-f-]{36}$/i.test(out)) return out;
    return null;
  } catch {
    return null;
  }
}

let fixed = 0;
let unchanged = 0;
let failed = [];

for (const cfg of launch.configurations) {
  const name = cfg.name || "";
  if (!name.includes("(CF Direct)")) continue;
  // app name is between the cloud emoji and "(CF Direct)"
  const m = /^[^\w]*\s*(\w[\w-]*)\s*\(CF Direct\)/.exec(name);
  if (!m) {
    failed.push(`unparseable name: ${name}`);
    continue;
  }
  const app = m[1];
  const guid = getGuid(app);
  if (!guid) {
    failed.push(app);
    continue;
  }
  const cs = `comerpisshiperp${app}`;
  const newUrl = `${LAUNCHPAD_HOST}/${guid}.${cs}.${cs}-1.0.0/index.html`;
  // Replace inside runtimeArgs[-1] string of form "Start-Process '...'"
  const ra = cfg.runtimeArgs;
  if (!Array.isArray(ra) || ra.length < 2) {
    failed.push(`${app}: runtimeArgs shape unexpected`);
    continue;
  }
  const last = ra[ra.length - 1];
  const next = last.replace(
    /https:\/\/btp-cf-8qsdli3e\.launchpad\.cfapps[^']+/,
    newUrl
  );
  if (next === last) {
    unchanged++;
  } else {
    ra[ra.length - 1] = next;
    fixed++;
  }
}

if (fixed > 0) {
  fs.writeFileSync(launchPath, JSON.stringify(launch, null, 4) + "\n", "utf8");
}

console.log(`Fixed:     ${fixed}`);
console.log(`Unchanged: ${unchanged}`);
console.log(`Failed:    ${failed.length}`);
if (failed.length) {
  console.log("\nFailures:");
  for (const f of failed) console.log("  " + f);
  process.exit(1);
}
