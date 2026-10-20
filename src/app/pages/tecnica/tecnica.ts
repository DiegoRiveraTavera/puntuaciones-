import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { NavbarComponent } from '../../components/navbar/navbar';
import { FutterComponent } from "../../components/futter/futter";
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

interface CalificacionTecnica {
  fuerza: number;
  utilidad: number;
  firmeza: number;
  estabilidad: number;
  originalidad: number;
}

interface EscuadraCalificada {
  nombre: string;
  calificacion: CalificacionTecnica;
  total: number;
}

@Component({
  selector: 'app-tecnica',
  standalone: true,
  imports: [NavbarComponent, CommonModule, FormsModule, FutterComponent],
  templateUrl: './tecnica.html',
  styleUrl: './tecnica.css'
})
export class Tecnica {
  criterios = ['Fuerza', 'Utilidad', 'Firmeza', 'Estabilidad', 'Originalidad'];

  // Escuadras hardcodeadas por ahora (después conectas con tu servicio real)
  escuadras = ['RRMS', 'ANK', 'ATL'];

  calificaciones: { [escuadra: string]: CalificacionTecnica } = {};
  guardado = signal(false);
    // Foto de la técnica de cada escuadra (data URL). Va en un signal porque la app es zoneless.
  fotos = signal<Record<string, string>>({});
  errorFoto = signal('');

  constructor(private http: HttpClient) {
    this.escuadras.forEach(e => {
      this.calificaciones[e] = {
        fuerza: 0, utilidad: 0, firmeza: 0,
        estabilidad: 0, originalidad: 0
      };
    });
  }

  getTotal(escuadra: string): number {
    const c = this.calificaciones[escuadra];
    return c.fuerza + c.utilidad + c.firmeza + c.estabilidad + c.originalidad;
  }

  getRanking(): EscuadraCalificada[] {
    return this.escuadras
      .map(e => ({ nombre: e, calificacion: this.calificaciones[e], total: this.getTotal(e) }))
      .sort((a, b) => b.total - a.total);
  }

  getColor(valor: number): string {
    if (valor >= 8) return 'alto';
    if (valor >= 5) return 'medio';
    if (valor > 0) return 'bajo';
    return '';
  }

  guardar() {
    this.guardado.set(true);
    setTimeout(() => this.guardado.set(false), 3000);

    // Notificamos al reloj con la escuadra líder de esta ronda
    const lider = this.getRanking()[0];
    if (lider && lider.total > 0) {
      this.http.post('/api/notificaciones/tecnica', {
        escuadra: lider.nombre,
        puntos: lider.total
      }).subscribe();
    }
  }

    // Abre la cámara (en el celular) y guarda la foto de la técnica de esa escuadra
  async tomarFoto(escuadra: string): Promise<void> {
    this.errorFoto.set('');
    try {
      const imagen = await Camera.getPhoto({
        source: CameraSource.Camera,
        resultType: CameraResultType.DataUrl,
        quality: 70,
        width: 1280,
        correctOrientation: true,
        webUseInput: true   // en el navegador usa el selector de archivos/cámara del sistema
      });
      if (imagen.dataUrl) {
        this.fotos.update(f => ({ ...f, [escuadra]: imagen.dataUrl! }));
      }
    } catch (error: any) {
      const msg = String(error?.message ?? error).toLowerCase();
      if (msg.includes('cancel')) return;   // cerró la cámara sin tomar foto
      this.errorFoto.set(
        msg.includes('denied')
          ? 'Permiso de cámara denegado. Actívalo en los ajustes del celular.'
          : 'No se pudo abrir la cámara.'
      );
    }
  }

  quitarFoto(escuadra: string): void {
    this.fotos.update(f => {
      const { [escuadra]: _quitada, ...resto } = f;
      return resto;
    });
  }
  
}