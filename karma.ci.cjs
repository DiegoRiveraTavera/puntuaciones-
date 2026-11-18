// Prácticas 13 y 14 — Karma para integración continua (GitHub Actions) y para correr todo en local.
// Uso: npm run test:ci
//  · Chrome sin interfaz y sin sandbox (los runners de CI corren como usuario sin escritorio).
//  · Reporte de cobertura en coverage/ci y un resumen en reportes/ci/resumen-pruebas.json.
//  · En GitHub Actions, el resumen también se escribe en la página de la ejecución ($GITHUB_STEP_SUMMARY).
const fs = require('fs');
const path = require('path');

function ResumenReporter(baseReporterDecorator) {
  baseReporterDecorator(this);
  const pruebas = [];
  const inicio = Date.now();
  this.onSpecComplete = (_navegador, r) => {
    pruebas.push({
      suite: r.suite.join(' › '), prueba: r.description, ms: r.time,
      estado: r.skipped ? 'omitida' : r.success ? 'aprobada' : 'fallida',
      error: r.success ? undefined : (r.log || []).join('\n').split('\n').slice(0, 3).join(' '),
    });
  };
  this.onRunComplete = (_navegadores, resultado) => {
    const n = (e) => pruebas.filter((p) => p.estado === e).length;
    const resumen = {
      fecha: new Date().toISOString(),
      commit: process.env.GITHUB_SHA || null,
      evento: process.env.GITHUB_EVENT_NAME || 'local',
      total: pruebas.length, aprobadas: n('aprobada'), fallidas: n('fallida'), omitidas: n('omitida'),
      duracionS: Math.round((Date.now() - inicio) / 100) / 10,
      errorDeEjecucion: resultado.error || false,
      porGrupo: Object.entries(pruebas.reduce((g, p) => {
        const clave = p.suite.split(' › ')[0];
        (g[clave] ??= { aprobadas: 0, fallidas: 0 })[p.estado === 'fallida' ? 'fallidas' : 'aprobadas']++;
        return g;
      }, {})).map(([grupo, v]) => ({ grupo, ...v })),
      detalleFallidas: pruebas.filter((p) => p.estado === 'fallida'),
    };
    const dir = path.join(__dirname, 'reportes/ci');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'resumen-pruebas.json'), JSON.stringify(resumen, null, 1));
    if (process.env.GITHUB_STEP_SUMMARY) {
      const filas = resumen.porGrupo.map((g) => `| ${g.grupo} | ${g.aprobadas} | ${g.fallidas} |`).join('\n');
      const malas = resumen.detalleFallidas.map((p) => `- ❌ **${p.suite}** › ${p.prueba}`).join('\n');
      fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
        `## Pruebas de la app (Karma)\n\n**${resumen.aprobadas} de ${resumen.total} aprobadas**, ` +
        `${resumen.fallidas} fallidas, en ${resumen.duracionS} s\n\n| Grupo | Aprobadas | Fallidas |\n| --- | --- | --- |\n${filas}\n\n${malas}\n`);
    }
  };
}
ResumenReporter.$inject = ['baseReporterDecorator'];

module.exports = function (config) {
  config.set({
    frameworks: ['jasmine'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-coverage'),
      { 'reporter:resumen': ['type', ResumenReporter] },
    ],
    browsers: ['ChromeHeadlessCI'],
    customLaunchers: { ChromeHeadlessCI: { base: 'ChromeHeadless', flags: ['--no-sandbox'] } },
    reporters: ['dots', 'coverage', 'resumen'],
    client: { jasmine: { random: false } },
    coverageReporter: {
      dir: path.join(__dirname, 'coverage/ci'),
      subdir: '.',
      reporters: [{ type: 'html' }, { type: 'json-summary' }, { type: 'text-summary' }],
    },
    browserNoActivityTimeout: 120000,
    singleRun: true,
  });
};
