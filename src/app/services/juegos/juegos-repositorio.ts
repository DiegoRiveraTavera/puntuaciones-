import { Injectable } from '@angular/core';
import { supabase } from '../supabase/supabase';
import { asegurarEscuadra, EscuadraBD, escuadrasDeFecha, listarEscuadras, obtenerSesion } from '../datos/datos';

export interface Enfrentamiento {
  escuadras: string[];
  ganador: string;
}

export interface Rol {
  numero: number;
  enfrentamientos: Enfrentamiento[];
}

export interface Juego {
  /** Identificador en pantalla (para las pestañas). */
  id: number;
  /** id del juego en la base de datos; no existe hasta que se guarda por primera vez. */
  dbId?: number;
  nombre: string;
  valor: number;
  roles: Rol[];
}

export interface DatosJuegos {
  /** Escuadras que se pueden elegir en los enfrentamientos. */
  escuadras: string[];
  juegos: Juego[];
}

interface FilaJuego {
  id: number;
  nombre: string;
  valor: number;
  enfrentamientos: {
    id: number;
    rol: number;
    ganador_id: number | null;
    enfrentamiento_escuadras: { escuadra_id: number }[];
  }[];
}

/** Todas las escuadras (también las inactivas, para poder mostrar juegos viejos). */
async function todasLasEscuadras(): Promise<EscuadraBD[]> {
  const { data, error } = await supabase().from('escuadras').select('id, nombre').order('id');
  if (error) throw error;
  return data as EscuadraBD[];
}

/**
 * Escuadras para elegir en una fecha: las registradas en Inicio para ese día;
 * si todavía no hay ninguna, todas las escuadras activas.
 */
export async function escuadrasParaElegir(fecha: string): Promise<string[]> {
  const delDia = await escuadrasDeFecha(fecha);
  const lista = delDia.length > 0 ? delDia : await listarEscuadras();
  return lista.map(e => e.nombre);
}

/**
 * Acceso a la base de datos para la pantalla Juegos.
 * Es un servicio inyectable para que las pruebas puedan sustituirlo por un doble.
 */
@Injectable({ providedIn: 'root' })
export class JuegosRepositorio {

  async cargar(fecha: string): Promise<DatosJuegos> {
    const escuadras = await escuadrasParaElegir(fecha);
    const sesionId = await obtenerSesion(fecha, false);
    if (sesionId === null) return { escuadras, juegos: [] };

    const { data, error } = await supabase()
      .from('juegos')
      .select('id, nombre, valor, enfrentamientos ( id, rol, ganador_id, enfrentamiento_escuadras ( escuadra_id ) )')
      .eq('sesion_id', sesionId)
      .order('id');
    if (error) throw error;

    const nombres = new Map((await todasLasEscuadras()).map(e => [e.id, e.nombre]));
    const nombre = (id: number | null) => (id !== null && nombres.get(id)) || '';

    const juegos = (data as FilaJuego[]).map(fila => {
      const enfs = [...fila.enfrentamientos].sort((a, b) => a.id - b.id);
      const totalRoles = enfs.reduce((max, e) => Math.max(max, e.rol), 0);
      const roles: Rol[] = Array.from({ length: totalRoles }, (_, i) => ({ numero: i + 1, enfrentamientos: [] }));
      for (const e of enfs) {
        const participantes = e.enfrentamiento_escuadras.map(p => nombre(p.escuadra_id)).filter(Boolean);
        while (participantes.length < 2) participantes.push('');
        roles[e.rol - 1].enfrentamientos.push({ escuadras: participantes, ganador: nombre(e.ganador_id) });
      }
      return { id: fila.id, dbId: fila.id, nombre: fila.nombre, valor: fila.valor, roles } as Juego;
    });

    // Si un juego usa una escuadra que no está en la lista del día, también se muestra
    for (const j of juegos) for (const r of j.roles) for (const e of r.enfrentamientos)
      for (const n of e.escuadras) if (n && !escuadras.includes(n)) escuadras.push(n);

    return { escuadras, juegos };
  }

  /**
   * Guarda todos los juegos de la fecha. Cada juego se guarda completo:
   * sus enfrentamientos se reemplazan por los que hay en pantalla.
   * Devuelve el id en la base de cada juego (id de pantalla → id en la base).
   */
  async guardar(fecha: string, juegos: Juego[]): Promise<Map<number, number>> {
    const sb = supabase();
    const sesionId = (await obtenerSesion(fecha, true)) as number;
    const existentes = await listarEscuadras();
    const ids = new Map<number, number>();
    const enSesion = new Set<number>();

    for (const juego of juegos) {
      let dbId = juego.dbId;
      if (dbId === undefined) {
        const { data, error } = await sb.from('juegos')
          .insert({ sesion_id: sesionId, nombre: juego.nombre, valor: juego.valor })
          .select('id').single();
        if (error) throw error;
        dbId = data.id as number;
      } else {
        const { error } = await sb.from('juegos').update({ nombre: juego.nombre, valor: juego.valor }).eq('id', dbId);
        if (error) throw error;
      }
      ids.set(juego.id, dbId);

      // Se reemplazan los enfrentamientos del juego
      const { error: errBorrar } = await sb.from('enfrentamientos').delete().eq('juego_id', dbId);
      if (errBorrar) throw errBorrar;

      for (const rol of juego.roles) {
        for (const enf of rol.enfrentamientos) {
          const participantes = [...new Set(enf.escuadras.map(e => e.trim()).filter(Boolean))];

          const { data: nuevo, error: errEnf } = await sb.from('enfrentamientos')
            .insert({ juego_id: dbId, rol: rol.numero }).select('id').single();
          if (errEnf) throw errEnf;
          const enfId = nuevo.id as number;

          const porNombre = new Map<string, number>();
          for (const n of participantes) {
            const id = await asegurarEscuadra(n, existentes);
            porNombre.set(n, id);
            if (!enSesion.has(id)) {
              // La escuadra participa en la sesión del día (para el ranking general)
              const { error } = await sb.from('sesion_escuadras')
                .upsert({ sesion_id: sesionId, escuadra_id: id }, { ignoreDuplicates: true });
              if (error) throw error;
              enSesion.add(id);
            }
          }

          if (porNombre.size > 0) {
            const { error } = await sb.from('enfrentamiento_escuadras')
              .insert([...porNombre.values()].map(escuadra_id => ({ enfrentamiento_id: enfId, escuadra_id })));
            if (error) throw error;
          }

          // El ganador se registra al final: la base exige que sea una de las participantes
          const ganadorId = porNombre.get(enf.ganador.trim());
          if (ganadorId !== undefined) {
            const { error } = await sb.from('enfrentamientos').update({ ganador_id: ganadorId }).eq('id', enfId);
            if (error) throw error;
          }
        }
      }
    }
    return ids;
  }
}
