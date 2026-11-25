# Práctica 11 — Pruebas White Box (Puntuaciones · Escuadrón Moriah)

| Fase | Qué se prueba | Archivo | Cómo se corre |
|---|---|---|---|
| 1 | Análisis estático (tipos, ESLint + SonarJS, dependencias) | ver reporte | `npx tsc -p tsconfig.app.json --noEmit` · `npm audit --omit=dev` · `npm outdated` |
| 2 | 4 métodos críticos: validación, cálculo, comunicación, excepciones; cobertura | `src/app/whitebox/*.wb.spec.ts` | `npm run test:whitebox` → `coverage/whitebox/index.html` |
| 3 | Endpoints de Supabase (PostgREST/Auth) y la función de Vercel: códigos HTTP, JSON, datos sensibles | `whitebox/medir.mjs` | ver abajo |
| 4 | Base de datos: CRUD, restricciones, concurrencia, transacciones, RLS, EXPLAIN | `whitebox/bd/wb_bd.mjs` (PostgreSQL embebido) y `whitebox/bd-planes.sql` (Supabase real) | ver abajo |
| 5 | Ping, latencia HTTP, 10 solicitudes, transferencia, carga 1/5/10 usuarios | `whitebox/medir.mjs` | ver abajo |

## Mediciones reales (desde tu laptop)

En PowerShell, en la carpeta del proyecto:

```powershell
$env:PRUEBA_CORREO="tu-correo-de-jefatura"; $env:PRUEBA_PASSWORD="tu-contraseña"; $env:CONEXION="WiFi casa 50 Mbps"
node whitebox/medir.mjs
```

- Tarda 2–4 minutos. Al final guarda `whitebox/resultados/medicion-<fecha>.json`.
- Todo lo que escribe en la base va a una sesión de prueba con fecha **2099-12-31** y se borra al final.
- El token y la contraseña no se imprimen ni se guardan en el resultado.

## Consultas en Supabase (EXPLAIN ANALYZE)

Supabase → SQL Editor → pega `whitebox/bd-planes.sql` → Run. Descarga el resultado como CSV.
No modifica datos: mide 4 consultas de la app, 3 veces cada una, con RLS (como la app) y sin RLS.

## Base de datos con PostgreSQL embebido

```powershell
cd whitebox/bd
npm install
node wb_bd.mjs
```
