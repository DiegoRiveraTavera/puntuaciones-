// Práctica 11 — Karma con reporte de cobertura (instrucciones, ramas, funciones y líneas).
// Uso: npm run test:whitebox   → reporte HTML en coverage/whitebox/index.html
module.exports = function (config) {
  config.set({
    frameworks: ['jasmine'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-coverage'),
    ],
    browsers: [process.env.KARMA_NAVEGADOR || 'ChromeHeadless'],
    customLaunchers: { ChromeSinSandbox: { base: 'ChromeHeadless', flags: ['--no-sandbox'] } },
    reporters: ['progress', 'coverage'],
    client: { captureConsole: true },
    browserConsoleLogOptions: { level: 'log', terminal: true },
    coverageReporter: {
      dir: require('path').join(__dirname, 'coverage/whitebox'),
      subdir: '.',
      reporters: [{ type: 'html' }, { type: 'json' }, { type: 'json-summary' }, { type: 'text-summary' }],
    },
    singleRun: true,
  });
};
