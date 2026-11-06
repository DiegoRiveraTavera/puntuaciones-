import { supabase } from '../supabase/supabase';

/**
 * Acceso a los datos compartidos en Supabase.
 * Todas las consultas pasan por las reglas RLS: sin una sesión de jefatura
 * el servidor no devuelve ni guarda nada.
 */

export interface EscuadraBD {
  id: number;
  nombre: string;
}

/** Fecha de hoy en la hora local del celular (AAAA-MM-DD). */
export function hoyLocal(): string {
  const d = new Date();
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

/** Busca la sesión (día de actividad) de una fecha; si `crear` es true y no existe, la crea. */
export async function obtenerSesion(fecha: string, crear = false): Promise<number | null> {
  const sb = supabase();
  const { data, error } = await sb.from('sesiones').select('id').eq('fecha', fecha).maybeSingle();
  if (error) throw error;
  if (data) return data.id as number;
  if (!crear) return null;

  const nueva = await sb.from('sesiones').insert({ fecha }).select('id').single();
  if (nueva.error?.code === '23505') {
    // Otro celular la creó al mismo tiempo: se usa la suya
    return obtenerSesion(fecha, false);
  }
  if (nueva.error) throw nueva.error;
  return nueva.data.id as number;
}

/** Todas las escuadras activas. */
export async function listarEscuadras(): Promise<EscuadraBD[]> {
  const { data, error } = await supabase().from('escuadras').select('id, nombre').eq('activa', true).order('id');
  if (error) throw error;
  return data as EscuadraBD[];
}

/** Escuadras registradas en la sesión de una fecha, en el orden en que se agregaron. */
export async function escuadrasDeFecha(fecha: string): Promise<EscuadraBD[]> {
  const sesionId = await obtenerSesion(fecha, false);
  if (sesionId === null) return [];
  const { data, error } = await supabase()
    .from('sesion_escuadras')
    .select('escuadra:escuadras ( id, nombre )')
    .eq('sesion_id', sesionId);
  if (error) throw error;
  return (data as unknown as { escuadra: EscuadraBD }[])
    .map(f => f.escuadra)
    .sort((a, b) => a.id - b.id);
}

/** Devuelve el id de la escuadra con ese nombre (sin importar mayúsculas); si no existe, la crea. */
export async function asegurarEscuadra(nombre: string, existentes: EscuadraBD[]): Promise<number> {
  const clave = nombre.trim().toUpperCase();
  const encontrada = existentes.find(e => e.nombre.trim().toUpperCase() === clave);
  if (encontrada) return encontrada.id;

  const { data, error } = await supabase().from('escuadras').insert({ nombre: nombre.trim() }).select('id').single();
  if (error?.code === '23505') {
    // La creó otro celular al mismo tiempo
    const todas = await listarEscuadras();
    const otra = todas.find(e => e.nombre.trim().toUpperCase() === clave);
    if (otra) return otra.id;
  }
  if (error) throw error;
  return data.id as number;
}

/** Guarda la lista de escuadras que participan en la sesión de una fecha. */
export async function guardarEscuadrasDeFecha(fecha: string, nombres: string[]): Promise<void> {
  const sb = supabase();
  const sesionId = (await obtenerSesion(fecha, true)) as number;
  const existentes = await listarEscuadras();

  const ids: number[] = [];
  for (const nombre of nombres) ids.push(await asegurarEscuadra(nombre, existentes));

  // Quita las que ya no están en la lista
  let borrar = sb.from('sesion_escuadras').delete().eq('sesion_id', sesionId);
  if (ids.length > 0) borrar = borrar.not('escuadra_id', 'in', `(${ids.join(',')})`);
  const { error: errBorrar } = await borrar;
  if (errBorrar) throw errBorrar;

  // Agrega las nuevas (las que ya estaban se ignoran)
  if (ids.length > 0) {
    const { error } = await sb
      .from('sesion_escuadras')
      .upsert(ids.map(escuadra_id => ({ sesion_id: sesionId, escuadra_id })), { ignoreDuplicates: true });
    if (error) throw error;
  }
}
