const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const appsRoot = path.join(root, "apps");
const mta = fs.readFileSync(path.join(root, "mta.yaml"), "utf8");
const workspace = JSON.parse(
  fs.readFileSync(path.join(root, "shiperp-hr7.code-workspace"), "utf8")
);

const hr7Apps = [
  "cancelacefiling",
  "cancelpickuprequest",
  "cancelshipmentecc",
  "cancelshipmentewm",
  "carrierperformancereportecc",
  "carrierperformancereportewm",
  "closedelivery",
  "createshipmentecc",
  "createshipmentewm",
  "createshipmentv2ewm",
  "dispute",
  "freightaudit",
  "freightauditupload",
  "freightorderplanning",
  "ltlplanning",
  "manualshipmentecc",
  "manualshipmentewm",
  "planshipment",
  "quickpackecc",
  "quickpackewm",
  "requestforpickup",
  "saleorder",
  "shippingdashboard",
  "submitacefiling",
  "trackshipmentecc",
  "trackshipmentewm",
  "viewacefiling"
];

const expectedApps = [
  ...hr7Apps,
  ...hr7Apps.map((app) => `${app}sls`)
];

const workspacePaths = new Set(
  workspace.folders
    .map((folder) => folder.path.replaceAll("\\", "/"))
    .filter((folderPath) => folderPath.startsWith("apps/"))
);

const errors = [];
const ids = new Map();
const services = new Map();
const xsappnames = new Map();

function requireCondition(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

for (const app of expectedApps) {
  const appPath = path.join(appsRoot, app);
  const manifestPath = path.join(appPath, "manifest.json");
  const xsAppPath = path.join(appPath, "xs-app.json");
  const securityPath = path.join(root, "security", `xs-security-${app}.json`);

  requireCondition(fs.existsSync(appPath), `${app}: app folder is missing`);
  requireCondition(fs.existsSync(manifestPath), `${app}: manifest.json is missing`);
  requireCondition(fs.existsSync(xsAppPath), `${app}: xs-app.json is missing`);
  requireCondition(fs.existsSync(securityPath), `${app}: XSUAA descriptor is missing`);
  requireCondition(
    fs.existsSync(path.join(appPath, "index.html")),
    `${app}: index.html is missing`
  );
  requireCondition(
    workspacePaths.has(`apps/${app}`),
    `${app}: missing from BAS workspace`
  );

  if (!fs.existsSync(manifestPath)) {
    continue;
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const xsApp = JSON.parse(fs.readFileSync(xsAppPath, "utf8"));
  const security = JSON.parse(fs.readFileSync(securityPath, "utf8"));
  const appId = manifest["sap.app"]?.id;
  const cloudService = manifest["sap.cloud"]?.service;
  const expectedService = `comerpisshiperp${app}`;
  const expectedDestination = app.endsWith("sls")
    ? "shiperp-virtual-erps4sales-destination"
    : "shiperp-virtual-hr7-destination";
  const routeDestinations = new Set(
    (xsApp.routes || []).map((route) => route.destination).filter(Boolean)
  );

  requireCondition(Boolean(appId), `${app}: sap.app/id is missing`);
  requireCondition(
    cloudService === expectedService,
    `${app}: sap.cloud/service is ${cloudService}, expected ${expectedService}`
  );
  requireCondition(
    routeDestinations.has(expectedDestination),
    `${app}: xs-app.json does not route to ${expectedDestination}`
  );
  requireCondition(
    Boolean(security.xsappname),
    `${app}: XSUAA descriptor has no xsappname`
  );
  requireCondition(
    mta.includes(`- name: ${app}\n`) || mta.includes(`- name: ${app}\r\n`),
    `${app}: HTML5 module is missing from mta.yaml`
  );
  requireCondition(
    mta.includes(`- name: ${app}-app-content`),
    `${app}: app-content module is missing from mta.yaml`
  );
  requireCondition(
    mta.includes(`- name: ${app}-destination-content`),
    `${app}: destination-content module is missing from mta.yaml`
  );
  requireCondition(
    mta.includes(`- name: ${app}-app-front-service`),
    `${app}: app-host resource is missing from mta.yaml`
  );
  requireCondition(
    mta.includes(`- name: ${app}-destination-service`),
    `${app}: destination resource is missing from mta.yaml`
  );
  requireCondition(
    mta.includes(`- name: ${app}-xsuaa-service`),
    `${app}: XSUAA resource is missing from mta.yaml`
  );

  if (appId) {
    ids.set(appId, [...(ids.get(appId) || []), app]);
  }
  if (cloudService) {
    services.set(cloudService, [...(services.get(cloudService) || []), app]);
  }
  if (security.xsappname) {
    xsappnames.set(
      security.xsappname,
      [...(xsappnames.get(security.xsappname) || []), app]
    );
  }
}

for (const [id, apps] of ids) {
  requireCondition(apps.length === 1, `duplicate sap.app/id ${id}: ${apps.join(", ")}`);
}

for (const [service, apps] of services) {
  requireCondition(
    apps.length === 1,
    `duplicate sap.cloud/service ${service}: ${apps.join(", ")}`
  );
}

for (const [xsappname, apps] of xsappnames) {
  requireCondition(
    apps.length === 1,
    `duplicate XSUAA xsappname ${xsappname}: ${apps.join(", ")}`
  );
}

const extraWorkspaceApps = [...workspacePaths]
  .map((workspacePath) => workspacePath.slice("apps/".length))
  .filter((app) => !expectedApps.includes(app));

requireCondition(
  extraWorkspaceApps.length === 0,
  `workspace contains out-of-scope apps: ${extraWorkspaceApps.join(", ")}`
);

if (errors.length > 0) {
  console.error(`Validation failed with ${errors.length} issue(s):`);
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exitCode = 1;
} else {
  console.log("Validation passed.");
  console.log("HR7 apps: 27");
  console.log("SLS apps: 27");
  console.log("Total deployed app definitions: 54");
}
