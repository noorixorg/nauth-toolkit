import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    outDir: 'dist',
    target: 'es2020',
    outExtension({ format }) {
      return {
        js: format === 'cjs' ? '.cjs' : '.mjs',
      };
    },
  },
  {
    entry: ['src/angular/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: false,
    outDir: 'dist/angular',
    target: 'es2020',
    external: [
      '@angular/core',
      '@angular/common',
      '@angular/router',
      '@angular/forms',
      '@angular/platform-browser',
      'rxjs',
      'rxjs/operators',
    ],
    outExtension({ format }) {
      return {
        js: format === 'cjs' ? '.cjs' : '.mjs',
      };
    },
    esbuildOptions(options) {
      options.keepNames = true;
    },
  },
]);
