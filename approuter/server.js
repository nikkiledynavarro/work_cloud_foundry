'use strict';
/**
 * Local dev approuter bootstrap (HR7 + SLS + HD6).
 *
 * The committed approuter/xs-app.json is the CF standalone configuration
 * (authenticationMethod=route + authenticationType=xsuaa), which requires a
 * UAA service binding we don't have when running on a developer machine. The
 * local dev chain is simpler: html5-apps-repo (credentials-bound) + ui5cdn +
 * one virtual-* destination per backend. No user auth.
 *
 * Backend routing is path-prefixed so a single approuter can serve apps
 * pointed at any of the three backend systems:
 *   /hr7/sap/opu/odata/...  → virtual-hr7-destination       (HR7 backend)
 *   /sls/sap/opu/odata/...  → virtual-erps4sales-destination (SLS backend)
 *   /hd6/sap/opu/odata/...  → virtual-hd6-destination        (HD6 backend)
 *   /sap/opu/odata/...      → BACKEND env var (default: virtual-hr7-destination)
 *
 * Set BACKEND=hr7|sls|hd6 in approuter/.env to switch the default for apps
 * that don't include the prefix in their data-source URI.
 *
 * To keep the CF xs-app.json intact (so `cf push approuter/` keeps working)
 * without forking it, this script writes a local override under
 * approuter/.local-approuter/{xs-app.json, default-env.json} and starts the
 * approuter against that directory. The override dir is gitignored.
 */
const fs = require('fs');
const path = require('path');
const approuter = require('@sap/approuter');

// Load .env (used by hr7-proxy.js too)
(function loadDotenv() {
  try {
    const envPath = path.join(__dirname, '.env');
    if (!fs.existsSync(envPath)) return;
    for (const raw of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq < 0) continue;
      const k = line.slice(0, eq).trim();
      let v = line.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (!(k in process.env)) process.env[k] = v;
    }
  } catch (_) {}
})();

const BACKEND_TO_DEST = {
  hr7: 'virtual-hr7-destination',
  sls: 'virtual-erps4sales-destination',
  hd6: 'virtual-hd6-destination',
};
const defaultBackend = (process.env.BACKEND || 'hr7').toLowerCase();
const defaultDestination = BACKEND_TO_DEST[defaultBackend] || BACKEND_TO_DEST.hr7;

const localDir = path.join(__dirname, '.local-approuter');
if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });

function odataRoute(prefix, destination) {
  return {
    source: `^/${prefix}/sap/opu/odata/(.*)$`,
    target: '/sap/opu/odata/$1',
    destination,
    authenticationType: 'none',
    csrfProtection: false,
  };
}

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
    // Explicit per-backend OData prefixes
    odataRoute('hr7', BACKEND_TO_DEST.hr7),
    odataRoute('sls', BACKEND_TO_DEST.sls),
    odataRoute('hd6', BACKEND_TO_DEST.hd6),
    // Fallback OData (no prefix) → BACKEND env var or HR7
    {
      source: '^/sap/opu/odata/(.*)$',
      target: '/sap/opu/odata/$1',
      destination: defaultDestination,
      authenticationType: 'none',
      csrfProtection: false,
    },
    // Everything else → html5-apps-repo-rt (deployed app content)
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
  // Wire each backend destination at its own proxy URL. Only HR7 has a
  // built-in default (the bundled hr7-proxy.js on :5001). SLS and HD6 require
  // explicit {SLS,HD6}_PROXY_URL in approuter/.env so a developer doesn't
  // silently end up hitting HR7 when clicking through an SLS or HD6 app.
  let env = JSON.parse(fs.readFileSync(envSrc, 'utf8'));
  env.destinations = env.destinations || [];
  const have = new Set(env.destinations.map((d) => d.name));
  const PROXY_DEFAULTS = { hr7: 'http://localhost:5001' };
  // Stub URL points at a free localhost port that nothing listens on, so a
  // misrouted request fails fast with ECONNREFUSED instead of silently hitting
  // the wrong backend. The destination still has to be present (even with a
  // dead URL) because approuter validates xs-app.json route targets at boot.
  const STUB_URL = 'http://127.0.0.1:65535';
  for (const [backend, name] of Object.entries(BACKEND_TO_DEST)) {
    if (have.has(name)) continue;
    const envKey = `${backend.toUpperCase()}_PROXY_URL`;
    const configured = process.env[envKey] || PROXY_DEFAULTS[backend];
    const url = configured || STUB_URL;
    if (!configured) {
      console.warn(
        `[local-approuter] ${envKey} not set and no default — destination "${name}" wired to ${STUB_URL} as a no-op. ` +
          `/${backend}/* routes will fail with ECONNREFUSED. Set ${envKey}=http://localhost:<port> in approuter/.env (and start a matching proxy) to make them work.`,
      );
    }
    env.destinations.push({
      name,
      url,
      forwardAuthToken: false,
      strictSSL: false,
    });
  }
  fs.writeFileSync(
    path.join(localDir, 'default-env.json'),
    JSON.stringify(env, null, 2),
  );
} else {
  // No default-env.json — minimal stub
  fs.writeFileSync(
    path.join(localDir, 'default-env.json'),
    JSON.stringify({ PORT: 5000, destinations: [] }, null, 2),
  );
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

console.log(
  `Local approuter starting — default OData backend: ${defaultBackend.toUpperCase()} (${defaultDestination})`,
);
console.log('Use /hr7/, /sls/, /hd6/ prefixes for explicit per-backend OData calls');

ar.start({ workingDir: localDir });
