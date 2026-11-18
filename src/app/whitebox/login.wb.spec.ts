import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { Router, provideRouter } from '@angular/router';
import { Login } from '../pages/login/login';
import { json, peticiones, quitarRed, sesionValida, usarRed } from './red-falsa';

/**
 * PRÁCTICA 11 — White Box · Método de VALIDACIÓN
 * pages/login/login.ts → Login.iniciarSesion()
 *
 *  D1 ¿cargando()?                                   → return (evita doble envío)
 *  D2 ¿!correo || !password?          (C1, C2)       → "Ingresa tu correo y contraseña."
 *  D3 ¿correo>100 || password>72?     (C3, C4)       → "Los datos exceden la longitud permitida."
 *  D4 ¿!FORMATO_CORREO.test(correo)?                 → "Escribe un correo válido."
 *  D5 ¿password < 8?                                 → "La contraseña debe tener al menos 8 caracteres."
 *  (llamada al servidor)
 *  D6 ¿resultado.ok?                                 → navegar a /inicio | mostrar error
 * V(G) = 6 decisiones + 1 = 7 caminos independientes.
 */
describe('WHITE BOX · Login.iniciarSesion (validación de entradas)', () => {
  let login: Login;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideRouter([])] });
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    login = TestBed.runInInjectionContext(() => new Login(router));
    // Cualquier llamada no prevista a Supabase se responde como credenciales inválidas
    usarRed(async () => json({ error: 'invalid_grant', error_description: 'Invalid login credentials' }, 400));
  });

  afterEach(() => { quitarRed(); localStorage.clear(); });

  async function intentar(correo: string, password: string) {
    login.correo = correo;
    login.password = password;
    await login.iniciarSesion();
    return login.error();
  }

  // ── Camino D1 verdadero
  it('WB-VAL-01 (D1=V) si ya hay un intento en curso no hace nada', async () => {
    login.cargando.set(true);
    expect(await intentar('a@b.com', '12345678')).toBe('');
    expect(peticiones.length).withContext('no se envía nada al servidor').toBe(0);
  });

  // ── D2: cobertura de condiciones (C1 y C2 toman V y F por separado)
  it('WB-VAL-02 (C1=V, C2=F) correo vacío', async () => {
    expect(await intentar('   ', 'Segura2026!')).toBe('Ingresa tu correo y contraseña.');
  });
  it('WB-VAL-03 (C1=F, C2=V) contraseña vacía', async () => {
    expect(await intentar('a@b.com', '')).toBe('Ingresa tu correo y contraseña.');
  });

  // ── D3: valores límite (100/101 y 72/73) y cobertura de condiciones
  it('WB-VAL-04 límite: correo de exactamente 100 caracteres sí pasa esta validación', async () => {
    const correo = 'a'.repeat(100 - '@moriah.com'.length) + '@moriah.com';
    expect(correo.length).toBe(100);
    expect(await intentar(correo, 'Segura2026!')).not.toBe('Los datos exceden la longitud permitida.');
  });
  it('WB-VAL-05 (C3=V) límite: correo de 101 caracteres se rechaza', async () => {
    const correo = 'a'.repeat(101 - '@moriah.com'.length) + '@moriah.com';
    expect(await intentar(correo, 'Segura2026!')).toBe('Los datos exceden la longitud permitida.');
  });
  it('WB-VAL-06 (C3=F, C4=V) límite: contraseña de 73 caracteres se rechaza; 72 sí pasa', async () => {
    expect(await intentar('a@b.com', 'x'.repeat(73))).toBe('Los datos exceden la longitud permitida.');
    expect(await intentar('a@b.com', 'x'.repeat(72))).not.toBe('Los datos exceden la longitud permitida.');
  });

  // ── D4: formato de correo
  it('WB-VAL-07 (D4=V) correo sin dominio', async () => {
    expect(await intentar('jefatura@moriah', 'Segura2026!')).toBe('Escribe un correo válido.');
  });
  it('WB-VAL-08 (D4=V) correo con espacio interno', async () => {
    expect(await intentar('jefa tura@moriah.com', 'Segura2026!')).toBe('Escribe un correo válido.');
  });

  // ── D5: valores límite 7 / 8
  it('WB-VAL-09 (D5=V) límite: contraseña de 7 caracteres se rechaza', async () => {
    expect(await intentar('a@b.com', '1234567')).toBe('La contraseña debe tener al menos 8 caracteres.');
    expect(peticiones.length).toBe(0);
  });

  // ── D6: los dos resultados del servidor
  it('WB-VAL-10 (D5=F, D6=F) contraseña de 8 caracteres llega al servidor; credenciales malas → error y se borra la contraseña', async () => {
    expect(await intentar('A@B.COM ', '12345678')).toBe('Correo o contraseña incorrectos.');
    expect(peticiones.some(p => p.startsWith('POST /auth/v1/token'))).toBeTrue();
    expect(login.password).withContext('no conserva la contraseña').toBe('');
    expect(login.cargando()).toBeFalse();
  });
  it('WB-VAL-11 (D6=V) credenciales correctas → navega a /inicio', async () => {
    usarRed(async url => {
      if (url.includes('/auth/v1/token')) return json(sesionValida());
      if (url.includes('/rest/v1/perfiles')) return json([{ id: 'usuario-1' }]);
      return new Response(null, { status: 204 });
    });
    expect(await intentar('jefatura@moriah.com', 'Segura2026!')).toBe('');
    expect(router.navigate).toHaveBeenCalledWith(['/inicio']);
  });

  it('WB-VAL-12 el correo se normaliza (trim + minúsculas) antes de enviarse', async () => {
    let cuerpo = '';
    usarRed(async (_url, init) => { cuerpo = String(init?.body ?? ''); return json({ error: 'invalid_grant' }, 400); });
    await intentar('  JeFaTuRa@Moriah.COM  ', 'Segura2026!');
    expect(JSON.parse(cuerpo).email).toBe('jefatura@moriah.com');
  });
});
