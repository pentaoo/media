import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const port = Number(process.env.PORT || 4173);
const contentTypes = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.otf': 'font/otf', '.woff2': 'font/woff2' };

createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    response.writeHead(400).end();
    return;
  }
  const file = resolve(root, `.${decoded === '/' ? '/index.html' : decoded}`);
  if (file !== root && !file.startsWith(root + sep)) {
    response.writeHead(403).end();
    return;
  }
  try {
    if (!(await stat(file)).isFile()) throw new Error('Not a file');
    response.writeHead(200, { 'Content-Type': contentTypes[extname(file)] || 'application/octet-stream' });
    response.end(await readFile(file));
  } catch {
    response.writeHead(404).end('Not found');
  }
}).listen(port, () => console.log(`Test site: http://localhost:${port}`));
