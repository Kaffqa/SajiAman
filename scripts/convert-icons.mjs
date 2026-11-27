import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const __dirname = new URL('.', import.meta.url).pathname.replace(/^\//, '');

// Icon.svg -> used for all 4 outputs
// For adaptive-icon, strip background rect so we get transparent bg (foreground only)
const iconSvg = readFileSync(resolve(__dirname, '../assets/icon.svg'), 'utf8');

// Strip the navy background path (first path with fill="#002081") for adaptive icon
const adaptiveIconSvg = iconSvg.replace(/<path fill="#002081"[^/]*\/>/g, '');

const outputs = [
  { svg: iconSvg,         out: 'assets/icon.png',          size: 1024 },
  { svg: adaptiveIconSvg, out: 'assets/adaptive-icon.png',  size: 1024 },
  { svg: iconSvg,         out: 'assets/splash-icon.png',    size: 1024 },
  { svg: iconSvg,         out: 'assets/favicon.png',        size:   48 },
];

for (const { svg, out, size } of outputs) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
    background: out.includes('adaptive') ? 'transparent' : undefined,
  });
  const png = resvg.render().asPng();
  writeFileSync(resolve(__dirname, '..', out), png);
  console.log(`✓ ${out}  (${size}px, ${(png.length / 1024).toFixed(1)} KB)`);
}

console.log('\nAll icons converted successfully!');
