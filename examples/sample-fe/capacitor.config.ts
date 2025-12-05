import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.noorix.nauth',
  appName: 'nauth-toolkit',
  webDir: 'dist/sample-fe/browser',
  // Live reload during development
  server: {
    androidScheme: 'https',
    url: 'https://angular.dev1.noorix.com',
    cleartext: false,
  },
};

export default config;
