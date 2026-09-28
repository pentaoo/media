import { getRelease, releases } from './releases.js';
import { parseYandexMusicUrl } from './yandex-music.js';
import { createSceneWindow } from './scene-window.js';

const homeUrl = new URL('../', import.meta.url);

const app = document.querySelector('#app');
const player = document.querySelector('#player');
const playerTitle = document.querySelector('#player-title');
const playerExternal = document.querySelector('#player-external');
const playerExpand = document.querySelector('#player-expand');
const playerClose = document.querySelector('#player-close');
const frameWrap = document.querySelector('#player-frame-wrap');

let activeReleaseId = null;
let expanded = false;
let sceneWindow = null;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function currentDetail() {
  const id = new URL(window.location.href).searchParams.get('release');
  return id ? getRelease(id) : null;
}

function setExpanded(value) {
  expanded = value;
  player.classList.toggle('player--expanded', value);
  playerExpand.setAttribute('aria-expanded', String(value));
  playerExpand.setAttribute('aria-label', value ? 'Свернуть плеер' : 'Развернуть плеер');
  playerExpand.title = value ? 'Свернуть плеер' : 'Развернуть плеер';
  playerExpand.textContent = value ? 'Свернуть' : 'Развернуть';
  updateLayout();
}

function updateLayout() {
  const detail = currentDetail();
  document.body.dataset.page = detail ? 'detail' : 'catalog';
  document.body.dataset.player = player.hidden ? 'closed' : expanded ? 'expanded' : 'compact';
}

function openPlayer(release, shouldExpand = false) {
  const parsed = parseYandexMusicUrl(release.musicUrl);
  if (!parsed) return;

  // Keep the same iframe when the current release is opened again or the page changes.
  if (activeReleaseId !== release.id || !frameWrap.firstElementChild) {
    const frame = document.createElement('iframe');
    frame.src = parsed.iframeUrl;
    frame.title = `Яндекс Музыка: ${release.title}`;
    frame.allow = 'autoplay; encrypted-media';
    frame.setAttribute('loading', 'eager');
    frameWrap.replaceChildren(frame);
    activeReleaseId = release.id;
  }

  playerTitle.textContent = release.title;
  playerExternal.href = parsed.sourceUrl;
  player.hidden = false;
  setExpanded(shouldExpand);
}

function closePlayer() {
  player.hidden = true;
  frameWrap.replaceChildren(); // Unload the iframe and stop playback.
  activeReleaseId = null;
  updateLayout();
}

function navigateTo(release) {
  const url = new URL(homeUrl);
  if (release) url.searchParams.set('release', release.id);
  window.history.pushState({}, '', url);
  render();
  window.scrollTo({ top: 0, behavior: 'auto' });
}

function makeListenButton(release) {
  if (!parseYandexMusicUrl(release.musicUrl)) return null;
  const button = element('button', 'listen-button', 'Слушать');
  button.type = 'button';
  button.addEventListener('click', () => openPlayer(release, currentDetail() !== null || expanded));
  return button;
}

function renderCatalog() {
  const section = element('section', 'catalog page-shell');
  sceneWindow = createSceneWindow();
  section.append(sceneWindow);
  section.append(
    element('h1', '', 'Релизы'),
    element('p', 'hint', 'Нажмите «Слушать», затем Play внутри виджета Яндекс Музыки.'),
  );

  const grid = element('div', 'release-grid');
  for (const release of releases) {
    const card = element('article', 'release-card');
    card.append(
      element('small', '', release.kind),
      element('h2', '', release.title),
      element('p', '', release.subtitle),
    );

    const actions = element('div', 'release-card__actions');
    const listen = makeListenButton(release);
    if (listen) actions.append(listen);
    const detail = element('a', '', 'Подробнее');
    const detailUrl = new URL(homeUrl);
    detailUrl.searchParams.set('release', release.id);
    detail.href = detailUrl.href;
    detail.addEventListener('click', (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      event.preventDefault();
      navigateTo(release);
    });
    actions.append(detail);
    card.append(actions);
    grid.append(card);
  }
  section.append(grid);
  const credits = element('details', 'media-credits');
  const summary = element('summary', '', 'Источники видео во вступлении');
  credits.append(summary);
  const sourceList = element('ul');
  for (const [label, href] of [
    ['Концерт Pixies — Benoît Prieur, CC0', 'https://commons.wikimedia.org/wiki/File:Fin_concert_Pixies_Lyon_2016_et_coussins_volants.webm'],
    ['DJ-сет — Leticia Nabunje, CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:DJ_mixes_music_while_people_enjoy_beats.webm'],
    ['Красная площадь — Zeliotvankaizer, CC BY 4.0', 'https://commons.wikimedia.org/wiki/File:Red_Square_Chinese_New_Year.webm'],
  ]) {
    const item = element('li');
    const link = element('a', '', label);
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    item.append(link);
    sourceList.append(item);
  }
  credits.append(sourceList);
  section.append(credits);
  return section;
}

function renderDetail(release) {
  const section = element('section', 'detail page-shell');
  const back = element('a', 'back-link', '← Все релизы');
  back.href = '/';
  back.addEventListener('click', (event) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    navigateTo(null);
  });
  section.append(back);

  section.append(
    element('small', '', release.kind),
    element('h1', '', release.title),
    element('p', '', release.subtitle),
  );
  if (parseYandexMusicUrl(release.musicUrl)) {
    section.append(element('p', 'hint', 'Ниже встроенный виджет. Воспроизведение запускается внутри него.'));
  } else {
    section.append(element('p', 'hint', 'Ссылка на Яндекс Музыку для этого релиза пока не указана.'));
  }
  return section;
}

function render() {
  sceneWindow?.dispose?.();
  sceneWindow = null;
  const release = currentDetail();
  app.replaceChildren(release ? renderDetail(release) : renderCatalog());
  document.title = release ? `${release.title} — Pocket Jam` : 'Pocket Jam — музыка и сцена';

  if (release && parseYandexMusicUrl(release.musicUrl)) {
    openPlayer(release, true);
  } else if (release) {
    closePlayer();
  } else {
    updateLayout();
  }
}

playerExpand.addEventListener('click', () => setExpanded(!expanded));
playerClose.addEventListener('click', closePlayer);
document.querySelector('[data-home-link]').addEventListener('click', (event) => {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
  event.preventDefault();
  navigateTo(null);
});
window.addEventListener('popstate', render);
if (document.querySelector('#intro')) {
  window.addEventListener('pocketjam:intro-dismissed', render, { once: true });
} else {
  render();
}
