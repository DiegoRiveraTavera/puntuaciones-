import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { iniciarSesionLocal, cerrarSesionLocal } from '../../services/sesion/sesion';

// Límites definidos para las entradas
const MAX_USUARIO = 20;
const MAX_PASSWORD = 32;
const MIN_PASSWORD = 8;

// Datos de prueba para el acceso simulado
const USUARIO_PRUEBA = 'moriah';
const PASSWORD_PRUEBA = 'Segura2026';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {
  readonly maxUsuario = MAX_USUARIO;
  readonly maxPassword = MAX_PASSWORD;

  usuario = '';
  password = '';
  mostrar = false;

  error = '';
  acceso = false;

  constructor(private router: Router) {}

  iniciarSesion(): void {
    this.error = '';
    this.acceso = false;

    const usuario = this.usuario.trim();

    // 1. Comprobar que ambos campos tengan información
    if (!usuario || !this.password) {
      this.error = 'Ingresa tu usuario y contraseña.';
      return;
    }

    // 2. Rechazar entradas demasiado largas
    if (
      usuario.length > MAX_USUARIO ||
      this.password.length > MAX_PASSWORD
    ) {
      this.error = 'Los datos exceden la longitud permitida.';
      return;
    }

    // 3. Comprobar la longitud mínima de la contraseña
    if (this.password.length < MIN_PASSWORD) {
      this.error = `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`;
      return;
    }

    // 4. Validar el acceso simulado
    if (
      usuario === USUARIO_PRUEBA &&
      this.password === PASSWORD_PRUEBA
    ) {
      this.acceso = true;
      this.password = '';
      iniciarSesionLocal(usuario); // registra la sesión para el guard (REQ-14)

      // Ir directamente a la página de Inicio
      this.router.navigate(['/inicio']);
      return;
    }

    // Mensaje genérico para credenciales incorrectas
    this.error = 'Usuario o contraseña incorrectos.';

    // No conservar la contraseña después del intento
    this.password = '';
  }

  cerrarSesion(): void {
    cerrarSesionLocal();
    this.acceso = false;
    this.usuario = '';
    this.password = '';
    this.error = '';
    this.router.navigate(['/login']);
  }
}
