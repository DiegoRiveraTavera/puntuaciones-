import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';
import { crearIndice, sembrarDatos, buscar } from './elastic-client';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

app.use(express.json());

crearIndice()
  .then(sembrarDatos)
  .catch(err => console.error('Error preparando Elasticsearch:', err));

app.get('/api/buscar', async (req, res) => {
  const q = String(req.query['q'] ?? '');
  if (q.trim().length < 2) {
    res.json([]);
    return;
  }
  try {
    const resultados = await buscar(q);
    res.json(resultados);
  } catch (err) {
    console.error('Error en búsqueda:', err);
    res.status(500).json({ error: 'Error al buscar' });
  }
});

// Guarda la última notificación en memoria (simple, sin base de datos)
let ultimaNotificacionTecnica: {
  id: number;
  escuadra: string;
  puntos: number;
  fecha: string;
} | null = null;

app.post('/api/notificaciones/tecnica', (req, res) => {
  const { escuadra, puntos } = req.body;
  ultimaNotificacionTecnica = {
    id: Date.now(),
    escuadra,
    puntos,
    fecha: new Date().toISOString(),
  };
  res.json({ ok: true });
});

app.get('/api/notificaciones/tecnica', (req, res) => {
  res.json(ultimaNotificacionTecnica ?? { id: 0 });
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);