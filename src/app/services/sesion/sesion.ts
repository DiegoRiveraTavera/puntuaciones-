import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

/**
 * Control de sesión.
 *
 * Corrige REQ-14: antes cualquier pantalla interna se abría escribiendo su URL
 * sin iniciar sesión. Ahora el login registra la sesión y el guard `sesionGuard`
 * protege las rutas internas.
 *
 * La sesión vive en sessionStorage: dura mientras la pestaña o la app estén
 * abiertas y se borra al cerrarlas.
 */

const CLAVE_SESION = 'puntuaciones:sesion';

export function iniciarSesionLocal(usuario: string): void {
  try {
    sessionStorage.setItem(CLAVE_SESION, JSON.stringify({ usuario, inicio: Date.now() }));
  } catch {
    /* sin almacenamiento disponible: la sesión no se conserva */
  }
}

export function cerrarSesionLocal(): void {
  try {
    sessionStorage.removeItem(CLAVE_SESION);
  } catch {
    /* nada que borrar */
  }
}

export function haySesion(): boolean {
  try {
    return typeof sessionStorage !== 'undefined' && sessionStorage.getItem(CLAVE_SESION) !== null;
  } catch {
    return false;
  }
}

/** Deja pasar solo si hay sesión; si no, manda al login. */
export const sesionGuard: CanActivateFn = () =>
  haySesion() ? true : inject(Router).createUrlTree(['/login']);
