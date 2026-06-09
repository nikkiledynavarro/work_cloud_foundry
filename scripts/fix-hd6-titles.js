#!/usr/bin/env node
/**
 * scripts/fix-hd6-titles.js
 *
 * Mirror of scripts/fix-sls-titles.js for the HD6 migration. Walks
 * every active HD6 app under apps/ and:
 *   1) Sets <title> in index.html to canonical "{Title} HD6".
 *   2) Sets/replaces appTitle= in i18n/i18n.properties (and any
 *      i18n_*.properties) so the launchpad header matches.
 *   3) For farpthd6, fixes sap.app.id from the legacy testfarptFA_RPT
 *      name to com.erpis.shiperp.farpt.hd6 so the html5-apps-repo
 *      entry name becomes comerpisshiperpfarpthd6 (matching cloud.service).
 *
 * zpkwporeporthd6 is intentionally skipped — §16.3 removed it from
 * the active HD6 MTA; source folder is kept for audit only.
 *
 * Run from repo root: node scripts/fix-hd6-titles.js
 */
const fs = require("fs");
const path = require("path");

const TITLES = {
  cancelhd6: "Cancel HD6",
  disputehd6: "Dispute HD6",
  eodhd6: "End of Day HD6",
  farpthd6: "Freight Audit Report HD6",
  freightaudithd6: "Freight Audit HD6",
  parceldemohd6: "Parcel Demo HD6",
  parcelhd6: "Parcel HD6",
  trackshipmenthd6: "Track Shipment HD6",
};

const root = path.resolve(__dirname, "..");
const appsRoot = path.join(root, "apps");
const changes = [];

for (const [app, title] of Object.entries(TITLES)) {
  const dir = path.join(appsRoot, app);
  if (!fs.existsSync(dir)) {
    console.log(`SKIP ${app} — directory missing`);
    continue;
  }

  // 1) index.html <title>
  const indexPath = path.join(dir, "index.html");
  if (fs.existsSync(indexPath)) {
    const src = fs.readFileSync(indexPath, "utf8");
    const next = src.replace(/<title>[^<]*<\/title>/i, `<title>${title}</title>`);
    if (next !== src) {
      fs.writeFileSync(indexPath, next, "utf8");
      changes.push(`index.html: ${app} → "${title}"`);
    }
  } else {
    console.log(`SKIP ${app}/index.html — file missing`);
  }

  // 2) i18n appTitle — handle .properties and _en/_en_US variants
  const i18nDir = path.join(dir, "i18n");
  if (fs.existsSync(i18nDir)) {
    for (const file of fs.readdirSync(i18nDir)) {
      if (!file.endsWith(".properties")) continue;
      const fp = path.join(i18nDir, file);
      let text = fs.readFileSync(fp, "utf8");
      const lineRe = /^[\t ]*appTitle[\t ]*=.*$/m;
      const newLine = `appTitle=${title}`;
      let next;
      if (lineRe.test(text)) {
        next = text.replace(lineRe, newLine);
      } else {
        if (!text.endsWith("\n")) text += "\n";
        next = text + `\n#XTIT: Application name\n${newLine}\n`;
      }
      if (next !== text) {
        fs.writeFileSync(fp, next, "utf8");
        changes.push(`${file}: ${app} appTitle="${title}"`);
      }
      // Also fix appDescription if it looks stale (no HD6 suffix)
      const descLineRe = /^[\t ]*appDescription[\t ]*=.*$/m;
      text = fs.readFileSync(fp, "utf8");
      if (descLineRe.test(text)) {
        const desc = `appDescription=ShipERP - ${title}`;
        const text2 = text.replace(descLineRe, desc);
        if (text2 !== text) {
          fs.writeFileSync(fp, text2, "utf8");
          changes.push(`${file}: ${app} appDescription updated`);
        }
      }
    }
  }
}

// 3) farpthd6 manifest sap.app.id fix
const farptManifestPath = path.join(appsRoot, "farpthd6", "manifest.json");
if (fs.existsSync(farptManifestPath)) {
  let raw = fs.readFileSync(farptManifestPath, "utf8");
  const before = "com.erpis.testfarptFA_RPT.hd6";
  const after = "com.erpis.shiperp.farpt.hd6";
  if (raw.includes(before)) {
    raw = raw.split(before).join(after);
    fs.writeFileSync(farptManifestPath, raw, "utf8");
    changes.push(`manifest: farpthd6 sap.app.id ${before} → ${after}`);
  }
}

console.log(`\n${changes.length} change(s):`);
for (const c of changes) console.log("  " + c);
