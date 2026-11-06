import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { NavbarComponent } from '../../components/navbar/navbar';
import { WearableWidgetComponent } from '../../components/wearable-widget/wearable-widget';
import { FutterComponent } from "../../components/futter/futter";
import { escuadrasDeFecha, guardarEscuadrasDeFecha, hoyLocal } from '../../services/datos/datos';
import { mensajeError } from '../../services/supabase/supabase';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [NavbarComponent, FormsModule, CommonModule, WearableWidgetComponent, FutterComponent],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class Home implements OnInit {
  fecha: string = hoyLocal();
  nuevaEscuadra: string = '';
  // Signals: la app es zoneless y estos valores cambian cuando responde el servidor
  escuadras = signal<string[]>([]);
  guardado = signal(false);
  errorGuardado = signal('');
  cargando = signal(false);

  // Al entrar se cargan desde la base de datos las escuadras registradas para la fecha
  ngOnInit() {
    this.cargar();
  }

  async cargar() {
    this.cargando.set(true);
    this.errorGuardado.set('');
    try {
      const lista = await escuadrasDeFecha(this.fecha);
      this.escuadras.set(lista.map(e => e.nombre));
    } catch (e) {
      this.errorGuardado.set(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  cambiarFecha(fecha: string) {
    this.fecha = fecha;
    this.guardado.set(false);
    this.cargar();
  }

  agregar() {
    const nombre = this.nuevaEscuadra.trim();
    if (!nombre) return;

    // REQ-08: evita duplicados sin importar mayúsculas y minúsculas (RRMS = rrms)
    const repetida = this.escuadras().find(e => e.toUpperCase() === nombre.toUpperCase());
    if (repetida) {
      alert(`"${repetida}" ya está en la lista`);
      return;
    }

    this.escuadras.update(lista => [...lista, nombre]);
    this.nuevaEscuadra = '';
    this.guardado.set(false);
  }

  eliminar(index: number) {
    this.escuadras.update(lista => lista.filter((_, i) => i !== index));
    this.guardado.set(false);
  }

  async guardar() {
    if (this.escuadras().length === 0) {
      alert('Agrega al menos una escuadra antes de guardar');
      return;
    }
    this.errorGuardado.set('');
    this.cargando.set(true);
    try {
      // Se guarda en Supabase; el mensaje de éxito solo sale si el servidor confirmó
      await guardarEscuadrasDeFecha(this.fecha, this.escuadras());
      this.guardado.set(true);
      setTimeout(() => this.guardado.set(false), 3000); // oculta el mensaje a los 3s
    } catch (e) {
      this.errorGuardado.set(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }
}
