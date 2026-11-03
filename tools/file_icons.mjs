// Document icons of the formats the editor opens: public/file_<ext>.png (512 px, web
// manifest, Mac, Windows) and public/file_<ext>_<size>.png (Linux hicolor sizes).
// Below 48 px the extension cannot be read: a simpler drawing, aligned on the pixel
// grid, tells the formats apart by the colour of the band.
// Usage: node tools/file_icons.mjs
import { chromium } from "playwright";

const FORMATS = { dgo: "#2563eb", dgp: "#ea580c", ggb: "#16a34a" };
const GRAY = "#94a3b8";
const FOLD = "#dbeafe";
const BLUE = "#2563eb";
const LIGHT = "#e0e9fc";

const large = (ext, color) => {
  const page = "M96 24H336L432 120V488H96Z";
  return `<svg viewBox="0 0 512 512">
<defs><clipPath id="b"><rect y="392" width="512" height="120"/></clipPath></defs>
<path d="${page}" fill="#fff" stroke="${GRAY}" stroke-width="10" stroke-linejoin="round"/>
<path d="M336 24V120H432" fill="${FOLD}" stroke="${GRAY}" stroke-width="10" stroke-linejoin="round"/>
<path d="M168 158L350 135L370 318L157 340Z" fill="none" stroke="#bfdbfe" stroke-width="8" stroke-linejoin="round"/>
<path d="M260 148L362 226L263 328L164 250Z" fill="${LIGHT}" stroke="${BLUE}" stroke-width="15" stroke-linejoin="round"/>
<g fill="#38bdf8" stroke="${BLUE}" stroke-width="4"><circle cx="260" cy="148" r="10.5"/><circle cx="362" cy="226" r="10.5"/><circle cx="263" cy="328" r="10.5"/><circle cx="164" cy="250" r="10.5"/></g>
<path d="${page}" fill="${color}" clip-path="url(#b)"/>
<text x="264" y="465" fill="#fff" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="77" text-anchor="middle">${ext.toUpperCase()}</text>
</svg>`;
};

// Coordinates in pixels; strokes of 1 px on half pixels stay sharp.
const SMALL = {
  32: { page: [6.5, 1.5, 26.5, 30.5], fold: 7, band: 7, diamond: [16.5, 13.5, 6.5], stroke: 2 },
  24: { page: [4.5, 1.5, 19.5, 22.5], fold: 5, band: 5, diamond: [12, 10.5, 5], stroke: 1.5 },
  16: { page: [2.5, 0.5, 13.5, 15.5], fold: 4, band: 4, diamond: [7.5, 7, 3.5], stroke: 0 },
};

const small = (size, color) => {
  const { page: [x0, y0, x1, y1], fold, band, diamond: [cx, cy, r], stroke } = SMALL[size];
  const f = x1 - fold;
  const d = `M${cx} ${cy - r}L${cx + r} ${cy}L${cx} ${cy + r}L${cx - r} ${cy}Z`;
  return `<svg viewBox="0 0 ${size} ${size}">
<path d="M${x0} ${y0}H${f}L${x1} ${y0 + fold}V${y1}H${x0}Z" fill="#fff" stroke="${GRAY}"/>
<path d="M${f} ${y0}V${y0 + fold}H${x1}" fill="${FOLD}" stroke="${GRAY}"/>
<path d="${d}" fill="${stroke ? LIGHT : BLUE}" stroke="${BLUE}" stroke-width="${stroke}" stroke-linejoin="round"/>
<rect x="${x0 + 0.5}" y="${y1 - 0.5 - band}" width="${x1 - x0 - 1}" height="${band}" fill="${color}"/>
</svg>`;
};

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [ext, color] of Object.entries(FORMATS))
  for (const size of [16, 24, 32, 48, 64, 128, 256, 512]) {
    const svg = size in SMALL ? small(size, color) : large(ext, color);
    await page.setContent(`<body style="margin:0">${svg.replace("<svg", `<svg width="${size}" height="${size}" style="display:block"`)}</body>`);
    const path = `public/file_${ext}${size === 512 ? "" : `_${size}`}.png`;
    await page.locator("svg").screenshot({ path, omitBackground: true });
  }
await browser.close();
