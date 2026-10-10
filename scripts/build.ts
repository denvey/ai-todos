import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const result = await build({ entryPoints: ['ui/app.tsx'], outfile: 'dist/app.js', bundle: true, write: false, format: 'esm', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' }, target: 'es2022', minify: true });
const js = result.outputFiles.find(file => file.path.endsWith('.js'))!.text.replace(/<\/script/gi, '<\\/script');
const css = result.outputFiles.find(file => file.path.endsWith('.css'))!.text;
const html = readFileSync('ui/index.html', 'utf8').replace('__CSS__', () => css).replace('__JS__', () => js).replace(/[ \t]+$/gm, '');
mkdirSync('dist', { recursive: true }); writeFileSync('dist/app.html', html);
console.log('Built self-contained MCP Apps / browser UI.');
