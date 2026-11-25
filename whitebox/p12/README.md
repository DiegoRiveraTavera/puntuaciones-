# Práctica 12 — Optimización, estrés y resiliencia

## Optimización implementada
- `supabase/03_optimizacion_p12.sql`: función `guardar_juego` (una transacción, idempotente por `id_cliente`) y políticas RLS con `(select public.es_jefatura())`.
- `src/app/services/juegos/juegos-repositorio.ts`: guardar = 1 llamada por juego + `conReintentos` (espera progresiva 0.5 s, 1 s).
- `src/app/services/supabase/supabase.ts`: límite de 10 s por petición (60 s para fotos).
- `src/app/services/sesion/sesion.ts`: corrección de DEF-03.

## Pruebas
| Qué | Archivo | Cómo |
|---|---|---|
| Migración en PostgreSQL embebido | `whitebox/bd/p12_migracion.mjs` | `cd whitebox/bd && npm install && node p12_migracion.mjs` |
| Pruebas unitarias de la optimización | `src/app/whitebox/p12.wb.spec.ts` | `npm run test:whitebox` |
| Estrés, concurrencia y operación crítica (Supabase real) | `whitebox/p12/estres.mjs` | `node whitebox/p12/estres.mjs antes` / `despues` |
| Consultas con 5,000 registros (Supabase real) | `whitebox/p12/bd-avanzado.sql` | SQL Editor, antes y después de la migración |
| Profiling de la app y resiliencia RES-01…08 | `whitebox/p12/perfil/*.cjs` | se corrieron sobre la app compilada antes/después; resultados en `resultados-contenedor/` |

## Orden para medir en Supabase
1. `node whitebox/p12/estres.mjs antes`
2. SQL Editor: `whitebox/p12/bd-avanzado.sql` → descargar CSV (antes)
3. SQL Editor: `supabase/03_optimizacion_p12.sql`
4. `node whitebox/p12/estres.mjs despues`
5. SQL Editor: `whitebox/p12/bd-avanzado.sql` → descargar CSV (después)
