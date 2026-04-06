import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: '.',
  resolve: {
    alias: {
      '@core': path.resolve(__dirname, './core'),
      '@components': path.resolve(__dirname, './components'),
      '@services': path.resolve(__dirname, './services'),
      '@state': path.resolve(__dirname, './state'),
      '@views': path.resolve(__dirname, './views'),
      '@assets': path.resolve(__dirname, './assets'),
      '@locales': path.resolve(__dirname, './locales'),
    },
  },
  build: {
    outDir: 'dist',
  },
});
