import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Juegos } from './juegos';
import { Tecnica } from '../tecnica/tecnica';
import { TecnicaRepositorio, CalificacionBD, FilaParaGuardar } from '../../services/tecnica/tecnica-repositorio';
import { Juego, JuegosRepositorio } from '../../services/juegos/juegos-repositorio';
import { config as rxjsConfig } from 'rxjs';

/**
 * PRÁCTICA — Pirámide de pruebas
 * Fase 3: PRUEBAS DE INTEGRACIÓN.
 *
 * I-01 a I-03 y I-10: componente Juegos + su plantilla real (juegos.html) + FormsModule (ngModel).
 *   Se escribe en los campos, se eligen opciones y se pulsan botones en el DOM, y se comprueba
 *   que la lógica y la vista se actualizan juntas. La base de datos (Supabase) se sustituye por
 *   un repositorio en memoria para no depender de internet.
 * I-04 a I-06: componente Técnica + plantilla + HttpClient. Se verifica la petición HTTP que
 *   el componente envía al servidor. El servidor se sustituye por HttpTestingController.
 */

// ── Ayudantes para interactuar con el DOM como un usuario ──
async function estable(f: ComponentFixture<unknown>) {
  f.detectChanges();
  await f.whenStable();
  f.detectChanges();
}
function q<T extends Element>(f: ComponentFixture<unknown>, sel: string): T {
  const el = (f.nativeElement as HTMLElement).querySelector<T>(sel);
  if (!el) throw new Error(`No se encontró "${sel}" en la pantalla`);
  return el;
}
function qa<T extends Element>(f: ComponentFixture<unknown>, sel: string): T[] {
  return Array.from((f.nativeElement as HTMLElement).querySelectorAll<T>(sel));
}
async function escribir(f: ComponentFixture<unknown>, input: HTMLInputElement, valor: string) {
  input.value = valor;
  input.dispatchEvent(new Event('input'));
  await estable(f);
}
async function elegir(f: ComponentFixture<unknown>, select: HTMLSelectElement, valor: string) {
  select.value = valor;
  select.dispatchEvent(new Event('change'));
  await estable(f);
}
async function clic(f: ComponentFixture<unknown>, boton: HTMLElement) {
  boton.click();
  await estable(f);
}
function botonConTexto(f: ComponentFixture<unknown>, texto: string): HTMLButtonElement {
  const b = qa<HTMLButtonElement>(f, 'button').find(x => x.textContent?.trim().includes(texto));
  if (!b) throw new Error(`No hay botón "${texto}"`);
  return b;
}

const proveedores = () => [
  provideZonelessChangeDetection(),
  provideRouter([]),
  provideHttpClient(),
  provideHttpClientTesting(), // el buscador del menú usa HTTP; aquí no se prueba
];

/** Doble del repositorio de Juegos: la base de datos se simula en memoria. */
class RepoJuegosFalso {
  guardados: Juego[] = [];
  cargar = jasmine.createSpy('cargar').and.callFake(async () => ({
    escuadras: ['RRMS', 'ANK', 'ATL'],
    juegos: structuredClone(this.guardados),
  }));
  guardar = jasmine.createSpy('guardar').and.callFake(async (_fecha: string, juegos: Juego[]) => {
    const ids = new Map(juegos.map((j, i) => [j.id, j.dbId ?? 100 + i]));
    this.guardados = structuredClone(juegos).map(j => ({ ...j, dbId: ids.get(j.id) }));
    return ids;
  });
}

