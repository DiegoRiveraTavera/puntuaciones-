import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ClimaWidgetComponent } from '../components/clima-widget/clima-widget';
import {
  ClimaActual, ClimaService, LIMITES, PUNTO_REUNION, describirCodigo, leerRespuesta, mensajeClima, recomendar,
} from '../services/clima/clima';
import { TecnicaRepositorio } from '../services/tecnica/tecnica-repositorio';
import { json, peticiones, quitarRed, usarRed } from '../whitebox/red-falsa';

/**
 * Funciones que faltaban en Puntuaciones según el documento del proyecto:
 *  · Clima del punto de reunión con recomendación «aire libre / bajo techo» (ClimaService + tarjeta en Inicio)
 *  · Historial de fotos de técnica por escuadra (TecnicaRepositorio.historialFotos)
 * Estas pruebas corren en el CI junto con las demás (npm run test:ci).
 */

/** Clima base: despejado y templado. */
const clima = (cambios: Partial<ClimaActual> = {}): ClimaActual => ({
  temperatura: 22, sensacion: 22, humedad: 40, precipitacion: 0, viento: 10, codigo: 0,
  condicion: 'Despejado', icono: '☀️', hora: '2026-11-24T10:00', ...cambios,
});

/** Respuesta real de Open-Meteo (formato de /v1/forecast con current=…). */
const respuestaOpenMeteo = (cambios: Record<string, unknown> = {}) => ({
  latitude: 20.6, longitude: -100.4, timezone: 'America/Mexico_City',
  current: {
    time: '2026-11-24T10:00', interval: 900, temperature_2m: 22.4, apparent_temperature: 21.8,
    relative_humidity_2m: 38, precipitation: 0, weather_code: 1, wind_speed_10m: 9.7, ...cambios,
  },
});

describe('CLIMA · Unitarias · recomendación de actividad', () => {
  it('C-01 despejado y templado → aire libre', () => {
    expect(recomendar(clima())).toEqual({ lugar: 'aire libre', motivo: 'Buen clima para la actividad al aire libre.' });
  });

  it('C-02 lluvia, llovizna o chubascos (códigos 51–67 y 80–82) → bajo techo', () => {
    for (const codigo of [51, 61, 65, 80, 82]) {
      expect(recomendar(clima({ codigo })).lugar).withContext(`código ${codigo}`).toBe('bajo techo');
    }
  });

  it('C-03 cielo nublado pero ya cayó lluvia (≥ 0.5 mm) → bajo techo', () => {
    expect(recomendar(clima({ codigo: 3, precipitacion: 0.8 })))
      .toEqual({ lugar: 'bajo techo', motivo: 'Está lloviendo en el punto de reunión.' });
  });

  it('C-04 tormenta eléctrica tiene prioridad sobre cualquier otra condición', () => {
    expect(recomendar(clima({ codigo: 95, temperatura: 25 })).motivo).toContain('tormenta');
  });

  it('C-05 límites: viento 40 km/h, 32 °C y 8 °C ya son bajo techo; un poco antes, aire libre', () => {
    expect(recomendar(clima({ viento: LIMITES.viento })).lugar).toBe('bajo techo');
    expect(recomendar(clima({ viento: LIMITES.viento - 0.1 })).lugar).toBe('aire libre');
    expect(recomendar(clima({ temperatura: 32, sensacion: 30 })).lugar).toBe('bajo techo');
    expect(recomendar(clima({ temperatura: 31.9, sensacion: 31.9 })).lugar).toBe('aire libre');
    expect(recomendar(clima({ temperatura: 8, sensacion: 8 })).lugar).toBe('bajo techo');
    expect(recomendar(clima({ temperatura: 8.1, sensacion: 8.1 })).lugar).toBe('aire libre');
  });

  it('C-06 la sensación térmica también cuenta (24 °C que se sienten como 34 °C → bajo techo)', () => {
    expect(recomendar(clima({ temperatura: 24, sensacion: 34 })).motivo).toBe('Hace mucho calor (34 °C): busquen sombra o un lugar techado.');
  });

  it('C-07 neblina → aire libre con aviso de visibilidad', () => {
    expect(recomendar(clima({ codigo: 45 }))).toEqual({ lugar: 'aire libre', motivo: 'Se puede salir, pero hay neblina: cuiden la visibilidad.' });
  });

  it('C-08 cada código WMO tiene descripción e ícono; uno desconocido no truena', () => {
    expect(describirCodigo(0).condicion).toBe('Despejado');
    expect(describirCodigo(63).condicion).toBe('Lluvia');
    expect(describirCodigo(99).condicion).toBe('Tormenta eléctrica');
    expect(describirCodigo(1234).condicion).toBe('Sin datos del cielo');
  });

  it('C-09 leerRespuesta convierte la respuesta de Open-Meteo y rechaza una respuesta incompleta', () => {
    expect(leerRespuesta(respuestaOpenMeteo())).toEqual(jasmine.objectContaining({
      temperatura: 22.4, sensacion: 21.8, humedad: 38, viento: 9.7, codigo: 1, condicion: 'Parcialmente nublado', hora: '2026-11-24T10:00',
    }));
    expect(() => leerRespuesta({ current: { temperature_2m: 20 } })).toThrowError(/no trae/);
    expect(() => leerRespuesta(null)).toThrowError(/no trae/);
  });

  it('C-10 mensajes claros para sin internet, sin permiso de ubicación y servicio caído', () => {
    expect(mensajeClima(new TypeError('Failed to fetch'))).toBe('No se pudo consultar el clima. Revisa tu conexión a internet.');
    expect(mensajeClima(new Error('ubicación: Permiso de ubicación denegado.'))).toContain('permiso de ubicación');
    expect(mensajeClima(new Error('El servicio de clima respondió 503.'))).toBe('El servicio de clima no está disponible en este momento.');
    expect(mensajeClima(null)).toBe('El servicio de clima no está disponible en este momento.');
  });
});

