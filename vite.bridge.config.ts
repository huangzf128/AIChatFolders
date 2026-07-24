import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  build: {
    rollupOptions: {
      input: { 'claude-main-bridge': resolve(__dirname, 'src/bridges/claude-main-bridge.ts') },
      output: {
        entryFileNames: 'bridges/[name].js',
        format: 'iife',
        inlineDynamicImports: false,
      }
    },
    outDir: 'dist',
    emptyOutDir: false,
  }
});