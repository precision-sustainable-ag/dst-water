import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    open: true,
    watch: {
      usePolling: true,
    },
    host: true, // needed for the Docker Container port mapping to work
    strictPort: true,
    port: 3000,
  },
  optimizeDeps: {
    include: [
      'mapbox-gl',
      '@mapbox/mapbox-gl-draw',
      '@mapbox/mapbox-gl-geocoder',
      'wellknown',
    ],
  },
  build: {
    outDir: '/usr/src/app/build',
  },
});
