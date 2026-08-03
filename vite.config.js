/**
 * vite.config.js - Vite build configuration
 *
 * @fileOverview Configures development proxying, relative deployment paths, source maps, and stable distribution asset names.
 * @project     Heurist mapping application
 *
 * @link        https://HeuristNetwork.org
 * @copyright   (C) 2026 Heurist Network
 * @license     https://www.gnu.org/licenses/gpl-3.0.txt GNU License 3.0
 * @author      Artem Osmakov <osmakov@gmail.com>
 */

import { defineConfig } from 'vite';

export default defineConfig({
  base: './',

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,

    rollupOptions: {
      /*
        * Use index.html as the Vite application entry.
        * Vite will process the module reference to src/main.js
        * and generate a production index.html.
      input: 'index.html',      
        */
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