describe('CLIMA · Integración · ClimaService y tarjeta de Inicio con Open-Meteo simulado', () => {
  let urls: string[];
  const simularOpenMeteo = (responder: () => Response | Promise<Response>) => {
    urls = [];
    spyOn(window, 'fetch').and.callFake(async (entrada: RequestInfo | URL) => {
      urls.push(String(entrada));
      return responder();
    });
  };

  it('C-11 consulta Open-Meteo con las coordenadas del punto de reunión y devuelve el clima', async () => {
    simularOpenMeteo(() => json(respuestaOpenMeteo()));
    const c = await new ClimaService().consultar();
    expect(urls.length).toBe(1);
    expect(urls[0]).toContain('https://api.open-meteo.com/v1/forecast?latitude=20.5931&longitude=-100.3922');
    expect(urls[0]).toContain('current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m');
    expect(c.temperatura).toBe(22.4);
  });

  it('C-12 una respuesta HTTP 500 se reporta como error, y unas coordenadas inválidas ni siquiera se envían', async () => {
    simularOpenMeteo(() => json({ error: true }, 500));
    await expectAsync(new ClimaService().consultar()).toBeRejectedWithError('El servicio de clima respondió 500.');
    await expectAsync(new ClimaService().consultar({ latitud: 120, longitud: 0 })).toBeRejectedWithError('Coordenadas inválidas.');
    expect(urls.length).withContext('solo la primera consulta salió a la red').toBe(1);
  });

  it('C-13 la tarjeta de Inicio muestra temperatura, condición y «Mejor bajo techo» cuando llueve', async () => {
    simularOpenMeteo(() => json(respuestaOpenMeteo({ weather_code: 63, precipitation: 2.1, temperature_2m: 17 })));
    TestBed.configureTestingModule({ imports: [ClimaWidgetComponent], providers: [provideZonelessChangeDetection()] });
    const f = TestBed.createComponent(ClimaWidgetComponent);
    f.detectChanges();
    await f.whenStable();
    await f.componentInstance.actualizar();
    f.detectChanges();
    const texto = (f.nativeElement as HTMLElement).textContent!.replace(/\s+/g, ' ');
    expect(texto).toContain(PUNTO_REUNION.nombre);
    expect(texto).toContain('17 °C');
    expect(texto).toContain('Lluvia');
    expect(texto).toContain('Mejor bajo techo');
    expect(texto).toContain('Está lloviendo en el punto de reunión.');
  });

  it('C-14 sin internet, la tarjeta muestra un aviso y no inventa datos', async () => {
    simularOpenMeteo(() => Promise.reject(new TypeError('Failed to fetch')));
    TestBed.configureTestingModule({ imports: [ClimaWidgetComponent], providers: [provideZonelessChangeDetection()] });
    const f = TestBed.createComponent(ClimaWidgetComponent);
    f.detectChanges();
    await f.whenStable();
    await f.componentInstance.actualizar();
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('.clima-error')?.textContent).toContain('Revisa tu conexión a internet');
    expect(el.querySelector('.clima-temp')).toBeNull();
    expect(el.querySelector('.clima-recomendacion')).toBeNull();
  });
});

