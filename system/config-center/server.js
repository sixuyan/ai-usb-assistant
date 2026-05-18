#!/usr/bin/env node
// =========================================================================
// config-server.js - AI USB Assistant Config Center
// =========================================================================
// Mini HTTP server that serves Config.html and provides /api/config CRUD.
//
// Key difference from U-Claw: config path is user/config/ (user layer),
// NOT data/.openclaw/ (runtime layer). This ensures config survives
// system resets and updates.
// =========================================================================

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.argv[2] === '--port' ? process.argv[3] : process.env.CONFIG_PORT || 18788, 10);

// Resolve paths: server is at system/config-center/server.js
// Config file: user/config/openclaw.json (USER layer - survives updates)
const SERVER_DIR = __dirname;
const USB_ROOT = path.resolve(SERVER_DIR, '..', '..');
const CONFIG_DIR = path.join(USB_ROOT, 'user', 'config');
const CONFIG_PATH = path.join(CONFIG_DIR, 'openclaw.json');
const STATIC_DIR = SERVER_DIR;  // Serve from config-center/ directly

// MIME types for static files
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

// Ensure config directory exists
if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

const server = http.createServer((req, res) => {
    // CORS: only allow localhost origins (stricter than U-Claw's "*")
    const origin = req.headers.origin || '';
    if (origin && (origin.startsWith('http://127.0.0.1') || origin.startsWith('http://localhost'))) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // ---- API: Get config ----
    if (req.url === '/api/config' && req.method === 'GET') {
        try {
            const config = fs.existsSync(CONFIG_PATH)
                ? JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'))
                : { gateway: { mode: 'local', auth: { token: 'uclaw' } } };
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify(config));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    // ---- API: Save config ----
    if (req.url === '/api/config' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const config = JSON.parse(body);
                // Add metadata
                config.meta = config.meta || {};
                config.meta.lastTouchedAt = new Date().toISOString();

                // Read version for tracking
                const versionFile = path.join(USB_ROOT, 'system', 'VERSION');
                if (fs.existsSync(versionFile)) {
                    config.meta.lastTouchedVersion = fs.readFileSync(versionFile, 'utf8').trim();
                }

                // Write to USER layer (survives system updates)
                if (!fs.existsSync(CONFIG_DIR)) {
                    fs.mkdirSync(CONFIG_DIR, { recursive: true });
                }
                fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');

                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ ok: true }));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
        return;
    }

    // ---- API: System info ----
    if (req.url === '/api/system-info' && req.method === 'GET') {
        try {
            const versionFile = path.join(USB_ROOT, 'system', 'VERSION');
            const version = fs.existsSync(versionFile) ? fs.readFileSync(versionFile, 'utf8').trim() : 'unknown';
            const info = {
                version: version,
                configPath: CONFIG_PATH,
                hasConfig: fs.existsSync(CONFIG_PATH),
                usbRoot: USB_ROOT
            };
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify(info));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    // ---- API: Version info ----
    if (req.url === '/api/version' && req.method === 'GET') {
        try {
            const versionFile = path.join(USB_ROOT, 'system', 'VERSION');
            const manifestFile = path.join(USB_ROOT, 'system', 'manifest.json');
            const version = fs.existsSync(versionFile) ? fs.readFileSync(versionFile, 'utf8').trim() : 'unknown';
            let manifest = null;
            if (fs.existsSync(manifestFile)) {
                try { manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8')); } catch(e) {}
            }
            const info = {
                version: version,
                channel: manifest ? manifest.channel : 'unknown',
                product: manifest ? manifest.product : 'ai-usb-assistant',
                lastUpdate: manifest ? manifest.publishedAt : null,
                releaseNotes: manifest ? manifest.releaseNotes : null
            };
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify(info));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    // ---- Serve static files ----
    let filePath = req.url === '/' ? path.join(STATIC_DIR, 'Config.html') : path.join(STATIC_DIR, req.url);

    // Security: prevent directory traversal
    if (!filePath.startsWith(STATIC_DIR)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath);
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        fs.createReadStream(filePath).pipe(res);
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

server.listen(PORT, '127.0.0.1', () => {
    console.log(`\n  AI USB Assistant - Config Center`);
    console.log(`  http://127.0.0.1:${PORT}`);
    console.log(`  Config: ${CONFIG_PATH}`);
    console.log(`  Data survives system updates (user layer)\n`);
});
