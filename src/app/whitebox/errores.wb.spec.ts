import { mensajeError } from '../services/supabase/supabase';

/**
 * PRÁCTICA 11 — White Box · Manejo de EXCEPCIONES
 * services/supabase/supabase.ts → mensajeError(error)
 *
 *  D1 ¿msg incluye 'failed to fetch' || 'network' || 'load failed'?   (C1, C2, C3)
 *  switch (code): '23505' | '23514' | '42501' | 'PGRST301' | 'PGRST303' | default
 * V(G) = 1 (if) + 5 (case) + 1 = 7 caminos; con condiciones simples 12 (lo que reporta ESLint).
 */
describe('WHITE BOX · mensajeError (traducción de excepciones)', () => {
  const SIN_RED = 'Sin conexión con el servidor. No se guardó; revisa tu internet e inténtalo de nuevo.';

  it('WB-EXC-01 (C1=V) Chrome/Android: "Failed to fetch"', () => {
    expect(mensajeError(new TypeError('Failed to fetch'))).toBe(SIN_RED);
  });
  it('WB-EXC-02 (C1=F, C2=V) "NetworkError when attempting to fetch resource" (Firefox)', () => {
    expect(mensajeError(new TypeError('NetworkError when attempting to fetch resource.'))).toBe(SIN_RED);
  });
  it('WB-EXC-03 (C1=F, C2=F, C3=V) Safari/iOS: "Load failed"', () => {
    expect(mensajeError(new TypeError('Load failed'))).toBe(SIN_RED);
  });

  it('WB-EXC-04 23505 violación UNIQUE', () => {
    expect(mensajeError({ code: '23505', message: 'duplicate key value' })).toBe('Ese registro ya existe.');
  });
  it('WB-EXC-05 23514 violación CHECK', () => {
    expect(mensajeError({ code: '23514', message: 'violates check constraint' })).toBe('Algún dato está fuera de los valores permitidos.');
  });
  it('WB-EXC-06 42501 RLS / sin permiso', () => {
    expect(mensajeError({ code: '42501', message: 'row-level security' })).toBe('No tienes permiso para hacer esta operación.');
  });
  it('WB-EXC-07 PGRST301 y PGRST303 sesión expirada', () => {
    expect(mensajeError({ code: 'PGRST301', message: 'JWT expired' })).toBe('Tu sesión expiró. Vuelve a iniciar sesión.');
    expect(mensajeError({ code: 'PGRST303', message: 'JWT expired' })).toBe('Tu sesión expiró. Vuelve a iniciar sesión.');
  });
  it('WB-EXC-08 (default) código desconocido', () => {
    expect(mensajeError({ code: 'XX000', message: 'internal' })).toBe('Ocurrió un error al comunicarse con el servidor.');
  });
  it('WB-EXC-09 entradas extremas: null, undefined y cadena no lanzan excepción', () => {
    expect(mensajeError(null)).toBe('Ocurrió un error al comunicarse con el servidor.');
    expect(mensajeError(undefined)).toBe('Ocurrió un error al comunicarse con el servidor.');
    expect(mensajeError('texto suelto')).toBe('Ocurrió un error al comunicarse con el servidor.');
  });
  it('WB-EXC-10 ÁREA DE MEJORA: llave foránea (23503) cae en el mensaje genérico (camino default)', () => {
    // Documenta el comportamiento actual: la jefatura no sabe que la escuadra ya no existe.
    expect(mensajeError({ code: '23503', message: 'violates foreign key constraint' }))
      .toBe('Ocurrió un error al comunicarse con el servidor.');
  });
});
