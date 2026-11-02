import { defineConfig } from 'vite';

export default defineConfig({
  // Use relative base path so assets load correctly from ESP8266 LittleFS root
  // as well as Apache subdirectories (e.g. http://localhost/panzer/).
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'esbuild',
    target: 'es2020',
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
  server: {
    port: 3000,
    host: true,
  },
});