describe('INTEGRACIÓN · Juegos — formulario, lógica y vista', () => {
  let f: ComponentFixture<Juegos>;
  let repoJuegos: RepoJuegosFalso;

  beforeEach(async () => {
    repoJuegos = new RepoJuegosFalso();
    await TestBed.configureTestingModule({
      imports: [Juegos],
      providers: [...proveedores(), { provide: JuegosRepositorio, useValue: repoJuegos }],
    }).compileComponents();
    f = TestBed.createComponent(Juegos);
    await estable(f);
  });

  async function crearJuegoDesdeFormulario(nombre: string, valor: string) {
    await escribir(f, q(f, 'input[placeholder^="Nombre del juego"]'), nombre);
    await escribir(f, q(f, 'input[placeholder="Valor (pts)"]'), valor);
    await clic(f, botonConTexto(f, '+ Agregar'));
  }

  it('I-01 flujo correcto: crear juego, registrar ganador y ver los puntos en el resumen', async () => {
    await crearJuegoDesdeFormulario('Tiro al blanco', '15');
    expect(qa(f, '.tab-juego').length).withContext('pestañas de juego').toBe(1);

    await clic(f, botonConTexto(f, '+ Agregar rol'));
    await clic(f, botonConTexto(f, '+ Enfrentamiento'));

    const selects = qa<HTMLSelectElement>(f, '.escuadra-select select');
    await elegir(f, selects[0], 'RRMS');
    await elegir(f, selects[1], 'ANK');
    await elegir(f, q(f, '.ganador-select select'), 'ANK');

    const resumen = qa<HTMLElement>(f, '.ranking-item');
    expect(resumen.length).toBe(1);
    expect(resumen[0].textContent).toContain('ANK');
    expect(resumen[0].textContent).toContain('15 pts');
  });

  it('I-02 error: el formulario rechaza un juego con valor 0 y no crea nada en pantalla', async () => {
    await crearJuegoDesdeFormulario('Carrera', '0');
    expect(qa(f, '.tab-juego').length).toBe(0);

    await crearJuegoDesdeFormulario('', '10');
    expect(qa(f, '.tab-juego').length).toBe(0);
    expect(f.componentInstance.juegos.length).toBe(0);
  });

  it('I-03 error: al quitar a la ganadora desde la pantalla, el resumen debe dejar de mostrarla', async () => {
    await crearJuegoDesdeFormulario('Relevos', '20');
    await clic(f, botonConTexto(f, '+ Agregar rol'));
    await clic(f, botonConTexto(f, '+ Enfrentamiento'));
    await clic(f, botonConTexto(f, '+ escuadra'));

    const selects = qa<HTMLSelectElement>(f, '.escuadra-select select');
    await elegir(f, selects[0], 'RRMS');
    await elegir(f, selects[1], 'ANK');
    await elegir(f, selects[2], 'ATL');
    await elegir(f, q(f, '.ganador-select select'), 'ANK');
    expect(q(f, '.ranking-item').textContent).toContain('ANK');

    // Botón ✕ de la segunda escuadra (ANK)
    await clic(f, qa<HTMLElement>(f, '.escuadra-select')[1].querySelector('.btn-quitar') as HTMLElement);

    expect(qa(f, '.escuadra-select select').length).toBe(2);
    expect(qa(f, '.ranking-item').length).withContext('escuadras con puntos en el resumen').toBe(0);
  });

  it('I-10 al guardar se envía a la base y, al volver a entrar, el juego y su ganador siguen ahí', async () => {
    await crearJuegoDesdeFormulario('Tiro al blanco', '15');
    await clic(f, botonConTexto(f, '+ Agregar rol'));
    await clic(f, botonConTexto(f, '+ Enfrentamiento'));
    const selects = qa<HTMLSelectElement>(f, '.escuadra-select select');
    await elegir(f, selects[0], 'RRMS');
    await elegir(f, selects[1], 'ATL');
    await elegir(f, q(f, '.ganador-select select'), 'ATL');

    await clic(f, botonConTexto(f, 'Guardar'));
    expect(repoJuegos.guardar).toHaveBeenCalledTimes(1);
    expect(q(f, '.msg-guardado').textContent).toContain('Guardado correctamente');

    // Se vuelve a abrir la pantalla: los datos vienen de la "base"
    f.destroy();
    f = TestBed.createComponent(Juegos);
    await estable(f);
    expect(qa(f, '.tab-juego').length).toBe(1);
    expect(q(f, '.ranking-item').textContent).toContain('ATL');
    expect(q(f, '.ranking-item').textContent).toContain('15 pts');
  });
});

