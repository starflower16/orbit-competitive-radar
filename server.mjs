import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.cwd();
const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || '0.0.0.0';
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8'
};

const reviewHandler = (await import('./api/reviews.mjs')).default;
const aiHandler = (await import('./api/ai.mjs')).default;

function enhanceResponse(response) {
  response.status = code => { response.statusCode = code; return response; };
  response.json = value => {
    if (!response.getHeader('Content-Type')) response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.end(JSON.stringify(value));
    return response;
  };
  return response;
}

async function readBody(request, limit = 2 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new Error('Request body too large');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch (_) { return {}; }
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, 'http://' + (request.headers.host || 'localhost'));
  const pathname = decodeURIComponent(url.pathname);
  try {
    if (pathname === '/api/reviews') {
      request.body = await readBody(request);
      await reviewHandler(request, enhanceResponse(response));
      return;
    }
    if (pathname === '/api/ai') {
      request.body = await readBody(request);
      await aiHandler(request, enhanceResponse(response));
      return;
    }
    if (pathname.startsWith('/api/')) {
      response.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ error: 'API route not found' }));
      return;
    }

    let relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    let filePath = path.resolve(ROOT, relative);
    if (!filePath.startsWith(ROOT + path.sep) && filePath !== path.join(ROOT, 'index.html')) {
      response.writeHead(403); response.end('Forbidden'); return;
    }
    let stat;
    try { stat = await fs.stat(filePath); } catch (_) { stat = null; }
    if (stat?.isDirectory()) { filePath = path.join(filePath, 'index.html'); try { stat = await fs.stat(filePath); } catch (_) { stat = null; } }
    if (!stat?.isFile()) {
      response.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end('<h1>404</h1><p>Orbit could not find this page.</p>');
      return;
    }
    const content = await fs.readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      'Content-Type': MIME[extension] || 'application/octet-stream',
      'Cache-Control': extension === '.html' ? 'no-cache' : 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff'
    });
    response.end(content);
  } catch (error) {
    if (!response.headersSent) response.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    if (!response.writableEnded) response.end(JSON.stringify({ error: 'Server error', detail: error.message }));
  }
});

server.listen(PORT, HOST, () => {
  const displayHost = HOST === '0.0.0.0' ? 'localhost' : HOST;
  console.log('\n  Orbit Market Intelligence');
  console.log('  Local:   http://' + displayHost + ':' + PORT + '\n');
  console.log('  Review proxy: /api/reviews');
  console.log('  AI proxy:      /api/ai (visitor BYOK)\n');
});

const shutdown = () => server.close(() => process.exit(0));
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
