import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

// Pantalla «Sesion»: genera el enlace de sesión de un solo uso (la cámara se usa en Técnica)
// Dirección base de los enlaces de sesión
const ENLACE_BASE = 'https://puntuaciones.vercel.app/sesion/';
@Component({
  selector: 'app-camara',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './camara.html',
  styleUrl: './camara.css'
})
export class Camara {
  // Enlace de sesión (se genera uno nuevo cada vez que se entra a la página)
  enlace = this.generarEnlace();
  avisoEnlace = '';

  // Crea un enlace con código aleatorio, tipo "abc-defg-hij"
  generarEnlace(): string {
    const letras = 'abcdefghijklmnopqrstuvwxyz';
    const azar = crypto.getRandomValues(new Uint32Array(10));
    const c = Array.from(azar, n => letras[n % letras.length]).join('');
    return `${ENLACE_BASE}${c.slice(0, 3)}-${c.slice(3, 7)}-${c.slice(7, 10)}`;
  }

  // Copia el enlace al portapapeles
  async copiarEnlace(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.enlace);
      this.avisoEnlace = 'Enlace copiado.';
    } catch {
      this.avisoEnlace = 'No se pudo copiar el enlace.';
    }
  }

  // Código del enlace (abc-defg-hij)
  get codigoEnlace(): string {
    return this.enlace.split('/sesion/')[1];
  }
}