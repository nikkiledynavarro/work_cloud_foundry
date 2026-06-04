#!/bin/bash
# setup.sh — Run once after cloning to create default-env.json from CF service keys
# Works in BAS, VS Code terminal, or any shell with cf CLI logged in

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="$SCRIPT_DIR/default-env.json"

echo "=== ShipERP Local Approuter Setup ==="
echo "Generating $OUT from CF service keys..."

# Check cf is logged in
if ! cf target &>/dev/null 2>&1; then
    echo ""
    echo "You are not logged into CF. Please run:"
    echo "  cf login -a https://api.cf.us11.hana.ondemand.com --sso"
    exit 1
fi

# Get html5-apps-repo runtime credentials
echo "Getting html5-apps-repo credentials..."
HTML5_KEY=$(cf service-key app-runtime-1779763944 html5-runtime-test-key 2>&1 | tail -n +3)
HTML5_CLIENTID=$(echo "$HTML5_KEY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['credentials']['uaa']['clientid'])")
HTML5_SECRET=$(echo "$HTML5_KEY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['credentials']['uaa']['clientsecret'])")
HTML5_UAA_URL=$(echo "$HTML5_KEY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['credentials']['uaa']['url'])")
HTML5_URI=$(echo "$HTML5_KEY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['credentials']['uri'])")

# Write default-env.json
cat > "$OUT" << ENVEOF
{
  "PORT": 5000,
  "destinations": [
    {
      "name": "ui5cdn",
      "url": "https://ui5.sap.com",
      "forwardAuthToken": false
    },
    {
      "name": "virtual-hr7-destination",
      "url": "http://localhost:5001",
      "forwardAuthToken": false,
      "strictSSL": false
    }
  ],
  "VCAP_SERVICES": {
    "html5-apps-repo": [
      {
        "name": "html5-apps-repo-rt",
        "label": "html5-apps-repo",
        "tags": ["html5appsrepo"],
        "credentials": {
          "grant_type": "client_credentials",
          "sap.cloud.service": "html5-apps-repo-rt",
          "uri": "$HTML5_URI",
          "uaa": {
            "clientid": "$HTML5_CLIENTID",
            "clientsecret": "$HTML5_SECRET",
            "url": "$HTML5_UAA_URL",
            "uaadomain": "authentication.us11.hana.ondemand.com",
            "identityzone": "btp-cf-8qsdli3e"
          }
        }
      }
    ]
  }
}
ENVEOF

echo "✅ default-env.json created successfully"
echo ""
# Write server.js — strips X-Frame-Options so BAS Simple Browser (iframe) can render apps
SERVER_JS="$SCRIPT_DIR/server.js"
cat > "$SERVER_JS" << 'JSEOF'
'use strict';
var approuter = require('@sap/approuter');
var ar = approuter();
// Strip X-Frame-Options so BAS Simple Browser (iframe) can render apps
ar.first.use(function(req, res, next) {
  var orig = res.setHeader.bind(res);
  res.setHeader = function(name, value) {
    if (name.toLowerCase() !== 'x-frame-options') orig(name, value);
  };
  next();
});
ar.start({ workingDir: './' });
JSEOF

echo "default-env.json created"
echo "server.js created (strips X-Frame-Options for BAS/iframe preview)"
echo ""
echo "=== Next steps ==="
echo "1. Start approuter:  node server.js"
echo "2. In BAS: Simple Browser -> http://localhost:5000/{appId}/index.html"
echo "3. On PC:  open http://localhost:5000/{appId}/index.html"
echo ""
echo "Note: HR7 live data requires VPN (not available in BAS)"
