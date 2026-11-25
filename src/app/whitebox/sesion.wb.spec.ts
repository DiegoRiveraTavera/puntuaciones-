import { iniciarSesion } from '../services/sesion/sesion';
import { json, peticiones, quitarRed, sesionValida, usarRed } from './red-falsa';

/**
 * PRÁCTICA 11 — White Box · Método de COMUNICACIÓN
 * services/sesion/sesion.ts → iniciarSesion(correo, password)
 *
 * Nodos del grafo de flujo de control (figura del reporte):
 *  1 inicio · 2 signInWithPassword dentro de try → 3 catch: "No se pudo conectar"
 *  4 D2 ¿error || !data.user?                (C1 error, C2 !data.user)
 *  5 D3 ¿status===0 || /fetch|network/?      (C3, C4)  → 6 "No se pudo conectar"
 *  7 D4 ¿status===429?                        → 8a "Demasiados intentos" | 8b "Correo o contraseña incorrectos"
 *  9 consulta a perfiles · 10 D5 ¿!perfil?    → 11 signOut + "sin acceso" | 12 { ok: true } · 13 fin
 * V(G) = 5 decisiones + 1 = 6 caminos independientes.
 */

const LOGIN = '/auth/v1/token';
const PERFILES = '/rest/v1/perfiles';
const LOGOUT = '/auth/v1/logout';

/** Construye una "red" que responde según la ruta pedida. */
function red(opc: { login: () => Promise<Response> | Response; perfil?: () => Promise<Response> | Response }) {
  usarRed(async url => {
    if (url.includes(LOGIN)) return opc.login();
    if (url.includes(PERFILES)) return (opc.perfil ?? (() => json([{ id: 'usuario-1' }])))();
    if (url.includes(LOGOUT)) return new Response(null, { status: 204 });
    return json({ message: 'no simulado' }, 404);
  });
}

describe('WHITE BOX · sesion.iniciarSesion (comunicación con Supabase Auth)', () => {
  afterEach(async () => {
    // Deja el cliente sin sesión para la siguiente prueba
    usarRed(async () => new Response(null, { status: 204 }));
    const { cerrarSesion } = await import('../services/sesion/sesion');
    await cerrarSesion();
    quitarRed();
    localStorage.clear();
  });

  it('WB-COM-01 camino 1-2-4-9-10-12: credenciales correctas y perfil de jefatura → ok', async () => {
    red({ login: () => json(sesionValida()) });
    const r = await iniciarSesion('jefatura@moriah.com', 'Segura2026!');
    expect(r).toEqual({ ok: true });
    expect(peticiones.some(p => p.startsWith('POST /auth/v1/token'))).toBeTrue();
    expect(peticiones.some(p => p.startsWith('GET /rest/v1/perfiles'))).withContext('consulta el perfil').toBeTrue();
  });

  it('WB-COM-02 camino 1-2-4-9-10-11: la cuenta existe pero no tiene perfil → cierra la sesión', async () => {
    red({ login: () => json(sesionValida()), perfil: () => json([]) });
    const r = await iniciarSesion('otro@correo.com', 'Segura2026!');
    expect(r).toEqual({ ok: false, error: 'Tu cuenta no tiene acceso a Puntuaciones.' });
    expect(peticiones.some(p => p.startsWith('POST /auth/v1/logout'))).withContext('llama a signOut').toBeTrue();
  });

  it('WB-COM-03 camino 1-2-4-5-7-8b (C1=V, C3=F, C4=F): contraseña incorrecta (HTTP 400)', async () => {
    red({ login: () => json({ error: 'invalid_grant', error_description: 'Invalid login credentials', code: 'invalid_credentials' }, 400) });
    const r = await iniciarSesion('jefatura@moriah.com', 'Incorrecta1');
    expect(r).toEqual({ ok: false, error: 'Correo o contraseña incorrectos.' });
    expect(peticiones.some(p => p.includes(PERFILES))).withContext('no consulta perfiles').toBeFalse();
  });

  it('WB-COM-04 camino 1-2-4-5-7-8a (D4=V): demasiados intentos (HTTP 429)', async () => {
    red({ login: () => json({ message: 'Request rate limit reached' }, 429) });
    const r = await iniciarSesion('jefatura@moriah.com', 'Segura2026!');
    expect(r).toEqual({ ok: false, error: 'Demasiados intentos. Espera un momento y vuelve a intentarlo.' });
  });

  it('WB-COM-05 camino 1-2-4-5-6 (C3=V): sin red, fetch falla → status 0', async () => {
    red({ login: () => Promise.reject(new TypeError('Failed to fetch')) });
    const r = await iniciarSesion('jefatura@moriah.com', 'Segura2026!');
    expect(r).toEqual({ ok: false, error: 'No se pudo conectar con el servidor. Revisa tu conexión.' });
  });

  it('WB-COM-06 camino 1-2-4-5-6 con C3=F y C4=V (status≠0, mensaje con "network") → se trata como falta de conexión', async () => {
    red({ login: () => json({ message: 'network timeout at upstream' }, 503) });
    const r = await iniciarSesion('jefatura@moriah.com', 'Segura2026!');
    expect(r).toEqual({ ok: false, error: 'No se pudo conectar con el servidor. Revisa tu conexión.' });
  });

  it('WB-COM-07 excepción del servidor (HTTP 500) → no se informa como éxito', async () => {
    red({ login: () => json({ message: 'Database error querying schema' }, 500) });
    const r = await iniciarSesion('jefatura@moriah.com', 'Segura2026!');
    expect(r.ok).toBeFalse();
  });

  it('WB-COM-08 (DEF-03, corregido en la P12): si falla la consulta de perfiles por red, dice "sin conexión" y no "sin acceso"', async () => {
    red({ login: () => json(sesionValida()), perfil: () => Promise.reject(new TypeError('Failed to fetch')) });
    const inicio = performance.now();
    const r = await iniciarSesion('jefatura@moriah.com', 'Segura2026!');
    const ms = performance.now() - inicio;
    const intentos = peticiones.filter(p => p.startsWith('GET /rest/v1/perfiles')).length;
    console.log(`[WB-COM-08] intentos a perfiles: ${intentos}, tiempo hasta responder: ${Math.round(ms)} ms`);
    // La librería reintenta las lecturas (GET) 3 veces con espera 1 s + 2 s + 4 s
    expect(intentos).withContext('1 intento + 3 reintentos automáticos').toBe(4);
    // Resultado esperado: un error de conexión (esta prueba FALLA mientras exista el defecto).
    expect(r.ok).toBeFalse();
    expect((r as { error: string }).error)
      .withContext('el error de red de la consulta de perfiles no debe confundirse con falta de permisos')
      .toBe('No se pudo conectar con el servidor. Revisa tu conexión.');
  }, 20000);

  it('WB-COM-09 las escrituras (POST de login) no se reintentan solas: un solo intento ante falla de red', async () => {
    red({ login: () => Promise.reject(new TypeError('Failed to fetch')) });
    await iniciarSesion('jefatura@moriah.com', 'Segura2026!');
    expect(peticiones.filter(p => p.startsWith('POST /auth/v1/token')).length).toBe(1);
  });
});
