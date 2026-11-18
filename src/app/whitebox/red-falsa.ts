/**
 * PRÁCTICA 11 — White Box
 * Doble de prueba de la RED: reemplaza `fetch` del navegador para que las pruebas
 * controlen exactamente qué responde "Supabase" en cada caso (éxito, 400, 429,
 * error de red, perfil inexistente...). Así se pueden recorrer todos los caminos
 * del código de comunicación sin depender de internet ni de datos reales.
 *
 * Se instala al cargar el archivo (antes de que la app cree el cliente de Supabase),
 * porque el cliente guarda la referencia a `fetch` en el momento en que se crea.
 */
export type Manejador = (url: string, init: RequestInit | undefined) => Promise<Response>;

const fetchOriginal = window.fetch.bind(window);
let manejador: Manejador | null = null;
/** Peticiones que hizo la app durante la prueba actual (método + ruta). */
export const peticiones: string[] = [];

window.fetch = (entrada: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
  if (manejador && url.includes('.supabase.co')) {
    const ruta = new URL(url);
    peticiones.push(`${init?.method ?? 'GET'} ${ruta.pathname}${ruta.search}`);
    return manejador(url, init);
  }
  return fetchOriginal(entrada, init);
};

export function usarRed(m: Manejador) {
  manejador = m;
  peticiones.length = 0;
}

export function quitarRed() {
  manejador = null;
}

export const json = (cuerpo: unknown, status = 200) =>
  new Response(status === 204 ? null : JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });

/** Respuesta de Supabase Auth para un inicio de sesión correcto. */
export function sesionValida(userId = 'usuario-1') {
  const ahora = Math.floor(Date.now() / 1000);
  return {
    access_token: 'token-de-prueba', token_type: 'bearer', expires_in: 3600, expires_at: ahora + 3600,
    refresh_token: 'refresh-de-prueba',
    user: { id: userId, aud: 'authenticated', email: 'jefatura@moriah.com', app_metadata: {}, user_metadata: {}, created_at: '' },
  };
}
