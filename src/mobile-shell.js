import { createContextPager } from './context-pager.js';
import { initialMobileShellState, reduceMobileShell, mobileSnapHeights, mobileSnapAfterDrag } from './mobile-shell-state.js';
import { mountMobileCityVideo } from './mobile-city-video.js';
import { searchFeed } from './article-search-data.js';
import { burstLinkMarkup, createBurst, createTag, createTagList } from './components/tag.js';
import { createFollowAction } from './components/subscribe-dialog.js';

const timeSticker = new URL('../assets/stickers/time.svg', import.meta.url).href;
const asset = name => new URL(`../assets/figma/mobile-shell/${name}.svg`, import.meta.url).href;
/** Durations live in design-tokens.css so CSS transitions and Web Animations share one scale. */
const motionMs = (name, fallback) => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || fallback;
const img = (name, size) => `<img src="${asset(name)}" alt="" width="${size}" height="${size}" aria-hidden="true">`;

/** Phone-only shell: one content sheet, site search, navigation and three Figma FABs. Without `context` only menu and search remain. */
export function mountMobileShell(page, { context: withContext = true, onOverlayChange = () => {}, onVisibilityChange = () => {}, onDismissContext = () => {}, onRestoreContext = () => {} } = {}) {
  const controller = new AbortController();
  const options = { signal: controller.signal };
  const phone = matchMedia('(max-width: 760px)');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const storageKey = `chinatown:mobile-shell:${page.dataset.articleId || 'site'}`;
  let saved;
  try { saved = JSON.parse(sessionStorage.getItem(storageKey) || '{}'); } catch { /* Private mode or an older draft. */ }
  let state = initialMobileShellState(saved);
  let context = { id: null, title: 'Китай-город' };
  let showVideo = false;
  let frozen = false;
  let lastOverlay = false;
  let drag = null;
  let dragMoved = false;
  let settleMs = null;
  let pointerDown = false;
  let shake = null;
  let ownedHistory = false;
  let historyMode = null;
  const token = crypto.randomUUID();
  let scrollLock = null;
  let announcedId = null;

  const root = document.createElement('div');
  root.className = 'mobile-shell';
  root.innerHTML = `<p class="story-visually-hidden" data-mobile-status role="status" aria-live="polite"></p>
    <div class="mobile-shell__fabs" role="group" aria-label="Управление сайтом" data-node-id="404:664">
      <button class="mobile-fab" type="button" data-mobile-mode="menu" aria-label="Открыть меню" aria-expanded="false" aria-controls="mobile-site-menu" data-node-id="404:665"><span>${img('menu-24', 24)}</span></button>
      <button class="mobile-fab" type="button" data-mobile-mode="search" aria-label="Поиск статей" aria-expanded="false" aria-controls="mobile-site-search" data-node-id="404:667"><span>${img('search-24', 24)}</span></button>
      <button class="mobile-fab mobile-fab--context" type="button" data-mobile-mode="context" aria-label="Открыть дополнительный материал" aria-expanded="false" aria-controls="mobile-context-sheet" data-node-id="404:671"><span>${burstLinkMarkup({ label: 'Ещё' })}<i class="mobile-fab__unread" hidden></i></span></button>
    </div>
    <div class="mobile-shell__backdrop"></div>
    <section class="mobile-shell__sheet" id="mobile-context-sheet" aria-label="Рядом со статьёй" inert>
      <div class="mobile-shell__handle" data-sheet-handle>
        <button class="mobile-shell__grab" type="button" aria-label="Развернуть плашку"><span></span></button>
        <div class="mobile-shell__heading"><button class="mobile-shell__title" type="button"></button></div>
      </div>
      <div class="mobile-shell__pages"><div class="mobile-shell__content"></div></div>
      <div class="mobile-city-video" hidden></div>
      <div class="mobile-shell__format"><button type="button" data-city-toggle>смотреть китай-город ↗</button></div>
      <button class="mobile-shell__preview-toggle" type="button" aria-label="Развернуть дополнительный материал" hidden></button>
    </section>
    <section class="mobile-shell__menu-surface" role="dialog" aria-modal="true" aria-label="Меню сайта" inert>
      <button class="mobile-fab mobile-shell__menu-close" type="button" aria-label="Закрыть меню"><span>${img('arrow-down', 32)}</span></button>
      <nav id="mobile-site-menu" aria-label="Навигация Чайнатаун">
        <a href="./article.html">статьи</a><a href="./index.html">заглушка</a><a href="./about.html">о нас</a>
      </nav>
    </section>
    <section class="mobile-shell__search" id="mobile-site-search" role="dialog" aria-modal="true" aria-label="Поиск статей" inert>
      <form class="mobile-search-field" role="search" aria-label="Поиск статей">
        <button type="submit" aria-label="Найти статьи">${img('search-field', 24)}</button>
        <label class="story-visually-hidden" for="mobile-article-query">о чём скучаешь? поиск статей</label>
        <input id="mobile-article-query" type="search" name="q" placeholder="о чём скучаешь?" autocomplete="off" aria-controls="mobile-search-results">
        <button type="button" data-search-close aria-label="Закрыть поиск">${img('close', 24)}</button>
      </form>
      <p class="mobile-shell__search-status story-visually-hidden" role="status" aria-live="polite"></p>
      <ul id="mobile-search-results" class="mobile-search-results"></ul>
    </section>`;
  document.body.append(root);
  const fabs = root.querySelector('.mobile-shell__fabs');
  const liveStatus = root.querySelector('[data-mobile-status]');
  const contextButton = root.querySelector('[data-mobile-mode="context"]');
  // Pages without material beside the text (the landing) keep only the square FABs.
  if (!withContext) contextButton.remove();
  const badge = contextButton.querySelector('.mobile-fab__unread');
  const sheet = root.querySelector('.mobile-shell__sheet');
  const handle = root.querySelector('[data-sheet-handle]');
  const title = root.querySelector('.mobile-shell__title');
  const grab = root.querySelector('.mobile-shell__grab');
  const previewToggle = root.querySelector('.mobile-shell__preview-toggle');
  const pages = root.querySelector('.mobile-shell__pages');
  const contextHost = root.querySelector('.mobile-shell__content');
  const format = root.querySelector('.mobile-shell__format');
  const cityToggle = root.querySelector('[data-city-toggle]');
  const cityHost = root.querySelector('.mobile-city-video');
  const city = mountMobileCityVideo(cityHost);
  const menu = root.querySelector('.mobile-shell__menu-surface');
  const search = root.querySelector('.mobile-shell__search');
  const input = search.querySelector('input');
  const searchStatus = root.querySelector('.mobile-shell__search-status');
  const results = root.querySelector('.mobile-search-results');
  const backdrop = root.querySelector('.mobile-shell__backdrop');
  const pager = createContextPager(contextHost, {
    outgoingClassName: 'mobile-shell__content mobile-shell__outgoing',
    canAnimate: () => isContextOpen() && !reducedMotion.matches && !frozen && !document.hidden,
    duration: motionMs('--motion-enter', 260),
    onUpdate() {},
  });

  const viewportHeight = () => window.visualViewport?.height || innerHeight;
  const isOverlay = () => phone.matches && (state.mode === 'menu' || state.mode === 'search');
  const isContextOpen = () => phone.matches && state.mode === 'context' && state.snap !== 'hidden';
  const contextVisible = () => isContextOpen() && !showVideo && !frozen;
  const ownHistory = () => history.state?.mobileShell?.token === token;

  function persist() {
    try { sessionStorage.setItem(storageKey, JSON.stringify({ dismissed: state.dismissed, introduced: state.introduced })); } catch { /* Memory state remains usable. */ }
  }
  function apply(event) {
    const before = state;
    state = reduceMobileShell(state, event);
    persist();
    render();
    if (state.unread && !before.unread && phone.matches && !reducedMotion.matches) {
      shake?.cancel();
      // One short turn and back; a still-unread badge never retriggers it.
      shake = contextButton.querySelector('span').animate([
        { transform: 'rotate(0)' }, { transform: 'rotate(-14deg)', offset: .4 }, { transform: 'rotate(0)' },
      ], { duration: motionMs('--motion-enter', 260), easing: 'ease-in-out' });
    }
  }
  function lockArticle(lock) {
    if (lock && !scrollLock) {
      scrollLock = { overflow: document.documentElement.style.overflow, y: window.scrollY };
      document.documentElement.style.overflow = 'hidden';
      page.inert = true;
    } else if (!lock && scrollLock) {
      const previous = scrollLock;
      scrollLock = null;
      page.inert = false;
      document.documentElement.style.overflow = previous.overflow;
      if (window.scrollY !== previous.y) window.scrollTo({ top: previous.y, behavior: 'instant' });
    }
  }
  function syncViewport() {
    const height = viewportHeight();
    const searchInset = Math.max(0, innerHeight - height - (window.visualViewport?.offsetTop || 0));
    const heights = mobileSnapHeights(height);
    root.style.setProperty('--mobile-viewport-height', `${height}px`);
    root.style.setProperty('--mobile-search-inset', `${searchInset}px`);
    // Only resizes touch these; snaps themselves are transforms relative to the sheet's own height.
    root.style.setProperty('--mobile-sheet-full', `${heights.expanded}px`);
    root.style.setProperty('--mobile-sheet-preview', `${heights.preview}px`);
  }
  /** The sheet's visible height right now, including an unfinished transition. */
  function visibleSheetHeight() {
    const transform = getComputedStyle(sheet).transform;
    return Math.max(0, sheet.offsetHeight - (transform === 'none' ? 0 : new DOMMatrixReadOnly(transform).m42));
  }
  function render() {
    root.hidden = !phone.matches;
    root.inert = !phone.matches || frozen;
    const contentOpen = isContextOpen();
    const overlay = isOverlay();
    const videoVisible = contentOpen && (!context.id || showVideo);
    // Visual states are data attributes; CSS transitions start from the current position, so any change can interrupt another.
    if (settleMs) root.style.setProperty('--mobile-sheet-settle', `${settleMs}ms`);
    else root.style.removeProperty('--mobile-sheet-settle');
    settleMs = null;
    root.dataset.mode = state.mode || 'closed';
    root.dataset.snap = state.snap;
    root.dataset.sheet = contentOpen ? 'open' : overlay && state.snap !== 'hidden' ? 'covered' : 'hidden';
    root.dataset.fabs = phone.matches && state.snap !== 'hidden' ? 'compact' : 'full';
    // Leaving surfaces stop taking input at once and finish their exit visually.
    sheet.inert = !contentOpen || frozen;
    sheet.setAttribute('aria-hidden', String(!contentOpen));
    previewToggle.hidden = !contentOpen || state.snap !== 'preview';
    contextHost.inert = state.snap === 'preview';
    fabs.inert = overlay;
    fabs.dataset.nodeId = contentOpen ? '408:855' : '404:664';
    contextButton.inert = contentOpen;
    contextButton.setAttribute('aria-hidden', String(contentOpen));
    menu.inert = !phone.matches || state.mode !== 'menu';
    search.inert = !phone.matches || state.mode !== 'search';
    for (const button of fabs.querySelectorAll('[data-mobile-mode]')) button.setAttribute('aria-expanded', String(phone.matches && state.mode === button.dataset.mobileMode));
    badge.hidden = !state.unread;
    contextButton.setAttribute('aria-label', state.unread ? 'Новый дополнительный материал. Открыть плашку' : 'Открыть дополнительный материал');
    if (phone.matches && context.id && context.id !== announcedId) {
      liveStatus.textContent = `Дополнительный материал: ${context.title}`;
      announcedId = context.id;
    }
    // A leaving sheet keeps its last content so the exit shows what the reader saw.
    if (contentOpen) {
      title.textContent = videoVisible ? 'Китай-город' : context.title;
      title.setAttribute('aria-label', `${title.textContent}. Развернуть плашку`);
      cityHost.hidden = !videoVisible;
      pages.hidden = videoVisible || !context.id;
      format.hidden = !context.id;
      cityToggle.textContent = showVideo ? '← К материалу' : 'смотреть китай-город ↗';
    }
    grab.setAttribute('aria-label', state.snap === 'expanded' ? 'Уменьшить плашку' : 'Развернуть плашку');
    city.setActive(videoVisible && !frozen && phone.matches);
    document.body.classList.toggle('has-mobile-shell', phone.matches);
    document.body.classList.toggle('has-mobile-overlay', overlay);
    lockArticle(overlay);
    syncViewport();
    if (overlay !== lastOverlay) { lastOverlay = overlay; onOverlayChange(overlay); }
    onVisibilityChange(contextVisible());
  }
  function recordHistory(mode) {
    const value = { ...history.state, mobileShell: { token, mode, materialId: context.manual ? context.id : null } };
    if (ownHistory()) history.replaceState(value, '');
    else history.pushState(value, '');
    ownedHistory = true;
    historyMode = mode;
  }
  function restoreButton(mode) {
    if (phone.matches && !frozen) root.querySelector(`[data-mobile-mode="${mode}"]`)?.focus({ preventScroll: true });
  }
  function closeOverlay({ historyBack = true } = {}) {
    const mode = state.mode;
    input.blur();
    apply({ type: 'back' });
    if (historyBack && ownHistory()) history.back();
    if (state.mode === 'context') grab.focus({ preventScroll: true });
    else restoreButton(mode);
  }
  function hideContext() {
    apply({ type: 'hide' });
    onDismissContext();
    if (ownHistory()) history.back();
    restoreButton('context');
  }
  function setSnap(snap) {
    if (snap === 'hidden') hideContext();
    else apply({ type: 'snap', snap });
  }
  function collapse() {
    setSnap(state.snap === 'preview' ? 'hidden' : 'preview');
  }
  function toggleSheet() {
    if (dragMoved) return;
    setSnap(state.snap === 'expanded' ? 'preview' : 'expanded');
  }
  // The card the reader is looking at opens up. The focus line sits at 40% of the list height; near the top and the
  // bottom of the feed it slides toward the edge so the first and the last cards can open too. The line is matched
  // against the folded layout, so opening a card never moves the line onto another one and the choice cannot flicker.
  let focusIndex = -1;
  let focusFrame = 0;
  let folded = { bottoms: [], scrollHeight: 0 };
  function measureFolded() {
    // Fold every card for one synchronous read; the transition is off so nothing animates back and forth.
    results.classList.add('is-measuring');
    folded = {
      bottoms: [...results.querySelectorAll('.mobile-search-result')].map(card => card.parentElement.offsetTop + card.offsetHeight),
      scrollHeight: results.scrollHeight,
    };
    results.classList.remove('is-measuring');
  }
  function updateSearchFocus() {
    focusFrame = 0;
    const cards = [...results.querySelectorAll('.mobile-search-result')];
    if (!cards.length) return;
    const top = results.scrollTop;
    const height = results.clientHeight;
    const rest = folded.scrollHeight - height - top;
    const line = top + Math.max(Math.min(height * .4, top + 64), height - rest - 64);
    let index = folded.bottoms.findIndex(bottom => bottom > line);
    if (index < 0) index = cards.length - 1;
    if (index === focusIndex) return;
    focusIndex = index;
    cards.forEach((card, i) => card.parentElement.classList.toggle('is-focus', i === index));
  }
  const resultsSize = new ResizeObserver(() => {
    if (!results.children.length) return;
    measureFolded();
    updateSearchFocus();
  });
  resultsSize.observe(results);
  results.addEventListener('scroll', () => { if (!focusFrame) focusFrame = requestAnimationFrame(updateSearchFocus); }, { ...options, passive: true });

  function renderSearch() {
    const matches = searchFeed(input.value);
    results.replaceChildren();
    for (const item of matches) {
      const li = document.createElement('li');
      const link = document.createElement('a');
      link.className = 'mobile-search-result';
      link.href = './index.html';
      link.setAttribute('aria-label', `${item.artist} — ${item.title}. Материал готовится, открыть вайт-лист`);
      const cover = document.createElement('img');
      cover.src = item.image;
      cover.alt = '';
      cover.style.objectPosition = item.position;
      const label = document.createElement('p');
      const artist = document.createElement('span');
      artist.textContent = item.artist;
      label.append(artist, ` — ${item.title}`);
      const body = document.createElement('div');
      body.className = 'mobile-search-result__body';
      const tags = createTagList(item.tags.map(tag => ({ label: tag })), item.id);
      tags.classList.add('ct-tags--stuck');
      body.append(label);
      // Prologue for the card in focus: reading time and a short lead, folded away on the other cards.
      const more = document.createElement('div');
      more.className = 'mobile-search-result__more';
      const moreInner = document.createElement('div');
      const lead = document.createElement('p');
      lead.textContent = item.lead;
      moreInner.append(createTag({ label: `${item.minutes} минут`, sticker: timeSticker }), lead);
      more.append(moreInner);
      link.classList.add('film');
      link.append(cover, body, more, tags);
      if (item.status === 'new') link.append(createBurst('Новое'));
      li.append(link);
      results.append(li);
    }
    if (matches.length) {
      const follow = document.createElement('li');
      follow.className = 'mobile-search-follow';
      follow.append(createFollowAction());
      results.append(follow);
    }
    // A fresh list opens its first card at once: results do not animate while typing.
    focusIndex = -1;
    results.scrollTop = 0;
    results.classList.add('is-instant');
    measureFolded();
    updateSearchFocus();
    results.offsetHeight;
    results.classList.remove('is-instant');
    searchStatus.textContent = matches.length ? `Материалов: ${matches.length}` : 'ничего не найдено. попробуй другое слово';
    searchStatus.classList.toggle('story-visually-hidden', matches.length > 0);
  }
  function openMode(mode) {
    if (mode === 'context') {
      showVideo = false;
      apply({ type: 'open' });
      recordHistory(mode);
      grab.focus({ preventScroll: true });
      return;
    }
    if (state.mode === mode) { closeOverlay(); return; }
    apply({ type: 'overlay', mode });
    recordHistory(mode);
    if (mode === 'search') {
      renderSearch();
      input.focus({ preventScroll: true });
    } else menu.querySelector('a').focus({ preventScroll: true });
  }
  fabs.addEventListener('click', event => {
    const button = event.target.closest('[data-mobile-mode]');
    if (button) openMode(button.dataset.mobileMode);
  }, options);
  backdrop.addEventListener('click', () => closeOverlay(), options);
  root.querySelector('.mobile-shell__menu-close').addEventListener('click', () => closeOverlay(), options);
  search.querySelector('[data-search-close]').addEventListener('click', () => closeOverlay(), options);
  for (const control of [grab, title, previewToggle]) control.addEventListener('click', toggleSheet, options);
  input.addEventListener('input', renderSearch, options);
  search.querySelector('form').addEventListener('submit', event => {
    event.preventDefault();
    renderSearch();
    input.blur();
    results.querySelector('a')?.focus({ preventScroll: true });
  }, options);
  cityToggle.addEventListener('click', () => { showVideo = !showVideo; render(); }, options);
  // One drag model for the handle (pointer events) and the rest of the sheet (touch events).
  function startDrag(id, y) {
    dragMoved = false;
    drag = { id, startY: y, lastY: y, lastTime: performance.now(), velocity: 0, snap: state.snap, origin: 0, visible: 0 };
  }
  function moveDrag(y, onPickUp) {
    const now = performance.now();
    if (!dragMoved) {
      if (Math.abs(y - drag.startY) <= 6) return;
      dragMoved = true;
      onPickUp?.();
      // Pick the sheet up where it is, even mid-transition, so the finger never causes a jump.
      drag.origin = visibleSheetHeight();
      drag.startY = y;
      drag.lastY = y;
      drag.lastTime = now;
    }
    drag.velocity = (y - drag.lastY) / Math.max(1, now - drag.lastTime);
    drag.lastY = y;
    drag.lastTime = now;
    drag.visible = Math.max(0, Math.min(sheet.offsetHeight, drag.origin - (y - drag.startY)));
    root.style.setProperty('--mobile-sheet-drag', `${drag.visible}px`);
    root.classList.add('is-dragging');
  }
  function endDrag(cancelled = false) {
    const previous = drag;
    drag = null;
    if (!dragMoved) return;
    const velocity = cancelled || performance.now() - previous.lastTime > 100 ? 0 : previous.velocity;
    const snap = cancelled ? previous.snap : mobileSnapAfterDrag({ snap: previous.snap, height: previous.visible, viewportHeight: viewportHeight(), velocity });
    const target = mobileSnapHeights(viewportHeight())[snap];
    // Continue the finger's speed: the ease curve starts at ~4.5x its average speed.
    if (Math.abs(velocity) > .05) settleMs = Math.round(Math.max(180, Math.min(280, 4.5 * Math.abs(target - previous.visible) / Math.abs(velocity))));
    // The class and the new snap change in one style pass, so the transition starts from the released position.
    root.classList.remove('is-dragging');
    if (cancelled) render();
    else setSnap(snap);
    // Suppress the click generated by a completed drag, without blocking the next tap.
    setTimeout(() => { dragMoved = false; }, 0);
  }
  handle.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    startDrag(event.pointerId, event.clientY);
  }, options);
  handle.addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return;
    moveDrag(event.clientY, () => handle.setPointerCapture(event.pointerId));
  }, options);
  function finishPointerDrag(event, cancelled = false) {
    if (!drag || drag.id !== event.pointerId) return;
    if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
    endDrag(cancelled);
  }
  handle.addEventListener('pointerup', finishPointerDrag, options);
  handle.addEventListener('pointercancel', event => finishPointerDrag(event, true), options);
  // Anywhere else on the open sheet a downward swipe moves the sheet too, once the material is
  // scrolled to its top. Upward swipes stay native: they scroll the material, or the article under a preview.
  let touch = null;
  sheet.addEventListener('touchstart', event => {
    touch = null;
    if (drag || event.touches.length !== 1 || !isContextOpen() || event.target.closest('[data-sheet-handle]')) return;
    const { identifier, clientX, clientY } = event.touches[0];
    touch = { id: identifier, x: clientX, y: clientY, claimed: false };
  }, { ...options, passive: true });
  sheet.addEventListener('touchmove', event => {
    const point = touch && [...event.changedTouches].find(item => item.identifier === touch.id);
    if (!point) return;
    if (!touch.claimed) {
      const dx = point.clientX - touch.x;
      const dy = point.clientY - touch.y;
      if (!dy || Math.abs(dx) >= Math.abs(dy)) { if (Math.abs(dx) > 6) touch = null; return; }
      const scroller = event.target.closest('.mobile-shell__content');
      const atTop = !scroller || state.snap === 'preview' || scroller.scrollTop <= 0;
      if (!event.cancelable || dy < 0 || !atTop) { touch = null; return; }
      touch.claimed = true;
      startDrag(`touch-${touch.id}`, touch.y);
    }
    event.preventDefault();
    moveDrag(point.clientY);
  }, { ...options, passive: false });
  for (const type of ['touchend', 'touchcancel']) sheet.addEventListener(type, event => {
    if (!touch || ![...event.changedTouches].some(item => item.identifier === touch.id)) return;
    const claimed = touch.claimed;
    touch = null;
    if (claimed && drag) endDrag(type === 'touchcancel');
  }, options);
  root.addEventListener('pointerdown', () => { pointerDown = true; }, options);
  // A passive listener lets mobile Safari apply :active press feedback; it never intercepts scrolling.
  root.addEventListener('touchstart', () => {}, { ...options, passive: true });
  for (const type of ['pointerup', 'pointercancel', 'blur']) window.addEventListener(type, () => { pointerDown = false; }, options);
  document.addEventListener('keydown', event => {
    if (!phone.matches || frozen || event.defaultPrevented) return;
    if (event.key === 'Escape') {
      if (isOverlay()) closeOverlay();
      else if (state.mode === 'context') collapse();
      else return;
      event.preventDefault();
    }
    if (event.key !== 'Tab' || !isOverlay()) return;
    const surface = state.mode === 'menu' ? menu : search;
    const controls = [...surface.querySelectorAll('a, button, input')].filter(node => !node.hidden && !node.disabled);
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }, options);
  window.addEventListener('popstate', () => {
    if (ownHistory()) {
      ownedHistory = true;
      historyMode = history.state.mobileShell.mode;
      if (history.state.mobileShell.materialId) onRestoreContext(history.state.mobileShell.materialId);
      if (historyMode === 'context') apply({ type: 'open' });
      else { apply({ type: 'overlay', mode: historyMode }); renderSearch(); }
    } else if (ownedHistory) {
      ownedHistory = false;
      if (historyMode === 'context') hideContext();
      else if (isOverlay()) closeOverlay({ historyBack: false });
      onDismissContext();
    }
  }, options);
  phone.addEventListener('change', () => {
    if (!phone.matches) {
      input.blur();
      if (state.mode === 'menu' || state.mode === 'search') state = reduceMobileShell(state, { type: 'back' });
      if (ownHistory()) {
        const { mobileShell, ...rest } = history.state;
        history.replaceState(rest, '');
        ownedHistory = false;
      }
    }
    pager.finish();
    render();
  }, options);
  reducedMotion.addEventListener('change', () => { shake?.cancel(); pager.finish(); }, options);
  window.addEventListener('resize', syncViewport, options);
  window.visualViewport?.addEventListener('resize', syncViewport, options);
  window.visualViewport?.addEventListener('scroll', syncViewport, options);
  render();
  renderSearch();

  return {
    contextHost,
    get active() { return phone.matches; },
    get contextVisible() { return contextVisible(); },
    isInteracting() {
      const selection = window.getSelection();
      return pointerDown || !selection?.isCollapsed && contextHost.contains(selection?.anchorNode);
    },
    setContext(node, details = {}) {
      context = { ...details, id: details.id || null, title: details.title || 'Китай-город' };
      pager.set(node, details);
      if (phone.matches) apply({ type: 'context', id: context.id });
      else render();
    },
    openContext() { openMode('context'); },
    releaseContext() { pager.set(null, { animate: false }); },
    setFrozen(value) { frozen = value; pager.setPaused(value); render(); },
    dispose() {
      controller.abort();
      cancelAnimationFrame(focusFrame);
      resultsSize.disconnect();
      pager.dispose();
      shake?.cancel();
      city.dispose();
      lockArticle(false);
      document.body.classList.remove('has-mobile-shell', 'has-mobile-overlay');
      root.remove();
    },
  };
}
