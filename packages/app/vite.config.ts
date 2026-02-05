import { defineConfig } from 'vite';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  base: './', // Ensure relative paths for file:// protocol
  resolve: {
    alias: {
      '@tradodesk/shared': path.resolve(__dirname, '../shared')
    }
  },
  build: {
    outDir: 'dist', // Standard Vite output
    emptyOutDir: true,
  },
  plugins: [
    react(),
    electron([
      {
        // Main-Process entry
        entry: 'electron/main.ts',
        onstart(options) {
            options.startup();
        },
        vite: {
            build: {
                outDir: 'dist-electron', // Separate output for Main process
                rollupOptions: {
                    external: ['electron', 'path', 'fs', 'os', 'crypto', 'buffer', 'url']
                }
            }
        }
      },
      {
        entry: 'electron/preload.ts',
        onstart(options) {
          options.reload();
        },
        vite: {
            build: {
                outDir: 'dist-electron',
            }
        }
      },
    ]),
    renderer(),
  ],
});