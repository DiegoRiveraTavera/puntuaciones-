import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { iniciarSesion, haySesion } from '../../services/sesion/sesion';

// Límites definidos para las entradas
const MAX_CORREO = 100;
const MAX_PASSWORD = 72;
const MIN_PASSWORD = 8;
const FORMATO_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login implements OnInit {
  readonly maxCorreo = MAX_CORREO;
  readonly maxPassword = MAX_PASSWORD;

  correo = '';
  password = '';
  mostrar = false;

  // Signals: la app es zoneless y estos valores cambian después de una respuesta del servidor
  error = signal('');
  cargando = signal(false);

  constructor(private router: Router) {}

  // Si ya hay una sesión activa, entra directo
  async ngOnInit() {
    if (await haySesion()) this.router.navigate(['/inicio']);
  }

  async iniciarSesion(): Promise<void> {
    if (this.cargando()) return;
    this.error.set('');

    const correo = this.correo.trim().toLowerCase();

    // 1. Comprobar que ambos campos tengan información
    if (!correo || !this.password) {
      this.error.set('Ingresa tu correo y contraseña.');
      return;
    }

    // 2. Rechazar entradas demasiado largas
    if (correo.length > MAX_CORREO || this.password.length > MAX_PASSWORD) {
      this.error.set('Los datos exceden la longitud permitida.');
      return;
    }

    // 3. Formato de correo
    if (!FORMATO_CORREO.test(correo)) {
      this.error.set('Escribe un correo válido.');
      return;
    }

    // 4. Longitud mínima de la contraseña
    if (this.password.length < MIN_PASSWORD) {
      this.error.set(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`);
      return;
    }

    // 5. Verificación en el servidor (Supabase Authentication)
    this.cargando.set(true);
    const resultado = await iniciarSesion(correo, this.password);
    this.cargando.set(false);
    this.password = ''; // no conservar la contraseña después del intento

    if (resultado.ok) {
      this.router.navigate(['/inicio']);
    } else {
      this.error.set(resultado.error);
    }
  }
}
