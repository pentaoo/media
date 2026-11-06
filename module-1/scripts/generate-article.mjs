import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { homeView } from '../src/media-views.js';
import { articleView, articleTitle, articleDescription } from '../src/article-view.js';

const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

export async function writeStaticArticle() {
  const file = new URL('../article.html', import.meta.url);
  const html = await readFile(file, 'utf8');
  const updated = html
    .replace(/<title>[\s\S]*?<\/title>/, () => `<title>${escape(articleTitle)} — chinatown.site</title>`)
    .replace(/<meta name="description" content="[^"]*">/, () => `<meta name="description" content="${escape(articleDescription)}">`)
    .replace(/<main id="media-content">[\s\S]*?<\/main>/, () => `<main id="media-content">${articleView()}</main>`);
  await writeFile(file, updated);
  const aboutFile = new URL('../about.html', import.meta.url);
  const about = await readFile(aboutFile, 'utf8');
  await writeFile(aboutFile, about.replace(/<title>[\s\S]*?<\/title>/, '<title>chinatown.site — гид и архив центра москвы</title>').replace(/<meta name="description" content="[^"]*">/, '<meta name="description" content="Куда пойти в центре Москвы, кроме бара, и архив сцены Китай-города, пока она ещё жива.">').replace(/<main id="media-content">[\s\S]*?<\/main>/, () => `<main id="media-content">${homeView()}</main>`));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await writeStaticArticle();
