import { Injectable } from '@angular/core';
import { EscuadraService } from '../escuadra/escuadra';

export interface WearablePayload {
  escuadra: string;
  totalMiembros: number;
  totalPuntos: number;
  ultimaActualizacion: string;
  alertas: string[];
}

@Injectable({ providedIn: 'root' })
export class WearableSyncService {

  constructor(private escuadraService: EscuadraService) {}

  generarPayload(nombreEscuadra: string): WearablePayload | null {
    const escuadra = this.escuadraService
      .getEscuadras()
      .find(e => e.nombre === nombreEscuadra);

    if (!escuadra) return null;

    const alertas: string[] = [];
    if (escuadra.adeudoPendiente) alertas.push('Adeudo pendiente');
    if (escuadra.pruebasIncompletas) alertas.push('Pruebas incompletas');

    return {
      escuadra: escuadra.nombre,
      totalMiembros: escuadra.totalMiembros,
      totalPuntos: escuadra.totalPuntos,
      ultimaActualizacion: new Date().toISOString(),
      alertas
    };
  }

  async enviarAWearable(payload: WearablePayload): Promise<boolean> {
    console.log('[WearableSync] Enviando payload al dispositivo:', payload);
    await new Promise(resolve => setTimeout(resolve, 600));
    return true;
  }
}