/**
 * Doble del repositorio de Técnica: simula la base de datos de Supabase en memoria,
 * con la misma regla de versiones que la base real (un update con versión vieja no cambia nada).
 */
class RepoFalso {
  filas: (CalificacionBD & { escuadra: string })[] = [];
  sinConexion = false;
  private sigId = 1;
  cargar = jasmine.createSpy('cargar').and.callFake(async () => ({
    escuadras: [{ id: 1, nombre: 'RRMS' }, { id: 2, nombre: 'ANK' }, { id: 3, nombre: 'ATL' }],
    calificaciones: this.filas.map(({ escuadra, ...c }) => c),
    fotos: {}, sesionId: 7,
  }));
  guardar = jasmine.createSpy('guardar').and.callFake(async (_fecha: string, filas: FilaParaGuardar[]) => {
    if (this.sinConexion) throw new TypeError('Failed to fetch');
    const r = { guardadas: [] as (CalificacionBD & { escuadra: string })[], conflictos: [] as string[] };
    for (const fila of filas) {
      const ids: Record<string, number> = { RRMS: 1, ANK: 2, ATL: 3 };
      const actual = this.filas.find(x => x.escuadra === fila.escuadra);
      if (actual && (fila.version === undefined || actual.version !== fila.version)) { r.conflictos.push(fila.escuadra); continue; }
      if (actual) { Object.assign(actual, fila.valores, { version: actual.version + 1 }); r.guardadas.push({ ...actual }); }
      else {
        const nueva = { id: this.sigId++, escuadra_id: ids[fila.escuadra], version: 1, escuadra: fila.escuadra, ...fila.valores };
        this.filas.push(nueva); r.guardadas.push({ ...nueva });
      }
    }
    return r;
  });
  subirFoto = jasmine.createSpy('subirFoto').and.resolveTo('https://fotos/x.jpg');
  suscribir = jasmine.createSpy('suscribir').and.returnValue(() => {});
}

