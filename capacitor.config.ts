import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.moriah.puntuaciones',
  appName: 'Puntuaciones',
  webDir: 'dist/mobile',
  server: {
    androidScheme: 'http',
    cleartext: true
  }
};

export default config;