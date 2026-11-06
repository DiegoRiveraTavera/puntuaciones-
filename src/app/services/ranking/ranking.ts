import { supabase } from '../supabase/supabase';

export interface PuntosEscuadra {
  nombre: string;
  juegos: number;
  tecnica: number;
  formacion: number;
  total: number;
}

export interface Ranking {
  /** Fecha de la sesión que se muestra (AAAA-MM-DD), o null si todavía no hay datos. */
  fecha: string | null;
  puntos: PuntosEscuadra[];
}

/**
 * Puntos de cada escuadra según la vista `ranking_general` de Supabase
 * (Juegos + Técnica + Formación). Si no se indica fecha, se usa la sesión más reciente.
 */
export async function obtenerRanking(fecha?: string): Promise<Ranking> {
  const sb = supabase();
  let dia = fecha ?? null;
  if (!dia) {
    const { data, error } = await sb.from('ranking_general').select('fecha').order('fecha', { ascending: false }).limit(1);
    if (error) throw error;
    dia = data?.[0]?.fecha ?? null;
  }
  if (!dia) return { fecha: null, puntos: [] };

  const { data, error } = await sb
    .from('ranking_general')
    .select('escuadra, puntos_juegos, puntos_tecnica, puntos_formacion, total')
    .eq('fecha', dia)
    .order('escuadra_id');
  if (error) throw error;

  return {
    fecha: dia,
    puntos: (data ?? []).map(f => ({
      nombre: f.escuadra as string,
      juegos: Number(f.puntos_juegos),
      tecnica: Number(f.puntos_tecnica),
      formacion: Number(f.puntos_formacion),
      total: Number(f.total),
    })),
  };
}

/** "2026-11-05" → "5 de noviembre de 2026" */
export function fechaLegible(fecha: string): string {
  const [a, m, d] = fecha.split('-').map(Number);
  return new Date(a, m - 1, d).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
}
