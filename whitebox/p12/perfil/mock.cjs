// Supabase simulado en memoria (PostgREST mínimo) con latencia configurable, para el profiling de la P12
module.exports = function crearMock(latencia = 100) {
const estado = { sinRed: false, colgar: false, perderRespuesta: null, forzar: null, latencia, retrasoExtra: 0, peticiones: 0 };
const hoy = (() => { const d = new Date(); const z = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`; })();
const db = {
  sesiones: [{ id: 1, fecha: hoy }],
  escuadras: [{ id: 1, nombre: 'RRMS', activa: true }, { id: 2, nombre: 'ANK', activa: true }, { id: 3, nombre: 'ATL', activa: true }],
  sesion_escuadras: [1, 2, 3].map(e => ({ sesion_id: 1, escuadra_id: e })),
  juegos: [], enfrentamientos: [], enfrentamiento_escuadras: [],
  formacion: [], formacion_miembros: [], calificaciones_tecnica: [], fotografias: [],
  perfiles: [{ id: 'u1', rol: 'jefatura', activo: true }],
};
let sig = 100; const log = [];
const filtros = (u) => [...u.searchParams].filter(([k]) => !['select', 'order', 'limit', 'on_conflict', 'columns'].includes(k));
function cumple(row, fs) {
  return fs.every(([k, v]) => {
    if (v.startsWith('eq.')) return String(row[k]) === v.slice(3);
    if (v.startsWith('not.in.(')) return !v.slice(8, -1).split(',').includes(String(row[k]));
    return true;
  });
}
function ranking() {
  return db.sesion_escuadras.map(se => {
    const s = db.sesiones.find(x => x.id === se.sesion_id), e = db.escuadras.find(x => x.id === se.escuadra_id);
    const pj = db.juegos.filter(j => j.sesion_id === s.id).reduce((t, j) =>
      t + db.enfrentamientos.filter(en => en.juego_id === j.id && en.ganador_id === e.id).length * j.valor, 0);
    const t = db.calificaciones_tecnica.find(c => c.sesion_id === s.id && c.escuadra_id === e.id);
    const f = db.formacion.find(c => c.sesion_id === s.id && c.escuadra_id === e.id);
    const pt = t ? t.total : 0, pf = f ? f.puntos : 0;
    return { sesion_id: s.id, fecha: s.fecha, escuadra_id: e.id, escuadra: e.nombre, puntos_juegos: pj, puntos_tecnica: pt, puntos_formacion: pf, total: pj + pt + pf };
  });
}
function expandir(tabla, rows) {
  if (tabla === 'sesion_escuadras') return rows.map(r => ({ escuadra: db.escuadras.find(e => e.id === r.escuadra_id) }));
  if (tabla === 'juegos') return rows.map(j => ({ ...j, enfrentamientos: db.enfrentamientos.filter(e => e.juego_id === j.id)
    .map(e => ({ ...e, enfrentamiento_escuadras: db.enfrentamiento_escuadras.filter(p => p.enfrentamiento_id === e.id) })) }));
  if (tabla === 'formacion') return rows.map(f => ({ ...f, escuadra: { nombre: db.escuadras.find(e => e.id === f.escuadra_id).nombre },
    formacion_miembros: db.formacion_miembros.filter(m => m.formacion_id === f.id) }));
  return rows;
}
async function rest(route) {
  const req = route.request();
  estado.peticiones++;
  if (estado.sinRed) { log.push('X ' + req.method() + ' (sin red)'); return route.abort('internetdisconnected'); }
  if (estado.colgar) { log.push('... ' + req.method() + ' (sin respuesta)'); return; }   // el servidor nunca contesta
  await new Promise(r => setTimeout(r, estado.latencia + (estado.retrasoExtra || 0))); const u = new URL(req.url()); const tabla = u.pathname.split('/').pop();
  const m = req.method(); const fs = filtros(u); const h = req.headers();
  const uno = (h['accept'] || '').includes('vnd.pgrst.object');
  const body = req.postData() ? JSON.parse(req.postData()) : null;
  log.push(`${m} ${tabla} ${u.search}${body ? ' ' + JSON.stringify(body).slice(0, 160) : ''}`);
  if (estado.forzar && (!estado.forzar.tabla || estado.forzar.tabla === tabla)) {
    const f = estado.forzar; if (f.una) estado.forzar = null;
    return route.fulfill({ status: f.status, json: f.json });
  }
  let out;
  if (tabla === 'guardar_juego' && m === 'POST') {
    const { p_fecha, p_juego: pj } = body;
    let s = db.sesiones.find(x => x.fecha === p_fecha); if (!s) { s = { id: ++sig, fecha: p_fecha }; db.sesiones.push(s); }
    let j = pj.id ? db.juegos.find(x => x.id === pj.id) : null;
    if (!j && pj.idCliente) j = db.juegos.find(x => x.id_cliente === pj.idCliente);
    if (j) Object.assign(j, { nombre: pj.nombre, valor: pj.valor, id_cliente: j.id_cliente ?? pj.idCliente });
    else { j = { id: ++sig, sesion_id: s.id, nombre: pj.nombre, valor: pj.valor, id_cliente: pj.idCliente }; db.juegos.push(j); }
    const viejos = db.enfrentamientos.filter(e => e.juego_id === j.id).map(e => e.id);
    db.enfrentamientos = db.enfrentamientos.filter(e => e.juego_id !== j.id);
    db.enfrentamiento_escuadras = db.enfrentamiento_escuadras.filter(p => !viejos.includes(p.enfrentamiento_id));
    for (const r of pj.roles) for (const e of r.enfrentamientos) {
      const en = { id: ++sig, juego_id: j.id, rol: r.numero, ganador_id: null }; db.enfrentamientos.push(en);
      for (const n of [...new Set(e.escuadras.map(x => x.trim()).filter(Boolean))]) {
        let esc = db.escuadras.find(x => x.nombre.toUpperCase() === n.toUpperCase());
        if (!esc) { esc = { id: ++sig, nombre: n, activa: true }; db.escuadras.push(esc); }
        if (!db.sesion_escuadras.some(x => x.sesion_id === s.id && x.escuadra_id === esc.id)) db.sesion_escuadras.push({ sesion_id: s.id, escuadra_id: esc.id });
        db.enfrentamiento_escuadras.push({ enfrentamiento_id: en.id, escuadra_id: esc.id });
        if (n.toUpperCase() === (e.ganador || '').trim().toUpperCase()) en.ganador_id = esc.id;
      }
    }
    if (estado.perderRespuesta === 'guardar_juego') { estado.perderRespuesta = null; log.push('!! respuesta perdida'); return route.abort('connectionreset'); }
    return route.fulfill({ status: 200, json: j.id });
  }
  if (tabla === 'ranking_general') {
    out = ranking().filter(r => cumple(r, fs));
    if (u.searchParams.get('order')?.startsWith('fecha.desc')) out.sort((a, b) => b.fecha.localeCompare(a.fecha));
    if (u.searchParams.get('limit')) out = out.slice(0, +u.searchParams.get('limit'));
  } else if (m === 'GET') {
    out = expandir(tabla, db[tabla].filter(r => cumple(r, fs)));
  } else if (m === 'POST') {
    const conflicto = u.searchParams.get('on_conflict')?.split(',');
    const ignorar = (h['prefer'] || '').includes('ignore-duplicates');
    out = [];
    for (const fila of [].concat(body)) {
      const claves = conflicto || (tabla === 'sesion_escuadras' ? ['sesion_id', 'escuadra_id'] : tabla === 'enfrentamiento_escuadras' ? ['enfrentamiento_id', 'escuadra_id'] : null);
      const prev = claves && db[tabla].find(r => claves.every(k => String(r[k]) === String(fila[k])));
      if (prev) { if (!ignorar) Object.assign(prev, fila); out.push(prev); continue; }
      const nueva = { ...fila };
      if (!['sesion_escuadras', 'enfrentamiento_escuadras', 'formacion_miembros'].includes(tabla)) nueva.id = ++sig;
      if (tabla === 'enfrentamientos') nueva.ganador_id ??= null;
      db[tabla].push(nueva); out.push(nueva);
    }
  } else if (m === 'PATCH') {
    out = db[tabla].filter(r => cumple(r, fs));
    if (tabla === 'enfrentamientos' && body.ganador_id && out.some(e => !db.enfrentamiento_escuadras.some(p => p.enfrentamiento_id === e.id && p.escuadra_id === body.ganador_id)))
      return route.fulfill({ status: 400, json: { code: 'P0001', message: 'El ganador debe participar' } });
    out.forEach(r => Object.assign(r, body));
  } else if (m === 'DELETE') {
    out = db[tabla].filter(r => cumple(r, fs));
    db[tabla] = db[tabla].filter(r => !out.includes(r));
    if (tabla === 'enfrentamientos') db.enfrentamiento_escuadras = db.enfrentamiento_escuadras.filter(p => !out.some(e => e.id === p.enfrentamiento_id));
  }
  if (estado.perderRespuesta && m === 'POST' && tabla === estado.perderRespuesta) { estado.perderRespuesta = null; log.push('!! respuesta perdida'); return route.abort('connectionreset'); }
  return route.fulfill({ status: 200, json: uno ? (out[0] ?? null) : out });
}


return { db, log, rest, estado };
};
