/**
 * Función serverless de Vercel: POST /api/notificaciones/tecnica
 *
 * Corrige REQ-18: en Vercel solo se publica el frontend de Angular, así que el
 * servidor Express (src/server.ts) no existe ahí y la ruta respondía 405.
 * Vercel ejecuta automáticamente los archivos de la carpeta /api como funciones.
 *
 * Variables de entorno opcionales (Vercel → Settings → Environment Variables):
 *   FIREBASE_SERVICE_ACCOUNT_BASE64  credenciales de Firebase en base64
 *   FCM_DEVICE_TOKEN                 token del reloj que recibe la notificación
 * Sin ellas la función valida y responde { ok: true }, pero no envía nada al reloj.
 */
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }

  const { escuadra, puntos } = req.body || {};
  if (typeof escuadra !== 'string' || !escuadra.trim() || typeof puntos !== 'number') {
    res.status(400).json({ error: 'Se requieren escuadra (texto) y puntos (número)' });
    return;
  }

  const token = process.env.FCM_DEVICE_TOKEN;
  const credenciales = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;

  if (token && credenciales) {
    try {
      const { initializeApp, cert, getApps } = require('firebase-admin/app');
      const { getMessaging } = require('firebase-admin/messaging');
      if (getApps().length === 0) {
        const cuenta = JSON.parse(Buffer.from(credenciales, 'base64').toString('utf-8'));
        initializeApp({ credential: cert(cuenta) });
      }
      await getMessaging().send({
        token,
        notification: {
          title: 'Nueva puntuación técnica',
          body: `${escuadra} va liderando con ${puntos} puntos`,
        },
      });
    } catch (err) {
      console.error('[FCM] Error al enviar la notificación:', err);
    }
  } else {
    console.warn('[FCM] Sin FCM_DEVICE_TOKEN o credenciales: no se envió notificación');
  }

  res.status(200).json({ ok: true });
};
