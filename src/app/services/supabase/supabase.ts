import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Conexión con la base de datos de Supabase.
 *
 * La "publishable key" es pública por diseño: va dentro de la app y lo que
 * protege los datos son las reglas Row Level Security (RLS) de la base.
 * NUNCA pongas aquí la "secret key" (service_role), porque se salta las reglas.
 */
export const SUPABASE_URL = 'https://berxzmxipyapcczfwynl.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_jyXb_vegqKWGh_4BURo11A_0adNCWNf';

/** Bucket de Storage donde se guardan las fotos de técnica. */
export const BUCKET_FOTOS = 'fotos-tecnica';

/** Tiempo máximo de espera por petición (Práctica 12, RES-03). Las fotos tienen más margen. */
export const LIMITE_MS = 10_000;
export const LIMITE_FOTOS_MS = 60_000;
export const MENSAJE_TIEMPO = 'tiempo de espera agotado';

/**
 * fetch con límite de tiempo. Sin esto, si el servidor no responde la app se queda
 * esperando indefinidamente (supabase-js no trae un timeout propio).
 * El error se lanza como AbortError para que la librería no lo reintente por su cuenta:
 * los reintentos los decide la app (ver conReintentos en juegos-repositorio.ts).
 */
export function fetchConLimite(entrada: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const url = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
  const limite = url.includes('/storage/v1/') ? LIMITE_FOTOS_MS : LIMITE_MS;
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(new DOMException(MENSAJE_TIEMPO, 'AbortError')), limite);
  const externa = init.signal;
  if (externa) {
    if (externa.aborted) control.abort(externa.reason);
    else externa.addEventListener('abort', () => control.abort(externa.reason), { once: true });
  }
  // Se lee window.fetch en cada llamada (no al crear el cliente) para poder sustituirlo en pruebas
  return globalThis.fetch(entrada, { ...init, signal: control.signal })
    .catch(e => { throw control.signal.aborted && !externa?.aborted ? new DOMException(MENSAJE_TIEMPO, 'AbortError') : e; })
    .finally(() => clearTimeout(reloj));
}

let cliente: SupabaseClient | null = null;

/** Cliente único de Supabase para toda la app. */
export function supabase(): SupabaseClient {
  if (!cliente) {
    const enNavegador = typeof window !== 'undefined';
    cliente = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: enNavegador,   // la sesión sigue activa al cerrar y abrir la app
        autoRefreshToken: enNavegador,
        detectSessionInUrl: false,
      },
      global: { fetch: fetchConLimite },
    });
  }
  return cliente;
}

/** ¿El error es de conexión (sin red, sin respuesta o tiempo agotado)? Solo esos se reintentan. */
export function esErrorDeRed(error: unknown): boolean {
  const e = error as { message?: string; name?: string } | null;
  const msg = `${e?.name ?? ''} ${e?.message ?? ''}`.toLowerCase();
  return ['failed to fetch', 'network', 'load failed', MENSAJE_TIEMPO, 'aborterror'].some(t => msg.includes(t));
}

/** Traduce los errores de la base a mensajes que entienda la jefatura. */
export function mensajeError(error: unknown): string {
  const e = error as { code?: string; message?: string } | null;
  const msg = (e?.message ?? '').toLowerCase();
  // Práctica 13-14: las reglas del juego ya traen un mensaje claro (validacion-juego.ts)
  if (error instanceof Error && error.name === 'ErrorValidacionJuego') return error.message;
  if (msg.includes(MENSAJE_TIEMPO)) {
    return 'El servidor no respondió a tiempo. Revisa tu conexión e inténtalo de nuevo.';
  }
  if (msg.includes('failed to fetch') || msg.includes('network') || msg.includes('load failed')) {
    return 'Sin conexión con el servidor. No se guardó; revisa tu internet e inténtalo de nuevo.';
  }
  switch (e?.code) {
    case '23505': return 'Ese registro ya existe.';
    case '23514': return 'Algún dato está fuera de los valores permitidos.';
    case '42501': return 'No tienes permiso para hacer esta operación.';
    case 'PGRST301':
    case 'PGRST303': return 'Tu sesión expiró. Vuelve a iniciar sesión.';
  }
  return 'Ocurrió un error al comunicarse con el servidor.';
}
