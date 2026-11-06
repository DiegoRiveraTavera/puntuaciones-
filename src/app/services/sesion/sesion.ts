import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { supabase } from '../supabase/supabase';

/**
 * Control de sesión con Supabase Authentication (Práctica 10).
 *
 * Antes el login comparaba contra credenciales escritas en el código. Ahora:
 *  - las cuentas de jefatura se crean en Supabase → Authentication → Users;
 *  - la contraseña la verifica el servidor de Supabase, nunca la app;
 *  - además de iniciar sesión, la cuenta debe tener un perfil de jefatura activo;
 *  - el guard `sesionGuard` protege todas las pantallas internas.
 */

export type ResultadoLogin = { ok: true } | { ok: false; error: string };

export async function iniciarSesion(correo: string, password: string): Promise<ResultadoLogin> {
  const sb = supabase();
  let respuesta;
  try {
    respuesta = await sb.auth.signInWithPassword({ email: correo, password });
  } catch {
    return { ok: false, error: 'No se pudo conectar con el servidor. Revisa tu conexión.' };
  }

  const { data, error } = respuesta;
  if (error || !data.user) {
    if (error?.status === 0 || /fetch|network/i.test(error?.message ?? '')) {
      return { ok: false, error: 'No se pudo conectar con el servidor. Revisa tu conexión.' };
    }
    if (error?.status === 429) {
      return { ok: false, error: 'Demasiados intentos. Espera un momento y vuelve a intentarlo.' };
    }
    return { ok: false, error: 'Correo o contraseña incorrectos.' };
  }

  // La cuenta existe, pero ¿es de jefatura y está activa? (lo decide la regla RLS)
  const { data: perfil } = await sb.from('perfiles').select('id').eq('id', data.user.id).maybeSingle();
  if (!perfil) {
    await sb.auth.signOut();
    return { ok: false, error: 'Tu cuenta no tiene acceso a Puntuaciones.' };
  }
  return { ok: true };
}

export async function cerrarSesion(): Promise<void> {
  try {
    await supabase().auth.signOut();
  } catch {
    /* sin conexión: la sesión local se borra de todos modos */
  }
}

export async function haySesion(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    const { data } = await supabase().auth.getSession();
    return !!data.session;
  } catch {
    return false;
  }
}

/** Deja pasar solo si hay sesión de Supabase; si no, manda al login. */
export const sesionGuard: CanActivateFn = () => {
  const router = inject(Router);
  return haySesion().then(ok => (ok ? true : router.createUrlTree(['/login'])));
};
