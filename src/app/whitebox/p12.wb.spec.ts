import { conReintentos, JuegosRepositorio, nuevoIdCliente, Juego } from '../services/juegos/juegos-repositorio';
import { fetchConLimite, LIMITE_MS, mensajeError, esErrorDeRed } from '../services/supabase/supabase';
import { json, peticiones, quitarRed, sesionValida, usarRed } from './red-falsa';

/**
 * PRÁCTICA 12 — Pruebas de la optimización y de la resiliencia
 *  · conReintentos: reintento controlado con espera progresiva (exponential backoff)
 *  · JuegosRepositorio.guardar: UNA llamada por juego a guardar_juego, idempotente (mismo idCliente en cada reintento)
 *  · fetchConLimite: tiempo de espera máximo por petición (RES-03)
 */
const errorRed = () => new TypeError('Failed to fetch');

describe('P12 · conReintentos (exponential backoff)', () => {
  it('OPT-01 reintenta errores de red con espera progresiva y termina bien', async () => {
    const esperas: number[] = [];
    let llamadas = 0;
    const r = await conReintentos(async () => { if (++llamadas < 3) throw errorRed(); return 'ok'; },
      { reintentos: 2, esperaBase: 500, dormir: async ms => { esperas.push(ms); } });
    expect(r).toBe('ok');
    expect(llamadas).toBe(3);
    expect(esperas.length).toBe(2);
    // 500·2^0 + jitter ≤ 250, luego 500·2^1 + jitter ≤ 250
    expect(esperas[0]).toBeGreaterThanOrEqual(500); expect(esperas[0]).toBeLessThanOrEqual(750);
    expect(esperas[1]).toBeGreaterThanOrEqual(1000); expect(esperas[1]).toBeLessThanOrEqual(1250);
  });

  it('OPT-02 se rinde después del máximo de reintentos y devuelve el error', async () => {
    let llamadas = 0;
    await expectAsync(conReintentos(async () => { llamadas++; throw errorRed(); }, { reintentos: 2, dormir: async () => {} }))
      .toBeRejectedWithError(TypeError, 'Failed to fetch');
    expect(llamadas).toBe(3);
  });

  it('OPT-03 NO reintenta errores de validación o permisos (no son de red)', async () => {
    let llamadas = 0;
    await expectAsync(conReintentos(async () => { llamadas++; throw { code: '23514', message: 'violates check constraint' }; },
      { dormir: async () => {} })).toBeRejected();
    expect(llamadas).toBe(1);
  });

  it('OPT-04 avisa a la interfaz en cada reintento', async () => {
    const avisos: string[] = [];
    let llamadas = 0;
    await conReintentos(async () => { if (++llamadas < 2) throw errorRed(); return 1; },
      { dormir: async () => {}, alReintentar: (n, t) => avisos.push(`${n}/${t}`) });
    expect(avisos).toEqual(['1/2']);
  });

  it('OPT-05 nuevoIdCliente genera UUID v4 distintos', () => {
    const a = nuevoIdCliente(), b = nuevoIdCliente();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a).not.toBe(b);
  });
});

describe('P12 · JuegosRepositorio.guardar (una llamada transaccional e idempotente)', () => {
  const juego = (): Juego => ({ id: 1, idCliente: '6f1d2c3b-0000-4000-8000-000000000001', nombre: 'Relevos', valor: 20,
    roles: [{ numero: 1, enfrentamientos: [{ escuadras: ['ANK', 'ATL'], ganador: 'ANK' }] }] });
  const cuerpos: { idCliente: string }[] = [];

  beforeEach(() => { cuerpos.length = 0; localStorage.clear(); });
  afterEach(() => { quitarRed(); localStorage.clear(); });

  it('OPT-06 guarda un juego con UNA sola petición (antes eran ~9)', async () => {
    usarRed(async (url, init) => {
      if (url.includes('/rpc/guardar_juego')) { cuerpos.push(JSON.parse(String(init?.body)).p_juego); return json(77); }
      return json({ message: 'no simulado' }, 404);
    });
    const ids = await new JuegosRepositorio().guardar('2026-11-14', [juego()]);
    expect(ids.get(1)).toBe(77);
    expect(peticiones).toEqual(['POST /rest/v1/rpc/guardar_juego']);
    expect(cuerpos[0].idCliente).toBe('6f1d2c3b-0000-4000-8000-000000000001');
  });

  it('OPT-07 RES-07: si se pierde la conexión, reintenta con el MISMO idCliente (no duplica)', async () => {
    let intentos = 0;
    usarRed(async (url, init) => {
      cuerpos.push(JSON.parse(String(init?.body)).p_juego);
      if (++intentos === 1) throw errorRed();      // primer intento: sin red
      return json(77);
    });
    const avisos: number[] = [];
    const ids = await new JuegosRepositorio().guardar('2026-11-14', [juego()], { dormir: async () => {}, alReintentar: n => avisos.push(n) });
    expect(ids.get(1)).toBe(77);
    expect(intentos).toBe(2);
    expect(new Set(cuerpos.map(c => c.idCliente)).size).withContext('mismo id en ambos intentos').toBe(1);
    expect(avisos).toEqual([1]);
  });

  it('OPT-08 un error del servidor (permiso) no se reintenta y se informa', async () => {
    let intentos = 0;
    usarRed(async () => { intentos++; return json({ code: '42501', message: 'Tu cuenta no tiene permiso para guardar juegos' }, 403); });
    await expectAsync(new JuegosRepositorio().guardar('2026-11-14', [juego()], { dormir: async () => {} })).toBeRejected();
    expect(intentos).toBe(1);
  });

  it('OPT-09 un juego sin idCliente (cargado antes de la migración) recibe uno y lo conserva', async () => {
    usarRed(async (_u, init) => { cuerpos.push(JSON.parse(String(init?.body)).p_juego); return json(5); });
    const j = { ...juego(), idCliente: undefined, dbId: 5 };
    await new JuegosRepositorio().guardar('2026-11-14', [j]);
    expect(j.idCliente).toBeDefined();
    expect(cuerpos[0]).toEqual(jasmine.objectContaining({ id: 5, idCliente: j.idCliente! }));
  });
});

describe('P12 · fetchConLimite (RES-03 servidor sin respuesta)', () => {
  afterEach(() => { quitarRed(); jasmine.clock().uninstall(); });

  it('OPT-10 corta la petición al llegar al límite y lo reporta como error de red', async () => {
    jasmine.clock().install();
    usarRed((_url, init) => new Promise<Response>((_ok, falla) => {
      init?.signal?.addEventListener('abort', () => falla(init.signal!.reason));   // el servidor nunca contesta
    }));
    const p = fetchConLimite('https://berxzmxipyapcczfwynl.supabase.co/rest/v1/juegos');
    let error: unknown = null;
    p.catch(e => (error = e));
    jasmine.clock().tick(LIMITE_MS - 1);
    await Promise.resolve();
    expect(error).withContext('todavía no se corta').toBeNull();
    jasmine.clock().tick(1);
    await expectAsync(p).toBeRejected();
    expect(esErrorDeRed(error)).toBeTrue();
    expect(mensajeError({ message: `AbortError: ${(error as Error).message}` })).toBe('El servidor no respondió a tiempo. Revisa tu conexión e inténtalo de nuevo.');
  });

  it('OPT-11 una respuesta a tiempo no se ve afectada', async () => {
    usarRed(async () => json(sesionValida()));
    const r = await fetchConLimite('https://berxzmxipyapcczfwynl.supabase.co/auth/v1/token');
    expect(r.status).toBe(200);
  });
});
