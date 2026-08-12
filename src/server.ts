import 'dotenv/config';
import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';
import { crearIndice, sembrarDatos, buscar } from './elastic-client';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

app.use(express.json());

function asegurarFirebaseApp() {
  if (getApps().length > 0) return;

  const base64 = process.env['FIREBASE_SERVICE_ACCOUNT_BASE64'];
  let serviceAccount;

  if (base64) {
    serviceAccount = JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'));
  } else {
    const path = process.env['FIREBASE_SERVICE_ACCOUNT_PATH'];
    if (!path) {
      throw new Error('Faltan credenciales de Firebase (FIREBASE_SERVICE_ACCOUNT_BASE64 o FIREBASE_SERVICE_ACCOUNT_PATH)');
    }
    serviceAccount = JSON.parse(readFileSync(path, 'utf-8'));
  }

  initializeApp({ credential: cert(serviceAccount) });
}

function obtenerMessaging() {
  asegurarFirebaseApp();
  return getMessaging();
}

function obtenerDb() {
  asegurarFirebaseApp();
  return getFirestore();
}

app.post('/api/dispositivo/registrar', async (req, res) => {
  const { token } = req.body;
  try {
    await obtenerDb().collection('dispositivos').doc('reloj-principal').set({
      token,
      actualizado: new Date().toISOString(),
    });
    console.log('[FCM] Token de dispositivo registrado:', token);
    res.json({ ok: true });
  } catch (err) {
    console.error('[FCM] Error guardando token:', err);
    res.status(500).json({ error: 'No se pudo guardar el token' });
  }
});

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

app.post('/api/notificaciones/tecnica', async (req, res) => {
  const { escuadra, puntos } = req.body;

  try {
    const doc = await obtenerDb().collection('dispositivos').doc('reloj-principal').get();
    const token = doc.exists ? (doc.data()?.['token'] as string | undefined) : undefined;

    if (token) {
      await obtenerMessaging().send({
        token,
        notification: {
          title: 'Nueva puntuación técnica',
          body: `${escuadra} va liderando con ${puntos} puntos`,
        },
      });
      console.log('[FCM] Notificación enviada al reloj');
    } else {
      console.warn('[FCM] No hay token de dispositivo registrado todavía');
    }
  } catch (err) {
    console.error('[FCM] Error al enviar:', err);
  }

  res.json({ ok: true });
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

if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

export const reqHandler = createNodeRequestHandler(app);