describe('INTEGRACIÓN · Técnica — componente, base de datos (doble) y cliente HTTP', () => {
  let f: ComponentFixture<Tecnica>;
  let http: HttpTestingController;
  let repo: RepoFalso;

  beforeEach(async () => {
    repo = new RepoFalso();
    await TestBed.configureTestingModule({
      imports: [Tecnica],
      providers: [...proveedores(), { provide: TecnicaRepositorio, useValue: repo }],
    }).compileComponents();
    f = TestBed.createComponent(Tecnica);
    http = TestBed.inject(HttpTestingController);
    await estable(f);
    await esperar(f);
  });

  afterEach(() => http.verify()); // falla si quedó alguna petición sin revisar

  async function esperar(fx: ComponentFixture<unknown>) {
    for (let i = 0; i < 3; i++) { await new Promise(r => setTimeout(r, 0)); await estable(fx); }
  }

  async function calificar(fila: number, notas: string[]) {
    const inputs = qa<HTMLInputElement>(f, '.tabla-tecnica tbody tr')[fila].querySelectorAll('input');
    for (let i = 0; i < 5; i++) await escribir(f, inputs[i] as HTMLInputElement, notas[i]);
  }

  it('I-04 al guardar, registra en la base y envía al reloj la escuadra líder', async () => {
    await calificar(0, ['8', '7', '9', '6', '10']); // RRMS = 40
    await calificar(1, ['9', '9', '9', '9', '9']);  // ANK  = 45
    await clic(f, botonConTexto(f, 'Guardar calificaciones'));
    await esperar(f);

    expect(repo.guardar).toHaveBeenCalledTimes(1);
    expect(repo.filas.map(x => [x.escuadra, x.version])).toEqual([['RRMS', 1], ['ANK', 1]]);
    const req = http.expectOne('/api/notificaciones/tecnica');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ escuadra: 'ANK', puntos: 45 });
    req.flush({ ok: true });
    await estable(f);

    expect(q(f, '.msg-guardado').textContent).toContain('Calificaciones guardadas');
  });

  it('I-05 sin calificaciones no guarda ni envía ninguna notificación', async () => {
    await clic(f, botonConTexto(f, 'Guardar calificaciones'));
    await esperar(f);
    expect(repo.guardar).not.toHaveBeenCalled();
    expect(q(f, '[role=alert]').textContent).toContain('No hay cambios por guardar');
    http.expectNone('/api/notificaciones/tecnica');
  });

  it('I-06 si el reloj no responde, las calificaciones quedan guardadas y se avisa del error', async () => {
    let errorSinManejar: unknown = null;
    const original = rxjsConfig.onUnhandledError;
    rxjsConfig.onUnhandledError = err => (errorSinManejar = err);
    try {
      await calificar(0, ['10', '10', '10', '10', '10']);
      await clic(f, botonConTexto(f, 'Guardar calificaciones'));
      await esperar(f);

      http.expectOne('/api/notificaciones/tecnica')
        .flush({ error: 'Error' }, { status: 500, statusText: 'Internal Server Error' });
      await new Promise(r => setTimeout(r, 0));
      await estable(f);

      const texto = (f.nativeElement as HTMLElement).textContent ?? '';
      expect(errorSinManejar === null).withContext('el error HTTP se maneja').toBeTrue();
      expect(repo.filas.length).withContext('la calificación quedó en la base').toBe(1);
      expect(/no se pudo notificar/i.test(texto)).withContext('la pantalla avisa del reloj').toBeTrue();
    } finally {
      rxjsConfig.onUnhandledError = original;
    }
  });

  it('I-07 sin conexión no confirma el guardado y conserva lo escrito', async () => {
    repo.sinConexion = true;
    await calificar(0, ['8', '8', '8', '8', '8']);
    await clic(f, botonConTexto(f, 'Guardar calificaciones'));
    await esperar(f);

    const texto = (f.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('Sin conexión con el servidor. No se guardó');
    expect(texto.includes('Calificaciones guardadas')).withContext('no hay confirmación falsa').toBeFalse();
    expect(q(f, '.tabla-tecnica tbody tr .total').textContent).toContain('40');
    http.expectNone('/api/notificaciones/tecnica');
  });

  it('I-08 si otra persona cambió la calificación, no se sobrescribe y se avisa del conflicto', async () => {
    await calificar(0, ['8', '8', '8', '8', '8']);
    await clic(f, botonConTexto(f, 'Guardar calificaciones'));
    await esperar(f);
    http.expectOne('/api/notificaciones/tecnica').flush({ ok: true });

    // Otro celular guarda RRMS mientras tanto (versión 1 → 2)
    Object.assign(repo.filas[0], { fuerza: 5, version: 2 });

    await calificar(0, ['10', '10', '10', '10', '10']);
    await clic(f, botonConTexto(f, 'Guardar calificaciones'));
    await esperar(f);

    expect(repo.filas[0].fuerza).withContext('la base conserva el cambio de la otra persona').toBe(5);
    expect(q(f, '.msg-aviso').textContent).toContain('CONFLICTO');
    expect(q(f, '.tabla-tecnica tbody tr .total').textContent).withContext('se recargan los datos de la base').toContain('37');
  });

  it('I-09 la calificación guardada se vuelve a mostrar al abrir la pantalla otra vez', async () => {
    await calificar(1, ['7', '7', '7', '7', '7']);
    await clic(f, botonConTexto(f, 'Guardar calificaciones'));
    await esperar(f);
    http.expectOne('/api/notificaciones/tecnica').flush({ ok: true });

    const otra = TestBed.createComponent(Tecnica);
    await estable(otra); await esperar(otra);
    const totales = Array.from((otra.nativeElement as HTMLElement).querySelectorAll('.tabla-tecnica tbody tr .total')).map(t => t.textContent);
    expect(totales[1]).toContain('35');
  });
});
