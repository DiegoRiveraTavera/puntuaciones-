import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { NavbarComponent } from '../../components/navbar/navbar';
import { WearableWidgetComponent } from '../../components/wearable-widget/wearable-widget';
import { FutterComponent } from "../../components/futter/futter";
import { leerDato, guardarDato } from '../../services/almacen/almacen';

interface DatosInicio {
  fecha: string;
  escuadras: string[];
}

const CLAVE = 'inicio';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [NavbarComponent, FormsModule, CommonModule, WearableWidgetComponent, FutterComponent],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class Home implements OnInit {
  fecha: string = new Date().toISOString().split('T')[0];
  nuevaEscuadra: string = '';
  escuadras: string[] = [];
  guardado: boolean = false;
  errorGuardado: boolean = false;

  // REQ-11: al entrar se recupera lo último que se guardó en el dispositivo
  ngOnInit() {
    const datos = leerDato<DatosInicio | null>(CLAVE, null);
    if (datos) {
      this.fecha = datos.fecha || this.fecha;
      this.escuadras = Array.isArray(datos.escuadras) ? datos.escuadras : [];
    }
  }

  agregar() {
    const nombre = this.nuevaEscuadra.trim();
    if (!nombre) return;

    // REQ-08: evita duplicados sin importar mayúsculas y minúsculas (RRMS = rrms)
    const repetida = this.escuadras.find(e => e.toUpperCase() === nombre.toUpperCase());
    if (repetida) {
      alert(`"${repetida}" ya está en la lista`);
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
    // REQ-11: ahora sí se guarda en el dispositivo; solo se confirma si se logró
    const ok = guardarDato<DatosInicio>(CLAVE, { fecha: this.fecha, escuadras: this.escuadras });
    this.guardado = ok;
    this.errorGuardado = !ok;
    setTimeout(() => this.guardado = false, 3000); // oculta el mensaje a los 3s
  }
}
