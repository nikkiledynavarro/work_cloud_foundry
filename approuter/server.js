'use strict';
/**
 * Local dev approuter bootstrap.
 *
 * The committed approuter/xs-app.json is the CF standalone configuration
 * (authenticationMethod=route + authenticationType=xsuaa), which requires a
 * UAA service binding we don't have when running on a developer machine. The
 * local dev chain is simpler: html5-apps-repo (credentials-bound) + ui5cdn +
 * virtual-hr7-destination → hr7-proxy.js. No user auth.
 *
 * To keep the CF config intact (so `cf push approuter/` keeps working) without
 * forking xs-app.json, this script writes a local override under
 * approuter/.local-approuter/{xs-app.json, default-env.json} and starts the
 * approuter against that directory. The override is gitignored.
 */
const fs = require('fs');
const path = require('path');
const approuter = require('@sap/approuter');

const localDir = path.join(__dirname, '.local-approuter');
if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });

// Local-dev xs-app.json. Auth is "none" because:
//   1) html5-apps-repo-rt routes auth via client_credentials baked into the
//      binding in default-env.json, not via user UAA.
//   2) virtual-hr7-destination is proxied through hr7-proxy.js which injects
//      Basic Auth using USER_CF from approuter/.env.
const localXsApp = {
  welcomeFile: '/index.html',
  authenticationMethod: 'none',
  routes: [
    // UI5 CDN for `/{cloud.service}/resources/...` (some Neo bundles use this prefix)
    {
      source: '^/[^/]+/resources/(.*)$',
      target: '/resources/$1',
      destination: 'ui5cdn',
      authenticationType: 'none',
    },
    // UI5 CDN direct
    {
      source: '^/resources/(.*)$',
      target: '/resources/$1',
      destination: 'ui5cdn',
      authenticationType: 'none',
    },
    // OData → virtual-hr7-destination (hr7-proxy on :5001 adds Basic Auth)
    {
      source: '^/sap/opu/odata/(.*)$',
      target: '/sap/opu/odata/$1',
      destination: 'virtual-hr7-destination',
      authenticationType: 'none',
      csrfProtection: false,
    },
    // Everything else → html5-apps-repo-rt (the deployed app content)
    {
      source: '^(.*)$',
      target: '$1',
      service: 'html5-apps-repo-rt',
      authenticationType: 'none',
    },
  ],
};
fs.writeFileSync(
  path.join(localDir, 'xs-app.json'),
  JSON.stringify(localXsApp, null, 2),
);

// Mirror default-env.json so the html5-apps-repo binding + destinations are visible.
const envSrc = path.join(__dirname, 'default-env.json');
if (fs.existsSync(envSrc)) {
  fs.copyFileSync(envSrc, path.join(localDir, 'default-env.json'));
}

const ar = approuter();

// Strip X-Frame-Options so BAS Simple Browser (iframe) can render apps.
ar.first.use(function (req, res, next) {
  const orig = res.setHeader.bind(res);
  res.setHeader = function (name, value) {
    if (name.toLowerCase() !== 'x-frame-options') orig(name, value);
  };
  next();
});

ar.start({ workingDir: localDir });
