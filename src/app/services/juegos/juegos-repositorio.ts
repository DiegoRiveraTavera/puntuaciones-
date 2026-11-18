import { Injectable } from '@angular/core';
import { esErrorDeRed, supabase } from '../supabase/supabase';
import { EscuadraBD, escuadrasDeFecha, listarEscuadras, obtenerSesion } from '../datos/datos';
import { asegurarJuegosValidos } from './validacion-juego';

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
  /**
   * Id único creado en la app al agregar el juego (Práctica 12). Es la llave de idempotencia:
   * si la misma solicitud llega dos veces al servidor, actualiza el mismo juego en lugar de duplicarlo.
   */
  idCliente?: string;
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
  id_cliente: string | null;
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

/** Id único para un juego nuevo (llave de idempotencia). */
export function nuevoIdCliente(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // Respaldo para WebViews antiguas: UUID v4 con crypto.getRandomValues
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export interface OpcionesReintento {
  /** Reintentos después del primer intento (por defecto 2). */
  reintentos?: number;
  /** Espera antes del primer reintento, en ms; se duplica en cada reintento (por defecto 500). */
  esperaBase?: number;
  /** Aviso a la interfaz: número de reintento que va a empezar. */
  alReintentar?: (intento: number, total: number) => void;
  /** Para pruebas: cómo esperar (por defecto setTimeout). */
  dormir?: (ms: number) => Promise<void>;
}

/**
 * Reintento controlado con espera progresiva (exponential backoff + jitter).
 * Solo reintenta errores de conexión (sin red, sin respuesta, tiempo agotado); un error
 * de validación o de permisos se devuelve de inmediato. Úsese solo con operaciones
 * idempotentes: repetirlas no debe crear registros nuevos.
 */
export async function conReintentos<T>(operacion: () => Promise<T>, opciones: OpcionesReintento = {}): Promise<T> {
  const { reintentos = 2, esperaBase = 500, alReintentar, dormir = ms => new Promise<void>(r => setTimeout(r, ms)) } = opciones;
  for (let intento = 0; ; intento++) {
    try {
      return await operacion();
    } catch (error) {
      if (intento >= reintentos || !esErrorDeRed(error)) throw error;
      const espera = esperaBase * 2 ** intento + Math.round(Math.random() * esperaBase / 2);
      alReintentar?.(intento + 1, reintentos);
      await dormir(espera);
    }
  }
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
      .select('id, id_cliente, nombre, valor, enfrentamientos ( id, rol, ganador_id, enfrentamiento_escuadras ( escuadra_id ) )')
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
      return { id: fila.id, dbId: fila.id, idCliente: fila.id_cliente ?? nuevoIdCliente(), nombre: fila.nombre, valor: fila.valor, roles } as Juego;
    });

    // Si un juego usa una escuadra que no está en la lista del día, también se muestra
    for (const j of juegos) for (const r of j.roles) for (const e of r.enfrentamientos)
      for (const n of e.escuadras) if (n && !escuadras.includes(n)) escuadras.push(n);

    return { escuadras, juegos };
  }

  /**
   * Guarda todos los juegos de la fecha (Práctica 12: versión optimizada).
   * Cada juego se guarda con UNA llamada a la función guardar_juego de la base, que hace
   * todo en una transacción (juego, enfrentamientos, participantes y ganador).
   * Antes eran ~9 peticiones en serie sin transacción.
   * Como cada juego lleva su idCliente, la llamada es idempotente y se puede reintentar.
   * Devuelve el id en la base de cada juego (id de pantalla → id en la base).
   */
  async guardar(fecha: string, juegos: Juego[], opciones: OpcionesReintento = {}): Promise<Map<number, number>> {
    // Práctica 13-14: si algún juego rompe las reglas, no se envía nada al servidor
    asegurarJuegosValidos(juegos);
    const sb = supabase();
    const ids = new Map<number, number>();

    for (const juego of juegos) {
      juego.idCliente ??= nuevoIdCliente();
      const datos = {
        id: juego.dbId ?? null,
        idCliente: juego.idCliente,
        nombre: juego.nombre,
        valor: juego.valor,
        roles: juego.roles.map(r => ({
          numero: r.numero,
          enfrentamientos: r.enfrentamientos.map(e => ({ escuadras: e.escuadras, ganador: e.ganador })),
        })),
      };
      const dbId = await conReintentos(async () => {
        const { data, error } = await sb.rpc('guardar_juego', { p_fecha: fecha, p_juego: datos });
        if (error) throw error;
        return data as number;
      }, opciones);
      ids.set(juego.id, dbId);
    }
    return ids;
  }
}
