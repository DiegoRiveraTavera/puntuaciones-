import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { fetchConLimite } from '../supabase/supabase';

/**
 * ClimaService — clima actual del punto de reunión y recomendación de actividad.
 *
 * Usa la API pública de Open-Meteo (https://open-meteo.com): no necesita llave ni registro.
 * Por defecto consulta el punto de reunión del escuadrón; si la jefatura lo pide, usa la
 * ubicación del celular (GPS) con el plugin @capacitor/geolocation.
 */

export interface Coordenadas {
  latitud: number;
  longitud: number;
}

export interface Lugar extends Coordenadas {
  nombre: string;
}

/** Punto de reunión del Escuadrón Moriah (Santiago de Querétaro). */
export const PUNTO_REUNION: Lugar = { nombre: 'Punto de reunión (Querétaro)', latitud: 20.5931, longitud: -100.3922 };

export const URL_CLIMA = 'https://api.open-meteo.com/v1/forecast';

export interface ClimaActual {
  temperatura: number;     // °C
  sensacion: number;       // °C
  humedad: number;         // %
  precipitacion: number;   // mm en la última hora
  viento: number;          // km/h
  codigo: number;          // código WMO del estado del tiempo
  condicion: string;       // descripción en español
  icono: string;
  hora: string;            // hora local de la medición (YYYY-MM-DDTHH:mm)
}

export type LugarActividad = 'aire libre' | 'bajo techo';

export interface Recomendacion {
  lugar: LugarActividad;
  motivo: string;
}

/** Límites que deciden la recomendación. */
export const LIMITES = { calor: 32, frio: 8, viento: 40, lluvia: 0.5 };

/** Traduce el código WMO de Open-Meteo a una descripción y un ícono. */
export function describirCodigo(codigo: number): { condicion: string; icono: string } {
  if (codigo === 0) return { condicion: 'Despejado', icono: '☀️' };
  if (codigo === 1 || codigo === 2) return { condicion: 'Parcialmente nublado', icono: '⛅' };
  if (codigo === 3) return { condicion: 'Nublado', icono: '☁️' };
  if (codigo === 45 || codigo === 48) return { condicion: 'Neblina', icono: '🌫️' };
  if (codigo >= 51 && codigo <= 57) return { condicion: 'Llovizna', icono: '🌦️' };
  if (codigo >= 61 && codigo <= 67) return { condicion: 'Lluvia', icono: '🌧️' };
  if ((codigo >= 71 && codigo <= 77) || codigo === 85 || codigo === 86) return { condicion: 'Nieve o granizo', icono: '🌨️' };
  if (codigo >= 80 && codigo <= 82) return { condicion: 'Chubascos', icono: '🌧️' };
  if (codigo >= 95 && codigo <= 99) return { condicion: 'Tormenta eléctrica', icono: '⛈️' };
  return { condicion: 'Sin datos del cielo', icono: '🌡️' };
}

/**
 * Decide si conviene hacer la actividad al aire libre o bajo techo.
 * El orden importa: primero lo peligroso (tormenta), luego lo que moja, luego viento y temperatura.
 */
export function recomendar(clima: ClimaActual): Recomendacion {
  const { codigo, precipitacion, viento, temperatura, sensacion } = clima;
  if (codigo >= 95 && codigo <= 99) return { lugar: 'bajo techo', motivo: 'Hay tormenta eléctrica: no es seguro estar al aire libre.' };
  if ((codigo >= 71 && codigo <= 77) || codigo === 85 || codigo === 86) return { lugar: 'bajo techo', motivo: 'Está cayendo nieve o granizo.' };
  if ((codigo >= 51 && codigo <= 67) || (codigo >= 80 && codigo <= 82) || precipitacion >= LIMITES.lluvia) {
    return { lugar: 'bajo techo', motivo: 'Está lloviendo en el punto de reunión.' };
  }
  if (viento >= LIMITES.viento) return { lugar: 'bajo techo', motivo: `Hay viento fuerte (${Math.round(viento)} km/h).` };
  if (Math.max(temperatura, sensacion) >= LIMITES.calor) {
    return { lugar: 'bajo techo', motivo: `Hace mucho calor (${Math.round(Math.max(temperatura, sensacion))} °C): busquen sombra o un lugar techado.` };
  }
  if (Math.min(temperatura, sensacion) <= LIMITES.frio) {
    return { lugar: 'bajo techo', motivo: `Hace mucho frío (${Math.round(Math.min(temperatura, sensacion))} °C).` };
  }
  if (codigo === 45 || codigo === 48) return { lugar: 'aire libre', motivo: 'Se puede salir, pero hay neblina: cuiden la visibilidad.' };
  return { lugar: 'aire libre', motivo: 'Buen clima para la actividad al aire libre.' };
}

