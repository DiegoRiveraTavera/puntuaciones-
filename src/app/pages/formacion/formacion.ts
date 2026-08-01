import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavbarComponent } from '../../components/navbar/navbar';
import { FutterComponent } from "../../components/futter/futter";

interface Miembro {
  nombre: string;
  uniforme: boolean;
  cursos: string;
  pruebas: string;
}

interface DatosFormacion {
  miembros: Miembro[];
  uniformeJefe: boolean;
  banderin: boolean;
  bandera: boolean;
  escudo: boolean;
  bolsa: boolean;
  botiquin: boolean;
  biblia: boolean;
  materiales: { tecnica: number; quizz: number; juegos: number };
  extras: { cuotas: number; adeudo: number };
}

@Component({
  selector: 'app-formacion',
  standalone: true,
  imports: [NavbarComponent, CommonModule, FormsModule, FutterComponent],
  templateUrl: './formacion.html',
  styleUrl: './formacion.css'
})
export class Formacion {
  escuadrasDisponibles = ['RRMS', 'ANK', 'ATL', 'MNS', 'SMN', 'SJN'];
  escuadraSeleccionada = '';
  guardado = signal(false);

  datos: { [escuadra: string]: DatosFormacion } = {};

  get datosActuales(): DatosFormacion | null {
    return this.escuadraSeleccionada
      ? this.datos[this.escuadraSeleccionada]
      : null;
  }

  seleccionar(nombre: string) {
    this.escuadraSeleccionada = nombre;
    if (!this.datos[nombre]) {
      this.datos[nombre] = {
        miembros: Array.from({ length: 14 }, () => ({
          nombre: '', uniforme: false, cursos: '', pruebas: ''
        })),
        uniformeJefe: false,
        banderin: false, bandera: false, escudo: false,
        bolsa: false, botiquin: false, biblia: false,
        materiales: { tecnica: 0, quizz: 0, juegos: 0 },
        extras: { cuotas: 0, adeudo: 0 }
      };
    }
  }

  getMiembrosConUniforme(): number {
    if (!this.datosActuales) return 0;
    return this.datosActuales.miembros.filter(m => m.uniforme && m.nombre.trim()).length;
  }

  getPuntosUniforme(): number {
    if (!this.datosActuales) return 0;
    let pts = this.getMiembrosConUniforme() * 10;
    if (this.datosActuales.uniformeJefe) pts += 10;
    return pts;
  }

  getPuntosMateriales(): number {
    if (!this.datosActuales) return 0;
    const m = this.datosActuales.materiales;
    return (m.tecnica + m.quizz + m.juegos) * 10;
  }

  getPuntosExtras(): number {
    if (!this.datosActuales) return 0;
    const accesorios = [
      this.datosActuales.banderin, this.datosActuales.bandera,
      this.datosActuales.escudo, this.datosActuales.bolsa,
      this.datosActuales.botiquin, this.datosActuales.biblia
    ];
    return accesorios.filter(Boolean).length * 5;
  }

  getTotalPuntos(): number {
    return this.getPuntosUniforme() + this.getPuntosMateriales() + this.getPuntosExtras();
  }

  getAdeudo(): number {
    if (!this.datosActuales) return 0;
    return (this.datosActuales.extras.adeudo || 0) - (this.datosActuales.extras.cuotas || 0);
  }

  guardar() {
    this.guardado.set(true);
    setTimeout(() => this.guardado.set(false), 3000);
  }
}