import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavbarComponent } from '../../components/navbar/navbar';
import { FutterComponent } from '../../components/futter/futter';

interface PuntosEscuadra {
  nombre: string;
  juegos: number;
  tecnica: number;
  formacion: number;
  total: number;
}

@Component({
  selector: 'app-estadisticas',
  standalone: true,
  imports: [CommonModule, NavbarComponent, FutterComponent],
  templateUrl: './estadisticas.html',
  styleUrl: './estadisticas.css'
})
export class Estadisticas {
  // Por ahora datos de prueba — mismos que lugares.ts, después los conectas a un servicio compartido
  puntos: PuntosEscuadra[] = [
    { nombre: 'RRMS', juegos: 30, tecnica: 42, formacion: 85, total: 0 },
    { nombre: 'ANK',  juegos: 20, tecnica: 38, formacion: 70, total: 0 },
    { nombre: 'ATL',  juegos: 40, tecnica: 45, formacion: 90, total: 0 },
    { nombre: 'MNS',  juegos: 10, tecnica: 30, formacion: 60, total: 0 },
    { nombre: 'SMN',  juegos: 20, tecnica: 35, formacion: 75, total: 0 },
    { nombre: 'SJN',  juegos: 30, tecnica: 40, formacion: 80, total: 0 },
  ];

  colores = ['#1a73e8', '#2e7d32', '#F5A623', '#A32D2D', '#7A4E00', '#0C447C'];

  constructor() {
    this.puntos.forEach(e => e.total = e.juegos + e.tecnica + e.formacion);
  }

  get maxTotal(): number {
    return Math.max(...this.puntos.map(e => e.total));
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

  get lider(): PuntosEscuadra {
    return [...this.puntos].sort((a, b) => b.total - a.total)[0];
  }
}