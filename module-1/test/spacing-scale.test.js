import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Public stylesheets. Internal tools (component catalogue, dev panel, light editor) are left out.
const files = ['article.css', 'styles.css', 'landing.css', 'scene-rail.css', 'media.css', 'src/design-tokens.css', 'src/mobile-shell.css',
  'src/components/tag.css', 'src/components/site-footer.css', 'src/components/editorial-typography.css', 'src/components/editorial-data.css',
  'src/components/context-title.css', 'src/components/email-field.css', 'src/components/action-button.css', 'src/components/film.css'];
// --space-N in src/design-tokens.css, plus 0–2px hairlines and seams.
const scale = new Set([0, 1, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128, 160]);
const spacing = /(?<![-\w])((?:margin|padding)(?:-[a-z-]+)?|gap|row-gap|column-gap)\s*:\s*([^;{}]+)/g;

test('margins, paddings and gaps use only the spacing scale', () => {
  const misses = [];
  for (const file of files) {
    readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').split('\n').forEach((line, index) => {
      if (line.includes('spacing-exception') || line.includes('--button-label-padding')) return;
      for (const [declaration, , value] of line.matchAll(spacing)) {
        const off = [...value.matchAll(/(\d*\.?\d+)px/g)].map(match => Number(match[1])).filter(px => !scale.has(px));
        const fluid = /clamp\(|\d(?:vw|vh|svh|dvh|cqw|cqi|em|rem)\b/.test(value);
        if (off.length || fluid) misses.push(`${file}:${index + 1} ${declaration.trim()}`);
      }
    });
  }
  assert.deepEqual(misses, [], 'Use --space-N, or mark a deliberate optical value with /* spacing-exception: why */');
});

test('the scale tokens are multiples of four', () => {
  const tokens = readFileSync(new URL('../src/design-tokens.css', import.meta.url), 'utf8');
  const steps = [...tokens.matchAll(/--space-(\d+):\s*(\d+)px/g)];
  assert(steps.length >= 10);
  for (const [, step, px] of steps) assert.equal(Number(px), Number(step) * 4);
});
