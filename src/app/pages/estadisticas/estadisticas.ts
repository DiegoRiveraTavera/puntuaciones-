import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavbarComponent } from '../../components/navbar/navbar';
import { FutterComponent } from '../../components/futter/futter';
import { fechaLegible, obtenerRanking, PuntosEscuadra } from '../../services/ranking/ranking';
import { mensajeError } from '../../services/supabase/supabase';

@Component({
  selector: 'app-estadisticas',
  standalone: true,
  imports: [CommonModule, NavbarComponent, FutterComponent],
  templateUrl: './estadisticas.html',
  styleUrl: './estadisticas.css'
})
export class Estadisticas implements OnInit {
  // Puntos de la vista ranking_general de Supabase (Juegos + Técnica + Formación)
  puntos: PuntosEscuadra[] = [];
  // Signals: la app es zoneless y estos valores cambian cuando responde el servidor
  fecha = signal<string | null>(null);
  cargando = signal(true);
  error = signal('');

colores = ['#14B8A6', '#7C3AED', '#0D9488', '#5B21B6', '#111111', '#333333'];
  ngOnInit() {
    this.cargar();
  }

  async cargar() {
    this.cargando.set(true);
    this.error.set('');
    try {
      const r = await obtenerRanking();
      this.puntos = r.puntos;
      this.fecha.set(r.fecha);
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  fechaTexto(): string {
    const f = this.fecha();
    return f ? fechaLegible(f) : '';
  }

  get maxTotal(): number {
    return Math.max(0, ...this.puntos.map(e => e.total));
  }

  getAltura(valor: number): number {
    return this.maxTotal === 0 ? 0 : (valor / this.maxTotal) * 200;
  }

  getColor(index: number): string {
    return this.colores[index % this.colores.length];
  }

  get totalGeneral(): number {
    return this.puntos.reduce((sum, e) => sum + e.total, 0);
  }

  get promedio(): number {
    return this.puntos.length === 0 ? 0 : Math.round(this.totalGeneral / this.puntos.length);
  }

  get lider(): PuntosEscuadra | undefined {
    return [...this.puntos].sort((a, b) => b.total - a.total)[0];
  }
}