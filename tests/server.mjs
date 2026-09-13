/*
 * Static file server for the Flashcards browser tests and local preview.
 *
 * Test mode (default when imported):
 *   - /catalog.json is served from tests/fixtures/catalog.json
 *   - /assets/ruffle/ruffle.js is served from tests/fixtures/mock-ruffle.js
 *   - /thumbs/* is served from tests/fixtures/thumbs/
 *
 * Preview mode (`node tests/server.mjs`):
 *   - the real catalog.json and assets/ruffle/ruffle.js are used when present,
 *     otherwise the test fixtures are used so the desktop still opens.
 */
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(here, '..');
export const FIXTURES = path.join(here, 'fixtures');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.wasm': 'application/wasm',
  '.swf': 'application/x-shockwave-flash',
  '.txt': 'text/plain; charset=utf-8',
};

async function readIfExists(file) {
  try {
    const info = await stat(file);
    if (!info.isFile()) return null;
    return await readFile(file);
  } catch {
    return null;
  }
}

export async function startServer(options = {}) {
  const preview = Boolean(options.preview);
  const explicitCatalog = options.catalog || null;

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://127.0.0.1');
      let pathname = decodeURIComponent(url.pathname);
      if (pathname === '/') pathname = '/index.html';

      let body = null;
      let fileName = null;

      if (pathname === '/catalog.json') {
        if (explicitCatalog) {
          body = Buffer.from(JSON.stringify(explicitCatalog, null, 2));
        } else if (preview) {
          body = await readIfExists(path.join(PROJECT_ROOT, 'catalog.json'));
        }
        if (body === null) body = await readIfExists(path.join(FIXTURES, 'catalog.json'));
        fileName = 'catalog.json';
      } else if (pathname === '/assets/ruffle/ruffle.js') {
        if (preview) body = await readIfExists(path.join(PROJECT_ROOT, 'assets/ruffle/ruffle.js'));
        if (body === null) {
          body = await readIfExists(path.join(FIXTURES, 'mock-ruffle.js'));
          fileName = 'mock-ruffle.js';
        } else {
          fileName = 'ruffle.js';
        }
      } else if (pathname.startsWith('/assets/ruffle/')) {
        const relative = pathname.slice('/assets/'.length);
        body = preview ? await readIfExists(path.join(PROJECT_ROOT, 'assets', relative)) : null;
        fileName = path.basename(pathname);
      } else if (pathname.startsWith('/thumbs/')) {
        const relative = pathname.slice('/'.length);
        body = await readIfExists(path.join(FIXTURES, relative));
        fileName = path.basename(pathname);
      } else {
        const relative = pathname.replace(/^\/+/, '');
        const candidate = path.resolve(PROJECT_ROOT, relative);
        if (!candidate.startsWith(PROJECT_ROOT + path.sep)) {
          res.writeHead(403).end('Forbidden');
          return;
        }
        body = await readIfExists(candidate);
        fileName = path.basename(candidate);
      }

      if (body === null) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found: ' + pathname);
        return;
      }

      const type = MIME[path.extname(fileName || pathname).toLowerCase()] || 'application/octet-stream';
      res.writeHead(200, {
        'Content-Type': type,
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
      }).end(body);
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Server error: ' + error.message);
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port ?? 0, '127.0.0.1', resolve);
  });

  const address = server.address();
  const baseURL = `http://127.0.0.1:${address.port}`;
  return {
    server,
    baseURL,
    async close() {
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const port = Number(process.env.PORT || 4173);
  const instance = await startServer({ preview: true, port });
  console.log(`Flashcards preview server: ${instance.baseURL}/`);
  console.log('Serving the real catalog.json and assets/ruffle/ruffle.js when present, test fixtures otherwise.');
}
