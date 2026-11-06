import { Injectable } from '@angular/core';
import { supabase } from '../supabase/supabase';
import { asegurarEscuadra, listarEscuadras, obtenerSesion } from '../datos/datos';
import { escuadrasParaElegir } from '../juegos/juegos-repositorio';

export interface Miembro {
  nombre: string;
  uniforme: boolean;
  cursos: string;
  pruebas: string;
}

export interface DatosFormacion {
  miembros: Miembro[];
  uniformeJefe: boolean;
  banderin: boolean;
  bandera: boolean;
  escudo: boolean;
  bolsa: boolean;
  botiquin: boolean;
  biblia: boolean;
  materiales: { tecnica: number; quizz: number; juegos: number };
  extras: { cuotas: number; adeudo: number };
}

export const TOTAL_MIEMBROS = 14;

export function formacionVacia(): DatosFormacion {
  return {
    miembros: Array.from({ length: TOTAL_MIEMBROS }, () => ({ nombre: '', uniforme: false, cursos: '', pruebas: '' })),
    uniformeJefe: false,
    banderin: false, bandera: false, escudo: false,
    bolsa: false, botiquin: false, biblia: false,
    materiales: { tecnica: 0, quizz: 0, juegos: 0 },
    extras: { cuotas: 0, adeudo: 0 },
  };
}

interface FilaFormacion {
  escuadra: { nombre: string };
  uniforme_jefe: boolean; banderin: boolean; bandera: boolean; escudo: boolean;
  bolsa: boolean; botiquin: boolean; biblia: boolean;
  mat_tecnica: number; mat_quizz: number; mat_juegos: number;
  cuotas: number | string; adeudo: number | string;
  formacion_miembros: (Miembro & { posicion: number })[];
}

/** Lo que se guarda de una escuadra: sus datos y el total de puntos calculado en pantalla. */
export interface FormacionParaGuardar {
  escuadra: string;
  datos: DatosFormacion;
  puntos: number;
}

/**
 * Acceso a la base de datos para la pantalla Formación.
 * Es un servicio inyectable para que las pruebas puedan sustituirlo por un doble.
 */
@Injectable({ providedIn: 'root' })
export class FormacionRepositorio {

  async cargar(fecha: string): Promise<{ escuadras: string[]; datos: Record<string, DatosFormacion> }> {
    const escuadras = await escuadrasParaElegir(fecha);
    const datos: Record<string, DatosFormacion> = {};
    const sesionId = await obtenerSesion(fecha, false);
    if (sesionId === null) return { escuadras, datos };

    const { data, error } = await supabase()
      .from('formacion')
      .select(`escuadra:escuadras ( nombre ), uniforme_jefe, banderin, bandera, escudo, bolsa, botiquin, biblia,
               mat_tecnica, mat_quizz, mat_juegos, cuotas, adeudo,
               formacion_miembros ( posicion, nombre, uniforme, cursos, pruebas )`)
      .eq('sesion_id', sesionId);
    if (error) throw error;

    for (const f of data as unknown as FilaFormacion[]) {
      const d = formacionVacia();
      for (const m of f.formacion_miembros) {
        d.miembros[m.posicion - 1] = { nombre: m.nombre, uniforme: m.uniforme, cursos: m.cursos, pruebas: m.pruebas };
      }
      d.uniformeJefe = f.uniforme_jefe;
      d.banderin = f.banderin; d.bandera = f.bandera; d.escudo = f.escudo;
      d.bolsa = f.bolsa; d.botiquin = f.botiquin; d.biblia = f.biblia;
      d.materiales = { tecnica: f.mat_tecnica, quizz: f.mat_quizz, juegos: f.mat_juegos };
      d.extras = { cuotas: Number(f.cuotas), adeudo: Number(f.adeudo) };
      datos[f.escuadra.nombre] = d;
      if (!escuadras.includes(f.escuadra.nombre)) escuadras.push(f.escuadra.nombre);
    }
    return { escuadras, datos };
  }

  async guardar(fecha: string, filas: FormacionParaGuardar[]): Promise<void> {
    const sb = supabase();
    const sesionId = (await obtenerSesion(fecha, true)) as number;
    const existentes = await listarEscuadras();

    for (const fila of filas) {
      const escuadraId = await asegurarEscuadra(fila.escuadra, existentes);
      // La escuadra participa en la sesión del día (para el ranking general)
      const { error: errSesion } = await sb.from('sesion_escuadras')
        .upsert({ sesion_id: sesionId, escuadra_id: escuadraId }, { ignoreDuplicates: true });
      if (errSesion) throw errSesion;

      const d = fila.datos;
      const { data, error } = await sb.from('formacion').upsert({
        sesion_id: sesionId, escuadra_id: escuadraId,
        uniforme_jefe: d.uniformeJefe,
        banderin: d.banderin, bandera: d.bandera, escudo: d.escudo,
        bolsa: d.bolsa, botiquin: d.botiquin, biblia: d.biblia,
        mat_tecnica: d.materiales.tecnica, mat_quizz: d.materiales.quizz, mat_juegos: d.materiales.juegos,
        cuotas: d.extras.cuotas, adeudo: d.extras.adeudo,
        puntos: fila.puntos,
      }, { onConflict: 'sesion_id,escuadra_id' }).select('id').single();
      if (error) throw error;

      const { error: errMiembros } = await sb.from('formacion_miembros').upsert(
        d.miembros.map((m, i) => ({
          formacion_id: data.id, posicion: i + 1,
          nombre: m.nombre.trim(), uniforme: m.uniforme, cursos: m.cursos.trim(), pruebas: m.pruebas.trim(),
        })),
        { onConflict: 'formacion_id,posicion' });
      if (errMiembros) throw errMiembros;
    }
  }
}
