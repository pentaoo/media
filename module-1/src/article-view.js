import { editorialDataView } from './components/editorial-data.js';
import { madk1dContext as context } from './article-context-data.js';
import { contextMaterialView, contextEntryView } from './article-context-view.js';
import { bigBurstMarkup, burstLinkMarkup, tagMarkup } from './components/tag.js';
import { articleSearchItems } from './article-search-data.js';
import { entityReferenceView } from './components/editorial-typography.js';
import { articleCopy, articleSources } from './article-copy.js';
import { siteFooterMarkup } from './components/site-footer.js';
import { subscribeDialogMarkup } from './components/subscribe-dialog.js';
const material = id => context.materials.find(item => item.id === id);
const entity = (id, label) => entityReferenceView(material(id), label);
const artwork = './assets/figma/article/';
const icons = `${artwork}header/`;

const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const contextLink = (id, label) => `<a href="#${escape(id)}" data-context-ref="${escape(id)}">${escape(label)}</a>`;
// Sources never sit in the copy: each scene lists them in its context card.
const withSources = (item, sources) => ({ ...item, sources: [...sources, ...item.sources] });

export const articleTitle = articleCopy.title;
export const articleDescription = articleCopy.description;

function paragraphView(copyId, index) {
  const section = articleCopy.sections[copyId];
  let text = escape(section.paragraphs[index]);
  let id = '';
  if (copyId === 'start' && index === 0) {
    id = 'artist-intro';
    text = text.replace('madk1d', entity('artist-madk1d', 'madk1d'))
      .replace('«Так пох*й»', entity('track-tak', '«Так пох*й»'))
      .replace('sexyswag', entity('sexyswag-artwork', 'sexyswag'));
  }
  if (copyId === 'analysis') id = ['chorus-doubt', 'chorus-conflict'][index] || '';
  if (copyId === 'delivery' && index === 2) {
    text = text.replace('подача¹', 'подача<sup><a class="story-footnote-ref" id="footnote-ref-1" href="#footnote-1" data-context-ref="footnote-1" aria-label="Сноска 1: что такое подача" role="doc-noteref">1</a></sup>');
  }
  if (copyId === 'verse' && index === 1) {
    for (const label of ['Mastermind', 'Dragon Lore', 'Logic Pro']) text = text.replace(label, contextLink('references', label));
  }
  if (copyId === 'spread' && index === 1) text = text.replace('недельные позиции', contextLink('spread-method', 'недельные позиции'));
  if (copyId === 'reach' && index === 0) text = text.replace('300%', contextLink('reach-note', '300%'));
  if (copyId === 'album' && index === 0) text = text.replace('sexyswag', entity('sexyswag-artwork', 'sexyswag'));
  if (copyId === 'return' && index === 0) text = text.replace('«Так пох*й»', entity('track-tak', '«Так пох*й»'));
  return `<p id="${id || `${copyId}-paragraph-${index + 1}`}"><span data-context-text>${text}</span></p>`;
}

function sectionView(id, copyId, { analysis = false, afterParagraph = {}, after = '', from = 0, to = Infinity, heading = true, labelledBy = `${id}-title` } = {}) {
  const section = articleCopy.sections[copyId];
  return `<section class="story-section${heading ? ' story-section--anchored' : ''} ${analysis ? 'story-analysis' : 'story-column'}" id="${id}" aria-labelledby="${escape(labelledBy)}" data-search-section>
    ${heading ? `<div class="story-section__heading"><h2 id="${id}-title">${escape(section.heading)}</h2></div>` : ''}
    <div class="story-column story-section__copy editorial-prose">
      ${section.paragraphs.map((_, index) => index >= from && index < to ? paragraphView(copyId, index) + (afterParagraph[index] || '') : '').join('\n')}
      ${after}
    </div>
  </section>`;
}

// The end of the article hands the reader on: the next story from search, as the big burst.
function nextStoryView() {
  const next = articleSearchItems.find(item => !context.articleId.startsWith(item.id));
  return bigBurstMarkup({ href: './index.html', words: ['Читать', 'дальше'], label: `Читать дальше: ${next.artist} — ${next.title}` });
}

function timelineView() {
  const timeline = articleCopy.timeline;
  return `${editorialDataView({
    id: 'spread-timeline', title: timeline.title, scope: '«Так пох*й» · Spotify · украина · недельный чарт',
    points: timeline.points.map(point => ({ ...point, label: point.position })),
    caption: timeline.caption, sources: [{ label: 'Kworb', href: articleSources.kworb.url }],
  })}
  ${contextMaterialView(withSources(material('spread-method'), [{ label: articleSources.interview.label, href: articleSources.interview.url }]))}
  ${paragraphView('timeline', 0)}`;
}

function concertTextView() {
  const { title, lyrics } = articleCopy.concert;
  if (!lyrics.length) return `<div class="story-quote-scene__lyrics"><p>${escape(title)}</p></div>`;
  return `<blockquote class="story-quote-scene__lyrics" aria-label="Припев «Так пох*й»" data-node-id="125:6">${lyrics.map((line, index) => `<p${index ? '' : ' class="is-current"'} data-quote-line>${escape(line)}</p>`).join('')}</blockquote>`;
}

