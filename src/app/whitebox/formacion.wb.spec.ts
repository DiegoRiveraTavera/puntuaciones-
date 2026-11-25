import { Formacion } from '../pages/formacion/formacion';
import { DatosFormacion, FormacionParaGuardar, FormacionRepositorio, formacionVacia } from '../services/formacion/formacion-repositorio';

/**
 * PRÁCTICA 11 — White Box · Método de PROCESAMIENTO / CÁLCULO
 * pages/formacion/formacion.ts → getTotalPuntos(d) = getPuntosUniforme + getPuntosMateriales + getPuntosExtras
 *
 *  getMiembrosConUniforme: D1 ¿!d?  · filtro: m.uniforme && m.nombre.trim()   (C1, C2)
 *  getPuntosUniforme:      D2 ¿!d?  · D3 ¿d.uniformeJefe?
 *  getPuntosMateriales:    D4 ¿!d?  · (m.tecnica || 0) (m.quizz || 0) (m.juegos || 0)  → 3 decisiones implícitas
 *  getPuntosExtras:        D5 ¿!d?  · filter(Boolean) sobre 6 accesorios
 * Fórmula: 10 por miembro con nombre y uniforme + 10 por uniforme del jefe
 *        + 10 por cada material + 5 por cada accesorio.
 *
 * También se prueba guardar(), que valida y envía el cálculo a la base:
 *  D1 ¿guardando? · D2 ¿algún material <0 o no entero? (C: v<0, !isInteger)
 *  D3 ¿cuotas<0 || adeudo<0? · D4 ¿no hay filas? · try/catch del repositorio
 */

function datos(cambios: (d: DatosFormacion) => void = () => {}): DatosFormacion {
  const d = formacionVacia();
  cambios(d);
  return d;
}

class RepoFalso {
  enviados: FormacionParaGuardar[] = [];
  falla: unknown = null;
  async guardar(_fecha: string, filas: FormacionParaGuardar[]) {
    if (this.falla) throw this.falla;
    this.enviados = filas;
  }
}

describe('WHITE BOX · Formación — cálculo de puntos', () => {
  let f: Formacion;
  beforeEach(() => { f = new Formacion(new RepoFalso() as unknown as FormacionRepositorio); });

  it('WB-CAL-01 (D1..D5 verdaderas) sin escuadra seleccionada todo vale 0', () => {
    expect(f.getTotalPuntos()).toBe(0);
    expect(f.getMiembrosConUniforme()).toBe(0);
    expect(f.getAdeudo()).toBe(0);
  });

  it('WB-CAL-02 formación vacía (límite inferior) = 0 puntos', () => {
    expect(f.getTotalPuntos(datos())).toBe(0);
  });

  it('WB-CAL-03 condición C1 y C2: solo cuenta a quien tiene nombre Y uniforme', () => {
    const d = datos(x => {
      x.miembros[0] = { nombre: 'Ana', uniforme: true, cursos: '', pruebas: '' };   // C1=V C2=V → cuenta
      x.miembros[1] = { nombre: 'Luis', uniforme: false, cursos: '', pruebas: '' }; // C1=F       → no
      x.miembros[2] = { nombre: '   ', uniforme: true, cursos: '', pruebas: '' };   // C1=V C2=F → no
    });
    expect(f.getMiembrosConUniforme(d)).toBe(1);
    expect(f.getPuntosUniforme(d)).toBe(10);
  });

  it('WB-CAL-04 (D3=V) el uniforme del jefe suma 10', () => {
    expect(f.getPuntosUniforme(datos(x => (x.uniformeJefe = true)))).toBe(10);
  });

  it('WB-CAL-05 materiales: campos vacíos (null) cuentan como 0', () => {
    const d = datos(x => (x.materiales = { tecnica: 2, quizz: null as unknown as number, juegos: 1 }));
    expect(f.getPuntosMateriales(d)).toBe(30);
  });

  it('WB-CAL-06 accesorios: cada uno suma 5 (límite superior 6 × 5 = 30)', () => {
    const d = datos(x => { x.banderin = x.bandera = x.escudo = x.bolsa = x.botiquin = x.biblia = true; });
    expect(f.getPuntosExtras(d)).toBe(30);
  });

  it('WB-CAL-07 límite superior: 14 miembros + jefe + 3 materiales + 6 accesorios', () => {
    const d = datos(x => {
      x.miembros = x.miembros.map((_, i) => ({ nombre: `M${i}`, uniforme: true, cursos: '', pruebas: '' }));
      x.uniformeJefe = true;
      x.materiales = { tecnica: 1, quizz: 1, juegos: 1 };
      x.banderin = x.bandera = x.escudo = x.bolsa = x.botiquin = x.biblia = true;
    });
    expect(f.getTotalPuntos(d)).toBe(14 * 10 + 10 + 30 + 30);   // 210
  });

  it('WB-CAL-08 el adeudo pendiente es adeudo − cuotas', () => {
    f.seleccionar('ATL');
    f.datosActuales!.extras = { cuotas: 30, adeudo: 100 };
    expect(f.getAdeudo()).toBe(70);
  });
});

