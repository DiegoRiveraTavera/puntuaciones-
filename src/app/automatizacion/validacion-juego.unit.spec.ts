import { Juego } from '../services/juegos/juegos-repositorio';
import {
  asegurarJuegosValidos, ErrorValidacionJuego, validarJuego, validarJuegos, VALOR_MAXIMO,
} from '../services/juegos/validacion-juego';
import { conReintentos } from '../services/juegos/juegos-repositorio';
import { mensajeError } from '../services/supabase/supabase';

/**
 * PRÁCTICAS 13 y 14 — Automatización de pruebas
 * Fase 2 · PRUEBAS UNITARIAS de la lógica de negocio del guardado de juegos.
 *
 * Se prueban funciones puras, sin Angular, sin pantalla y sin red:
 *  · validarJuego / validarJuegos / asegurarJuegosValidos (services/juegos/validacion-juego.ts)
 *  · conReintentos (services/juegos/juegos-repositorio.ts) y mensajeError (services/supabase/supabase.ts)
 *
 * Matriz: AUT-01 entrada válida y resultado esperado · AUT-02 entrada vacía o nula ·
 *         AUT-03 valores fuera de rango y manejo de excepciones.
 */

/** Juego válido de referencia: 1 rol con 1 enfrentamiento ANK vs ATL que ganó ANK. */
function juego(cambios: Partial<Juego> = {}): Juego {
  return {
    id: 1, idCliente: '6f1d2c3b-0000-4000-8000-000000000001', nombre: 'Relevos', valor: 20,
    roles: [{ numero: 1, enfrentamientos: [{ escuadras: ['ANK', 'ATL'], ganador: 'ANK' }] }],
    ...cambios,
  };
}

describe('AUT-01 · Unitarias · entrada válida y resultado esperado', () => {
  it('U-AUT-01 un juego completo y correcto no tiene errores', () => {
    expect(validarJuego(juego())).toEqual([]);
  });

  it('U-AUT-02 acepta los límites exactos: valor 1, valor 1000 y nombre de 60 caracteres', () => {
    expect(validarJuego(juego({ valor: 1 }))).toEqual([]);
    expect(validarJuego(juego({ valor: VALOR_MAXIMO }))).toEqual([]);
    expect(validarJuego(juego({ nombre: 'J'.repeat(60) }))).toEqual([]);
  });

  it('U-AUT-03 un enfrentamiento todavía sin ganador es válido (se puede guardar a medias)', () => {
    const j = juego({ roles: [{ numero: 1, enfrentamientos: [{ escuadras: ['ANK', 'ATL', 'RRMS'], ganador: '' }] }] });
    expect(validarJuego(j)).toEqual([]);
  });

  it('U-AUT-04 resultado esperado: devuelve TODOS los problemas, cada uno con el lugar exacto', () => {
    const j = juego({
      nombre: 'Cuerda', valor: 0,
      roles: [
        { numero: 1, enfrentamientos: [{ escuadras: ['ANK', 'ank '], ganador: '' }] },   // repetida (mayúsculas y espacios)
        { numero: 2, enfrentamientos: [{ escuadras: ['ANK', ''], ganador: '' }] },       // solo 1 escuadra
      ],
    });
    expect(validarJuego(j)).toEqual([
      'El valor de «Cuerda» debe ser un número entero entre 1 y 1000.',
      'En «Cuerda», rol 1, enfrentamiento 1 hay una escuadra repetida.',
      'En «Cuerda», rol 2, enfrentamiento 1 elige al menos 2 escuadras.',
    ]);
  });
});

