import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.noorix.nauth',
  appName: 'sample-capacitor',
  webDir: 'dist/sample-capacitor/browser',
  server: {
    url: 'http://192.168.50.39:4200',
    cleartext: true,
  },
  plugins: {
    CapacitorSocialLogin: {
      google: {
        webClientId: '1010280037829-ccl2aoaflruq2ao22gkpkbj4jpkj6fn4.apps.googleusercontent.com',
        mode: 'online',
      },
      facebook: {
        appId: '9612640992193714',
      },
      apple: {
        clientId: 'com.noorix.nauth',
        redirectUrl: 'https://your-app.com/auth/apple/callback',
      },
    },
  },
};

export default config;
