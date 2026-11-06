import { Injectable } from '@angular/core';
import { supabase, BUCKET_FOTOS } from '../supabase/supabase';
import { asegurarEscuadra, escuadrasDeFecha, listarEscuadras, obtenerSesion } from '../datos/datos';

export interface Criterios {
  fuerza: number;
  utilidad: number;
  firmeza: number;
  estabilidad: number;
  originalidad: number;
}

/** Una calificación tal como está en la base de datos. */
export interface CalificacionBD extends Criterios {
  id: number;
  escuadra_id: number;
  version: number;
}

export interface DatosTecnica {
  /** Escuadras de la sesión del día, con su id en la base. */
  escuadras: { id: number; nombre: string }[];
  calificaciones: CalificacionBD[];
  /** Última foto de cada escuadra (escuadra_id → URL temporal firmada). */
  fotos: Record<number, string>;
  sesionId: number | null;
}

export interface FilaParaGuardar {
  escuadra: string;
  valores: Criterios;
  /** id y version si la calificación ya existía (para detectar conflictos). */
  id?: number;
  version?: number;
}

export interface ResultadoGuardado {
  guardadas: (CalificacionBD & { escuadra: string })[];
  /** Escuadras que otra persona modificó mientras se editaban (no se sobrescribieron). */
  conflictos: string[];
}

const COLUMNAS = 'id, escuadra_id, version, fuerza, utilidad, firmeza, estabilidad, originalidad';

/**
 * Acceso a la base de datos para la pantalla Técnica.
 * Es un servicio inyectable para que las pruebas puedan sustituirlo por un doble.
 */
@Injectable({ providedIn: 'root' })
export class TecnicaRepositorio {

  async cargar(fecha: string): Promise<DatosTecnica> {
    const sb = supabase();
    const sesionId = await obtenerSesion(fecha, false);
    if (sesionId === null) return { escuadras: [], calificaciones: [], fotos: {}, sesionId };

    const escuadras = await escuadrasDeFecha(fecha);
    const { data, error } = await sb.from('calificaciones_tecnica').select(COLUMNAS).eq('sesion_id', sesionId);
    if (error) throw error;

    // Última foto de cada escuadra en esta sesión
    const fotos: Record<number, string> = {};
    const { data: filasFoto, error: errFoto } = await sb
      .from('fotografias')
      .select('escuadra_id, ruta_archivo, creado_en')
      .eq('sesion_id', sesionId)
      .order('creado_en', { ascending: false });
    if (!errFoto && filasFoto?.length) {
      const ultimas = new Map<number, string>();
      for (const f of filasFoto) if (!ultimas.has(f.escuadra_id)) ultimas.set(f.escuadra_id, f.ruta_archivo);
      const { data: firmadas } = await sb.storage.from(BUCKET_FOTOS).createSignedUrls([...ultimas.values()], 3600);
      for (const [escuadraId, ruta] of ultimas) {
        const url = firmadas?.find(x => x.path === ruta)?.signedUrl;
        if (url) fotos[escuadraId] = url;
      }
    }
    return { escuadras, calificaciones: (data ?? []) as CalificacionBD[], fotos, sesionId };
  }

  /**
   * Guarda las calificaciones. Si una ya existía, solo se actualiza cuando su versión
   * no cambió desde que se cargó; si otra persona la modificó, se reporta como conflicto.
   */
  async guardar(fecha: string, filas: FilaParaGuardar[]): Promise<ResultadoGuardado> {
    const sb = supabase();
    const sesionId = (await obtenerSesion(fecha, true)) as number;
    const existentes = await listarEscuadras();
    const resultado: ResultadoGuardado = { guardadas: [], conflictos: [] };

    for (const fila of filas) {
      const escuadraId = await asegurarEscuadra(fila.escuadra, existentes);
      // La escuadra participa en la sesión del día (para el ranking general)
      await sb.from('sesion_escuadras').upsert({ sesion_id: sesionId, escuadra_id: escuadraId }, { ignoreDuplicates: true });

      if (fila.id !== undefined && fila.version !== undefined) {
        const { data, error } = await sb
          .from('calificaciones_tecnica')
          .update(fila.valores)
          .eq('id', fila.id)
          .eq('version', fila.version)           // control de conflictos (Práctica 9)
          .select(COLUMNAS);
        if (error) throw error;
        if (!data?.length) { resultado.conflictos.push(fila.escuadra); continue; }
        resultado.guardadas.push({ ...(data[0] as CalificacionBD), escuadra: fila.escuadra });
      } else {
        const { data, error } = await sb
          .from('calificaciones_tecnica')
          .insert({ sesion_id: sesionId, escuadra_id: escuadraId, ...fila.valores })
          .select(COLUMNAS)
          .single();
        if (error?.code === '23505') { resultado.conflictos.push(fila.escuadra); continue; } // otra persona la creó antes
        if (error) throw error;
        resultado.guardadas.push({ ...(data as CalificacionBD), escuadra: fila.escuadra });
      }
    }
    return resultado;
  }

  /** Sube la foto a Storage y la registra en la tabla fotografias. Devuelve una URL para mostrarla. */
  async subirFoto(fecha: string, escuadra: string, dataUrl: string, calificacionId?: number): Promise<string> {
    const sb = supabase();
    const sesionId = (await obtenerSesion(fecha, true)) as number;
    const escuadraId = await asegurarEscuadra(escuadra, await listarEscuadras());

    const archivo = await (await fetch(dataUrl)).blob();
    const ruta = `${sesionId}/${escuadraId}-${Date.now()}.jpg`;
    const subida = await sb.storage.from(BUCKET_FOTOS).upload(ruta, archivo, { contentType: 'image/jpeg' });
    if (subida.error) throw subida.error;

    const { error } = await sb.from('fotografias').insert({
      escuadra_id: escuadraId, sesion_id: sesionId, calificacion_id: calificacionId ?? null, ruta_archivo: ruta,
    });
    if (error) {
      await sb.storage.from(BUCKET_FOTOS).remove([ruta]);   // no dejar archivos sin registro
      throw error;
    }
    const { data } = await sb.storage.from(BUCKET_FOTOS).createSignedUrl(ruta, 3600);
    return data?.signedUrl ?? dataUrl;
  }

  /**
   * Escucha en tiempo real los cambios de calificaciones de una sesión (Práctica 9).
   * Devuelve una función para dejar de escuchar.
   */
  suscribir(sesionId: number, alCambiar: (fila: CalificacionBD) => void): () => void {
    const sb = supabase();
    const canal = sb
      .channel(`tecnica-${sesionId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'calificaciones_tecnica', filter: `sesion_id=eq.${sesionId}` },
        cambio => { if (cambio.new && 'id' in cambio.new) alCambiar(cambio.new as CalificacionBD); })
      .subscribe();
    return () => { sb.removeChannel(canal); };
  }
}
