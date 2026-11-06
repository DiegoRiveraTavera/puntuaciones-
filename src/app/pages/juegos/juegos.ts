import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavbarComponent } from '../../components/navbar/navbar';
import { FutterComponent } from "../../components/futter/futter";
import { Enfrentamiento, Juego, JuegosRepositorio, Rol } from '../../services/juegos/juegos-repositorio';
import { hoyLocal } from '../../services/datos/datos';
import { mensajeError } from '../../services/supabase/supabase';

@Component({
  selector: 'app-juegos',
  standalone: true,
  imports: [NavbarComponent, CommonModule, FormsModule, FutterComponent],
  templateUrl: './juegos.html',
  styleUrl: './juegos.css'
})
export class Juegos implements OnInit {
  // Escuadras que se pueden elegir: las registradas en Inicio para hoy (se cargan de la base)
  escuadrasDisponibles: string[] = [];
  fecha = hoyLocal();

  juegos: Juego[] = [];
  juegoActivo: Juego | null = null;
  // Signals: la app es zoneless y estos valores cambian cuando responde el servidor
  guardado = signal(false);
  errorGuardado = signal('');
  cargando = signal(false);
  guardando = signal(false);

  // Form nuevo juego
  nuevoNombre = '';
  nuevoValor = 0;

  // El repositorio se inyecta; con `new Juegos()` (pruebas unitarias) se usa uno nuevo
  constructor(private repo: JuegosRepositorio = new JuegosRepositorio()) {}

  // Al entrar se cargan desde la base de datos los juegos del día
  ngOnInit() {
    this.cargar();
  }

  async cargar() {
    this.cargando.set(true);
    this.errorGuardado.set('');
    try {
      const datos = await this.repo.cargar(this.fecha);
      this.escuadrasDisponibles = datos.escuadras;
      this.juegos = datos.juegos;
      this.juegoActivo = datos.juegos[0] ?? null;
    } catch (e) {
      this.errorGuardado.set(mensajeError(e));
    } finally {
      this.cargando.set(false);
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
    // Se cuentan las escuadras de la lista y también cualquier ganadora que no esté en ella
    const ganadoras = this.juegos.flatMap(j => j.roles.flatMap(r => r.enfrentamientos.map(e => e.ganador)));
    const nombres = [...new Set([...this.escuadrasDisponibles, ...ganadoras.filter(Boolean)])];
    return nombres
      .map(e => ({ nombre: e, puntos: this.getPuntosEscuadra(e) }))
      .filter(e => e.puntos > 0)
      .sort((a, b) => b.puntos - a.puntos);
  }

  async guardar() {
    if (this.guardando()) return;
    this.errorGuardado.set('');
    this.guardado.set(false);

    // Un ganador debe ser una de las escuadras del enfrentamiento
    for (const j of this.juegos) for (const r of j.roles) for (const e of r.enfrentamientos) {
      if (e.ganador && !e.escuadras.includes(e.ganador)) e.ganador = '';
    }

    this.guardando.set(true);
    try {
      // Se guarda en Supabase; el mensaje de éxito solo sale si el servidor confirmó
      const ids = await this.repo.guardar(this.fecha, this.juegos);
      this.juegos.forEach(j => { const id = ids.get(j.id); if (id !== undefined) j.dbId = id; });
      this.guardado.set(true);
      setTimeout(() => this.guardado.set(false), 3000);
    } catch (e) {
      this.errorGuardado.set(mensajeError(e));
    } finally {
      this.guardando.set(false);
    }
  }

  trackByIndex(index: number) { return index; }
}