function quoteSceneView({ id, text, caption, hasLyrics = true, figma = false }) {
  return `<figure class="story-quote story-quote-scene" id="${id}" data-quote-scene data-quote-content="${hasLyrics ? 'lyrics' : 'concert'}"${figma ? ' data-node-id="125:3"' : ''}>
    <div class="story-quote-scene__media" data-video-clip="madk1d-chorus" aria-hidden="true">
      <img class="story-quote-scene__photo" src="${artwork}madk1d-concert.png" alt="" width="3516" height="1984" loading="lazy"${figma ? ' data-node-id="125:4"' : ''}>
      <div class="story-quote-scene__video"></div>
      <div class="story-quote-scene__shade"${figma ? ' data-node-id="125:5"' : ''}></div>
    </div>
    <div class="story-quote-scene__scroll"><div class="story-quote-scene__stage">${text}</div></div>
    ${caption ? `<figcaption>${caption}</figcaption>` : ''}
  </figure>`;
}

function verseExcerptView() {
  const { stanzas } = articleCopy.verseExcerpt;
  const text = `<blockquote class="story-quote-scene__lyrics" aria-label="Куплет «Так пох*й»">${stanzas.map((lines, stanzaIndex) => lines.map((line, lineIndex) => `<p${stanzaIndex === 0 && lineIndex === 0 ? ' class="is-current"' : ''} data-quote-line data-lyric-line>${escape(line.text)}</p>`).join('')).join('<p class="story-quote-scene__break" role="separator" aria-label="Пропуск строк">***</p>')}</blockquote>`;
  return quoteSceneView({ id: 'verse-excerpt', text });
}

function referencesView() {
  const labels = ['Bunny Boots', 'Dragon Lore', 'Mac и Logic'];
  const genius = articleCopy.verseExcerpt.stanzas.flat().filter(line => line.href).map((line, index) => ({ label: `Genius: ${labels[index]}`, href: line.href }));
  return contextMaterialView(withSources(material('references'), genius));
}

const articleMenu = [
  { label: 'статьи', href: '#article-content', node: '272:120' },
  { label: 'заглушка', href: './index.html' },
  { label: 'о нас', href: './about.html', route: true },
];

function menuItemView({ label, href, route, node }) {
  const nodeId = node ? ` data-node-id="${node}"` : '';
  if (href) return `          <a class="story-menu__item" href="${href}"${route ? ' data-media-route' : ''}${nodeId}>${label}</a>`;
  return `          <button class="story-menu__item" type="button" aria-disabled="true" title="Раздел готовится"${nodeId}>${label}</button>`;
}

/** Shared site header (Figma 272:111 / 376:696); pages choose the menu items. */
export function siteHeaderView(items = articleMenu) {
  return `<header class="story-header" data-node-id="272:111">
      <div class="story-header__bar">
        <div class="story-header__identity" data-node-id="272:112">
          <a class="story-icon story-brand" href="./index.html" aria-label="chinatown.site — на главную" data-node-id="272:113">
            <img src="${icons}star.svg" alt="" width="35.4091" height="35.584">
          </a>
        </div>
        <nav class="story-menu" id="article-menu" aria-label="Навигация Чайнатаун" data-node-id="272:116">
${items.map(menuItemView).join('\n')}
        </nav>
        <form class="story-search" id="article-search-form" role="search" aria-label="Поиск статей" data-node-id="376:712" inert>
          <button class="story-icon story-search__submit" type="submit" aria-label="Найти статьи" data-node-id="376:713">
            <img src="${icons}search.svg" alt="" width="32" height="32">
          </button>
          <label class="story-visually-hidden" for="article-search">о чём скучаешь? найти статьи</label>
          <input id="article-search" name="q" type="search" placeholder="о чём скучаешь?" autocomplete="off" aria-controls="article-search-results" data-node-id="376:717">
          <button class="story-icon story-search__close" type="button" aria-label="Закрыть поиск" aria-controls="article-search-form article-search-results" data-node-id="376:723">
            <img src="${icons}close.svg" alt="" width="32" height="32">
          </button>
        </form>
        <div class="story-header__controls" data-node-id="272:123">
          <button class="story-icon story-search-toggle" type="button" aria-label="Открыть поиск" aria-expanded="false" aria-controls="article-search-form article-search-results" data-node-id="272:124">
            <img src="${icons}search-toggle.svg" alt="" width="32" height="32">
          </button>
          <button class="story-icon story-menu-toggle" type="button" aria-label="Открыть навигацию" aria-expanded="false" aria-controls="article-menu" hidden>
            <img src="${icons}menu.svg" alt="" width="32" height="32" data-node-id="376:719">
          </button>
        </div>
      </div>
      <div class="story-search__results" id="article-search-results" data-node-id="263:254" hidden>
        <div class="story-search__inner">
          <p class="story-search__status" role="status" aria-live="polite" hidden></p>
          <ul></ul>
        </div>
      </div>
    </header>`;
}