describe('FOTOS · Integración · historial de técnica por escuadra (Supabase simulado)', () => {
  afterEach(() => { quitarRed(); localStorage.clear(); });

  const fila = (ruta: string, fecha: string, creado: string) => ({ ruta_archivo: ruta, creado_en: creado, sesiones: { fecha } });

  it('F-01 devuelve una foto por fecha, de la más reciente a la más antigua, con URL firmada', async () => {
    let firmadas: string[] = [];
    usarRed(async (url, init) => {
      if (url.includes('/rest/v1/escuadras')) return json([{ id: 7, nombre: 'ANK' }, { id: 8, nombre: 'ATL' }]);
      if (url.includes('/rest/v1/fotografias')) {
        return json([
          fila('3/7-c.jpg', '2026-11-21', '2026-11-21T18:00:00Z'),
          fila('3/7-b.jpg', '2026-11-21', '2026-11-21T17:00:00Z'),   // misma fecha: se descarta
          fila('2/7-a.jpg', '2026-11-14', '2026-11-14T17:00:00Z'),
        ]);
      }
      if (url.includes('/storage/v1/object/sign/fotos-tecnica')) {
        firmadas = JSON.parse(String(init?.body)).paths;
        return json(firmadas.map(p => ({ path: p, signedURL: `/object/sign/fotos-tecnica/${p}?token=t`, error: null })));
      }
      return json({ message: 'no simulado' }, 404);
    });

    const historial = await new TecnicaRepositorio().historialFotos('ank');

    expect(historial.map(h => h.fecha)).toEqual(['2026-11-21', '2026-11-14']);
    expect(firmadas).toEqual(['3/7-c.jpg', '2/7-a.jpg']);
    expect(historial[0].url).toContain('/storage/v1/object/sign/fotos-tecnica/3/7-c.jpg?token=t');
    const consulta = peticiones.find(p => p.startsWith('GET /rest/v1/fotografias'))!;
    expect(decodeURIComponent(consulta)).toContain('escuadra_id=eq.7');
    expect(decodeURIComponent(consulta)).toContain('order=creado_en.desc');
  });

  it('F-02 una escuadra sin fotos o que no existe devuelve una lista vacía', async () => {
    usarRed(async url => {
      if (url.includes('/rest/v1/escuadras')) return json([{ id: 7, nombre: 'ANK' }]);
      if (url.includes('/rest/v1/fotografias')) return json([]);
      return json({ message: 'no simulado' }, 404);
    });
    expect(await new TecnicaRepositorio().historialFotos('ANK')).toEqual([]);
    expect(await new TecnicaRepositorio().historialFotos('XYZ')).toEqual([]);
    expect(peticiones.filter(p => p.includes('fotografias')).length).withContext('XYZ no consulta fotos').toBe(1);
  });

  it('F-03 si la base rechaza la consulta (sin permiso) el error llega a la pantalla', async () => {
    usarRed(async url => {
      if (url.includes('/rest/v1/escuadras')) return json([{ id: 7, nombre: 'ANK' }]);
      return json({ code: '42501', message: 'permission denied' }, 403);
    });
    await expectAsync(new TecnicaRepositorio().historialFotos('ANK')).toBeRejected();
  });
});
