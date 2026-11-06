import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { writeStaticArticle } from './generate-article.mjs';

await writeStaticArticle();
const dist = new URL('../dist/', import.meta.url);

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
for (const file of ['index.html', 'about.html', 'article.html', 'glitch-test.html', 'components.html', 'component-preview.html', 'components.css', 'styles.css', 'media.css', 'landing.css', 'article.css', 'scene-rail.css', 'light-editor.css', 'dev-panel.css']) {
  await cp(new URL(`../${file}`, import.meta.url), new URL(`../dist/${file}`, import.meta.url));
}
await cp(new URL('../src/', import.meta.url), new URL('../dist/src/', import.meta.url), { recursive: true });
await cp(new URL('../docs/', import.meta.url), new URL('../dist/docs/', import.meta.url), { recursive: true });
await cp(new URL('../assets/', import.meta.url), new URL('../dist/assets/', import.meta.url), {
  recursive: true,
});
console.log(`Built static site in ${fileURLToPath(dist)}`);
