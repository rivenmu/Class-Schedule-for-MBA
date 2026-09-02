import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';

const ROOT = decodeURIComponent(new URL('../../', import.meta.url).pathname).replace(/\/$/,'');
const MIME = {'.html':'text/html; charset=utf-8','.htm':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.pdf':'application/pdf','.png':'image/png'};

export function startServer(port = 0) {
  let resolvedPort = port;
  const server = http.createServer(async (req, res) => {
    try {
      let p = decodeURIComponent((req.url || '/').split('?')[0]);
      if (p === '/') p = '/index.html';
      const file = join(ROOT, p);
      const st = await stat(file);
      if (!st.isFile()) throw new Error('not a file');
      const data = await readFile(file);
      res.writeHead(200, { 'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': data.length });
      res.end(data);
    } catch (e) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
    }
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => {
    resolvedPort = server.address().port;
    const srv = Object.assign(server, { _port: resolvedPort });
    resolve(srv);
  }));
}

export function APP_URL(server) {
  const port = server && server._port ? server._port : 8765;
  return `http://127.0.0.1:${port}/\u56fd\u79d1\u592726\u7ea7MBA_\u8bfe\u8868v4.html`;
}
