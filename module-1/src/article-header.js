import { searchFeed } from './article-search-data.js';
import { burstLinkMarkup, createBurst, createTagList } from './components/tag.js';
import { createFollowAction } from './components/subscribe-dialog.js';

const motion = {
  searchDuration: 420,
  menuDuration: 540,
  menuStagger: 44,
  easeOut: 'cubic-bezier(.16, 1, .3, 1)',
};

/** The Figma header, with interruptible search and navigation transitions. */
export function mountArticleHeader(header, onChange, page = header.closest('.story-page')) {
  const brand = header.querySelector('.story-brand');
  const menu = header.querySelector('.story-menu');
  const items = [...menu.querySelectorAll('.story-menu__item')];
  const menuToggle = header.querySelector('.story-menu-toggle');
  const searchToggle = header.querySelector('.story-search-toggle');
  const form = header.querySelector('.story-search');
  const searchClose = form.querySelector('.story-search__close');
  const input = form.querySelector('input');
  const results = header.querySelector('.story-search__results');
  const status = results.querySelector('[role="status"]');
  const list = results.querySelector('ul');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = { get matches() { return header.clientWidth <= 760; } };
  const controller = new AbortController();
  const options = { signal: controller.signal };
  const searchAnimations = new Set();
  const menuAnimations = new Set();
  let searchOpen = false;
  let navOpen = !mobile.matches;
  let wasMobile = mobile.matches;
  let searchRevision = 0;
  let lastScrollY = Math.max(0, window.scrollY);
  let scrollDirection = 0;
  let scrollDistance = 0;

  function revealHeader() {
    header.classList.remove('is-auto-hidden');
    scrollDistance = 0;
  }

  function followScroll() {
    const y = Math.max(0, window.scrollY);
    const delta = y - lastScrollY;
    lastScrollY = y;
    if (!delta) return;
    const direction = Math.sign(delta);
    if (direction !== scrollDirection) scrollDistance = 0;
    scrollDirection = direction;
    scrollDistance += Math.abs(delta);
    const keyboardFocus = header.contains(document.activeElement) && document.activeElement.matches(':focus-visible');
    if (y <= header.offsetHeight || searchOpen || mobile.matches && navOpen || keyboardFocus || header.matches(':hover')) {
      revealHeader();
    } else if (direction < 0 && scrollDistance >= 8) {
      revealHeader();
    } else if (direction > 0 && scrollDistance >= 32) {
      header.classList.add('is-auto-hidden');
    }
  }

  function cancelAnimations(group) {
    for (const animation of group) animation.cancel();
    group.clear();
  }

  function animate(node, keyframes, timing, group, finish) {
    const animation = node.animate(keyframes, { fill: 'both', ...timing });
    group.add(animation);
    animation.finished.then(() => {
      group.delete(animation);
      finish?.();
      animation.cancel();
    }, () => group.delete(animation));
    return animation;
  }

  function syncNavigation() {
    const expanded = !searchOpen && navOpen;
    header.classList.toggle('is-nav-open', mobile.matches && navOpen && !searchOpen);
    header.dataset.nodeId = searchOpen ? '376:696' : '272:111';
    menu.inert = !expanded;
    menuToggle.setAttribute('aria-expanded', String(expanded));
    searchToggle.hidden = searchOpen;
    menuToggle.hidden = !searchOpen;
    onChange();
  }

  function clearResults() {
    results.hidden = true;
    results.inert = true;
    list.replaceChildren();
    status.hidden = true;
    status.textContent = '';
    results.classList.remove('has-query');
  }

  // Desktop rhythm: three dense rows of 4, then a sudden row of 2 big cards; the last row takes what is left.
  function searchRows(count) {
    const pattern = [4, 4, 4, 2];
    const sizes = [];
    for (let row = 0; sizes.length < count; row++) {
      const size = Math.min(pattern[row % pattern.length], count - sizes.length);
      sizes.push(...Array(size).fill(size));
    }
    return sizes;
  }

  function renderSearch() {
    clearResults();
    const query = input.value.trim().toLocaleLowerCase('ru');
    if (!searchOpen) return;
    const matches = searchFeed(query);
    status.textContent = matches.length ? '' : 'ничего не найдено. попробуй другое слово';
    const rows = searchRows(matches.length);
    for (const [index, article] of matches.entries()) {
      const item = document.createElement('li');
      item.style.setProperty('--row-count', rows[index]);
      item.dataset.size = rows[index] <= 2 ? 'wide' : 'small';
      const link = document.createElement('a');
      link.href = './index.html';
      link.className = 'story-search-result';
      const image = document.createElement('img');
      image.src = article.image;
      image.alt = '';
      image.style.objectPosition = article.position;
      const label = document.createElement('span');
      const accent = document.createElement('span');
      accent.className = 'story-search-result__accent';
      accent.textContent = article.artist;
      label.append(accent, ` — ${article.title}`);
      link.setAttribute('aria-label', `${label.textContent}. Материал готовится, открыть вайт-лист`);
      const body = document.createElement('span');
      body.className = 'story-search-result__body';
      const tags = createTagList(article.tags.map(tag => ({ label: tag })), article.id);
      tags.classList.add('ct-tags--stuck');
      body.append(label);
      link.className = 'story-search-result film';
      link.append(image, body, tags);
      if (article.status === 'new') link.append(createBurst('Новое'));
      if (item.dataset.size === 'wide') link.insertAdjacentHTML('beforeend', burstLinkMarkup({ label: 'Читать' }));
      item.append(link);
      list.append(item);
    }
    if (matches.length) {
      const follow = document.createElement('li');
      follow.className = 'story-search__follow';
      follow.append(createFollowAction());
      list.append(follow);
    }
    results.hidden = false;
    results.inert = false;
    status.hidden = !!matches.length;
    results.classList.add('has-query');
  }

  function setSearch(open, { focus = false, animated = true } = {}) {
    if (open === searchOpen && !header.classList.contains('is-search-animating')) {
      if (open && focus) input.focus({ preventScroll: true });
      return;
    }
    const wasVisible = searchOpen || header.classList.contains('is-search-animating');
    const currentStyle = getComputedStyle(form);
    const currentTransform = currentStyle.transform;
    const currentOpacity = currentStyle.opacity;
    const revision = ++searchRevision;
    cancelAnimations(searchAnimations);
    searchOpen = open;
    if (open) navOpen = false;
    else if (!mobile.matches) navOpen = true;
    header.classList.toggle('is-search-open', open);
    form.inert = !open;
    clearResults();
    searchToggle.inert = open;
    searchToggle.setAttribute('aria-expanded', String(open));
    if (open) {
      revealHeader();
      cancelAnimations(menuAnimations);
    }
    syncNavigation();
    if (open) renderSearch();
    const shouldAnimate = animated && !reducedMotion.matches;
    header.classList.toggle('is-search-animating', shouldAnimate);
    if (!shouldAnimate) {
      if (focus) (open ? input : searchToggle).focus({ preventScroll: true });
      return;
    }
    // The icon and text travel together from the right edge. The background's
    // shorter opacity transition lives on the form's ::before surface in CSS.
    const distance = innerWidth - form.offsetLeft;
    const start = wasVisible
      ? { transform: currentTransform, opacity: currentOpacity }
      : { transform: `translateX(${distance}px)`, opacity: 0 };
    animate(form, [start, {
      transform: open ? 'translateX(0)' : `translateX(${distance}px)`,
      opacity: open ? 1 : 0,
    }], { duration: open ? motion.searchDuration : 280, easing: motion.easeOut }, searchAnimations, () => {
      if (revision !== searchRevision) return;
      header.classList.remove('is-search-animating');
    });
    if (focus) (open ? input : searchToggle).focus({ preventScroll: true });
  }

  function showNavigation({ animated = false } = {}) {
    revealHeader();
    cancelAnimations(menuAnimations);
    setSearch(false);
    navOpen = true;
    syncNavigation();
    if (!animated || reducedMotion.matches) return;
    // Reveal from the right edge, starting with the rightmost navigation item.
    for (const [index, node] of [...items].reverse().entries()) {
      const rect = node.getBoundingClientRect();
      const distance = innerWidth - rect.left + 32;
      animate(node, [
        { transform: `translateX(${distance}px)`, opacity: 0, offset: 0 },
        { opacity: .5, offset: .12 },
        { transform: 'translateX(0)', opacity: 1, offset: 1 },
      ], { duration: motion.menuDuration, delay: index * motion.menuStagger, easing: motion.easeOut }, menuAnimations);
    }
  }

  menuToggle.addEventListener('click', () => showNavigation({ animated: true }), options);
  searchToggle.addEventListener('click', () => setSearch(!searchOpen, { focus: true }), options);
  searchClose.addEventListener('click', () => setSearch(false, { focus: true }), options);
  input.addEventListener('input', renderSearch, options);
  form.addEventListener('submit', event => {
    event.preventDefault();
    renderSearch();
    list.querySelector('a')?.focus();
  }, options);

  // An open search is a screen of its own: only Escape or its close button leave it.
  function close() {
    if (searchOpen) return;
    cancelAnimations(menuAnimations);
    navOpen = !mobile.matches;
    syncNavigation();
  }
  document.addEventListener('click', event => {
    if (!header.contains(event.target)) close();
  }, options);
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (searchOpen) { setSearch(false, { focus: true }); event.preventDefault(); }
    else if (navOpen && mobile.matches) { close(); brand.focus(); event.preventDefault(); }
  }, options);
  function resetMotion() {
    if (wasMobile !== mobile.matches) {
      wasMobile = mobile.matches;
      if (!searchOpen) navOpen = !mobile.matches;
    }
    cancelAnimations(menuAnimations);
    cancelAnimations(searchAnimations);
    ++searchRevision;
    header.classList.remove('is-search-animating');
    if (!searchOpen) clearResults();
    revealHeader();
    syncNavigation();
  }
  header.addEventListener('focusin', revealHeader, options);
  document.addEventListener('pointermove', event => {
    if (event.pointerType !== 'touch' && event.clientY <= 24) revealHeader();
  }, { ...options, passive: true });
  window.addEventListener('scroll', followScroll, { ...options, passive: true });
  window.addEventListener('pageshow', () => {
    lastScrollY = Math.max(0, window.scrollY);
    revealHeader();
  }, options);
  window.addEventListener('resize', resetMotion, options);
  reducedMotion.addEventListener('change', resetMotion, options);
  let headerWidth = header.clientWidth;
  const resizeObserver = new ResizeObserver(() => {
    if (header.clientWidth === headerWidth) return;
    headerWidth = header.clientWidth;
    if (wasMobile !== mobile.matches) resetMotion();
  });
  resizeObserver.observe(header);
  syncNavigation();
  return {
    close,
    dispose() {
      controller.abort();
      resizeObserver.disconnect();
      cancelAnimations(searchAnimations);
      cancelAnimations(menuAnimations);
      header.classList.remove('is-auto-hidden');
    },
  };
}
