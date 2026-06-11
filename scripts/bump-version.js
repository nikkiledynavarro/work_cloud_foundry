#!/usr/bin/env node
// scripts/bump-version.js — review-fix #5 item 7
//
// Bumps the version of every one of the 62 apps' package.json AND the two
// MTAs (mta.yaml + mta-hd6.yaml) in lockstep, by a semver level.
//
// Usage:  node scripts/bump-version.js patch|minor|major [--dry-run]
//
// Examples:
//   node scripts/bump-version.js patch          # 1.0.0 -> 1.0.1 across all apps; 0.0.1 -> 0.0.2 on both MTAs
//   node scripts/bump-version.js minor --dry-run  # show what would change without writing
//
// Why a single helper instead of per-app `npm version`:
//   - keeps the 62 apps + 2 MTAs in lockstep (no drift if someone bumps 1 and forgets)
//   - mta.yaml is YAML, not JSON, so `npm version` doesn't touch it
//   - works on Windows / BAS / Linux with bare Node — no external deps
const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");

const HR7 = [
  "cancelacefiling","cancelpickuprequest","cancelshipmentecc","cancelshipmentewm",
  "carrierperformancereportecc","carrierperformancereportewm","closedelivery",
  "createshipmentecc","createshipmentewm","createshipmentv2ewm","dispute",
  "freightaudit","freightauditupload","freightorderplanning","ltlplanning",
  "manualshipmentecc","manualshipmentewm","planshipment","quickpackecc","quickpackewm",
  "requestforpickup","saleorder","shippingdashboard","submitacefiling",
  "trackshipmentecc","trackshipmentewm","viewacefiling",
];
const SLS = HR7.map(a => a + "sls");
const HD6 = ["cancelhd6","disputehd6","eodhd6","farpthd6","freightaudithd6","parceldemohd6","parcelhd6","trackshipmenthd6"];
const ALL_APPS = [...HR7, ...SLS, ...HD6];

const level = process.argv[2];
const dryRun = process.argv.includes("--dry-run");
if (!["patch", "minor", "major"].includes(level)) {
  console.error("Usage: node scripts/bump-version.js patch|minor|major [--dry-run]");
  process.exit(2);
}

function bumpSemver(v, lvl) {
  const m = v.match(/^(\d+)\.(\d+)\.(\d+)(.*)$/);
  if (!m) throw new Error(`Not a semver: ${v}`);
  let [, maj, min, pat, suffix] = m;
  maj = +maj; min = +min; pat = +pat;
  if (lvl === "major") { maj++; min = 0; pat = 0; }
  else if (lvl === "minor") { min++; pat = 0; }
  else { pat++; }
  return `${maj}.${min}.${pat}${suffix}`;
}

let changes = 0;

// 62 apps
for (const app of ALL_APPS) {
  const pkgPath = path.join(repoRoot, "apps", app, "package.json");
  if (!fs.existsSync(pkgPath)) continue;
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const newVersion = bumpSemver(pkg.version, level);
  console.log(`  apps/${app}: ${pkg.version} -> ${newVersion}`);
  if (!dryRun) {
    pkg.version = newVersion;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 4) + "\n");
  }
  changes++;
}

// 2 MTAs (YAML — bump the version field on a line that matches `version: <semver>`)
for (const mtaFile of ["mta.yaml", "mta-hd6.yaml"]) {
  const mtaPath = path.join(repoRoot, mtaFile);
  if (!fs.existsSync(mtaPath)) continue;
  let yaml = fs.readFileSync(mtaPath, "utf8");
  let hit = false;
  yaml = yaml.replace(/^(version:\s*)(\d+\.\d+\.\d+\S*)$/m, (line, prefix, ver) => {
    const newVer = bumpSemver(ver, level);
    console.log(`  ${mtaFile}: ${ver} -> ${newVer}`);
    hit = true;
    return prefix + newVer;
  });
  if (!hit) {
    console.warn(`  ${mtaFile}: no top-level 'version:' line found — skipped`);
    continue;
  }
  if (!dryRun) fs.writeFileSync(mtaPath, yaml);
  changes++;
}

console.log("");
console.log(dryRun ? `DRY RUN — ${changes} entries would change.` : `Bumped ${changes} version entries.`);
