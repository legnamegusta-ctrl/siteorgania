import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.organia.app',
  appName: 'Organia',
  webDir: 'public',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'http'
  }
};

export default config;

