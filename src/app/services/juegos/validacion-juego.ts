import type { Juego } from './juegos-repositorio';

/**
 * PRÁCTICA 13-14 — Reglas de negocio de un juego, revisadas ANTES de enviarlo al servidor.
 *
 * Antes, un juego con datos incompletos (una escuadra repetida, un enfrentamiento con un
 * solo participante, un valor de 2000 por error de captura) se enviaba tal cual y la base
 * lo guardaba sin avisar o lo rechazaba con un mensaje genérico. Ahora la pantalla dice
 * exactamente qué corregir y no hace ninguna petición.
 *
 * Los límites coinciden con la base (supabase/01_esquema_puntuaciones.sql):
 *  · juegos.nombre: 1 a 60 caracteres · juegos.valor: mayor que 0
 *  · el máximo de 1000 puntos es una regla de la app para detectar errores de captura.
 */
export const VALOR_MINIMO = 1;
export const VALOR_MAXIMO = 1000;
export const LARGO_MAXIMO_NOMBRE = 60;

/** Error que se lanza cuando un juego no cumple las reglas; trae la lista completa. */
export class ErrorValidacionJuego extends Error {
  constructor(readonly errores: string[]) {
    super(errores[0] ?? 'El juego no es válido.');
    this.name = 'ErrorValidacionJuego';
  }
}

const normalizar = (nombre: string | null | undefined) => (nombre ?? '').trim().toUpperCase();

/**
 * Revisa un juego y devuelve los problemas encontrados (lista vacía = juego válido).
 * Acepta null/undefined para que una pantalla sin datos no truene.
 */
export function validarJuego(juego: Juego | null | undefined): string[] {
  if (!juego) return ['El juego no tiene datos.'];
  const errores: string[] = [];
  const nombre = (juego.nombre ?? '').trim();
  const etiqueta = nombre ? `«${nombre}»` : 'el juego';

  if (!nombre) errores.push('El juego necesita un nombre.');
  else if (nombre.length > LARGO_MAXIMO_NOMBRE) {
    errores.push(`El nombre del juego no puede pasar de ${LARGO_MAXIMO_NOMBRE} caracteres.`);
  }

  const valor = juego.valor as unknown;
  if (typeof valor !== 'number' || !Number.isInteger(valor) || valor < VALOR_MINIMO || valor > VALOR_MAXIMO) {
    errores.push(`El valor de ${etiqueta} debe ser un número entero entre ${VALOR_MINIMO} y ${VALOR_MAXIMO}.`);
  }

  (juego.roles ?? []).forEach(rol => {
    (rol.enfrentamientos ?? []).forEach((enf, i) => {
      const donde = `${etiqueta}, rol ${rol.numero}, enfrentamiento ${i + 1}`;
      const escuadras = (enf.escuadras ?? []).map(normalizar).filter(Boolean);
      if (escuadras.length < 2) errores.push(`En ${donde} elige al menos 2 escuadras.`);
      else if (new Set(escuadras).size !== escuadras.length) errores.push(`En ${donde} hay una escuadra repetida.`);
      const ganador = normalizar(enf.ganador);
      if (ganador && !escuadras.includes(ganador)) errores.push(`En ${donde} la ganadora no participa en el enfrentamiento.`);
    });
  });
  return errores;
}

/** Revisa todos los juegos de la sesión. */
export function validarJuegos(juegos: (Juego | null | undefined)[] | null | undefined): string[] {
  return (juegos ?? []).flatMap(validarJuego);
}

/** Igual que validarJuegos, pero lanza ErrorValidacionJuego si hay algún problema. */
export function asegurarJuegosValidos(juegos: (Juego | null | undefined)[] | null | undefined): void {
  const errores = validarJuegos(juegos);
  if (errores.length) throw new ErrorValidacionJuego(errores);
}
