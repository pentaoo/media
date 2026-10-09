const PROMPT_DELAY_MS = 45_000;
const PROMPT_SHOWN_KEY = 'chinatown:subscribe-prompt-shown';

const intro = document.querySelector('#intro');
const modal = document.querySelector('#subscribe-modal');
const openButton = document.querySelector('#intro-whitelist');
const closeButton = document.querySelector('#subscribe-close');
const backdrop = modal.querySelector('[data-close-modal]');
const form = document.querySelector('#subscribe-form');
const emailInput = document.querySelector('#subscribe-email');
const submitButton = form.querySelector('[type="submit"]');
const status = document.querySelector('#subscribe-status');

let remainingMs = PROMPT_DELAY_MS;
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

function openModal() {
  if (!modal.hidden) return;
  markPrompted();
  lastFocus = document.activeElement;
  status.textContent = '';
  emailInput.removeAttribute('aria-invalid');
  modal.hidden = false;
  intro.inert = true;
  emailInput.focus({ preventScroll: true });
}

function closeModal() {
  if (modal.hidden) return;
  modal.hidden = true;
  intro.inert = false;
  if (lastFocus instanceof HTMLElement && lastFocus.isConnected) {
    lastFocus.focus({ preventScroll: true });
  } else {
    openButton.focus({ preventScroll: true });
  }
}

function pauseTimer() {
  if (visibleSince === null) return;
  remainingMs -= performance.now() - visibleSince;
  visibleSince = null;
  window.clearTimeout(timerId);
  timerId = 0;
}

function resumeTimer() {
  if (prompted || document.hidden || !modal.hidden || visibleSince !== null) return;
  visibleSince = performance.now();
  timerId = window.setTimeout(() => {
    visibleSince = null;
    openModal();
  }, Math.max(0, remainingMs));
}

openButton.addEventListener('click', openModal);
closeButton.addEventListener('click', closeModal);
backdrop.addEventListener('click', closeModal);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pauseTimer();
  else resumeTimer();
});
window.addEventListener('pagehide', pauseTimer);
window.addEventListener('pageshow', resumeTimer);
modal.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    event.preventDefault();
    closeModal();
  }
  if (event.key !== 'Tab') return;
  const focusables = [emailInput, submitButton, closeButton];
  const first = focusables[0];
  const last = focusables.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});

emailInput.addEventListener('input', () => {
  emailInput.removeAttribute('aria-invalid');
  status.textContent = '';
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (submitButton.disabled) return;
  const email = emailInput.value.trim();
  emailInput.value = email;
  if (!emailInput.checkValidity()) {
    emailInput.setAttribute('aria-invalid', 'true');
    status.textContent = 'Введите корректный адрес электропочты.';
    emailInput.focus();
    return;
  }

  const endpoint = form.action;
  if (!/^https:\/\/formspree\.io\/f\/[a-z0-9]+\/?$/i.test(endpoint)) {
    status.textContent = 'Форма пока не настроена. Попробуйте позже.';
    return;
  }

  submitButton.disabled = true;
  status.textContent = 'Отправляем…';
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: new FormData(form),
    });
    if (response.status === 429) {
      status.textContent = 'Слишком много попыток. Попробуйте позже.';
      return;
    }
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      const errors = Array.isArray(data?.errors) ? data.errors : [];
      if (errors.some((error) => error?.field === 'email')) {
        emailInput.setAttribute('aria-invalid', 'true');
      }
      status.textContent = errors.map((error) => error?.message).filter((message) => typeof message === 'string').join(' ') || 'Не удалось отправить адрес. Попробуйте ещё раз.';
      return;
    }
    form.reset();
    status.textContent = 'Готово! Заявка отправлена.';
  } catch {
    status.textContent = 'Не удалось отправить адрес. Попробуйте ещё раз.';
  } finally {
    submitButton.disabled = false;
  }
});

resumeTimer();
