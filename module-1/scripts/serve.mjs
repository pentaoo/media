import { createServer } from 'node:http';
import { stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseByteRange } from './http-range.mjs';

const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const port = Number(process.env.PORT || 4173);
const contentTypes = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.otf': 'font/otf', '.woff2': 'font/woff2' };

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
    const info = await stat(file);
    if (!info.isFile()) throw new Error('Not a file');
    const range = parseByteRange(request.headers.range, info.size);
    if (range === false) {
      response.writeHead(416, { 'Content-Range': `bytes */${info.size}` }).end();
      return;
    }
    const headers = { 'Content-Type': contentTypes[extname(file)] || 'application/octet-stream', 'Accept-Ranges': 'bytes', 'Content-Length': range ? range.end - range.start + 1 : info.size };
    if (range) headers['Content-Range'] = `bytes ${range.start}-${range.end}/${info.size}`;
    response.writeHead(range ? 206 : 200, headers);
    if (request.method === 'HEAD') { response.end(); return; }
    const stream = createReadStream(file, range || undefined);
    stream.on('error', () => response.destroy());
    response.on('close', () => stream.destroy());
    stream.pipe(response);
  } catch {
    response.writeHead(404).end('Not found');
  }
}).listen(port, () => console.log(`Test site: http://localhost:${port}`));
