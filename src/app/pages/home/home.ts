import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { NavbarComponent } from '../../components/navbar/navbar';
import { WearableWidgetComponent } from '../../components/wearable-widget/wearable-widget';
import { FutterComponent } from "../../components/futter/futter";

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [NavbarComponent, FormsModule, CommonModule, WearableWidgetComponent, FutterComponent],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class Home {
  fecha: string = new Date().toISOString().split('T')[0];
  nuevaEscuadra: string = '';
  escuadras: string[] = [];
  guardado: boolean = false;

  agregar() {
    const nombre = this.nuevaEscuadra.trim();
    if (!nombre) return;

    // Evita duplicados
    if (this.escuadras.includes(nombre)) {
      alert(`"${nombre}" ya está en la lista`);
      return;
    }

    this.escuadras.push(nombre);
    this.nuevaEscuadra = '';
    this.guardado = false;
  }

  eliminar(index: number) {
    this.escuadras.splice(index, 1);
    this.guardado = false;
  }

  guardar() {
    if (this.escuadras.length === 0) {
      alert('Agrega al menos una escuadra antes de guardar');
      return;
    }
    // Por ahora solo confirma visualmente
    this.guardado = true;
    setTimeout(() => this.guardado = false, 3000); // oculta el mensaje a los 3s
  }
}