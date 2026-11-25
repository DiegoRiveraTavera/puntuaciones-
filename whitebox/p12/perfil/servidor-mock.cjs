// Servidor HTTP local con el mismo Supabase simulado (solo para probar estres.mjs sin tocar la base real)
const http = require('http'); const crearMock = require('./mock.cjs');
const mock = crearMock(20);
mock.db.escuadras.push({ id: 4, nombre: 'MNS', activa: true });
mock.db.calificaciones_tecnica = [];
http.createServer((req, res) => {
  const trozos = []; req.on('data', c => trozos.push(c)); req.on('end', async () => {
    const cuerpo = Buffer.concat(trozos).toString();
    if (req.url.startsWith('/auth/v1/token')) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ access_token: 'eyJa.eyJb.c' })); }
    if (!process.env.CON_RPC && req.url.includes('/rpc/')) { res.writeHead(404); return res.end('{"message":"no existe"}'); }
    // versión con control de versión para calificaciones (PATCH ...&version=eq.N)
    const ruta = { request: () => ({ url: () => 'http://x' + req.url, method: () => req.method, headers: () => req.headers, postData: () => cuerpo || null }),
      fulfill: ({ status, json }) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(json === undefined ? '' : JSON.stringify(json)); },
      abort: () => res.destroy() };
    if (req.method === 'POST' && req.url.startsWith('/rest/v1/calificaciones_tecnica')) { const f = { ...JSON.parse(cuerpo), id: 999, version: 1 }; mock.db.calificaciones_tecnica = [f]; return ruta.fulfill({ status: 201, json: [f] }); }
    if (req.method === 'PATCH' && req.url.startsWith('/rest/v1/calificaciones_tecnica')) {
      const u = new URL('http://x' + req.url); const c = mock.db.calificaciones_tecnica[0]; const v = u.searchParams.get('version');
      if (v && 'eq.' + c.version !== v) return ruta.fulfill({ status: 200, json: [] });
      Object.assign(c, JSON.parse(cuerpo)); c.version++; return ruta.fulfill({ status: 200, json: [c] });
    }
    if (req.method === 'POST' && /\/(juegos|enfrentamientos)\?/.test(req.url)) {
      // devolver objeto único cuando se pide vnd.pgrst.object
      const orig = ruta.fulfill; ruta.fulfill = ({ status, json }) => orig({ status: status === 200 ? 201 : status, json });
    }
    await mock.rest(ruta);
  });
}).listen(process.env.PUERTO || 5070, () => console.log('mock listo'));
