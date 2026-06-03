/**
 * Local HR7 Auth Proxy
 * Listens on port 5001, adds Basic Auth and forwards to HR7 at 10.10.1.76:8001
 * Run: node hr7-proxy.js
 */
const http = require('http');

const HR7_HOST = '10.10.1.76';
const HR7_PORT = 8001;
const USER = 'NNAVARRO_AI';
const PASS = 'Greenrose123!';
const AUTH = 'Basic ' + Buffer.from(USER + ':' + PASS).toString('base64');
const PORT = 5001;

const server = http.createServer((req, res) => {
    const options = {
        hostname: HR7_HOST,
        port: HR7_PORT,
        path: req.url,
        method: req.method,
        headers: {
            ...req.headers,
            host: HR7_HOST + ':' + HR7_PORT,
            authorization: AUTH
        }
    };

    const proxy = http.request(options, (hr7res) => {
        // Add CORS headers so browser can access the response
        res.writeHead(hr7res.statusCode, {
            ...hr7res.headers,
            'access-control-allow-origin': '*',
            'access-control-allow-headers': 'Authorization, Content-Type, X-CSRF-Token',
            'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'access-control-expose-headers': 'X-CSRF-Token, sap-metadata-last-modified'
        });
        hr7res.pipe(res);
    });

    proxy.on('error', (err) => {
        console.error('Proxy error:', err.message);
        res.writeHead(502);
        res.end('HR7 proxy error: ' + err.message);
    });

    // Handle OPTIONS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(200, {
            'access-control-allow-origin': '*',
            'access-control-allow-headers': 'Authorization, Content-Type, X-CSRF-Token',
            'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS'
        });
        res.end();
        return;
    }

    req.pipe(proxy);
});

server.listen(PORT, () => {
    console.log(`HR7 Auth Proxy running on port ${PORT}`);
    console.log(`Forwarding to http://${HR7_HOST}:${HR7_PORT} as ${USER}`);
});
