/**
 * Almacenamiento local de la app (localStorage del navegador o del celular).
 *
 * Corrige REQ-11: antes "Guardar" solo mostraba un mensaje y los datos se perdían
 * al recargar. Ahora cada pantalla guarda aquí su información.
 *
 * Todas las funciones son seguras en el servidor (SSR) y en modo privado:
 * si el almacenamiento no está disponible, no fallan.
 */

const PREFIJO = 'puntuaciones:';

function disponible(): boolean {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
}

/** Lee un dato guardado; si no existe o está dañado, regresa `porDefecto`. */
export function leerDato<T>(clave: string, porDefecto: T): T {
  if (!disponible()) return porDefecto;
  try {
    const texto = localStorage.getItem(PREFIJO + clave);
    return texto === null ? porDefecto : (JSON.parse(texto) as T);
  } catch {
    return porDefecto;
  }
}

/** Guarda un dato. Regresa `false` si no se pudo guardar (sin espacio, modo privado, SSR). */
export function guardarDato<T>(clave: string, valor: T): boolean {
  if (!disponible()) return false;
  try {
    localStorage.setItem(PREFIJO + clave, JSON.stringify(valor));
    return true;
  } catch {
    return false;
  }
}
