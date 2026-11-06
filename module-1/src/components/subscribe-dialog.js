import { mountEmailSubscribe } from '../email-subscribe.js';
import { createActionButton } from './action-button.js';

const PROMPT_SHOWN_KEY = 'chinatown:subscribe-prompt-shown';
// Page-relative, like the article template: the markup is baked into article.html at build time, where import.meta.url is a file:// path.
const asset = path => `./assets/${path}`;

/** The intro's «держим связь» dialog as a string, for pages rendered from templates (the article). */
export function subscribeDialogMarkup() {
  return `<div class="subscribe-modal" id="subscribe-modal" hidden>
      <div class="subscribe-modal__backdrop" data-close-modal></div>
      <section class="subscribe-modal__panel" role="dialog" aria-modal="true" aria-labelledby="subscribe-title" aria-describedby="subscribe-description" tabindex="-1">
        <div class="subscribe-modal__deco" aria-hidden="true">
          <img src="${asset('figma/subscribe-star.svg')}" alt="" width="673.132" height="676.456">
        </div>
        <div class="subscribe-modal__head" aria-hidden="true">
          <img src="${asset('figma/subscribe-head.webp')}" alt="" width="640" height="653" decoding="async">
        </div>
        <div class="subscribe-modal__body">
          <div>
            <h2 id="subscribe-title">держим связь</h2>
            <p id="subscribe-description"><strong>подпишись на нас, чтобы участвовать в розыгрыше мерча,</strong> а&nbsp;также&nbsp;быть в курсе новостей медиа и тусовок на&nbsp;китай-городе.</p>
          </div>
          <form class="subscribe-modal__form" id="subscribe-form" action="https://formspree.io/f/xkjjgwgy" method="POST" novalidate>
            <label class="visually-hidden" for="subscribe-email">электропочта</label>
            <input class="email-field" id="subscribe-email" name="email" type="email" placeholder="ЭЛЕКТРОПОЧТА" autocomplete="email" inputmode="email" aria-describedby="subscribe-status" required>
            <button class="action-button" data-action-button type="submit">ПОДПИСАТЬСЯ</button>
            <p class="subscribe-modal__status" id="subscribe-status" role="status" aria-live="polite"></p>
          </form>
        </div>
        <button class="subscribe-modal__close" id="subscribe-close" type="button" aria-label="Закрыть окно"><img src="${asset('figma/subscribe-close.svg')}" alt="" aria-hidden="true"></button>
      </section>
    </div>`;
}

/** The pink «Следить за обновлениями» at the end of a feed, edge to edge; it opens the subscribe dialog. */
export function createFollowAction() {
  const button = createActionButton({ label: 'Следить за обновлениями' });
  button.classList.add('follow-action');
  button.dataset.subscribeOpen = '';
  button.setAttribute('aria-haspopup', 'dialog');
  button.setAttribute('aria-controls', 'subscribe-modal');
  return button;
}

/**
 * The subscribe dialog: opens from any of `openButtons` or any [data-subscribe-open] button, and prompts once per visit after `delayMs` of time the page
 * was actually visible. `background` goes inert while the dialog is open.
 */
