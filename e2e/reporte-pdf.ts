import type { Reporter, FullConfig, Suite, TestCase, TestResult, FullResult } from '@playwright/test/reporter';
import { chromium } from '@playwright/test';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Reporter que genera un PDF con la evidencia de la corrida:
 * resumen, tabla de casos y, por cada caso, su error y su captura de pantalla.
 * Se guarda en reportes/reporte-pruebas-<fecha>.pdf
 */

interface Caso {
  titulo: string;
  estado: string;
  duracionMs: number;
  errores: string[];
  capturas: string[]; // data URLs
}

const ESTADOS: Record<string, { texto: string; clase: string }> = {
  passed: { texto: 'Aprobado', clase: 'ok' },
  failed: { texto: 'Fallido', clase: 'mal' },
  timedOut: { texto: 'Tiempo agotado', clase: 'mal' },
  skipped: { texto: 'Omitido', clase: 'omit' },
  interrupted: { texto: 'Interrumpido', clase: 'omit' },
};

// Quita los códigos de color de la terminal que traen los mensajes de error
const sinColor = (t: string) => t.replace(/\u001b\[[0-9;]*m/g, '');
const escapar = (t: string) =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export default class ReportePdf implements Reporter {
  private casos = new Map<string, Caso>();
  private baseURL = '';
  private inicio = new Date();

  onBegin(config: FullConfig, _suite: Suite) {
    this.baseURL = String(config.projects[0]?.use?.baseURL ?? '');
    this.inicio = new Date();
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const capturas = result.attachments
      .filter(a => a.contentType === 'image/png')
      .map(a => {
        const datos = a.body ?? (a.path && existsSync(a.path) ? readFileSync(a.path) : null);
        return datos ? `data:image/png;base64,${Buffer.from(datos).toString('base64')}` : '';
      })
      .filter(Boolean);

    // Si hubo reintentos, se queda el último resultado
    this.casos.set(test.id, {
      titulo: test.title,
      estado: result.status,
      duracionMs: result.duration,
      errores: result.errors.map(e => sinColor(e.message ?? String(e.value ?? ''))),
      capturas,
    });
  }

  async onEnd(_result: FullResult) {
    const casos = [...this.casos.values()];
    const aprobados = casos.filter(c => c.estado === 'passed').length;
    const fallidos = casos.filter(c => c.estado === 'failed' || c.estado === 'timedOut').length;
    const fecha = this.inicio.toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' });

    const filas = casos.map(c => {
      const e = ESTADOS[c.estado] ?? { texto: c.estado, clase: 'omit' };
      return `<tr><td>${escapar(c.titulo)}</td><td class="${e.clase}">${e.texto}</td><td>${(c.duracionMs / 1000).toFixed(1)} s</td></tr>`;
    }).join('');

    const detalle = casos.map(c => {
      const e = ESTADOS[c.estado] ?? { texto: c.estado, clase: 'omit' };
      const errores = c.errores.length
        ? `<pre>${escapar(c.errores.join('\n\n').slice(0, 2500))}</pre>`
        : '';
      const imgs = c.capturas.map(src => `<img src="${src}">`).join('');
      return `<section class="caso">
        <h3>${escapar(c.titulo)} <span class="etq ${e.clase}">${e.texto}</span></h3>
        ${errores}${imgs || '<p class="nota">Sin captura.</p>'}
      </section>`;
    }).join('');

    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
      body { font-family: Arial, sans-serif; font-size: 11px; color: #111; margin: 0; }
      h1 { font-size: 20px; margin: 0 0 4px; } h2 { font-size: 15px; margin: 18px 0 8px; }
      h3 { font-size: 12px; margin: 0 0 6px; }
      .meta { color: #555; margin-bottom: 12px; }
      .resumen { display: flex; gap: 10px; margin: 10px 0; }
      .resumen div { border: 1px solid #ccc; border-radius: 6px; padding: 8px 14px; }
      .resumen b { display: block; font-size: 18px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; }
      th { background: #f0f0f0; }
      .ok { color: #137333; font-weight: bold; } .mal { color: #b3261e; font-weight: bold; } .omit { color: #777; }
      .caso { page-break-inside: avoid; border-top: 1px solid #ddd; padding-top: 10px; margin-top: 10px; }
      .etq { font-size: 10px; margin-left: 6px; }
      pre { white-space: pre-wrap; background: #fff4f4; border: 1px solid #f2c4c4; padding: 6px; font-size: 9.5px; }
      img { max-width: 100%; max-height: 640px; border: 1px solid #ccc; display: block; margin-top: 6px; }
      .nota { color: #777; }
    </style></head><body>
      <h1>Reporte de pruebas de caja negra</h1>
      <div class="meta">Puntuaciones — Escuadrón Moriah · ${escapar(fecha)} · URL probada: ${escapar(this.baseURL)}</div>
      <div class="resumen">
        <div><b>${casos.length}</b>Casos</div>
        <div><b class="ok">${aprobados}</b>Aprobados</div>
        <div><b class="mal">${fallidos}</b>Fallidos</div>
      </div>
      <h2>Resultados</h2>
      <table><thead><tr><th>Caso</th><th>Resultado</th><th>Duración</th></tr></thead><tbody>${filas}</tbody></table>
      <h2>Evidencia por caso</h2>
      ${detalle}
    </body></html>`;

    const carpeta = resolve('reportes');
    mkdirSync(carpeta, { recursive: true });
    const d = this.inicio, dos = (n: number) => String(n).padStart(2, '0');
    const sello = `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}_${dos(d.getHours())}-${dos(d.getMinutes())}`;
    const archivo = join(carpeta, `reporte-pruebas-${sello}.pdf`);

    const navegador = await chromium.launch();
    try {
      const pagina = await navegador.newPage();
      await pagina.setContent(html, { waitUntil: 'load' });
      await pagina.pdf({
        path: archivo,
        format: 'Letter',
        printBackground: true,
        margin: { top: '15mm', bottom: '15mm', left: '12mm', right: '12mm' },
      });
      console.log(`\nReporte PDF guardado en: ${archivo}`);
    } finally {
      await navegador.close();
    }
  }
}
