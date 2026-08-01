import { Component, Input, OnChanges, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WearableSyncService, WearablePayload } from '../../services/wearable/wearable-sync';

@Component({
  selector: 'app-wearable-widget',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './wearable-widget.html',
  styleUrl: './wearable-widget.css'
})
export class WearableWidgetComponent implements OnChanges {
  @Input() nombreEscuadra: string = '';

  payload = signal<WearablePayload | null>(null);
  enviando = signal(false);
  enviado = signal(false);

  constructor(private wearableSync: WearableSyncService) {}

  ngOnChanges() {
    if (this.nombreEscuadra) {
      this.payload.set(this.wearableSync.generarPayload(this.nombreEscuadra));
      this.enviado.set(false);
    }
  }

  async sincronizar() {
    const data = this.payload();
    if (!data) return;

    this.enviando.set(true);
    const ok = await this.wearableSync.enviarAWearable(data);
    this.enviando.set(false);
    this.enviado.set(ok);
  }
}