describe('WHITE BOX · Formación.guardar — validación, valores límite y excepciones', () => {
  let f: Formacion;
  let repo: RepoFalso;
  beforeEach(() => {
    repo = new RepoFalso();
    f = new Formacion(repo as unknown as FormacionRepositorio);
  });

  it('WB-CAL-09 (D4=V) sin escuadras no envía nada', async () => {
    await f.guardar();
    expect(f.errorGuardado()).toContain('Elige una escuadra');
    expect(repo.enviados.length).toBe(0);
  });

  it('WB-CAL-10 límite: material = 0 es válido y se envía con sus puntos calculados', async () => {
    f.seleccionar('ATL');
    f.datos['ATL'].uniformeJefe = true;
    await f.guardar();
    expect(f.errorGuardado()).toBe('');
    expect(f.guardado()).toBeTrue();
    expect(repo.enviados[0]).toEqual(jasmine.objectContaining({ escuadra: 'ATL', puntos: 10 }));
  });

  it('WB-CAL-11 (C v<0) límite: material = −1 se rechaza', async () => {
    f.seleccionar('ATL');
    f.datos['ATL'].materiales.quizz = -1;
    await f.guardar();
    expect(f.errorGuardado()).toContain('números enteros de 0 o más');
    expect(repo.enviados.length).toBe(0);
  });

  it('WB-CAL-12 (C !isInteger) material = 1.5 se rechaza', async () => {
    f.seleccionar('ATL');
    f.datos['ATL'].materiales.tecnica = 1.5;
    await f.guardar();
    expect(f.errorGuardado()).toContain('números enteros');
  });

  it('WB-CAL-13 (D3, C cuotas<0) cuotas negativas se rechazan', async () => {
    f.seleccionar('ATL');
    f.datos['ATL'].extras.cuotas = -0.01;
    await f.guardar();
    expect(f.errorGuardado()).toContain('no pueden ser negativos');
  });

  it('WB-CAL-14 (D3, C adeudo<0) adeudo negativo se rechaza', async () => {
    f.seleccionar('ATL');
    f.datos['ATL'].extras.adeudo = -5;
    await f.guardar();
    expect(f.errorGuardado()).toContain('no pueden ser negativos');
  });

  it('WB-CAL-15 (excepción) si la base falla, no se confirma el guardado y se explica el motivo', async () => {
    f.seleccionar('ATL');
    repo.falla = { code: '42501', message: 'new row violates row-level security policy' };
    await f.guardar();
    expect(f.guardado()).toBeFalse();
    expect(f.errorGuardado()).toBe('No tienes permiso para hacer esta operación.');
    expect(f.guardando()).withContext('el botón se vuelve a habilitar').toBeFalse();
  });

  it('WB-CAL-17 la confirmación "Guardado" se oculta a los 3 segundos (reloj simulado)', async () => {
    jasmine.clock().install();
    try {
      f.seleccionar('ATL');
      await f.guardar();
      expect(f.guardado()).toBeTrue();
      jasmine.clock().tick(2999);
      expect(f.guardado()).toBeTrue();
      jasmine.clock().tick(1);
      expect(f.guardado()).toBeFalse();
    } finally {
      jasmine.clock().uninstall();
    }
  });

  it('WB-CAL-16 (D1=V) un segundo clic mientras guarda no envía dos veces', async () => {
    f.seleccionar('ATL');
    f.guardando.set(true);
    await f.guardar();
    expect(repo.enviados.length).toBe(0);
  });
});
