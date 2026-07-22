import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  build: {
    // We use rollupOptions directly for multiple entry points
    rollupOptions: {
      input: {
        content: resolve(__dirname, 'src/content.ts'),
        // background: resolve(__dirname, 'src/background.ts'),
      },
      output: {
        // This ensures each entry becomes a standalone IIFE file
        entryFileNames: '[name].js',
        format: 'iife',
        // This prevents the code splitting error for multiple IIFEs
        inlineDynamicImports: false, 
      }
    },
    outDir: 'dist',
    emptyOutDir: false,
  }
});