# Puntuaciones

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 20.3.16.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Pruebas automatizadas e integración continua

[![CI](https://github.com/DiegoRiveraTavera/puntuaciones-/actions/workflows/ci.yml/badge.svg)](https://github.com/DiegoRiveraTavera/puntuaciones-/actions/workflows/ci.yml)

Cada push y cada pull request ejecutan el flujo [`.github/workflows/ci.yml`](.github/workflows/ci.yml) en GitHub Actions.
Si una prueba falla, la ejecución queda en rojo.

| Comando | Qué prueba | Herramienta |
| --- | --- | --- |
| `npm run test:ci` | Unitarias e integración de la app (validación de juegos, guardado, reintentos, inicio de sesión, puntuación) | Karma + Jasmine en Chrome sin interfaz |
| `npm run test:bd` | Persistencia: la función `guardar_juego` sobre el esquema real de Supabase | `node:test` + PostgreSQL embebido (PGlite) |
| `npm run build` | Que la app compile para producción | Angular CLI |

Antes de `npm run test:bd` instala sus dependencias una vez con `cd whitebox/bd && npm ci`.
El resumen de la última corrida queda en `reportes/ci/resumen-pruebas.json` y la cobertura en `coverage/ci/index.html`.

> `ng test` a secas no funciona: los `*.spec.ts` que generó Angular CLI no compilan. Usa los scripts de arriba.

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
