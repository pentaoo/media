import { homeView, articleView } from './media-views.js';
import { mountArticle } from './article.js';
import { articleTitle } from './article-view.js';
import { mountSceneRail } from './scene-rail.js';
import { mountEditorialVideos } from './editorial-video.js';
import { mountLanding } from './landing.js';
import { MAT_CHANGE_EVENT, withMat } from './mat-gate.js';

const content = document.querySelector('#media-content');
const headerRoot = document.createElement('div');
headerRoot.className = 'media-site-header';
content.before(headerRoot);
function syncHeaderHeight() {
  document.body.style.setProperty('--media-header-height', `${headerRoot.offsetHeight}px`);
}
const headerSize = new ResizeObserver(syncHeaderHeight);
headerSize.observe(headerRoot);
const root = new URL('../', import.meta.url);
const landingTitle = 'CHINATOWN.SITE — гид и архив центра Москвы';
const routeUrls = new Set([new URL('about.html', root).pathname, new URL('article.html', root).pathname]);
const sceneRail = mountSceneRail(content);
let disposeArticle = () => {};
let disposeVideos = () => {};
let disposeLanding = () => {};
let renderedRoute = '';

function renderPage({ focus = false } = {}) {
  disposeArticle();
  disposeVideos();
  disposeLanding();
  const isArticle = window.location.pathname === new URL('article.html', root).pathname;
  // Words come back before the headline glitch splits the H1 into letters.
  content.innerHTML = withMat(isArticle ? articleView() : homeView());
  const header = content.querySelector('.story-header');
  headerRoot.replaceChildren(header);
  syncHeaderHeight();
  document.body.dataset.mediaPage = isArticle ? 'article' : 'home';
  renderedRoute = location.pathname + location.search;
  document.title = isArticle ? withMat(`${articleTitle} — chinatown.site`) : landingTitle;
  sceneRail.refresh();
  disposeArticle = mountArticle(content.querySelector('.story-page'), header, sceneRail);
  disposeVideos = mountEditorialVideos(content);
  disposeLanding = isArticle ? () => {} : mountLanding(content.querySelector('.landing'), header);
  const heading = content.querySelector('h1');
  heading.tabIndex = -1;
  if (focus) heading.focus({ preventScroll: true });
}

document.addEventListener('click', (event) => {
  const link = event.target.closest('a[data-media-route]');
  if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const url = new URL(link.href);
  if (url.origin !== window.location.origin || !routeUrls.has(url.pathname) || link.target || link.hasAttribute('download')) return;
  event.preventDefault();
  if (history.state?.articleContext) history.replaceState({}, '', url);
  else history.pushState({}, '', url);
  renderPage({ focus: true });
  window.scrollTo({ top: 0, behavior: 'instant' });
});
window.addEventListener('popstate', () => {
  // Local context and anchor entries belong to the article, not to the router.
  if (renderedRoute !== location.pathname + location.search) renderPage({ focus: true });
});
// «Я ВЗРОСЛЫЙ» in the entry popup: render again, so the glitch headline gets the full words too.
window.addEventListener(MAT_CHANGE_EVENT, (event) => { if (event.detail.explicit) renderPage(); });
renderPage();
