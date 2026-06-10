#!/usr/bin/env node
/**
 * scripts/fix-hr7-titles.js
 *
 * Mirror of fix-sls-titles.js / fix-hd6-titles.js for HR7. Walks every
 * HR7 app under apps/ (no -sls or -hd6 suffix) and:
 *   1) Sets <title> in index.html to canonical "{Title}" form.
 *   2) Sets/replaces appTitle= in i18n/i18n.properties (and any
 *      i18n_*.properties variant).
 *   3) Skips out-of-scope Neo apps (not in the HR7 list below).
 *
 * Run from repo root: node scripts/fix-hr7-titles.js
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

for (const [app, title] of Object.entries(TITLES)) {
  const dir = path.join(appsRoot, app);
  if (!fs.existsSync(dir)) {
    console.log(`SKIP ${app} — directory missing`);
    continue;
  }

  // 1) index.html <title> (add or replace)
  const indexPath = path.join(dir, "index.html");
  if (fs.existsSync(indexPath)) {
    let src = fs.readFileSync(indexPath, "utf8");
    let next;
    if (/<title>[^<]*<\/title>/i.test(src)) {
      next = src.replace(/<title>[^<]*<\/title>/i, `<title>${title}</title>`);
    } else if (/<head[^>]*>/i.test(src)) {
      next = src.replace(/<head([^>]*)>/i, `<head$1>\n    <title>${title}</title>`);
    } else {
      next = src;
    }
    if (next !== src) {
      fs.writeFileSync(indexPath, next, "utf8");
      changes.push(`index.html: ${app} → "${title}"`);
    }
  } else {
    console.log(`SKIP ${app}/index.html — file missing`);
  }

  // 2) i18n appTitle / appDescription
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

console.log(`\n${changes.length} change(s):`);
for (const c of changes) console.log("  " + c);
