import { Injectable } from '@angular/core';

export interface Escuadra {
  nombre: string;
  totalMiembros: number;
  totalPuntos: number;
  adeudoPendiente: boolean;
  pruebasIncompletas: boolean;
}

@Injectable({ providedIn: 'root' })
export class EscuadraService {
  // Datos de prueba para que el widget tenga algo que mostrar.
  // Más adelante puedes conectar esto a tu home real.
  private escuadras: Escuadra[] = [
    { nombre: 'RRMS', totalMiembros: 12, totalPuntos: 85, adeudoPendiente: true, pruebasIncompletas: false },
    { nombre: 'ANK',  totalMiembros: 9,  totalPuntos: 60, adeudoPendiente: false, pruebasIncompletas: true },
  ];

  getEscuadras(): Escuadra[] {
    return this.escuadras;
  }

  getNombres(): string[] {
    return this.escuadras.map(e => e.nombre);
  }
}