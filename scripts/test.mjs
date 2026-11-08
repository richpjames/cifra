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

/* 5. #t= share links survive the URL (regression: reading them with
      URLSearchParams turned base64 + into a space, which atob silently
      dropped — corrupting the payload and losing the song) */
{
  const share = html.slice(html.indexOf('function encodeB64'), html.indexOf("$('#shareBtn')"));
  const sctx = { console, btoa, atob };
  vm.createContext(sctx);
  vm.runInContext(share + '\n;globalThis.__s={encodeB64,decodeB64,tabFromHash,shareHash};', sctx);
  const { encodeB64, tabFromHash, shareHash } = sctx.__s;
  /* a payload whose base64 actually uses both + and / (the manglers). Plain
     lyrics never produce either; 🎼 yields + and ➿ yields /, but only when
     their bytes land on a 6-bit group boundary — so sweep the alignment */
  let demo = null;
  for (let i = 0; i < 9 && !demo; i++) {
    const s = 'Song title: S Wonderful\n' + ' '.repeat(i % 3) + '🎼 ' + ' '.repeat((i / 3 | 0) % 3) + 'F#dim ➿ glamorous ' + i;
    const b = encodeB64(s);
    if (b.includes('+') && b.includes('/')) demo = s;
  }
  if (!demo) fail('no test payload produced + and / in its base64');
  else {
    if (tabFromHash(shareHash(demo)) !== demo) fail('base64url #t= link does not round-trip');
    if (tabFromHash('#t=' + encodeB64(demo)) !== demo) fail('legacy #t= link (literal + and /) does not decode');
  }
  if (tabFromHash('#t=%zz') !== null) fail('garbage hash should yield null, not throw');
  if (tabFromHash('') !== null || tabFromHash('#x=1') !== null) fail('hash without #t= should yield null');
  console.log('share links: base64url + legacy round-trip checked');
}

process.exit(failures ? (console.error(`${failures} FAILUR${failures === 1 ? 'E' : 'ES'}`), 1) : console.log('ALL CHECKS PASS'), 0);
