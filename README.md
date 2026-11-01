# Cifra — beautiful guitar tabs in the browser

A single-file mini site. Paste any guitar tab — plain text, or a raw copy from
Ultimate Guitar (spans, classes and all) — and it renders as a clean, playable
chord chart: chords aligned over lyrics, chord diagrams, tablature blocks,
transposition, auto-scroll, print, share links, and a song library.
No build step, no dependencies. Runs as a plain static page, or behind the
included `server.js` for a SQLite-backed library that follows you across
machines.

![Cifra rendering "Terra" by Caetano Veloso in dark mode](screenshot.png)

## Run it locally

```bash
node server.js
# open http://localhost:8765
```

This serves the site **and** a SQLite-backed song library (`cifra.db`), shared
by every browser and machine that can reach the server. Needs Node 22+;
zero dependencies.

Any plain static server works too — the site is fully functional, but the
library then stays in each browser's IndexedDB instead of syncing:

```bash
python3 -m http.server 8765
```

(Opening `index.html` directly also works.)

## Host it

- **With the synced library** — run `node server.js` on any always-on box
  (VPS, home server, Tailscale node). `PORT=9000` picks a port;
  `CIFRA_TOKEN=s3cret` makes the library ask for that access key before
  reading or writing; `CIFRA_DB=/path/to.db` relocates the database.
- **Static only** — everything except cross-device library sync works:
  - **GitHub Pages** — push `index.html` to a repo, enable Pages on the branch.
  - **Netlify** — drag the folder onto <https://app.netlify.com/drop>.
  - **Vercel / Cloudflare Pages / S3** — deploy as a plain static site.

## What it does with a pasted tab

| Input | Output |
| --- | --- |
| `Song title:` / `Composition:` / `Tune:` lines | Title, artist, meta chips |
| `[Verse 1]`, `[Chorus]`, … | Section headers |
| Chord lines above lyrics (`G/B    G` …) | Chords anchored over the exact syllable |
| `e|---0-2-…` blocks | Monospace tab cards, fret numbers highlighted |
| Chord-only lines | Instrumental rows |
| Any `A–G` chord (slash chords, 7ths, sus, dim…) | Voicing diagram — canonical shapes for open chords, computed fretboards for everything else |

Extras: transpose ±11 (also `[` / `]` keys), auto-scroll (Space, adjustable
speed), text size, light/dark, copy-as-text, print stylesheet, and a share
link that encodes the whole tab in the URL. The current tab is remembered in
`localStorage`. The Library keeps a song collection with save / load /
delete: served by `server.js` it lives in SQLite on the server (one library,
every device, optional access key); on static hosting it stays in the
browser's IndexedDB. Saving a song you already saved updates it instead of
duplicating; delete has a two-click confirm.

## Notes

- Chord diagrams use a small music-theory engine: chord tones are resolved,
  then the fretboard is searched for a playable voicing (right bass note for
  slash chords, all chord tones present, minimal fretting). Common open
  shapes come from a built-in dictionary.
- Google Fonts (Fraunces / Inter / JetBrains Mono) load from a CDN with
  system fallbacks — the site works fully offline without them.
