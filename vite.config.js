import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Сайт публикуется на GitHub Pages по адресу hseadc.github.io/Chinatown/
export default defineConfig({
  base: '/Chinatown/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        events: resolve(import.meta.dirname, 'events.html'),
        event: resolve(import.meta.dirname, 'event.html'),
        notFound: resolve(import.meta.dirname, '404.html'),
      },
    },
  },
});
