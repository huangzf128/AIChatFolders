// rollup.config.js
const typescript = require('@rollup/plugin-typescript');
const resolve = require('@rollup/plugin-node-resolve');
const copy = require('rollup-plugin-copy');

// Every entry below runs in a context that does NOT support top-level
// import/export:
//   - content.ts is injected as a classic content script
//   - the *-main-bridge.ts files run directly in the page's MAIN world
//   - options.ts is loaded via a plain <script> tag in options.html
// A single Rollup config with multiple inputs + format:'es' triggers
// automatic code-splitting whenever two entries share a module (e.g.
// FolderManager), which injects `import` statements into the output —
// exactly what caused this error. Giving each entry its own config with
// format:'iife' forces Rollup to bundle it as a fully self-contained
// file with zero shared chunks.
function bundle(name, input, extraPlugins = []) {
  return {
    input,
    output: {
      file: `dist/${name}.js`,
      format: 'iife',
    },
    plugins: [resolve(), typescript({ tsconfig: './tsconfig.json' }), ...extraPlugins],
  };
}

const copyConfig = {
	input: 'src/dummy.ts',
	output: {
		file: 'dist/dummy.js',
		format: 'iife',
	},
	plugins: [
		copy({
		targets: [
			{ src: '_locales/*', dest: 'dist/_locales' },
			{ src: 'icons/**/*', dest: 'dist/icons' },
			{ src: 'options.html', dest: 'dist' },
			{ src: 'manifest.json', dest: 'dist' },
		],
		verbose: true,
		watch: true,
		}),
	],
	watch: {
		include: ['_locales/**/*', 'icons/**/*', '*.html', 'manifest.json'],
	},
};

module.exports = [
  bundle('content', 'src/content.ts'),
  bundle('background', 'src/background.ts'),
  bundle('options', 'src/options.ts'),
  bundle('bridges/claude-main-bridge', 'src/bridges/claude-main-bridge.ts'),
  bundle('bridges/gemini-main-bridge', 'src/bridges/gemini-main-bridge.ts'),
  bundle('bridges/chatgpt-main-bridge', 'src/bridges/chatgpt-main-bridge.ts'),
  bundle('bridges/deepseek-main-bridge', 'src/bridges/deepseek-main-bridge.ts'),
  copyConfig
];