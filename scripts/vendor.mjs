#!/usr/bin/env node
/*
 * Copies tonal's browser build (a classic script that sets window.Tonal)
 * into vendor/. The copy is committed, so deploys never need npm and the
 * site keeps working from static hosting and file://.
 *
 *   npm install && npm run vendor
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const src = 'node_modules/tonal/browser/tonal.min.js';
const dest = 'vendor/tonal.min.js';
const version = JSON.parse(readFileSync('node_modules/tonal/package.json', 'utf8')).version;

mkdirSync('vendor', { recursive: true });
copyFileSync(src, dest);
writeFileSync(dest, `/* tonal ${version} — https://tonaljs.github.io — MIT. Vendored by scripts/vendor.mjs */\n` + readFileSync(dest, 'utf8'));
console.log(`vendor/tonal.min.js ← tonal@${version}`);
