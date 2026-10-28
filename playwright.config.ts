import { defineConfig, devices } from '@playwright/test';

// Por defecto prueba en Vercel. Para probar en local:
//   PowerShell: $env:URL_BASE="http://localhost:4000"; npx playwright test
const URL_BASE = process.env['URL_BASE'] ?? 'https://puntuaciones.vercel.app';
const esLocal = URL_BASE.includes('localhost');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  timeout: 90_000,                 // tiempo máximo por prueba
  expect: { timeout: 15_000 },     // cada verificación espera hasta 15 s
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
    ['./e2e/reporte-pdf.ts'],   // genera reportes/reporte-pruebas-<fecha>.pdf
  ],
  use: {
    baseURL: URL_BASE,
    navigationTimeout: 60_000,
    screenshot: { mode: 'on', fullPage: true },   // captura de la página completa
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    serviceWorkers: 'block',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: esLocal
    ? {
        command: 'npm run serve:ssr:puntuaciones',
        url: 'http://localhost:4000/login',
        reuseExistingServer: true,
        timeout: 180_000,
      }
    : undefined,
});