describe('AUT-02 · Unitarias · entrada vacía o nula', () => {
  it('U-AUT-05 un juego nulo o indefinido no truena y se reporta como "sin datos"', () => {
    expect(validarJuego(null)).toEqual(['El juego no tiene datos.']);
    expect(validarJuego(undefined)).toEqual(['El juego no tiene datos.']);
  });

  it('U-AUT-06 nombre vacío, con solo espacios o nulo → "necesita un nombre"', () => {
    for (const nombre of ['', '   ', null as unknown as string]) {
      expect(validarJuego(juego({ nombre }))).withContext(`nombre=${JSON.stringify(nombre)}`)
        .toEqual(['El juego necesita un nombre.']);
    }
  });

  it('U-AUT-07 lista de juegos vacía o nula: no hay nada que corregir', () => {
    expect(validarJuegos([])).toEqual([]);
    expect(validarJuegos(null)).toEqual([]);
    expect(() => asegurarJuegosValidos(undefined)).not.toThrow();
  });

  it('U-AUT-08 roles o escuadras nulos (datos viejos o incompletos) no rompen la validación', () => {
    const sinRoles = { ...juego(), roles: null } as unknown as Juego;
    expect(validarJuego(sinRoles)).toEqual([]);
    const sinEscuadras = juego({ roles: [{ numero: 1, enfrentamientos: [{ escuadras: null as unknown as string[], ganador: '' }] }] });
    expect(validarJuego(sinEscuadras)).toEqual(['En «Relevos», rol 1, enfrentamiento 1 elige al menos 2 escuadras.']);
  });
});

describe('AUT-03 · Unitarias · valores fuera de rango y manejo de excepciones', () => {
  it('U-AUT-09 valor fuera de rango o no entero: 0, -5, 1001, 2.5, NaN, Infinity y texto', () => {
    for (const valor of [0, -5, VALOR_MAXIMO + 1, 2.5, NaN, Infinity, '20' as unknown as number]) {
      expect(validarJuego(juego({ valor }))).withContext(`valor=${String(valor)}`)
        .toEqual(['El valor de «Relevos» debe ser un número entero entre 1 y 1000.']);
    }
  });

  it('U-AUT-10 nombre de 61 caracteres (la base admite 60) se rechaza', () => {
    expect(validarJuego(juego({ nombre: 'J'.repeat(61) })))
      .toEqual(['El nombre del juego no puede pasar de 60 caracteres.']);
  });

  it('U-AUT-11 una ganadora que no participa en el enfrentamiento se reporta', () => {
    const j = juego({ roles: [{ numero: 1, enfrentamientos: [{ escuadras: ['ANK', 'ATL'], ganador: 'RRMS' }] }] });
    expect(validarJuego(j)).toEqual(['En «Relevos», rol 1, enfrentamiento 1 la ganadora no participa en el enfrentamiento.']);
  });

  it('U-AUT-12 asegurarJuegosValidos lanza ErrorValidacionJuego con la lista completa', () => {
    const malos = [juego({ nombre: '' }), juego({ id: 2, valor: 5000 })];
    let error: unknown;
    try { asegurarJuegosValidos(malos); } catch (e) { error = e; }
    expect(error).toBeInstanceOf(ErrorValidacionJuego);
    expect((error as ErrorValidacionJuego).errores.length).toBe(2);
    expect((error as Error).message).toBe('El juego necesita un nombre.');
    // La pantalla muestra el mensaje de la regla, no el genérico del servidor
    expect(mensajeError(error)).toBe('El juego necesita un nombre.');
  });

  it('U-AUT-13 un error que no es de red (restricción de la base) se propaga sin reintentos', async () => {
    let intentos = 0;
    await expectAsync(conReintentos(async () => { intentos++; throw { code: '23514', message: 'check violation' }; },
      { dormir: async () => {} })).toBeRejectedWith(jasmine.objectContaining({ code: '23514' }));
    expect(intentos).toBe(1);
    expect(mensajeError({ code: '23514', message: 'check violation' })).toBe('Algún dato está fuera de los valores permitidos.');
  });

  it('U-AUT-14 un error desconocido (null o sin código) da un mensaje genérico, nunca una excepción', () => {
    expect(() => mensajeError(null)).not.toThrow();
    expect(mensajeError(null)).toBe('Ocurrió un error al comunicarse con el servidor.');
    expect(mensajeError({})).toBe('Ocurrió un error al comunicarse con el servidor.');
  });
});