/** Convierte la respuesta de Open-Meteo en ClimaActual; lanza un error si falta algún dato. */
export function leerRespuesta(cuerpo: unknown): ClimaActual {
  const actual = (cuerpo as { current?: Record<string, unknown> } | null)?.current;
  const num = (clave: string) => {
    const v = actual?.[clave];
    if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`La respuesta del clima no trae ${clave}.`);
    return v;
  };
  const codigo = num('weather_code');
  return {
    temperatura: num('temperature_2m'),
    sensacion: num('apparent_temperature'),
    humedad: num('relative_humidity_2m'),
    precipitacion: num('precipitation'),
    viento: num('wind_speed_10m'),
    codigo,
    ...describirCodigo(codigo),
    hora: typeof actual?.['time'] === 'string' ? (actual['time'] as string) : '',
  };
}

/** Mensaje claro para la pantalla cuando no se pudo consultar el clima. */
export function mensajeClima(error: unknown): string {
  const msg = String((error as Error)?.message ?? error ?? '').toLowerCase();
  if (msg.includes('ubicación') || msg.includes('location') || msg.includes('permission')) {
    return 'No se pudo usar tu ubicación. Revisa el permiso de ubicación del celular.';
  }
  if (msg.includes('tiempo de espera') || msg.includes('failed to fetch') || msg.includes('network') || msg.includes('load failed')) {
    return 'No se pudo consultar el clima. Revisa tu conexión a internet.';
  }
  return 'El servicio de clima no está disponible en este momento.';
}

@Injectable({ providedIn: 'root' })
export class ClimaService {
  /** Arma la dirección de la consulta a Open-Meteo. */
  url(lugar: Coordenadas): string {
    const variables = 'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m';
    return `${URL_CLIMA}?latitude=${lugar.latitud.toFixed(4)}&longitude=${lugar.longitud.toFixed(4)}&current=${variables}&timezone=auto`;
  }

  /** Clima actual de un lugar (por defecto, el punto de reunión). Corta a los 10 s si no hay respuesta. */
  async consultar(lugar: Coordenadas = PUNTO_REUNION): Promise<ClimaActual> {
    if (!Number.isFinite(lugar?.latitud) || !Number.isFinite(lugar?.longitud)
      || Math.abs(lugar.latitud) > 90 || Math.abs(lugar.longitud) > 180) {
      throw new Error('Coordenadas inválidas.');
    }
    const respuesta = await fetchConLimite(this.url(lugar));
    if (!respuesta.ok) throw new Error(`El servicio de clima respondió ${respuesta.status}.`);
    return leerRespuesta(await respuesta.json());
  }

  /** Ubicación actual del celular. En Android pide el permiso de ubicación la primera vez. */
  async ubicacionActual(): Promise<Coordenadas> {
    if (Capacitor.isNativePlatform()) {
      const permiso = await Geolocation.requestPermissions({ permissions: ['coarseLocation'] });
      if (permiso.coarseLocation !== 'granted' && permiso.location !== 'granted') {
        throw new Error('Permiso de ubicación denegado.');
      }
    }
    const posicion = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 });
    return { latitud: posicion.coords.latitude, longitud: posicion.coords.longitude };
  }
}
