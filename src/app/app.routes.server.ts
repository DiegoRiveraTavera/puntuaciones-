import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * Solo el login se renderiza en el servidor. Las pantallas internas se renderizan
 * en el navegador, porque dependen de la sesión y de los datos guardados en el
 * dispositivo (sessionStorage / localStorage), que el servidor no puede leer.
 */
export const serverRoutes: ServerRoute[] = [
  {
    path: 'login',
    renderMode: RenderMode.Server
  },
  {
    path: '**',
    renderMode: RenderMode.Client
  }
];
