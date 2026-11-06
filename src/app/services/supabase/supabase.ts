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
    });
  }
  return cliente;
}

/** Traduce los errores de la base a mensajes que entienda la jefatura. */
export function mensajeError(error: unknown): string {
  const e = error as { code?: string; message?: string } | null;
  const msg = (e?.message ?? '').toLowerCase();
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
