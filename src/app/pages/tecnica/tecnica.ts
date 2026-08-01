import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavbarComponent } from '../../components/navbar/navbar';
import { FutterComponent } from "../../components/futter/futter";

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

  constructor() {
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
  }
}