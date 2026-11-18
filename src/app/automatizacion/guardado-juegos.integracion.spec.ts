import { Juegos } from '../pages/juegos/juegos';
import { Juego } from '../services/juegos/juegos-repositorio';
import { LIMITE_MS } from '../services/supabase/supabase';
import { json, peticiones, quitarRed, usarRed } from '../whitebox/red-falsa';

/**
 * PRÁCTICAS 13 y 14 — Automatización de pruebas
 * Fase 3 · PRUEBAS DE INTEGRACIÓN: pantalla de Juegos → JuegosRepositorio → cliente real de
 * supabase-js → HTTP. Todo es código real de la app; solo se sustituye la red (red-falsa.ts)
 * para decidir qué responde "Supabase" (200, 403, sin respuesta). Así la prueba no depende
 * de internet ni ensucia la base real, y puede correr en GitHub Actions en cada push.
 *
 * Matriz: AUT-04 la app envía datos al servicio y recibe el código HTTP esperado ·
 *         AUT-05 la app muestra el mensaje adecuado cuando el servidor no responde o rechaza.
 */

const RPC = '/rest/v1/rpc/guardar_juego';

function pantallaConJuego(cambios: Partial<Juego> = {}): Juegos {
  const p = new Juegos();          // sin ngOnInit: no se carga nada de la base
  p.fecha = '2026-11-17';
  p.juegos = [{
    id: 1, idCliente: '6f1d2c3b-0000-4000-8000-000000000001', nombre: 'Relevos', valor: 20,
    roles: [{ numero: 1, enfrentamientos: [{ escuadras: ['ANK', 'ATL'], ganador: 'ANK' }] }],
    ...cambios,
  }];
  return p;
}

/** Deja correr las tareas reales del navegador (MessageChannel no lo controla jasmine.clock). */
const respirar = () => new Promise<void>(r => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); });
async function avanzarReloj(ms: number, paso = 250) {
  for (let t = 0; t < ms; t += paso) { jasmine.clock().tick(paso); await respirar(); }
}

describe('AUT-04 · Integración · la app envía al servicio y recibe la respuesta esperada', () => {
  afterEach(() => { quitarRed(); localStorage.clear(); });

  it('I-AUT-01 Guardar envía UNA petición POST con los datos del juego y, con HTTP 200, confirma y guarda el id', async () => {
    let cuerpo: { p_fecha: string; p_juego: Record<string, unknown> } | null = null;
    let cabeceras: Headers | null = null;
    usarRed(async (url, init) => {
      if (url.includes(RPC)) { cuerpo = JSON.parse(String(init?.body)); cabeceras = new Headers(init?.headers); return json(77); }
      return json({ message: 'no simulado' }, 404);
    });
    const p = pantallaConJuego();

    await p.guardar();

    expect(peticiones).toEqual([`POST ${RPC}`]);
    expect(cuerpo!.p_fecha).toBe('2026-11-17');
    expect(cuerpo!.p_juego).toEqual(jasmine.objectContaining({
      idCliente: '6f1d2c3b-0000-4000-8000-000000000001', nombre: 'Relevos', valor: 20,
      roles: [{ numero: 1, enfrentamientos: [{ escuadras: ['ANK', 'ATL'], ganador: 'ANK' }] }],
    }));
    expect(cabeceras!.get('apikey')).withContext('se identifica con la llave publicable').toMatch(/^sb_publishable_/);
    expect(p.juegos[0].dbId).withContext('id devuelto por la base').toBe(77);
    expect(p.guardado()).toBeTrue();
    expect(p.errorGuardado()).toBe('');
  });

  it('I-AUT-02 si la API responde HTTP 403 (sin permiso) no se confirma, no se reintenta y se dice por qué', async () => {
    let intentos = 0;
    usarRed(async () => { intentos++; return json({ code: '42501', message: 'permission denied' }, 403); });
    const p = pantallaConJuego();

    await p.guardar();

    expect(intentos).withContext('un 403 no se arregla reintentando').toBe(1);
    expect(p.guardado()).toBeFalse();
    expect(p.errorGuardado()).toBe('No tienes permiso para hacer esta operación.');
    expect(p.juegos[0].dbId).toBeUndefined();
    expect(p.guardando()).withContext('el botón se vuelve a habilitar').toBeFalse();
  });

  it('I-AUT-03 si la API responde HTTP 500 el error se muestra y la pantalla conserva lo capturado', async () => {
    usarRed(async () => json({ code: 'XX000', message: 'internal server error' }, 500));
    const p = pantallaConJuego();

    await p.guardar();

    expect(p.guardado()).toBeFalse();
    expect(p.errorGuardado()).toBe('Ocurrió un error al comunicarse con el servidor.');
    expect(p.juegos.length).toBe(1);
    expect(p.juegos[0].roles[0].enfrentamientos[0].ganador).withContext('no se pierde lo capturado').toBe('ANK');
  });
});

describe('AUT-05 · Integración · mensaje adecuado cuando el servidor no responde o los datos son inválidos', () => {
  afterEach(() => { quitarRed(); localStorage.clear(); jasmine.clock().uninstall(); });

  it('I-AUT-04 servidor sin respuesta: corta cada intento a los 10 s, avisa que reintenta y termina con un mensaje claro', async () => {
    jasmine.clock().install();
    usarRed((_url, init) => new Promise<Response>((_ok, falla) => {
      init?.signal?.addEventListener('abort', () => falla(init.signal!.reason));   // nunca contesta
    }));
    const p = pantallaConJuego();
    const avisos: string[] = [];

    const guardando = p.guardar();
    await avanzarReloj(LIMITE_MS + 100);           // 1.er intento cortado → espera el reintento
    avisos.push(p.reintento());
    await avanzarReloj(3 * LIMITE_MS);             // 2.º y 3.er intento cortados
    await guardando;

    expect(peticiones.length).withContext('1 intento + 2 reintentos').toBe(3);
    expect(new Set(peticiones)).toEqual(new Set([`POST ${RPC}`]));
    expect(avisos[0]).toBe('Sin respuesta del servidor; reintentando (1 de 2)…');
    expect(p.errorGuardado()).toBe('El servidor no respondió a tiempo. Revisa tu conexión e inténtalo de nuevo.');
    expect(p.guardado()).toBeFalse();
    expect(p.reintento()).withContext('el aviso se quita al terminar').toBe('');
  });

  it('I-AUT-05 un juego con una escuadra repetida NO se envía: 0 peticiones y la pantalla dice qué corregir', async () => {
    usarRed(async () => json(1));
    const p = pantallaConJuego({ roles: [{ numero: 1, enfrentamientos: [{ escuadras: ['ANK', 'ANK'], ganador: '' }] }] });

    await p.guardar();

    expect(peticiones).toEqual([]);
    expect(p.errorGuardado()).toBe('En «Relevos», rol 1, enfrentamiento 1 hay una escuadra repetida.');
    expect(p.guardando()).toBeFalse();
  });

  it('I-AUT-06 un valor fuera de rango (5000) tampoco llega al servidor', async () => {
    usarRed(async () => json(1));
    const p = pantallaConJuego({ valor: 5000 });

    await p.guardar();

    expect(peticiones).toEqual([]);
    expect(p.errorGuardado()).toBe('El valor de «Relevos» debe ser un número entero entre 1 y 1000.');
  });
});
