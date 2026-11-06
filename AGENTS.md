# Cifra conventions

Cifra is a zero-build, single-file guitar chord chart. The whole app is
`index.html` (one inline script) plus `server.js`; hold every change to that
shape.

- **No build step, no bundler, no runtime CDN dependency.** The site must keep
  working from plain static hosting and from `file://` — classic `<script>`
  tags only, never ES-module imports.
- **Third-party code is vendored**, not fetched at runtime: `vendor/tonal.min.js`
  (chord-symbol parsing) is committed and refreshed with
  `npm install && npm run vendor`. `node_modules` is dev-time only; deploys and
  CI never install it.
- **`server.js` stays zero-dependency** Node 22+ (`node:sqlite`), serving the
  static files and the `/api/songs` library. No framework, no ORM.
- **Chord voicings must be playable by a four-finger hand** — a barre counts as
  one finger, open strings only in first position (see `fingersNeeded()` /
  `findVoicing()` in `index.html`). Canonical open shapes come from the
  `OPEN_CHORDS` dictionary; don't hand-edit shapes without running the checks.
- **`npm test` is the regression gate** (`scripts/test.mjs`): dictionary shapes
  render exact, every voicing stays playable, chord symbols parse, transpose
  keeps its spelling. Run it before pushing; extend it when behaviour changes.
- **Diagram SVGs (`dgmSVG`) draw with CSS variables** (`--chord`, `--dg-*`) so
  light/dark themes and the print stylesheet keep working. A barre renders as
  one rounded line spanning the barred strings, not individual dots.
- **Git:** feature branches and pull requests only — never commit to `main`.
