/**
 * Local HR7 Auth Proxy
 *
 * Listens on 127.0.0.1:5001, injects Basic Auth, and forwards to the HR7
 * backend. Reads credentials from environment so they don't sit in source.
 *
 * Required env vars:
 *   HR7_USER, HR7_PASS
 * Optional env vars (with defaults):
 *   HR7_HOST=10.10.1.76, HR7_PORT=8001, HR7_PROXY_PORT=5001,
 *   HR7_PROXY_ALLOWED_ORIGIN=http://localhost:5000
 *
 * Provide them via a .env file (gitignored) or your shell. The .vscode/
 * "Start HR7 Auth Proxy" task loads .env via approuter/start-hr7-proxy.cmd
 * before invoking this file.
 */
const http = require('http');

function loadDotenv() {
  try {
    const fs = require('fs');
    const path = require('path');
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
  } catch (_) { /* ignore */ }
}
loadDotenv();

const HR7_HOST = process.env.HR7_HOST || '10.10.1.76';
const HR7_PORT = Number(process.env.HR7_PORT || 8001);
const USER = process.env.HR7_USER;
const PASS = process.env.HR7_PASS;
const PORT = Number(process.env.HR7_PROXY_PORT || 5001);
const ALLOWED_ORIGIN = process.env.HR7_PROXY_ALLOWED_ORIGIN || 'http://localhost:5000';

if (!USER || !PASS) {
  console.error('HR7 Auth Proxy: HR7_USER and HR7_PASS env vars are required.');
  console.error('Create approuter/.env (gitignored) with:');
  console.error('  HR7_USER=your_user');
  console.error('  HR7_PASS=your_password');
  process.exit(1);
}

const AUTH = 'Basic ' + Buffer.from(USER + ':' + PASS).toString('base64');

function corsHeaders(extra) {
  return {
    ...(extra || {}),
    'access-control-allow-origin': ALLOWED_ORIGIN,
    'access-control-allow-credentials': 'true',
    'access-control-allow-headers': 'Authorization, Content-Type, X-CSRF-Token',
    'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'access-control-expose-headers': 'X-CSRF-Token, sap-metadata-last-modified',
  };
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(200, corsHeaders());
    res.end();
    return;
  }

  const options = {
    hostname: HR7_HOST,
    port: HR7_PORT,
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      host: HR7_HOST + ':' + HR7_PORT,
      authorization: AUTH,
    },
  };

  const proxy = http.request(options, (hr7res) => {
    res.writeHead(hr7res.statusCode, corsHeaders(hr7res.headers));
    hr7res.pipe(res);
  });

  proxy.on('error', (err) => {
    console.error('Proxy error:', err.message);
    res.writeHead(502, corsHeaders({ 'content-type': 'text/plain' }));
    res.end('HR7 proxy error: ' + err.message);
  });

  req.pipe(proxy);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`HR7 Auth Proxy running on 127.0.0.1:${PORT}`);
  console.log(`Forwarding to http://${HR7_HOST}:${HR7_PORT} as ${USER}`);
  console.log(`CORS allowed origin: ${ALLOWED_ORIGIN}`);
});
