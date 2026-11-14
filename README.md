# DocGeo

DocGeo is a multilingual, browser-based interactive geometry application,
the successor of [DGPad](https://dgpad.net). It opens figures made with DGPad
and GeoGebra faithfully, lets you manipulate them, and comes with an editor
to build your own constructions, in 2D and 3D.

## Features

- An interactive player for `.dgo` (DocGeo's native format, gzipped JSON),
  `.dgp` (DGPad) and `.ggb` (GeoGebra) figures, built for smooth handling of
  constructions with thousands of objects
- Safe import: GeoGebra scripts and the JavaScript or active HTML of DGPad
  figures are never executed; DGPad's Blockly programs are read by a closed,
  sandboxed interpreter
- A construction editor (`editor.html`) with a tool palette, macro-constructions,
  transformations and Blockly programs, also installable as an offline app (PWA)
- An embedded mode (`?embed`) driven by a versioned `postMessage` protocol,
  to integrate figures into any host page
- UI and user manual localized in 12 languages

## Built on open source

DocGeo uses [Blockly](https://github.com/google/blockly) for its visual
programs and [KaTeX](https://github.com/KaTeX/KaTeX) for mathematical
formulas.

## Getting started

```bash
git clone https://github.com/erichake/docgeo.git
cd docgeo
npm install
npm run dev
```

The dev server runs at `http://localhost:5175` (player) and
`http://localhost:5175/editor.html` (editor). `npm run dev` also starts a PHP
server on port 5176 for the `figure.php` relay, which fetches figures that
browsers can't read directly (sites without CORS headers, Google Drive,
Nextcloud). Without PHP, everything else works.

## Available scripts

- `npm run dev` — start the Vite dev server (and the PHP relay)
- `npm run build` — type-check and production build of the player and the
  editor (output directory set by `build.outDir` in `vite.config.ts`)
- `npm run preview` — locally preview a production build
- `npm test` — run the unit and browser tests (Vitest, Playwright)
- `npm run check` — formatting check, tests and build

## License

DocGeo is licensed under the [GNU-GPL v3](LICENSE).
