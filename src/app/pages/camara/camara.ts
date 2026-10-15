
import { Component } from '@angular/core';
import { Camera } from '@capacitor/camera';

@Component({
  selector: 'app-camara',
  standalone: true,
  templateUrl: './camara.html',
  styleUrl: './camara.css'
})
export class Camara {
  mensaje = 'Pulsa el botón para solicitar permiso.';
  estado = '';

  async solicitarPermiso(): Promise<void> {
    try {
      const permisos = await Camera.requestPermissions({
        permissions: ['camera']
      });

      if (permisos.camera === 'granted') {
        this.estado = 'correcto';
        this.mensaje =
          '¡Permiso de cámara concedido correctamente!';
      } else {
        this.estado = 'error';
        this.mensaje =
          'No se ha concedido el permiso de cámara.';
      }
    } catch (error) {
      console.error('Error al solicitar permiso de cámara:', error);

      this.estado = 'error';
      this.mensaje =
        'No se pudo solicitar el permiso. Revisa la configuración de Android.';
    }
  }
}
