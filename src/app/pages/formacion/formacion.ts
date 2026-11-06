import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavbarComponent } from '../../components/navbar/navbar';
import { FutterComponent } from "../../components/futter/futter";
import { hoyLocal } from '../../services/datos/datos';
import { mensajeError } from '../../services/supabase/supabase';
import { DatosFormacion, FormacionRepositorio, formacionVacia } from '../../services/formacion/formacion-repositorio';

@Component({
  selector: 'app-formacion',
  standalone: true,
  imports: [NavbarComponent, CommonModule, FormsModule, FutterComponent],
  templateUrl: './formacion.html',
  styleUrl: './formacion.css'
})
export class Formacion implements OnInit {
  // Escuadras que se pueden elegir: las registradas en Inicio para hoy (se cargan de la base)
  escuadrasDisponibles: string[] = [];
  escuadraSeleccionada = '';
  fecha = hoyLocal();
  // Signals: la app es zoneless y estos valores cambian cuando responde el servidor
  guardado = signal(false);
  errorGuardado = signal('');
  cargando = signal(false);
  guardando = signal(false);

  datos: { [escuadra: string]: DatosFormacion } = {};

  // El repositorio se inyecta; con `new Formacion()` (pruebas unitarias) se usa uno nuevo
  constructor(private repo: FormacionRepositorio = new FormacionRepositorio()) {}

  // Al entrar se carga de la base de datos lo registrado hoy
  ngOnInit() {
    this.cargar();
  }

  async cargar() {
    this.cargando.set(true);
    this.errorGuardado.set('');
    try {
      const r = await this.repo.cargar(this.fecha);
      this.escuadrasDisponibles = r.escuadras;
      this.datos = r.datos;
    } catch (e) {
      this.errorGuardado.set(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  get datosActuales(): DatosFormacion | null {
    return this.escuadraSeleccionada
      ? this.datos[this.escuadraSeleccionada]
      : null;
  }

  seleccionar(nombre: string) {
    this.escuadraSeleccionada = nombre;
    this.guardado.set(false);
    if (nombre && !this.datos[nombre]) this.datos[nombre] = formacionVacia();
  }

  // ── Cálculo de puntos (de una escuadra cualquiera; por defecto la seleccionada) ──
  getMiembrosConUniforme(d = this.datosActuales): number {
    if (!d) return 0;
    return d.miembros.filter(m => m.uniforme && m.nombre.trim()).length;
  }

  getPuntosUniforme(d = this.datosActuales): number {
    if (!d) return 0;
    let pts = this.getMiembrosConUniforme(d) * 10;
    if (d.uniformeJefe) pts += 10;
    return pts;
  }

  getPuntosMateriales(d = this.datosActuales): number {
    if (!d) return 0;
    const m = d.materiales;
    return ((m.tecnica || 0) + (m.quizz || 0) + (m.juegos || 0)) * 10;
  }

  getPuntosExtras(d = this.datosActuales): number {
    if (!d) return 0;
    const accesorios = [d.banderin, d.bandera, d.escudo, d.bolsa, d.botiquin, d.biblia];
    return accesorios.filter(Boolean).length * 5;
  }

  getTotalPuntos(d = this.datosActuales): number {
    return this.getPuntosUniforme(d) + this.getPuntosMateriales(d) + this.getPuntosExtras(d);
  }

  getAdeudo(): number {
    if (!this.datosActuales) return 0;
    return (this.datosActuales.extras.adeudo || 0) - (this.datosActuales.extras.cuotas || 0);
  }

  async guardar() {
    if (this.guardando()) return;
    this.errorGuardado.set('');
    this.guardado.set(false);

    const filas = Object.entries(this.datos).map(([escuadra, d]) => {
      // Un campo numérico vacío cuenta como 0
      d.materiales = { tecnica: d.materiales.tecnica || 0, quizz: d.materiales.quizz || 0, juegos: d.materiales.juegos || 0 };
      d.extras = { cuotas: d.extras.cuotas || 0, adeudo: d.extras.adeudo || 0 };
      return { escuadra, datos: d, puntos: this.getTotalPuntos(d) };
    });

    // Validaciones antes de enviar (la base también las revisa)
    for (const { escuadra, datos: d } of filas) {
      const m = d.materiales;
      if ([m.tecnica, m.quizz, m.juegos].some(v => v < 0 || !Number.isInteger(v))) {
        this.errorGuardado.set(`${escuadra}: los materiales deben ser números enteros de 0 o más.`);
        return;
      }
      if (d.extras.cuotas < 0 || d.extras.adeudo < 0) {
        this.errorGuardado.set(`${escuadra}: las cuotas y el adeudo no pueden ser negativos.`);
        return;
      }
    }
    if (filas.length === 0) {
      this.errorGuardado.set('Elige una escuadra y captura sus datos antes de guardar.');
      return;
    }

    this.guardando.set(true);
    try {
      // Se guarda en Supabase; el mensaje de éxito solo sale si el servidor confirmó
      await this.repo.guardar(this.fecha, filas);
      this.guardado.set(true);
      setTimeout(() => this.guardado.set(false), 3000);
    } catch (e) {
      this.errorGuardado.set(mensajeError(e));
    } finally {
      this.guardando.set(false);
    }
  }
}