import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavbarComponent } from '../../components/navbar/navbar';
import { FutterComponent } from "../../components/futter/futter";

interface PuntosEscuadra {
  nombre: string;
  juegos: number;
  tecnica: number;
  formacion: number;
  total: number;
}

@Component({
  selector: 'app-lugares',
  standalone: true,
  imports: [NavbarComponent, CommonModule, FutterComponent],
  templateUrl: './lugares.html',
  styleUrl: './lugares.css'
})
export class Lugares {
  // Por ahora datos de prueba — después conectas con tus servicios reales
  puntos: PuntosEscuadra[] = [
    { nombre: 'RRMS', juegos: 30, tecnica: 42, formacion: 85,  total: 0 },
    { nombre: 'ANK',  juegos: 20, tecnica: 38, formacion: 70,  total: 0 },
    { nombre: 'ATL',  juegos: 40, tecnica: 45, formacion: 90,  total: 0 },
    { nombre: 'MNS',  juegos: 10, tecnica: 30, formacion: 60,  total: 0 },
    { nombre: 'SMN',  juegos: 20, tecnica: 35, formacion: 75,  total: 0 },
    { nombre: 'SJN',  juegos: 30, tecnica: 40, formacion: 80,  total: 0 },
  ];

  constructor() {
    this.calcularTotales();
  }

  calcularTotales() {
    this.puntos.forEach(e => {
      e.total = e.juegos + e.tecnica + e.formacion;
    });
  }

  getRanking(): PuntosEscuadra[] {
    return [...this.puntos].sort((a, b) => b.total - a.total);
  }

  getMaxTotal(): number {
    return Math.max(...this.puntos.map(e => e.total));
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

  getLiderJuegos(): PuntosEscuadra {
  return [...this.puntos].sort((a, b) => b.juegos - a.juegos)[0];
}

getLiderTecnica(): PuntosEscuadra {
  return [...this.puntos].sort((a, b) => b.tecnica - a.tecnica)[0];
}

getLiderFormacion(): PuntosEscuadra {
  return [...this.puntos].sort((a, b) => b.formacion - a.formacion)[0];
}
}