import http from 'node:http';
import { readFile } from 'node:fs/promises';

const pages = new Set(['overview-light', 'overview-dark', 'tasks-light', 'planning-light', 'finance-light', 'life-light', 'habits-light', 'inspiration-light', 'review-light']);
const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  const page = url.pathname === '/' ? 'overview-light' : url.pathname.slice(1).replace(/\.html$/, '');
  if (!pages.has(page)) { response.writeHead(404); response.end(); return; }
  try {
    const html = await readFile('.showcase/' + page + '.html');
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src 'none'", 'Cache-Control': 'no-store' });
    response.end(html);
  } catch { response.writeHead(404); response.end(); }
});
server.listen(4331, '127.0.0.1', () => console.log('Synthetic previews: http://127.0.0.1:4331/overview-light.html'));
