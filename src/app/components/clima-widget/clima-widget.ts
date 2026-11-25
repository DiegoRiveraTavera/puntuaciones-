import { Component, OnInit, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ClimaActual, ClimaService, Lugar, PUNTO_REUNION, Recomendacion, mensajeClima, recomendar } from '../../services/clima/clima';

/**
 * Tarjeta de clima del Inicio: clima actual del punto de reunión y la recomendación
 * de hacer la actividad al aire libre o bajo techo. Con «Usar mi ubicación» consulta
 * el clima donde está el celular (GPS).
 */
@Component({
  selector: 'app-clima-widget',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './clima-widget.html',
  styleUrl: './clima-widget.css',
})
export class ClimaWidgetComponent implements OnInit {
  private servicio = inject(ClimaService);

  lugar = signal<Lugar>(PUNTO_REUNION);
  clima = signal<ClimaActual | null>(null);
  recomendacion = signal<Recomendacion | null>(null);
  cargando = signal(false);
  error = signal('');

  ngOnInit() {
    this.actualizar();
  }

  async actualizar() {
    this.cargando.set(true);
    this.error.set('');
    try {
      const clima = await this.servicio.consultar(this.lugar());
      this.clima.set(clima);
      this.recomendacion.set(recomendar(clima));
    } catch (e) {
      this.error.set(mensajeClima(e));
    } finally {
      this.cargando.set(false);
    }
  }

  async usarMiUbicacion() {
    this.cargando.set(true);
    this.error.set('');
    try {
      const pos = await this.servicio.ubicacionActual();
      this.lugar.set({ nombre: 'Tu ubicación', ...pos });
    } catch (e) {
      this.cargando.set(false);
      this.error.set(mensajeClima(new Error('ubicación: ' + String((e as Error)?.message ?? e))));
      return;
    }
    await this.actualizar();
  }

  usarPuntoDeReunion() {
    this.lugar.set(PUNTO_REUNION);
    this.actualizar();
  }

  /** Hora corta (HH:mm) de la medición. */
  hora(): string {
    return this.clima()?.hora.split('T')[1] ?? '';
  }
}