/** The complete article, shared by the static page and client-side navigation. */
export function articleView() {
  return `<div class="story-page" data-node-id="250:107" data-video-clip="kitay-night" data-article-id="${context.articleId}">
    <div class="story-club" data-story-club aria-hidden="true">
      <div class="story-club__haze"></div>
      <div class="story-club__bloom"></div>
      <div class="story-club__beam story-club__beam--pink"></div>
      <div class="story-club__beam story-club__beam--blue"></div>
      <div class="story-club__beam story-club__beam--green"></div>
      <div class="story-club__seam"></div>
    </div>
    <a class="story-skip" href="#article-content">перейти к статье</a>
    ${siteHeaderView()}
    <article class="story" aria-labelledby="article-title">
      <header class="story-cover film" data-node-id="290:69">
        <img class="story-cover__photo" src="${artwork}madk1d-concert.png" alt="madk1d выступает перед зрителями на освещённой сцене" width="3516" height="1984" fetchpriority="high">
        <div class="story-cover__shade" aria-hidden="true"></div>
        <div class="story-cover__meta" data-node-id="290:70">
          <p class="media-eyebrow story-category" data-node-id="290:71">новая сцена <span aria-hidden="true">/</span> разбор</p>
          <p class="story-meta" data-node-id="290:72">${tagMarkup(`${articleCopy.readingMinutes} минут`, 'time')}</p>
        </div>
        <div class="story-cover__intro-row" data-node-id="293:210">
          <p class="story-cover__intro" data-node-id="293:209">${escape(articleDescription)}</p>
        </div>
        <h1 class="story-cover__title" id="article-title" data-node-id="290:74"><span class="story-cover__artist"><span class="media-accent">madk1d</span></span> — «Так пох*й»: почему этот припев прилип</h1>
      </header>
      <div class="story-content" id="article-content" tabindex="-1">
        ${sectionView('artist', 'start', {
          afterParagraph: { 0: contextMaterialView(material('artist-madk1d')) + contextMaterialView(material('track-tak')) },
          after: `<div id="chorus">${contextEntryView(material('madk1d-live'))}</div>${contextMaterialView(material('madk1d-live'))}`,
        })}
        ${quoteSceneView({ id: 'quote', text: concertTextView(), hasLyrics: !!articleCopy.concert.lyrics.length, figma: true })}
        ${sectionView('chorus-freedom', 'analysis', { analysis: true, afterParagraph: { 0: contextMaterialView(material('address-note')) } })}
        ${sectionView('delivery', 'delivery', { afterParagraph: { 2: contextMaterialView(material('footnote-1')) } })}
        ${sectionView('verse', 'verse', { to: 1 })}
        ${verseExcerptView()}
        ${sectionView('verse-analysis', 'verse', { from: 1, heading: false, labelledBy: 'verse-title', afterParagraph: { 1: referencesView() } })}
        ${sectionView('spread', 'spread', { after: timelineView() })}
        ${sectionView('reach', 'reach', { afterParagraph: { 0: contextMaterialView(material('reach-note')) } })}
        ${sectionView('album', 'album')}
        <figure class="story-artwork story-column entity-card entity-card--album" id="sexyswag-artwork" data-context-material="sexyswag-artwork" tabindex="-1" aria-labelledby="sexyswag-artwork-title">
          <h2 class="story-artwork__title" id="sexyswag-artwork-title">${escape(material('sexyswag-artwork').title)}</h2>
          <p class="entity-card__type">${tagMarkup('альбом')}</p>
          <div class="story-artwork__cover"><a href="${escape(articleSources.album.url)}" aria-label="Альбом sexyswag на Shazam"><img src="${artwork}rail/sexyswag.png" alt="Обложка альбома sexyswag, стилизованная под страницу поиска" width="642" height="634" loading="lazy"></a>${burstLinkMarkup(material('sexyswag-artwork').listen)}</div>
          <figcaption id="sexyswag-artwork-caption"><span class="story-artwork__artist">madk1d</span><span class="story-artwork__name">Марк Робертович Серков</span><span class="story-artwork__description">Обложка альбома sexyswag — madk1d.</span></figcaption>
          ${material('sexyswag-artwork').paragraphs.map(text => `<p class="story-artwork__summary">${escape(text)}</p>`).join('')}
          <p class="article-context-sources">${material('sexyswag-artwork').sources.map(source => `<a href="${escape(source.href)}">${escape(source.label)}</a>`).join(' · ')}</p>
        </figure>
        ${sectionView('return', 'return', { to: 1, after: `<div class="story-end">${paragraphView('return', 1)}${nextStoryView()}</div>` })}
      </div>
    </article>
    ${siteFooterMarkup()}
    ${subscribeDialogMarkup()}
  </div>`.replace(/[ \t]+$/gm, '');
}
