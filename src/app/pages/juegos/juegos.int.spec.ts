import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Juegos } from './juegos';
import { Tecnica } from '../tecnica/tecnica';
import { config as rxjsConfig } from 'rxjs';

/**
 * PRÁCTICA — Pirámide de pruebas
 * Fase 3: PRUEBAS DE INTEGRACIÓN.
 *
 * I-01 a I-03: componente Juegos + su plantilla real (juegos.html) + FormsModule (ngModel).
 *   No hay mocks: se escribe en los campos, se eligen opciones y se pulsan botones en el DOM,
 *   y se comprueba que la lógica y la vista se actualizan juntas.
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

describe('INTEGRACIÓN · Juegos — formulario, lógica y vista', () => {
  let f: ComponentFixture<Juegos>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Juegos], providers: proveedores() }).compileComponents();
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
});

describe('INTEGRACIÓN · Técnica — componente y cliente HTTP', () => {
  let f: ComponentFixture<Tecnica>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Tecnica], providers: proveedores() }).compileComponents();
    f = TestBed.createComponent(Tecnica);
    http = TestBed.inject(HttpTestingController);
    await estable(f);
  });

  afterEach(() => http.verify()); // falla si quedó alguna petición sin revisar

  async function calificar(fila: number, notas: string[]) {
    const inputs = qa<HTMLInputElement>(f, '.tabla-tecnica tbody tr')[fila].querySelectorAll('input');
    for (let i = 0; i < 5; i++) await escribir(f, inputs[i] as HTMLInputElement, notas[i]);
  }

  it('I-04 al guardar, envía al servidor la escuadra líder y su total', async () => {
    await calificar(0, ['8', '7', '9', '6', '10']); // RRMS = 40
    await calificar(1, ['9', '9', '9', '9', '9']);  // ANK  = 45
    await clic(f, botonConTexto(f, 'Guardar calificaciones'));

    const req = http.expectOne('/api/notificaciones/tecnica');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ escuadra: 'ANK', puntos: 45 });
    req.flush({ ok: true });
    await estable(f); // la confirmación aparece cuando el servidor responde bien

    expect(q(f, '.msg-guardado').textContent).toContain('Calificaciones guardadas');
  });

  it('I-05 sin calificaciones no envía ninguna notificación', async () => {
    await clic(f, botonConTexto(f, 'Guardar calificaciones'));
    http.expectNone('/api/notificaciones/tecnica');
  });

  it('I-06 si el servidor responde con error, se maneja y la pantalla avisa que no se notificó', async () => {
    // Se captura cualquier error que el componente deje sin manejar, para registrarlo
    // sin que detenga el resto de la corrida.
    let errorSinManejar: unknown = null;
    const original = rxjsConfig.onUnhandledError;
    rxjsConfig.onUnhandledError = err => (errorSinManejar = err);
    try {
      await calificar(0, ['10', '10', '10', '10', '10']);
      await clic(f, botonConTexto(f, 'Guardar calificaciones'));

      http.expectOne('/api/notificaciones/tecnica')
        .flush({ error: 'Error' }, { status: 500, statusText: 'Internal Server Error' });
      await new Promise(r => setTimeout(r, 0)); // rxjs reporta el error en el siguiente ciclo
      await estable(f);

      const texto = (f.nativeElement as HTMLElement).textContent ?? '';
      expect(errorSinManejar === null)
        .withContext(`el error HTTP se maneja (se recibió: ${(errorSinManejar as Error)?.message ?? 'nada'})`).toBeTrue();
      expect(/no se pudo/i.test(texto)).withContext('la pantalla avisa "No se pudo notificar"').toBeTrue();
      expect(texto.includes('Calificaciones guardadas'))
        .withContext('no debe confirmar el guardado si el servidor falló').toBeFalse();
    } finally {
      rxjsConfig.onUnhandledError = original;
    }
  });
});
