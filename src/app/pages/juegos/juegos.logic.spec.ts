import { Juegos } from './juegos';
import { Juego, JuegosRepositorio } from '../../services/juegos/juegos-repositorio';

/**
 * PRÁCTICA — Pirámide de pruebas
 * Fase 2: PRUEBAS UNITARIAS de la lógica de puntuación de Juegos.
 *
 * Se crea la clase directamente (`new Juegos()`), sin TestBed ni plantilla:
 * solo se prueba la lógica de negocio, aislada de Angular, del DOM y del navegador.
 * Dobles de prueba en `guardar()`: el temporizador (jasmine.clock) y la base de datos
 * (un repositorio falso que responde al instante, sin red).
 */

// Ayudante: crea un juego con un rol y un enfrentamiento entre las escuadras dadas
function crearJuegoConEnfrentamiento(j: Juegos, nombre: string, valor: number, escuadras: string[]) {
  j.nuevoNombre = nombre;
  j.nuevoValor = valor;
  j.agregarJuego();
  const juego = j.juegos[j.juegos.length - 1];
  j.agregarRol(juego);
  const rol = juego.roles[0];
  j.agregarEnfrentamiento(rol);
  const enf = rol.enfrentamientos[0];
  enf.escuadras = [...escuadras];
  return { juego, rol, enf };
}

describe('UNIT · Juegos — cálculo de puntuaciones', () => {
  let j: Juegos;

  beforeEach(() => {
    j = new Juegos();
  });

  // ─────────────── Caso válido ───────────────
  describe('Caso válido', () => {
    it('U-01 suma el valor del juego a la escuadra ganadora', () => {
      const { enf } = crearJuegoConEnfrentamiento(j, 'Tiro al blanco', 15, ['RRMS', 'ANK']);
      enf.ganador = 'ANK';

      expect(j.getPuntosEscuadra('ANK')).toBe(15);
      expect(j.getPuntosEscuadra('RRMS')).toBe(0);
    });

    it('U-02 acumula puntos de varios juegos y ordena el ranking de mayor a menor', () => {
      crearJuegoConEnfrentamiento(j, 'Tiro al blanco', 15, ['RRMS', 'ANK']).enf.ganador = 'ANK';
      crearJuegoConEnfrentamiento(j, 'Relevos', 20, ['RRMS', 'ATL']).enf.ganador = 'RRMS';
      crearJuegoConEnfrentamiento(j, 'Cuerda', 10, ['ANK', 'ATL']).enf.ganador = 'ANK';

      expect(j.getResumen()).toEqual([
        { nombre: 'ANK', puntos: 25 },
        { nombre: 'RRMS', puntos: 20 },
      ]);
    });
  });

  // ─────────────── Casos límite ───────────────
  describe('Casos límite', () => {
    it('U-03 un enfrentamiento sin ganador no reparte puntos y el resumen queda vacío', () => {
      crearJuegoConEnfrentamiento(j, 'Tiro al blanco', 15, ['RRMS', 'ANK']);

      expect(j.getPuntosEscuadra('RRMS')).toBe(0);
      expect(j.getPuntosEscuadra('ANK')).toBe(0);
      expect(j.getResumen()).toEqual([]);
    });

    it('U-04 acepta el valor mínimo permitido (1 punto)', () => {
      const { enf } = crearJuegoConEnfrentamiento(j, 'Mínimo', 1, ['RRMS', 'ANK']);
      enf.ganador = 'RRMS';

      expect(j.juegos.length).toBe(1);
      expect(j.getPuntosEscuadra('RRMS')).toBe(1);
    });

    it('U-05 no deja un enfrentamiento con menos de 2 escuadras', () => {
      const { enf } = crearJuegoConEnfrentamiento(j, 'Relevos', 20, ['RRMS', 'ANK']);
      j.quitarEscuadraDelEnfrentamiento(enf, 0);

      expect(enf.escuadras).toEqual(['RRMS', 'ANK']);
    });

    it('U-06 al eliminar un rol, los roles restantes se renumeran', () => {
      const { juego } = crearJuegoConEnfrentamiento(j, 'Relevos', 20, ['RRMS', 'ANK']);
      j.agregarRol(juego);
      j.agregarRol(juego);
      j.eliminarRol(juego, 0);

      expect(juego.roles.map(r => r.numero)).toEqual([1, 2]);
    });
  });

  // ─────────────── Casos inválidos ───────────────
  describe('Casos inválidos', () => {
    const invalidos: [string, string, number][] = [
      ['nombre vacío', '', 10],
      ['nombre con solo espacios', '   ', 10],
      ['valor 0', 'Carrera', 0],
      ['valor negativo', 'Carrera', -5],
    ];

    invalidos.forEach(([caso, nombre, valor], i) => {
      it(`U-${String(7 + i).padStart(2, "0")} rechaza un juego con ${caso}`, () => {
        j.nuevoNombre = nombre;
        j.nuevoValor = valor;
        j.agregarJuego();

        expect(j.juegos.length).toBe(0);
        expect(j.juegoActivo).toBeNull();
      });
    });
  });

  // ─────────────── Caso de error (defecto conocido) ───────────────
  describe('Caso de error', () => {
    it('U-11 al quitar a la escuadra ganadora se limpia el ganador y pierde sus puntos', () => {
      const { enf } = crearJuegoConEnfrentamiento(j, 'Relevos', 20, ['RRMS', 'ANK', 'ATL']);
      enf.ganador = 'ANK';

      j.quitarEscuadraDelEnfrentamiento(enf, 1); // se quita ANK

      expect(enf.escuadras).toEqual(['RRMS', 'ATL']);
      expect(enf.ganador).withContext('ganador después de quitar a ANK').toBe('');
      expect(j.getPuntosEscuadra('ANK')).withContext('puntos de ANK').toBe(0);
    });
  });

  // ─────────────── Doble de prueba: temporizador ───────────────
  describe('Guardar (con reloj simulado)', () => {
    beforeEach(() => jasmine.clock().install());
    afterEach(() => jasmine.clock().uninstall());

    it('U-12 muestra la confirmación y la oculta a los 3 segundos', async () => {
      // Repositorio falso: confirma el guardado sin conectarse a Supabase
      const repo = {
        guardar: jasmine.createSpy('guardar').and.callFake(async (_f: string, juegos: Juego[]) =>
          new Map(juegos.map((x, i) => [x.id, i + 1]))),
      } as unknown as JuegosRepositorio;
      j = new Juegos(repo);
      crearJuegoConEnfrentamiento(j, 'Relevos', 20, ['RRMS', 'ANK']);

      await j.guardar();
      expect(repo.guardar).toHaveBeenCalledTimes(1);
      expect(j.guardado()).toBeTrue();
      expect(j.juegos[0].dbId).withContext('id asignado por la base').toBe(1);

      jasmine.clock().tick(2999);
      expect(j.guardado()).toBeTrue();

      jasmine.clock().tick(1);
      expect(j.guardado()).toBeFalse();
    });

    it('U-13 si la base rechaza el guardado, no confirma y muestra el motivo', async () => {
      const repo = {
        guardar: async () => { throw new TypeError('Failed to fetch'); },
      } as unknown as JuegosRepositorio;
      j = new Juegos(repo);
      crearJuegoConEnfrentamiento(j, 'Relevos', 20, ['RRMS', 'ANK']);

      await j.guardar();
      expect(j.guardado()).toBeFalse();
      expect(j.errorGuardado()).toContain('Sin conexión');
    });
  });
});
