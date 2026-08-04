import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export default defineConfig({
	build: {
		rollupOptions: {
			input: { 'deepseek-main-bridge': resolve(__dirname, 'src/bridges/deepseek-main-bridge.ts') },
			output: {
				entryFileNames: 'bridges/[name].js',
				format: 'iife',
				inlineDynamicImports: false,
			}
		},
		outDir: 'dist',
		emptyOutDir: false, // must stay false — otherwise this build would wipe out content.js and the other bridge outputs
	}
});