import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { NavbarComponent } from '../../components/navbar/navbar';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [NavbarComponent, FormsModule, CommonModule],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class Home {
  fecha: string = new Date().toISOString().split('T')[0];
  nuevaEscuadra: string = '';
  escuadras: string[] = [];

  agregar() {
    if (this.nuevaEscuadra.trim()) {
      this.escuadras.push(this.nuevaEscuadra.trim());
      this.nuevaEscuadra = '';
    }
  }

  guardar() {
    console.log('Escuadras guardadas:', this.escuadras);
    // aquí después conectas con tu API Express
  }
}