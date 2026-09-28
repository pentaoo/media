import { mountVideoSphere } from './video-sphere.js';

const INTRO_DELAY_MS = 30_000;
const SITE_URL = 'https://chinatown.ru';

const intro = document.querySelector('#intro');
const content = document.querySelector('#intro-content');
const skip = document.querySelector('#intro-skip');
const hint = document.querySelector('#intro-hint');
const continueButton = document.querySelector('#intro-continue');
const copyButton = document.querySelector('#intro-copy');
const copyStatus = document.querySelector('#intro-copy-status');
const headline = document.querySelector('#intro-headline');
const linkWrap = document.querySelector('#intro-link-wrap');
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
const headlineParts = [...headline.querySelectorAll('.intro__faded, .intro__site-link')];
const pageBelow = [document.querySelector('.site-header'), document.querySelector('#app'), document.querySelector('#player')];
mountVideoSphere(intro);
let headlineHovered = false;
let linkFocused = false;
let pointerStart = null;
let pointerMoved = false;
let copyPending = false;

document.body.classList.add('intro-active');
for (const item of pageBelow) if (item) item.inert = true;

function reveal() {
  if (!content.hidden) return;
  content.hidden = false;
  skip.hidden = true;
  skip.setAttribute('aria-expanded', 'true');
  intro.classList.add('intro--revealed');
}

function dismissText() {
  window.clearTimeout(timer);
  content.hidden = true;
  skip.hidden = false;
  skip.setAttribute('aria-expanded', 'false');
  intro.classList.remove('intro--revealed');
  hint.hidden = !intro.classList.contains('intro--sphere-ready');
  headlineHovered = false;
  linkFocused = false;
  pointerStart = null;
  pointerMoved = false;
  intro.classList.remove('is-copy-hovered');
  setLinkActive();
  copyStatus.textContent = '';
  skip.focus({ preventScroll: true });
}

function setLinkActive() {
  headline.classList.toggle('is-link-active', headlineHovered || linkFocused);
}

function containsPoint(rect, x, y, padding = 0) {
  return x >= rect.left - padding && x <= rect.right + padding
    && y >= rect.top - padding && y <= rect.bottom + padding;
}

function updateHeadlineHover(event) {
  if (content.hidden || event.pointerType === 'touch') return;
  if (pointerStart && event.pointerId === pointerStart.id) {
    pointerMoved ||= Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 6;
  }
  const overText = isOverText(event);
  const linkRect = linkWrap.getBoundingClientRect();
  const linkPadding = Math.min(80, Math.max(24, linkRect.height * 0.45));
  headlineHovered = overText || containsPoint(linkRect, event.clientX, event.clientY, linkPadding);
  intro.classList.toggle('is-copy-hovered', finePointer.matches && overText && !pointerStart);
  setLinkActive();
}

function isOverText(event) {
  return headlineParts.some((part) => containsPoint(part.getBoundingClientRect(), event.clientX, event.clientY, 8));
}

function clearHover() {
  headlineHovered = false;
  intro.classList.remove('is-copy-hovered');
  setLinkActive();
}

function copyFromText(event) {
  if (content.hidden || !finePointer.matches || event.detail === 0 || event.button !== 0
    || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
    || event.target.closest('button') || !isOverText(event)) return;
  event.preventDefault();
  if (!pointerMoved) copySiteUrl();
}

async function copySiteUrl() {
  if (copyPending) return;
  copyPending = true;
  try {
    await navigator.clipboard.writeText(SITE_URL);
    copyStatus.textContent = 'Ссылка скопирована';
  } catch {
    copyStatus.textContent = 'Не удалось скопировать. Выделите адрес ссылки вручную.';
  } finally {
    copyPending = false;
  }
}

const timer = window.setTimeout(reveal, INTRO_DELAY_MS);
skip.addEventListener('click', () => {
  window.clearTimeout(timer);
  reveal();
});
continueButton.addEventListener('click', dismissText);
copyButton.addEventListener('click', copySiteUrl);
intro.addEventListener('pointermove', updateHeadlineHover);
intro.addEventListener('pointerdown', (event) => {
  if (event.button !== 0 || event.pointerType === 'touch') return;
  pointerStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
  pointerMoved = false;
  intro.classList.remove('is-copy-hovered');
});
intro.addEventListener('pointerup', (event) => {
  if (event.pointerId !== pointerStart?.id) return;
  pointerStart = null;
  updateHeadlineHover(event);
});
intro.addEventListener('pointercancel', () => { pointerStart = null; pointerMoved = true; clearHover(); });
intro.addEventListener('pointerleave', clearHover);
intro.addEventListener('click', copyFromText);
finePointer.addEventListener('change', clearHover);
window.addEventListener('blur', () => { pointerStart = null; clearHover(); });
linkWrap.addEventListener('focusin', () => {
  linkFocused = true;
  setLinkActive();
});
linkWrap.addEventListener('focusout', (event) => {
  linkFocused = linkWrap.contains(event.relatedTarget);
  setLinkActive();
});
