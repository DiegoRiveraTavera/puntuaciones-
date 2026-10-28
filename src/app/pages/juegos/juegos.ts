import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavbarComponent } from '../../components/navbar/navbar';
import { FutterComponent } from "../../components/futter/futter";
import { leerDato, guardarDato } from '../../services/almacen/almacen';

const CLAVE = 'juegos';

interface Enfrentamiento {
  escuadras: string[];
  ganador: string;
}

interface Rol {
  numero: number;
  enfrentamientos: Enfrentamiento[];
}

interface Juego {
  id: number;
  nombre: string;
  valor: number;
  roles: Rol[];
}

@Component({
  selector: 'app-juegos',
  standalone: true,
  imports: [NavbarComponent, CommonModule, FormsModule, FutterComponent],
  templateUrl: './juegos.html',
  styleUrl: './juegos.css'
})
export class Juegos implements OnInit {
  // Escuadras disponibles (hardcodeadas por ahora)
  escuadrasDisponibles = ['RRMS', 'ANK', 'ATL', 'MNS', 'SMN', 'SJN'];

  juegos: Juego[] = [];
  juegoActivo: Juego | null = null;
  guardado = signal(false);
  errorGuardado = signal(false);

  // Form nuevo juego
  nuevoNombre = '';
  nuevoValor = 0;

  // Al entrar se recuperan los juegos guardados en el dispositivo
  ngOnInit() {
    const guardados = leerDato<Juego[]>(CLAVE, []);
    if (Array.isArray(guardados) && guardados.length > 0) {
      this.juegos = guardados;
      this.juegoActivo = guardados[0];
    }
  }

  agregarJuego() {
    if (!this.nuevoNombre.trim() || this.nuevoValor <= 0) return;
    const juego: Juego = {
      id: Date.now(),
      nombre: this.nuevoNombre.trim(),
      valor: this.nuevoValor,
      roles: []
    };
    this.juegos.push(juego);
    this.juegoActivo = juego;
    this.nuevoNombre = '';
    this.nuevoValor = 0;
  }

  agregarRol(juego: Juego) {
    juego.roles.push({
      numero: juego.roles.length + 1,
      enfrentamientos: []
    });
  }

  agregarEnfrentamiento(rol: Rol) {
    rol.enfrentamientos.push({
      escuadras: ['', ''],
      ganador: ''
    });
  }

  agregarEscuadraAlEnfrentamiento(enf: Enfrentamiento) {
    enf.escuadras.push('');
  }

  quitarEscuadraDelEnfrentamiento(enf: Enfrentamiento, index: number) {
    if (enf.escuadras.length <= 2) return;
    // REQ-12: se guarda el nombre ANTES de quitarla; antes se comparaba después del
    // splice, con la escuadra que ocupaba ese lugar, y la ganadora conservaba sus puntos
    const quitada = enf.escuadras[index];
    enf.escuadras.splice(index, 1);
    if (quitada && enf.ganador === quitada) enf.ganador = '';
  }

  eliminarEnfrentamiento(rol: Rol, index: number) {
    rol.enfrentamientos.splice(index, 1);
  }

  eliminarRol(juego: Juego, index: number) {
    juego.roles.splice(index, 1);
    juego.roles.forEach((r, i) => r.numero = i + 1);
  }

  getPuntosEscuadra(escuadra: string): number {
    let total = 0;
    this.juegos.forEach(j => {
      j.roles.forEach(r => {
        r.enfrentamientos.forEach(enf => {
          if (enf.ganador === escuadra) total += j.valor;
        });
      });
    });
    return total;
  }

  getResumen(): { nombre: string; puntos: number }[] {
    return this.escuadrasDisponibles
      .map(e => ({ nombre: e, puntos: this.getPuntosEscuadra(e) }))
      .filter(e => e.puntos > 0)
      .sort((a, b) => b.puntos - a.puntos);
  }

  guardar() {
    // Ahora sí se guarda en el dispositivo; solo se confirma si se logró
    const ok = guardarDato(CLAVE, this.juegos);
    this.guardado.set(ok);
    this.errorGuardado.set(!ok);
    setTimeout(() => this.guardado.set(false), 3000);
  }

  trackByIndex(index: number) { return index; }
}