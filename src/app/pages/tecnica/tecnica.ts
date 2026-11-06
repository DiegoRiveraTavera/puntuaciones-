import { Component, ChangeDetectorRef, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { NavbarComponent } from '../../components/navbar/navbar';
import { FutterComponent } from "../../components/futter/futter";
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { TecnicaRepositorio, CalificacionBD, Criterios, FilaParaGuardar } from '../../services/tecnica/tecnica-repositorio';
import { hoyLocal } from '../../services/datos/datos';
import { mensajeError } from '../../services/supabase/supabase';

type CalificacionTecnica = Criterios;
type Criterio = keyof CalificacionTecnica;

const MIN_CALIFICACION = 1;
const MAX_CALIFICACION = 10;
const CRITERIOS: Criterio[] = ['fuerza', 'utilidad', 'firmeza', 'estabilidad', 'originalidad'];
const ESCUADRAS_POR_DEFECTO = ['RRMS', 'ANK', 'ATL'];

interface EscuadraCalificada {
  nombre: string;
  calificacion: CalificacionTecnica;
  total: number;
}

const vacia = (): CalificacionTecnica => ({ fuerza: 0, utilidad: 0, firmeza: 0, estabilidad: 0, originalidad: 0 });

@Component({
  selector: 'app-tecnica',
  standalone: true,
  imports: [NavbarComponent, CommonModule, FormsModule, FutterComponent],
  templateUrl: './tecnica.html',
  styleUrl: './tecnica.css'
})
export class Tecnica implements OnInit, OnDestroy {
  private repo = inject(TecnicaRepositorio);
  private cdr = inject(ChangeDetectorRef);

  criterios = ['Fuerza', 'Utilidad', 'Firmeza', 'Estabilidad', 'Originalidad'];
  fecha = hoyLocal();

  // Escuadras de la sesión del día (si aún no hay, se usan las de por defecto)
  escuadras = [...ESCUADRAS_POR_DEFECTO];

  calificaciones: { [escuadra: string]: CalificacionTecnica } = {};
  // Lo que hay en la base: id, versión y escuadra_id de cada calificación
  private enBase: { [escuadra: string]: { id: number; version: number } } = {};
  private idEscuadra: { [escuadra: string]: number } = {};
  // Escuadras que la jefatura editó y todavía no guarda
  private editadas = new Set<string>();
  private dejarDeEscuchar: (() => void) | null = null;

  guardado = signal(false);
  guardando = signal(false);
  errorGuardado = signal('');
  aviso = signal('');
  // Foto de la técnica de cada escuadra. Va en un signal porque la app es zoneless.
  fotos = signal<Record<string, string>>({});
  // Fotos tomadas que todavía no se suben
  private fotosPendientes: Record<string, string> = {};
  errorFoto = signal('');
  errorNotificacion = signal('');

  constructor(private http: HttpClient) {
    this.escuadras.forEach(e => (this.calificaciones[e] = vacia()));
  }

  async ngOnInit() {
    await this.cargar();
  }

  ngOnDestroy() {
    this.dejarDeEscuchar?.();
  }

  /** Carga de la base las escuadras, calificaciones y fotos del día. */
  async cargar() {
    try {
      const datos = await this.repo.cargar(this.fecha);
      if (datos.escuadras.length > 0) {
        this.escuadras = datos.escuadras.map(e => e.nombre);
        this.escuadras.forEach(e => (this.calificaciones[e] ??= vacia()));
      }
      datos.escuadras.forEach(e => (this.idEscuadra[e.nombre] = e.id));

      for (const c of datos.calificaciones) this.aplicarDeBase(c);

      const fotos: Record<string, string> = {};
      for (const [nombre, id] of Object.entries(this.idEscuadra)) {
        if (datos.fotos[id]) fotos[nombre] = datos.fotos[id];
      }
      this.fotos.set(fotos);

      if (datos.sesionId !== null) this.escuchar(datos.sesionId);
    } catch (e) {
      this.errorGuardado.set(mensajeError(e));
    }
    this.cdr.markForCheck();
  }

  /** Tiempo real: cuando otro celular guarda, la tabla se actualiza sola (Práctica 9). */
  private escuchar(sesionId: number) {
    if (this.dejarDeEscuchar) return;
    this.dejarDeEscuchar = this.repo.suscribir(sesionId, fila => {
      const nombre = Object.keys(this.idEscuadra).find(n => this.idEscuadra[n] === fila.escuadra_id);
      if (!nombre) return;
      const local = this.enBase[nombre];
      if (local && local.version >= fila.version) return;          // es nuestro propio guardado

      if (this.editadas.has(nombre)) {
        // No se pisa lo que la jefatura está escribiendo: solo se avisa
        this.aviso.set(`Otra persona modificó la calificación de ${nombre} (v${local?.version ?? 0} → v${fila.version}). Al guardar se detectará el conflicto.`);
      } else {
        this.aplicarDeBase(fila);
        this.aviso.set(`${nombre} se actualizó desde otro dispositivo (versión ${fila.version}).`);
      }
      this.cdr.markForCheck();
    });
  }

  private aplicarDeBase(c: CalificacionBD) {
    const nombre = Object.keys(this.idEscuadra).find(n => this.idEscuadra[n] === c.escuadra_id);
    if (!nombre) return;
    this.calificaciones[nombre] = {
      fuerza: c.fuerza, utilidad: c.utilidad, firmeza: c.firmeza,
      estabilidad: c.estabilidad, originalidad: c.originalidad,
    };
    this.enBase[nombre] = { id: c.id, version: c.version };
  }

  /**
   * REQ-09: cada criterio solo acepta enteros del 1 al 10. Un valor mayor se ajusta a 10,
   * uno menor a 1, y un campo vacío cuenta como "sin calificar" (0).
   */
  ajustar(valor: unknown): number {
    if (valor === null || valor === undefined || valor === '') return 0;
    const n = Math.round(Number(valor));
    if (!Number.isFinite(n)) return 0;
    return Math.min(MAX_CALIFICACION, Math.max(MIN_CALIFICACION, n));
  }

  fijar(escuadra: string, criterio: Criterio, valor: unknown, campo: HTMLInputElement): void {
    const ajustado = this.ajustar(valor);
    this.calificaciones[escuadra][criterio] = ajustado;
    this.editadas.add(escuadra);
    const texto = ajustado === 0 ? '' : String(ajustado);
    if (campo.value !== texto) campo.value = texto; // el campo muestra el valor corregido
  }

  getTotal(escuadra: string): number {
    const c = this.calificaciones[escuadra];
    return c.fuerza + c.utilidad + c.firmeza + c.estabilidad + c.originalidad;
  }

  getRanking(): EscuadraCalificada[] {
    return this.escuadras
      .map(e => ({ nombre: e, calificacion: this.calificaciones[e], total: this.getTotal(e) }))
      .sort((a, b) => b.total - a.total);
  }

  getColor(valor: number): string {
    if (valor >= 8) return 'alto';
    if (valor >= 5) return 'medio';
    if (valor > 0) return 'bajo';
    return '';
  }

  async guardar() {
    if (this.guardando()) return;
    this.errorGuardado.set('');
    this.errorNotificacion.set('');
    this.aviso.set('');
    this.guardado.set(false);

    // Solo se guardan escuadras con los 5 criterios completos
    const incompletas = this.escuadras.filter(e => {
      const llenos = CRITERIOS.filter(k => this.calificaciones[e][k] > 0).length;
      return llenos > 0 && llenos < CRITERIOS.length;
    });
    if (incompletas.length > 0) {
      this.errorGuardado.set(`Completa los 5 criterios de: ${incompletas.join(', ')}.`);
      return;
    }
    const filas: FilaParaGuardar[] = this.escuadras
      .filter(e => this.editadas.has(e) && this.getTotal(e) > 0)
      .map(e => ({ escuadra: e, valores: { ...this.calificaciones[e] }, ...this.enBase[e] }));
    const conFotoNueva = Object.keys(this.fotosPendientes);
    if (filas.length === 0 && conFotoNueva.length === 0) {
      this.errorGuardado.set('No hay cambios por guardar.');
      return;
    }

    this.guardando.set(true);
    let seGuardoAlgo = false;
    try {
      // 1. Calificaciones en la base. El éxito solo se muestra si el servidor lo confirmó.
      const resultado = await this.repo.guardar(this.fecha, filas);
      for (const g of resultado.guardadas) {
        this.idEscuadra[g.escuadra] = g.escuadra_id;
        this.aplicarDeBase(g);
        this.editadas.delete(g.escuadra);
      }

      // 2. Fotos pendientes
      for (const escuadra of conFotoNueva) {
        const url = await this.repo.subirFoto(this.fecha, escuadra, this.fotosPendientes[escuadra], this.enBase[escuadra]?.id);
        delete this.fotosPendientes[escuadra];
        this.fotos.update(f => ({ ...f, [escuadra]: url }));
      }

      if (resultado.conflictos.length > 0) {
        this.aviso.set(`CONFLICTO: otra persona modificó ${resultado.conflictos.join(', ')} mientras editabas. ` +
          'No se sobrescribió; se cargaron los datos más recientes. Revisa y vuelve a guardar.');
        this.dejarDeEscuchar?.(); this.dejarDeEscuchar = null;
        resultado.conflictos.forEach(e => this.editadas.delete(e));
        await this.cargar();
      }
      seGuardoAlgo = resultado.guardadas.length > 0;
      if (seGuardoAlgo || conFotoNueva.length > 0) this.mostrarGuardado();

      // 3. Ahora que hay sesión en la base, escuchar cambios de otros dispositivos
      if (!this.dejarDeEscuchar) await this.cargarSoloSuscripcion();
    } catch (e) {
      this.errorGuardado.set(mensajeError(e));   // incluye "Sin conexión… No se guardó"
      this.guardando.set(false);
      this.cdr.markForCheck();
      return;
    }
    this.guardando.set(false);
    this.cdr.markForCheck();

    // 4. Si cambió alguna calificación, notificamos al reloj con la escuadra líder
    const lider = this.getRanking()[0];
    if (!seGuardoAlgo || !lider || lider.total === 0) return;
    this.http.post('/api/notificaciones/tecnica', {
      escuadra: lider.nombre,
      puntos: lider.total
    }).subscribe({
      error: () => this.errorNotificacion.set('Calificaciones guardadas, pero no se pudo notificar al reloj.'),
    });
  }

  private async cargarSoloSuscripcion() {
    try {
      const datos = await this.repo.cargar(this.fecha);
      datos.escuadras.forEach(e => (this.idEscuadra[e.nombre] = e.id));
      if (datos.sesionId !== null) this.escuchar(datos.sesionId);
    } catch { /* sin suscripción: la pantalla sigue funcionando */ }
  }

  private mostrarGuardado() {
    this.guardado.set(true);
    setTimeout(() => this.guardado.set(false), 3000);
  }

  // Abre la cámara (en el celular); la foto se sube a la base al pulsar Guardar
  async tomarFoto(escuadra: string): Promise<void> {
    this.errorFoto.set('');
    try {
      const imagen = await Camera.getPhoto({
        source: CameraSource.Camera,
        resultType: CameraResultType.DataUrl,
        quality: 70,
        width: 1280,
        correctOrientation: true,
        webUseInput: true   // en el navegador usa el selector de archivos/cámara del sistema
      });
      if (imagen.dataUrl) {
        this.fotosPendientes[escuadra] = imagen.dataUrl;
        this.fotos.update(f => ({ ...f, [escuadra]: imagen.dataUrl! }));
      }
    } catch (error: any) {
      const msg = String(error?.message ?? error).toLowerCase();
      if (msg.includes('cancel')) return;   // cerró la cámara sin tomar foto
      this.errorFoto.set(
        msg.includes('denied')
          ? 'Permiso de cámara denegado. Actívalo en los ajustes del celular.'
          : 'No se pudo abrir la cámara.'
      );
    }
  }

  quitarFoto(escuadra: string): void {
    delete this.fotosPendientes[escuadra];
    this.fotos.update(f => {
      const { [escuadra]: _quitada, ...resto } = f;
      return resto;
    });
  }

  fotoPendiente(escuadra: string): boolean {
    return escuadra in this.fotosPendientes;
  }
}
