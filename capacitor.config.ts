import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gentlepath.mobile',
  appName: 'Gentle Path',
  webDir: 'dist',
  server: {
    hostname: 'localhost',
    androidScheme: 'http'
  }
};

export default config;
