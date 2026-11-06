import { articleContexts } from './article-context-data.js';
import { mountActionButton } from './components/action-button.js';
import { contextAtPosition, selectContextState, contextTransitionDirection } from './article-context-state.js';

/** Enhance the existing static nodes: each material has one DOM copy in every layout. */
export function mountArticleContext(page, sceneRail, { suspended: initiallySuspended = false, mobileShell } = {}) {
  const data = articleContexts[page.dataset.articleId];
  if (!data || !sceneRail) return { setSuspended() {}, setFrozen() {}, dispose() {} };
  const controller = new AbortController();
  const options = { signal: controller.signal };
  const wide = matchMedia('(min-width: 1200px)');
  const phone = matchMedia('(max-width: 760px)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const refs = [...page.querySelectorAll('[data-context-ref]')];
  const materials = new Map(data.materials.map(item => [item.id, { ...item, node: page.querySelector(`[data-context-material="${item.id}"]`) }]).filter(([, item]) => item.node));
  const nodes = [...materials.values()].map(item => item.node).filter(Boolean);
  const homes = new Map(nodes.map(node => {
    const marker = document.createComment(`context: ${node.id}`);
    node.before(marker);
    return [node, marker];
  }));
  const chapters = data.chapters.map(chapter => ({ ...chapter, node: page.querySelector(`#${chapter.anchorId || chapter.id}`) })).filter(chapter => chapter.node);
  // Capture article order before any material moves into the rail or a dialog.
  // Unlike Y coordinates, this also distinguishes mentions on the same text line.
  const sourceOrder = new Map([...page.querySelectorAll('*')].map((node, index) => [node, index]));
  const dialog = document.createElement('dialog');
  dialog.className = 'article-context-screen';
  dialog.innerHTML = '<div class="article-context-screen__bar"><button class="article-context-screen__back action-button--secondary" type="button">К статье</button></div><div class="article-context-screen__content"></div>';
  mountActionButton(dialog.querySelector('.article-context-screen__back'));
  document.body.append(dialog);
  const screenHost = dialog.querySelector('.article-context-screen__content');
  const token = crypto.randomUUID();
  let manual = null;
  let preview = null;
  let previewTimer = 0;
  let dismissTimer = 0;
  let chapterId = null;
  let displayedState = { type: 'video' };
  let displayedSource = null;
  let placement = '';
  let frame = 0;
  let hashFrame = 0;
  let suspended = initiallySuspended;
  let frozen = false;
  let pointerDown = false;
  let scrollLock = null;
  let highlighted = null;

  function ownHistory() { return history.state?.articleContext?.token === token; }
  function restoreFocus(trigger) {
    const target = trigger?.isConnected ? trigger : page.querySelector('#article-content');
    target?.focus({ preventScroll: true });
  }
  function restoreNode(node) {
    const marker = homes.get(node);
    if (marker && marker.nextSibling !== node) marker.after(node);
    node.hidden = true;
  }
  function restoreNodes() {
    for (const node of homes.keys()) restoreNode(node);
  }
  function closeScreen() {
    if (!dialog.open) return;
    const y = scrollLock?.y ?? window.scrollY;
    dialog.close();
    document.documentElement.style.overflow = scrollLock?.overflow || '';
    document.body.classList.remove('has-article-context-screen');
    scrollLock = null;
    // Native dialog restoration must not bring an offscreen opener into view.
    if (window.scrollY !== y) window.scrollTo({ top: y, behavior: 'instant' });
  }
  function updateRefs() {
    for (const ref of refs) {
      const item = materials.get(ref.dataset.contextRef);
      if (!item) continue;
      const expanded = (manual || preview)?.id === item.id || phone.matches && mobileShell?.contextVisible && displayedState.id === item.id;
      ref.setAttribute('aria-expanded', String(expanded));
      ref.toggleAttribute('data-context-active', expanded);
      ref.setAttribute('aria-controls', item.id);
      if (!wide.matches && !phone.matches && (item.mobile === 'screen' || item.entity)) ref.setAttribute('aria-haspopup', 'dialog');
      else ref.removeAttribute('aria-haspopup');
    }
  }
  function isInteracting() {
    if (phone.matches) return mobileShell?.isInteracting() || false;
    const selection = window.getSelection();
    return pointerDown || sceneRail.contextHost.contains(document.activeElement)
      || !selection?.isCollapsed && sceneRail.contextHost.contains(selection?.anchorNode);
  }

  function highlightSource(source) {
    const shown = phone.matches ? mobileShell?.contextVisible
      : wide.matches && !sceneRail.rail.classList.contains('is-collapsed') && !document.body.classList.contains('is-story-cover-active') && !suspended;
    const paragraph = shown && displayedState.id ? (source?.matches('p') ? source : source?.closest('p') || source?.querySelector('.story-section__copy > p')) : null;
    if (highlighted === paragraph) return;
    highlighted?.classList.remove('story-context-source');
    highlighted = paragraph || null;
    highlighted?.classList.add('story-context-source');
  }

  function render() {
    frame = 0;
    if (controller.signal.aborted || frozen || suspended) return;
    // Hiding the header must not move the reading line across a chapter boundary.
    const top = parseFloat(getComputedStyle(document.body).getPropertyValue('--media-header-height')) || 0;
    const readingOffset = top + (innerHeight - top) / 3;
    const readingY = window.scrollY + readingOffset;
    const chapterPositions = chapters.map(chapter => ({ ...chapter, start: chapter.node.getBoundingClientRect().top + window.scrollY }));
    const lastChapter = chapterPositions.at(-1);
    if (lastChapter?.materialId) {
      // A short final chapter can fit below the reading line even at the page end.
      // Give its card a reachable entry point before the last scroll position.
      const lastReadingY = document.documentElement.scrollHeight - innerHeight + readingOffset;
      lastChapter.start = Math.min(lastChapter.start, Math.max(chapterPositions.at(-2)?.start || 0, lastReadingY - 64));
    }
    chapterId = contextAtPosition(chapterPositions.map((chapter, index) => {
      return {
        id: chapter.id,
        start: chapter.start,
        end: chapterPositions[index + 1]?.start ?? Infinity,
      };
    }), readingY, chapterId);
    const automaticId = chapters.find(chapter => chapter.id === chapterId)?.materialId || null;
    const interactionId = (wide.matches || phone.matches) && !manual && isInteracting() ? displayedState.id || null : null;
    const state = selectContextState({ manualId: manual?.id, previewId: preview?.id, interactionId, automaticId });
    const selected = materials.get(manual?.id);
    const screen = !wide.matches && !phone.matches && !suspended && manual && (selected?.mobile === 'screen' || selected?.entity);
    const id = state.id || 'video';
    const source = interactionId && !manual && !preview ? displayedSource?.node : manual?.trigger || preview?.trigger || chapters.find(chapter => chapter.id === chapterId)?.node;
    const nextSource = { id, node: source, order: interactionId && !manual && !preview ? displayedSource?.order : sourceOrder.get(source) };
    const direction = contextTransitionDirection(displayedSource, nextSource);
    displayedSource = nextSource;
    const key = phone.matches && mobileShell ? `mobile:${id}` : wide.matches ? `rail:${id}` : screen ? `screen:${manual.id}` : `flow:${manual?.id || ''}:${refs.indexOf(manual?.trigger)}`;
    displayedState = state;
    updateRefs();
    highlightSource(source);
    if (key === placement) return;
    const wasWide = placement.startsWith('rail:');
    const wasMobile = placement.startsWith('mobile:');
    placement = key;
    const focused = document.activeElement;
    closeScreen();
    if (phone.matches && mobileShell) {
      if (!wasMobile) {
        sceneRail.setContext(null, { animate: false });
        restoreNodes();
      }
      const item = materials.get(state.id);
      if (item) item.node.hidden = false;
      mobileShell.setContext(item?.node || null, { id: item?.id, title: item?.title, manual: state.manual, direction, animate: wasMobile, release: restoreNode });
      highlightSource(source);
      return;
    }
    if (wasMobile) mobileShell?.releaseContext();
    if (wide.matches) {
      if (!wasWide) {
        sceneRail.setContext(null, { animate: false });
        restoreNodes();
      }
      const node = materials.get(state.id)?.node;
      if (node) node.hidden = false;
      sceneRail.setContext(node || null, { direction, animate: wasWide, release: restoreNode });
      if (node?.contains(focused)) focused.focus({ preventScroll: true });
      return;
    }
    sceneRail.setContext(null, { animate: false });
    restoreNodes();
    for (const item of materials.values()) {
      item.node.hidden = !(item.mobile === 'inline' || item.kind === 'footnote' && manual?.id === item.id);
      if (item.kind === 'footnote' && manual?.id === item.id) manual.trigger?.closest('p')?.after(item.node);
    }
    if (!screen && !focused.hidden && nodes.some(node => !node.hidden && node.contains(focused))) focused.focus({ preventScroll: true });
    if (screen) {
      const item = materials.get(manual.id);
      item.node.hidden = false;
      screenHost.replaceChildren(item.node);
      dialog.setAttribute('aria-labelledby', `${item.id}-title`);
      scrollLock = { y: window.scrollY, overflow: document.documentElement.style.overflow };
      document.documentElement.style.overflow = 'hidden';
      document.body.classList.add('has-article-context-screen');
      dialog.showModal();
      dialog.scrollTop = 0;
      dialog.querySelector('button').focus({ preventScroll: true });
      if (!ownHistory()) history.pushState({ ...history.state, articleContext: { token, articleId: data.articleId, materialId: item.id } }, '');
    }
  }
  function schedule() { if (!frame && !controller.signal.aborted) frame = requestAnimationFrame(render); }
  function clearPreview() {
    clearTimeout(previewTimer);
    clearTimeout(dismissTimer);
    preview = null;
  }
  function previewRef(ref) {
    if (!ref?.matches('.story-entity')) return;
    clearTimeout(previewTimer);
    clearTimeout(dismissTimer);
    if (!wide.matches || manual || suspended || frozen || isInteracting() || sceneRail.rail.classList.contains('is-collapsed')) return;
    previewTimer = setTimeout(() => {
      preview = { id: ref.dataset.contextRef, trigger: ref };
      render();
    }, 180);
  }
  function dismissPreview() {
    clearTimeout(previewTimer);
    clearTimeout(dismissTimer);
    // Leave enough time to cross the gap between the paragraph and the rail.
    dismissTimer = setTimeout(() => {
      if (frozen || sceneRail.contextHost.contains(document.activeElement)) return;
      preview = null;
      schedule();
    }, 280);
  }
  function closeImmediate({ focus = true } = {}) {
    const trigger = manual?.trigger;
    manual = null;
    if (focus) restoreFocus(trigger);
    clearPreview();
    render();
  }
  function requestClose() {
    if (!manual) return;
    if (ownHistory()) history.back();
    else closeImmediate();
  }
  function open(id, trigger, { recordHistory = true } = {}) {
    const item = materials.get(id);
    if (!item) return;
    if (!wide.matches && item.kind === 'footnote' && manual?.id === id && manual.trigger === trigger) { requestClose(); return; }
    clearPreview();
    manual = { id, trigger };
    if (wide.matches) sceneRail.expand();
    if (ownHistory()) history.replaceState({ ...history.state, articleContext: { token, articleId: data.articleId, materialId: id } }, '');
    render();
    if (phone.matches && mobileShell && recordHistory) mobileShell.openContext();
    if (wide.matches) item.node.focus({ preventScroll: true });
  }
  function followHash() {
    const hash = location.hash;
    let id;
    try { id = decodeURIComponent(hash.slice(1)); } catch { schedule(); return; }
    if (!materials.has(id)) { schedule(); return; }
    const trigger = refs.find(ref => ref.dataset.contextRef === id);
    // The quote scene measures after fonts settle. Resolve the article anchor
    // after that layout, before moving the target into the fixed rail/dialog.
    document.fonts.ready.then(() => {
      if (controller.signal.aborted) return;
      cancelAnimationFrame(hashFrame);
      hashFrame = requestAnimationFrame(() => {
        hashFrame = requestAnimationFrame(() => {
          if (controller.signal.aborted || location.hash !== hash) return;
          trigger?.scrollIntoView({ block: 'center', behavior: 'instant' });
          if (manual?.id !== id) open(id, trigger);
          else render();
        });
      });
    });
  }

  page.classList.add('has-article-context');
  page.addEventListener('pointerover', event => {
    if (event.pointerType !== 'mouse' || !finePointer.matches) return;
    const ref = event.target.closest('.story-entity');
    if (ref && !ref.contains(event.relatedTarget)) previewRef(ref);
  }, options);
  page.addEventListener('pointerout', event => {
    const ref = event.target.closest('.story-entity');
    if (ref && !ref.contains(event.relatedTarget)) dismissPreview();
  }, options);
  page.addEventListener('focusin', event => previewRef(event.target.closest('.story-entity')), options);
  page.addEventListener('focusout', event => {
    if (event.target.matches('.story-entity')) dismissPreview();
  }, options);
  sceneRail.contextHost.addEventListener('pointerenter', () => clearTimeout(dismissTimer), options);
  sceneRail.contextHost.addEventListener('pointerleave', dismissPreview, options);
  sceneRail.contextHost.addEventListener('focusout', dismissPreview, options);
  page.addEventListener('click', event => {
    const ref = event.target.closest('[data-context-ref]');
    if (!ref || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    open(ref.dataset.contextRef, ref);
  }, options);
  dialog.querySelector('button').addEventListener('click', requestClose, options);
  dialog.addEventListener('cancel', event => { event.preventDefault(); requestClose(); }, options);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && preview && !manual && !event.defaultPrevented) {
      restoreFocus(preview.trigger);
      clearPreview();
      schedule();
      event.preventDefault();
      return;
    }
    if (event.key === 'Escape' && manual && !suspended && !dialog.open && !event.defaultPrevented) {
      event.preventDefault();
      requestClose();
    }
  }, options);
  window.addEventListener('popstate', () => {
    // The phone shell owns its Back entry; nested image entries must not unpin it.
    if (phone.matches && mobileShell) return;
    if (ownHistory()) {
      const id = history.state.articleContext.materialId;
      if (materials.has(id)) { manual = { id, trigger: refs.find(ref => ref.dataset.contextRef === id) }; render(); }
    } else if (manual) closeImmediate();
  }, options);
  window.addEventListener('scroll', () => { clearPreview(); schedule(); }, { ...options, passive: true });
  window.addEventListener('resize', () => { clearPreview(); schedule(); }, options);
  window.addEventListener('hashchange', followHash, options);
  window.addEventListener('pageshow', schedule, options);
  wide.addEventListener('change', schedule, options);
  page.addEventListener('load', schedule, { ...options, capture: true });
  sceneRail.rail.addEventListener('focusin', schedule, options);
  sceneRail.rail.addEventListener('focusout', schedule, options);
  sceneRail.rail.addEventListener('click', schedule, options);
  sceneRail.contextHost.addEventListener('pointerdown', () => { pointerDown = true; }, options);
  window.addEventListener('pointerup', () => { pointerDown = false; schedule(); }, options);
  window.addEventListener('pointercancel', () => { pointerDown = false; schedule(); }, options);
  window.addEventListener('blur', () => { pointerDown = false; schedule(); }, options);
  document.addEventListener('selectionchange', schedule, options);
  const observer = new ResizeObserver(schedule);
  observer.observe(page);
  document.fonts.ready.then(schedule);
  sceneRail.setSuspended(suspended);
  render();
  // A direct fallback anchor should also open the enhanced explanation.
  followHash();

  return {
    refresh: schedule,
    openManual(id) { if (manual?.id !== id) open(id, refs.find(ref => ref.dataset.contextRef === id), { recordHistory: false }); },
    closeManual() { if (manual) closeImmediate({ focus: false }); },
    setFrozen(value) {
      frozen = value;
      mobileShell?.setFrozen(value);
      sceneRail.setContextFrozen(value);
      if (!frozen) render();
    },
    setSuspended(value) {
      suspended = value;
      if (value) clearPreview();
      sceneRail.setSuspended(value);
      render();
    },
    dispose() {
      controller.abort();
      clearPreview();
      observer.disconnect();
      cancelAnimationFrame(frame);
      cancelAnimationFrame(hashFrame);
      closeScreen();
      mobileShell?.releaseContext();
      sceneRail.setContext(null, { animate: false });
      restoreNodes();
      for (const node of nodes) node.hidden = false;
      for (const marker of homes.values()) marker.remove();
      sceneRail.setSuspended(false);
      dialog.remove();
      page.classList.remove('has-article-context');
      highlighted?.classList.remove('story-context-source');
      for (const ref of refs) for (const attr of ['aria-expanded', 'aria-controls', 'aria-haspopup', 'data-context-active']) ref.removeAttribute(attr);
    },
  };
}
