import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-futter',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './futter.html',
  styleUrls: ['./futter.css']
})
export class FutterComponent {
  nombre = '';
  correo = '';
  mensaje = '';
  enviado = false;

  enviar(event: Event) {
    event.preventDefault();
    if (!this.nombre.trim() || !this.correo.trim() || !this.mensaje.trim()) return;

    // Por ahora abre el correo con los datos precargados (sin backend)
    const asunto = encodeURIComponent(`Contacto de ${this.nombre}`);
    const cuerpo = encodeURIComponent(`${this.mensaje}\n\nCorreo: ${this.correo}`);
    window.location.href = `mailto:escuadron.moriah@gmail.com?subject=${asunto}&body=${cuerpo}`;

    this.enviado = true;
    setTimeout(() => (this.enviado = false), 4000);
  }
}