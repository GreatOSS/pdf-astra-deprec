import { defineConfig } from 'vite';
import { cpSync } from 'node:fs';

export default defineConfig({
  base: './',
  plugins: [{
    name: 'pdf-font-assets',
    closeBundle() {
      for (const dir of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) {
        cpSync(`node_modules/pdfjs-dist/${dir}`, `dist/pdfjs/${dir}`, { recursive: true });
      }
    },
  }],
});
