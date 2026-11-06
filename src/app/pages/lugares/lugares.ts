import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavbarComponent } from '../../components/navbar/navbar';
import { FutterComponent } from "../../components/futter/futter";
import { fechaLegible, obtenerRanking, PuntosEscuadra } from '../../services/ranking/ranking';
import { mensajeError } from '../../services/supabase/supabase';

@Component({
  selector: 'app-lugares',
  standalone: true,
  imports: [NavbarComponent, CommonModule, FutterComponent],
  templateUrl: './lugares.html',
  styleUrl: './lugares.css'
})
export class Lugares implements OnInit {
  // Puntos de la vista ranking_general de Supabase (Juegos + Técnica + Formación)
  puntos: PuntosEscuadra[] = [];
  // Signals: la app es zoneless y estos valores cambian cuando responde el servidor
  fecha = signal<string | null>(null);
  cargando = signal(true);
  error = signal('');

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

  getRanking(): PuntosEscuadra[] {
    return [...this.puntos].sort((a, b) => b.total - a.total);
  }

  getMaxTotal(): number {
    return Math.max(0, ...this.puntos.map(e => e.total));
  }

  getMedalla(index: number): string {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return `${index + 1}°`;
  }

  getPosicionClass(index: number): string {
    if (index === 0) return 'oro';
    if (index === 1) return 'plata';
    if (index === 2) return 'bronce';
    return 'normal';
  }

  getPorcentaje(valor: number): number {
    const max = this.getMaxTotal();
    return max === 0 ? 0 : (valor / max) * 100;
  }

  getLiderJuegos(): PuntosEscuadra | undefined {
  return [...this.puntos].sort((a, b) => b.juegos - a.juegos)[0];
}

getLiderTecnica(): PuntosEscuadra | undefined {
  return [...this.puntos].sort((a, b) => b.tecnica - a.tecnica)[0];
}

getLiderFormacion(): PuntosEscuadra | undefined {
  return [...this.puntos].sort((a, b) => b.formacion - a.formacion)[0];
}
}