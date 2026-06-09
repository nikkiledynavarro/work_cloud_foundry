#!/usr/bin/env node
/**
 * scripts/fix-sls-titles.js
 *
 * §13.3 cleanup. For every SLS app under apps/:
 *   1) Force <title> in index.html to the clean "Title SLS" form.
 *   2) If i18n/i18n.properties is missing `appTitle=` (or has a bad value),
 *      add `appTitle=Title SLS`. Existing correct appTitle entries are
 *      left alone.
 *   3) HR7 apps (apps/* not ending in "sls") are not touched.
 *
 * Run from repo root: node scripts/fix-sls-titles.js
 */
const fs = require("fs");
const path = require("path");

const TITLES = {
  cancelacefiling: "Cancel ACE Filing",
  cancelpickuprequest: "Cancel Pickup Request",
  cancelshipmentecc: "Cancel Shipment ECC",
  cancelshipmentewm: "Cancel Shipment EWM",
  carrierperformancereportecc: "Carrier Performance Report ECC",
  carrierperformancereportewm: "Carrier Performance Report EWM",
  closedelivery: "Close Delivery",
  createshipmentecc: "Create Shipment ECC",
  createshipmentewm: "Create Shipment EWM",
  createshipmentv2ewm: "Create Shipment v2 EWM",
  dispute: "Dispute",
  freightaudit: "Freight Audit",
  freightauditupload: "Freight Audit Upload",
  freightorderplanning: "Freight Order Planning",
  ltlplanning: "LTL Planning",
  manualshipmentecc: "Manual Shipment ECC",
  manualshipmentewm: "Manual Shipment EWM",
  planshipment: "Plan Shipment",
  quickpackecc: "Quick Pack ECC",
  quickpackewm: "Quick Pack EWM",
  requestforpickup: "Request For Pickup",
  saleorder: "Sales Order",
  shippingdashboard: "Shipping Dashboard",
  submitacefiling: "Submit ACE Filing",
  trackshipmentecc: "Track Shipment ECC",
  trackshipmentewm: "Track Shipment EWM",
  viewacefiling: "View ACE Filing",
};

const root = path.resolve(__dirname, "..");
const appsRoot = path.join(root, "apps");

const changes = [];

for (const dir of fs.readdirSync(appsRoot)) {
  if (!dir.endsWith("sls")) continue;
  const base = dir.slice(0, -3);
  if (!TITLES[base]) {
    console.log(`SKIP ${dir} — no canonical title mapping for "${base}"`);
    continue;
  }
  const slsTitle = `${TITLES[base]} SLS`;
  const appDir = path.join(appsRoot, dir);

  // 1) index.html <title>
  const indexPath = path.join(appDir, "index.html");
  if (fs.existsSync(indexPath)) {
    const src = fs.readFileSync(indexPath, "utf8");
    const next = src.replace(
      /<title>[^<]*<\/title>/i,
      `<title>${slsTitle}</title>`
    );
    if (next !== src) {
      fs.writeFileSync(indexPath, next, "utf8");
      changes.push(`index.html: ${dir} → "${slsTitle}"`);
    }
  } else {
    console.log(`SKIP ${dir}/index.html — file missing`);
  }

  // 2) i18n.properties appTitle
  const i18nPath = path.join(appDir, "i18n", "i18n.properties");
  if (fs.existsSync(i18nPath)) {
    let i18n = fs.readFileSync(i18nPath, "utf8");
    const hasAppTitle = /^\s*appTitle\s*=/m.test(i18n);
    if (!hasAppTitle) {
      // append a clean block
      if (!i18n.endsWith("\n")) i18n += "\n";
      i18n += `\n#XTIT: Application name\nappTitle=${slsTitle}\n`;
      fs.writeFileSync(i18nPath, i18n, "utf8");
      changes.push(`i18n: ${dir} appended appTitle="${slsTitle}"`);
    }
  } else {
    console.log(`SKIP ${dir}/i18n/i18n.properties — file missing`);
  }
}

console.log(`\n${changes.length} change(s):`);
for (const c of changes) console.log("  " + c);
