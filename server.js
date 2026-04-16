/**
 * Local Dev Server (pengganti `vercel dev`)
 * Jalankan: node server.js
 * Buka: http://localhost:3000
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3000;

// Load .env.local manually
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
            const eqIdx = trimmed.indexOf('=');
            if (eqIdx > 0) {
                const key = trimmed.slice(0, eqIdx).trim();
                let val = trimmed.slice(eqIdx + 1).trim();
                if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) {
                    val = val.slice(1, -1);
                }
                process.env[key] = process.env[key] || val;
            }
        }
    });
    console.log('✅ .env.local loaded');
}

const MIME = {
    '.html': 'text/html',
    '.js':   'application/javascript',
    '.css':  'text/css',
    '.json': 'application/json',
    '.png':  'image/png',
    '.svg':  'image/svg+xml',
    '.ico':  'image/x-icon',
};

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const pathname = url.pathname;

    // ---- API Routes (/api/*) ----
    if (pathname.startsWith('/api/')) {
        const apiFile = path.join(__dirname, pathname + '.js');
        if (!fs.existsSync(apiFile)) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: `API not found: ${pathname}` }));
        }

        try {
            // Build a minimal req/res shim matching Vercel's API signature
            const bodyChunks = [];
            req.on('data', chunk => bodyChunks.push(chunk));
            await new Promise(r => req.on('end', r));
            const rawBody = Buffer.concat(bodyChunks).toString();
            let body = {};
            try { body = rawBody ? JSON.parse(rawBody) : {}; } catch {}

            const shimReq = {
                method: req.method,
                headers: req.headers,
                query: Object.fromEntries(url.searchParams.entries()),
                body,
            };

            let statusCode = 200;
            let headers = { 'Content-Type': 'application/json' };
            let responseBody = null;

            const shimRes = {
                status(code) { statusCode = code; return this; },
                setHeader(k, v) { headers[k] = v; return this; },
                // SSE / streaming: write directly to response
                write(chunk) {
                    if (!res.headersSent) res.writeHead(statusCode, headers);
                    res.write(chunk);
                    return this;
                },
                json(data) {
                    if (!res.headersSent) {
                        res.writeHead(statusCode, headers);
                        res.end(JSON.stringify(data));
                    }
                    return this;
                },
                end(data) {
                    if (!res.writableEnded) {
                        if (!res.headersSent) res.writeHead(statusCode, headers);
                        res.end(data || '');
                    }
                },
                // expose raw response so SSE can write directly
                _raw: res
            };

            const fileUrl = pathToFileURL(apiFile).href + `?t=${Date.now()}`;
            const mod = await import(fileUrl);
            await mod.default(shimReq, shimRes);
        } catch (err) {
            console.error(`[API ERROR] ${pathname}:`, err);
            if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        }
        return;
    }

    // ---- Static Files ----
    let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);
    if (!fs.existsSync(filePath)) {
        // Fallback to index.html for SPA-style routes
        filePath = path.join(__dirname, 'index.html');
    }

    const ext = path.extname(filePath);
    const contentType = MIME[ext] || 'text/plain';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => {
    console.log(`\n🚀 Dev server running at http://localhost:${PORT}`);
    console.log('   API routes:');
    console.log(`   → http://localhost:${PORT}/api/generate`);
    console.log(`   → http://localhost:${PORT}/api/get-piezometer`);
    console.log(`   → http://localhost:${PORT}/api/sync-piezometer`);
    console.log('\n   Press Ctrl+C to stop\n');
});
