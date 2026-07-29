import { defineConfig } from 'vite';

export default defineConfig({
  base: './',

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,

    rollupOptions: {
      input: 'src/main.js',
      output: {
        entryFileNames: 'heurist-map.js',
        chunkFileNames: 'heurist-map-[name].js',
        assetFileNames: 'heurist-map-[name][extname]'
      }
    }
  },

  server: {
    host: '127.0.0.1',
    port: 5174,
    proxy: {
      '/heurist': {
        target: 'http://127.0.0.1',
        changeOrigin: true,
        secure: false
      }
    }
  }
});
