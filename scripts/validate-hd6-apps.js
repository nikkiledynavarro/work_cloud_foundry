const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const config = JSON.parse(
  fs.readFileSync(path.join(root, "templates", "neo-to-cf-hd6.json"), "utf8")
);
const mta = fs.readFileSync(path.join(root, "mta-hd6.yaml"), "utf8");
const errors = [];
const ids = new Set();
const cloudServices = new Set();
const xsappnames = new Set();

function check(condition, message) {
  if (!condition) errors.push(message);
}

for (const app of config.apps.filter((entry) => entry.enabled !== false)) {
  const appDir = path.join(root, "apps", app.appName);
  const manifestPath = path.join(appDir, "manifest.json");
  const xsAppPath = path.join(appDir, "xs-app.json");
  const securityPath = path.join(
    root,
    "security",
    `xs-security-${app.appName}.json`
  );

  for (const requiredPath of [
    appDir,
    manifestPath,
    xsAppPath,
    securityPath,
    path.join(appDir, "index.html"),
    path.join(appDir, "package.json"),
    path.join(appDir, "ui5.yaml")
  ]) {
    check(fs.existsSync(requiredPath), `${app.appName}: missing ${requiredPath}`);
  }

  if (!fs.existsSync(manifestPath) || !fs.existsSync(xsAppPath)) continue;

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const xsApp = JSON.parse(fs.readFileSync(xsAppPath, "utf8"));
  const security = JSON.parse(fs.readFileSync(securityPath, "utf8"));
  const appId = manifest["sap.app"]?.id;
  const cloudService = manifest["sap.cloud"]?.service;
  const destinations = new Set(
    (xsApp.routes || []).map((route) => route.destination).filter(Boolean)
  );

  check(appId === app.newNamespace, `${app.appName}: unexpected sap.app/id ${appId}`);
  check(
    cloudService === app.sapCloudService,
    `${app.appName}: unexpected sap.cloud/service ${cloudService}`
  );
  check(
    destinations.has("virtual-hd6-destination"),
    `${app.appName}: HD6 destination route is missing`
  );
  check(
    security.xsappname === app.sapCloudService,
    `${app.appName}: unexpected XSUAA xsappname ${security.xsappname}`
  );

  check(!ids.has(appId), `${app.appName}: duplicate sap.app/id ${appId}`);
  check(
    !cloudServices.has(cloudService),
    `${app.appName}: duplicate sap.cloud/service ${cloudService}`
  );
  check(
    !xsappnames.has(security.xsappname),
    `${app.appName}: duplicate XSUAA xsappname ${security.xsappname}`
  );
  ids.add(appId);
  cloudServices.add(cloudService);
  xsappnames.add(security.xsappname);

  for (const expected of [
    `- name: ${app.appName}`,
    `- name: ${app.appName}-app-content`,
    `- name: ${app.appName}-destination-content`,
    `- name: ${app.appName}-app-front-service`,
    `- name: ${app.appName}-destination-service`,
    `- name: ${app.appName}-xsuaa-service`
  ]) {
    check(mta.includes(expected), `${app.appName}: missing MTA entry ${expected.trim()}`);
  }
}

check(config.apps.length === 8, `Expected 8 active HD6 apps, found ${config.apps.length}`);
check(
  !mta.includes("virtual-hr7-destination") &&
    !mta.includes("virtual-erps4sales-destination"),
  "HD6 MTA contains an HR7 or SLS destination"
);

if (errors.length) {
  console.error(`HD6 validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log("HD6 validation passed.");
  console.log("HD6 apps: 8");
}