export function mountSubscribeDialog(modal, { openButtons = [], background = null, delayMs = 45_000 } = {}) {
  const controller = new AbortController();
  const options = { signal: controller.signal };
  const panel = modal.querySelector('[role="dialog"]');
  const closeButton = modal.querySelector('.subscribe-modal__close');
  const backdrop = modal.querySelector('[data-close-modal]');
  const form = modal.querySelector('form');
  const emailInput = form.querySelector('input[type="email"]');
  const submitButton = form.querySelector('[type="submit"]');
  const status = form.querySelector('[role="status"]');
  const phone = matchMedia('(max-width: 760px)');

  let remainingMs = delayMs;
  let visibleSince = null;
  let timerId = 0;
  let lastFocus = null;
  let prompted = false;

  try {
    prompted = sessionStorage.getItem(PROMPT_SHOWN_KEY) === 'true';
  } catch {
    // Storage can be unavailable in private browsing.
  }

  function markPrompted() {
    prompted = true;
    window.clearTimeout(timerId);
    timerId = 0;
    visibleSince = null;
    try { sessionStorage.setItem(PROMPT_SHOWN_KEY, 'true'); } catch { /* no storage */ }
  }

  const isOpen = () => modal.dataset.state === 'open';

  function openModal() {
    if (isOpen()) return;
    markPrompted();
    // Reopening during the exit reverses it from the current position and keeps the original return target.
    if (modal.hidden) lastFocus = document.activeElement;
    status.textContent = '';
    emailInput.removeAttribute('aria-invalid');
    modal.classList.remove('is-entering-email');
    modal.inert = false;
    if (modal.hidden) {
      modal.hidden = false;
      // Commit the closed position once so the entry transition has a starting point.
      getComputedStyle(panel).transform;
    }
    modal.dataset.state = 'open';
    panel.scrollTop = 0;
    if (background) background.inert = true;
    (phone.matches ? panel : emailInput).focus({ preventScroll: true });
  }

  async function finishClose() {
    // Flush styles so the exit transitions exist, then wait for them; reopening changes the state and cancels the hide.
    getComputedStyle(panel).transform;
    await Promise.allSettled(modal.getAnimations({ subtree: true }).map(animation => animation.finished));
    if (modal.dataset.state === 'closing') {
      modal.hidden = true;
      delete modal.dataset.state;
    }
  }

  function closeModal() {
    if (!isOpen()) return;
    // The leaving dialog stops taking input immediately, then slides out.
    modal.dataset.state = 'closing';
    modal.inert = true;
    modal.classList.remove('is-entering-email');
    if (background) background.inert = false;
    const returnTarget = lastFocus instanceof HTMLElement && lastFocus.isConnected ? lastFocus : openButtons[0];
    returnTarget?.focus({ preventScroll: true });
    finishClose();
  }

  function syncInputViewport() {
    if (!isOpen() || !phone.matches || !modal.classList.contains('is-entering-email')) return;
    const viewport = window.visualViewport;
    const height = viewport?.height || innerHeight;
    const bottom = Math.max(0, innerHeight - height - (viewport?.offsetTop || 0));
    modal.style.setProperty('--subscribe-input-height', `${height}px`);
    modal.style.setProperty('--subscribe-input-bottom', `${bottom}px`);
    // Keep the field and submit button together inside this sheet's own scroller.
    if (document.activeElement === emailInput) panel.scrollTop = panel.scrollHeight;
  }

  function pauseTimer() {
    if (visibleSince === null) return;
    remainingMs -= performance.now() - visibleSince;
    visibleSince = null;
    window.clearTimeout(timerId);
    timerId = 0;
  }

  function resumeTimer() {
    if (prompted || document.hidden || isOpen() || visibleSince !== null) return;
    visibleSince = performance.now();
    timerId = window.setTimeout(() => {
      visibleSince = null;
      openModal();
    }, Math.max(0, remainingMs));
  }

  for (const button of openButtons) button.addEventListener('click', openModal, options);
  // Buttons rendered later (the search feed's end) only need data-subscribe-open.
  document.addEventListener('click', (event) => {
    if (event.target.closest?.('[data-subscribe-open]')) openModal();
  }, options);
  closeButton.addEventListener('click', closeModal, options);
  backdrop.addEventListener('click', closeModal, options);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseTimer();
    else resumeTimer();
  }, options);
  window.addEventListener('pagehide', pauseTimer, options);
  window.addEventListener('pageshow', resumeTimer, options);
  modal.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeModal();
    }
    if (event.key !== 'Tab') return;
    const focusables = [emailInput, submitButton, closeButton];
    const first = focusables[0];
    const last = focusables.at(-1);
    if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }, options);
  emailInput.addEventListener('focus', () => {
    if (!phone.matches) return;
    modal.classList.add('is-entering-email');
    syncInputViewport();
  }, options);
  window.addEventListener('resize', syncInputViewport, { ...options, passive: true });
  window.visualViewport?.addEventListener('resize', syncInputViewport, { ...options, passive: true });
  window.visualViewport?.addEventListener('scroll', syncInputViewport, { ...options, passive: true });

  mountEmailSubscribe(form, options);
  resumeTimer();

  return {
    open: openModal,
    dispose() {
      pauseTimer();
      controller.abort();
      if (background) background.inert = false;
    },
  };
}
