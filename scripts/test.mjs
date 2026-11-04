#!/usr/bin/env node
/*
 * Cifra regression gate — `npm test`. Zero dependencies: it loads the
 * committed vendor/tonal.min.js and the inline script straight out of
 * index.html, the same way the browser does, so a plain checkout can run it.
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const vendor = readFileSync('vendor/tonal.min.js', 'utf8');
const html = readFileSync('index.html', 'utf8');
const code = html.slice(html.indexOf('const T=Tonal'), html.indexOf('/* ============================================================ parsing */'));

const ctx = { console };
vm.createContext(ctx);
vm.runInContext(vendor, ctx); // sets globalThis.Tonal, like the browser
vm.runInContext(code + '\n;globalThis.__api={parseChord,tp,dgmFor,fingersNeeded,OPEN_CHORDS};', ctx);
const { parseChord, tp, dgmFor, fingersNeeded, OPEN_CHORDS } = ctx.__api;
const T = ctx.Tonal;

const roots = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const span = f => { const fs = f.filter(x => x > 0); return fs.length ? Math.max(...fs) - Math.min(...fs) : 0; };
const openMixed = f => f.some(x => x === 0) && f.some(x => x > 3);
let failures = 0;
const fail = msg => { failures++; console.error('  ✗ ' + msg); };

/* 1. the open-shape dictionary renders its exact hardcoded frets */
for (const [name, frets] of OPEN_CHORDS)
  if (JSON.stringify(dgmFor(name).frets) !== JSON.stringify(frets)) fail(`dictionary ${name} ≠ [${frets}]`);
console.log(`dictionary shapes: ${OPEN_CHORDS.length} checked`);

/* 2. every voicing is playable by a four-finger hand */
let playable = 0;
for (const t of T.ChordType.all()) for (const a of new Set([t.name, ...t.aliases])) for (const r of roots) {
  const { frets } = dgmFor(r + a); if (!frets) continue; playable++;
  if (fingersNeeded(frets) > 4 || span(frets) > 3 || openMixed(frets)) fail(`${r + a} [${frets}] unplayable`);
}
console.log(`voicings: ${playable} playable across every tonal chord type × root`);

/* 3. symbols that must parse, and garbage that must not */
const MUST_PARSE = ['C','F#m7','Bb13','G/B','Cmaj9#11','C7alt','Fø','B°7','CM7','Cm6/9','Dbmaj7','Am7/G'];
for (const s of MUST_PARSE) { const p = parseChord(s); if (!(p && p.ok && p.ivs.length)) fail(`${s} does not parse`); }
for (const s of ['H7','Cfoo','Chello','x','Am7/9','']) if (parseChord(s)?.ok) fail(`"${s}" should not parse`);
console.log(`symbol table: ${MUST_PARSE.length} must-parse + 6 must-reject checked`);

/* 4. transpose keeps its spelling (sharp unless the source is flat) */
const TP = [['G',1,'G#'],['B',1,'C'],['Bb',-1,'A'],['F#',1,'G'],['C',-1,'B'],['Em',3,'Gm'],['G/B',5,'C/E'],['Bb',2,'C'],['Dbmaj7',1,'Dmaj7']];
for (const [n, d, want] of TP) { const got = tp(n, d); if (got !== want) fail(`tp(${n},${d}) = ${got}, want ${want}`); }
console.log(`transpose: ${TP.length} spot checks`);

process.exit(failures ? (console.error(`${failures} FAILUR${failures === 1 ? 'E' : 'ES'}`), 1) : console.log('ALL CHECKS PASS'), 0);
