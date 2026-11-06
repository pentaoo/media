import { mountActionButton } from './components/action-button.js';

/** One viewer for context images, even when their cards move into the rail. */
export function mountArticleImages(page, { onOpenChange = () => {} } = {}) {
  const controller = new AbortController();
  const options = { signal: controller.signal };
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const token = crypto.randomUUID();
  const dialog = document.createElement('dialog');
  dialog.id = `article-image-${token}`;
  dialog.className = 'article-image-viewer';
  dialog.setAttribute('aria-label', 'Просмотр изображения');
  dialog.innerHTML = `<div class="article-image-viewer__stage">
    <div class="article-image-viewer__surface"><img alt="" draggable="false"></div>
    <div class="article-image-viewer__controls">
      <button class="article-image-viewer__close action-button--secondary" type="button">Закрыть</button>
    </div>
  </div>`;
  document.body.append(dialog);
  const stage = dialog.querySelector('.article-image-viewer__stage');
  const surface = dialog.querySelector('.article-image-viewer__surface');
  const enlarged = surface.querySelector('img');
  const closeButton = mountActionButton(dialog.querySelector('button'));
  let entry = null;
  let animation = null;
  let shade = null;
  let closing = false;
  let historyClosing = false;
  let scrollLock = null;
  let backdropPressed = false;

  const entries = [...page.querySelectorAll('[data-context-material] img:not(.ct-tag__sticker)')].map(image => {
    const link = image.parentElement.matches('a') ? image.parentElement : null;
    const trigger = document.createElement('button');
    trigger.className = 'context-image-trigger';
    trigger.type = 'button';
    trigger.setAttribute('aria-label', `Увеличить изображение: ${image.alt}`);
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-controls', dialog.id);
    const item = { image, link, trigger, draggable: image.getAttribute('draggable') };
    (link || image).replaceWith(trigger);
    trigger.append(image);
    image.draggable = false;
    trigger.addEventListener('click', () => open(item), options);
    return item;
  });

  function ownsHistory() { return history.state?.articleImage?.token === token; }
  function resetTilt() {
    surface.style.removeProperty('--image-tilt-x');
    surface.style.removeProperty('--image-tilt-y');
  }
  function cancelAnimations() {
    animation?.cancel();
    shade?.cancel();
    animation = shade = null;
  }
  function originTransform() {
    const origin = entry.image.getBoundingClientRect();
    const target = stage.getBoundingClientRect();
    if (!origin.width || !origin.height) return 'scale(.96)';
    const x = origin.left + origin.width / 2 - target.left - target.width / 2;
    const y = origin.top + origin.height / 2 - target.top - target.height / 2;
    return `translate(${x}px, ${y}px) scale(${origin.width / target.width}, ${origin.height / target.height})`;
  }
  function animateOpening(from = originTransform(), color = 'rgb(0 0 0 / 0)', opacity = .7, backdrop = 'grayscale(0)') {
    if (reducedMotion.matches) return;
    shade = dialog.animate([{ backgroundColor: color, backdropFilter: backdrop }, { backgroundColor: 'rgb(0 0 0 / .8)', backdropFilter: 'grayscale(1)' }], { duration: 240, easing: 'ease-out' });
    animation = surface.animate([{ transform: from, opacity }, { transform: 'none', opacity: 1 }], { duration: 340, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'both' });
    const opening = animation;
    opening.finished.then(() => {
      if (animation !== opening) return;
      animation.cancel();
      animation = null;
    }, () => {});
  }
  function open(item, { recordHistory = true } = {}) {
    if (controller.signal.aborted) return;
    if (dialog.open) {
      if (closing) {
        const current = getComputedStyle(surface);
        const transform = current.transform;
        const opacity = current.opacity;
        const background = getComputedStyle(dialog);
        const color = background.backgroundColor;
        const backdrop = background.backdropFilter;
        cancelAnimations();
        resetTilt();
        closing = historyClosing = false;
        animateOpening(transform, color, opacity, backdrop);
      }
      return;
    }
    entry = item;
    closing = historyClosing = false;
    resetTilt();
    const width = item.image.naturalWidth || Number(item.image.getAttribute('width')) || 1;
    const height = item.image.naturalHeight || Number(item.image.getAttribute('height')) || 1;
    stage.style.setProperty('--image-ratio', width / height);
    enlarged.src = item.image.currentSrc || item.image.src;
    enlarged.alt = item.image.alt;
    const root = document.documentElement;
    scrollLock = { y: window.scrollY, overflow: root.style.overflow, paddingRight: root.style.paddingRight };
    const gutter = innerWidth - root.clientWidth;
    if (gutter) root.style.paddingRight = `${parseFloat(getComputedStyle(root).paddingRight) + gutter}px`;
    root.style.overflow = 'hidden';
    root.classList.add('has-article-image-viewer');
    onOpenChange(true);
    dialog.showModal();
    closeButton.focus({ preventScroll: true });
    if (recordHistory) history.pushState({ ...history.state, articleImage: { token } }, '');
    animateOpening();
  }
  function finishClose({ restoreFocus = true } = {}) {
    cancelAnimations();
    if (!dialog.open) return;
    dialog.close();
    const root = document.documentElement;
    root.classList.remove('has-article-image-viewer');
    root.style.overflow = scrollLock.overflow;
    root.style.paddingRight = scrollLock.paddingRight;
    if (restoreFocus) {
      const target = entry.trigger.isConnected && entry.trigger.getClientRects().length
        ? entry.trigger : page.querySelector('#article-content');
      target?.focus({ preventScroll: true });
    }
    if (window.scrollY !== scrollLock.y) window.scrollTo({ top: scrollLock.y, behavior: 'instant' });
    enlarged.removeAttribute('src');
    scrollLock = null;
    closing = historyClosing = false;
    onOpenChange(false);
  }
  function close() {
    if (!dialog.open || closing) return;
    closing = true;
    const currentTransform = getComputedStyle(surface).transform;
    const background = getComputedStyle(dialog);
    const currentColor = background.backgroundColor;
    const currentBackdrop = background.backdropFilter;
    cancelAnimations();
    resetTilt();
    if (reducedMotion.matches) { finishClose(); return; }
    shade = dialog.animate([{ backgroundColor: currentColor, backdropFilter: currentBackdrop }, { backgroundColor: 'rgb(0 0 0 / 0)', backdropFilter: 'grayscale(0)' }], { duration: 180, fill: 'forwards' });
    animation = surface.animate([{ transform: currentTransform, opacity: 1 }, { transform: originTransform(), opacity: 0 }], { duration: 180, easing: 'cubic-bezier(.4, 0, 1, 1)', fill: 'forwards' });
    animation.finished.then(() => finishClose(), () => {});
  }
  function requestClose() {
    if (!dialog.open || closing || historyClosing) return;
    if (ownsHistory()) { historyClosing = true; history.back(); }
    else close();
  }
  closeButton.addEventListener('click', requestClose, options);
  dialog.addEventListener('cancel', event => { event.preventDefault(); requestClose(); }, options);
  dialog.addEventListener('keydown', event => {
    if (event.key === 'Tab') {
      event.preventDefault();
      closeButton.focus();
      return;
    }
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    requestClose();
  }, options);
  dialog.addEventListener('pointerdown', event => { backdropPressed = event.target === dialog; }, options);
  dialog.addEventListener('click', event => { if (event.target === dialog && backdropPressed) requestClose(); }, options);
  stage.addEventListener('pointermove', event => {
    if (!finePointer.matches || reducedMotion.matches || animation || closing) return;
    if (event.target.closest('.article-image-viewer__controls')) { resetTilt(); return; }
    const rect = stage.getBoundingClientRect();
    const x = Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1));
    const y = Math.max(-1, Math.min(1, (event.clientY - rect.top) / rect.height * 2 - 1));
    surface.style.setProperty('--image-tilt-x', `${-y * 4}deg`);
    surface.style.setProperty('--image-tilt-y', `${x * 4}deg`);
  }, options);
  stage.addEventListener('pointerleave', resetTilt, options);
  window.addEventListener('popstate', () => {
    historyClosing = false;
    if (ownsHistory() && entry) open(entry, { recordHistory: false });
    else close();
  }, options);
  function settle() {
    if (closing) finishClose();
    else cancelAnimations();
    resetTilt();
  }
  window.addEventListener('resize', settle, options);
  reducedMotion.addEventListener('change', settle, options);
  finePointer.addEventListener('change', resetTilt, options);
  return {
    dispose() {
      controller.abort();
      finishClose({ restoreFocus: false });
      cancelAnimations();
      dialog.remove();
      if (ownsHistory()) {
        const { articleImage, ...rest } = history.state;
        history.replaceState(rest, '');
      }
      for (const { image, link, trigger, draggable } of entries) {
        if (link) { link.append(image); trigger.replaceWith(link); }
        else trigger.replaceWith(image);
        if (draggable === null) image.removeAttribute('draggable');
        else image.setAttribute('draggable', draggable);
      }
    },
  };
}
