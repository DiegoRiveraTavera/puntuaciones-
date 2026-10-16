import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

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
  mensaje = 'Pulsa el botón para solicitar permiso.';
  estado = '';
  foto = '';

  // Enlace de sesión (se genera uno nuevo cada vez que se entra a la página)
  enlace = this.generarEnlace();
  avisoEnlace = '';

  async solicitarPermiso(): Promise<void> {
    try {
      const permisos = await Camera.requestPermissions({
        permissions: ['camera']
      });

      if (permisos.camera === 'granted') {
        this.estado = 'correcto';
        this.mensaje = '¡Permiso de cámara concedido correctamente!';
        await this.abrirCamara();
      } else {
        this.estado = 'error';
        this.mensaje = 'No se ha concedido el permiso de cámara.';
      }
    } catch (error) {
      console.error('Error al solicitar permiso de cámara:', error);
      this.estado = 'error';
      this.mensaje =
        'No se pudo solicitar el permiso. Revisa la configuración de Android.';
    }
  }

  // Abre la cámara del dispositivo y guarda la foto tomada
  async abrirCamara(): Promise<void> {
    try {
      const imagen = await Camera.getPhoto({
        source: CameraSource.Camera,
        resultType: CameraResultType.DataUrl,
        quality: 80
      });
      this.foto = imagen.dataUrl ?? '';
      this.mensaje = 'Foto tomada correctamente.';
    } catch (error) {
      // El usuario cerró la cámara sin tomar la foto
      this.mensaje = 'No se tomó ninguna foto.';
    }
  }

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