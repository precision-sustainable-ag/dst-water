import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    open: true,
  },
  optimizeDeps: {
    include: [
      'mapbox-gl',
      '@mapbox/mapbox-gl-draw',
      '@mapbox/mapbox-gl-geocoder',
    ],
  },
  build: {
    outDir: '/usr/src/app/build',
  },
});
