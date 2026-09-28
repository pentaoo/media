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
const headlineParts = [...headline.querySelectorAll('.intro__faded, .intro__site-link')];
const pageBelow = [document.querySelector('.site-header'), document.querySelector('#app'), document.querySelector('#player')];
mountVideoSphere(intro);
let headlineHovered = false;
let linkFocused = false;

document.body.classList.add('intro-active');
for (const item of pageBelow) if (item) item.inert = true;

function reveal() {
  if (!content.hidden) return;
  content.hidden = false;
  skip.hidden = true;
  intro.classList.add('intro--revealed');
}

function dismissText() {
  window.clearTimeout(timer);
  content.hidden = true;
  skip.hidden = false;
  intro.classList.remove('intro--revealed');
  hint.hidden = !intro.classList.contains('intro--sphere-ready');
  headlineHovered = false;
  linkFocused = false;
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
  const overText = headlineParts.some((part) => containsPoint(part.getBoundingClientRect(), event.clientX, event.clientY, 8));
  const linkRect = linkWrap.getBoundingClientRect();
  const linkPadding = Math.min(80, Math.max(24, linkRect.height * 0.45));
  headlineHovered = overText || containsPoint(linkRect, event.clientX, event.clientY, linkPadding);
  setLinkActive();
}

async function copySiteUrl() {
  try {
    await navigator.clipboard.writeText(SITE_URL);
    copyStatus.textContent = 'Ссылка скопирована';
  } catch {
    copyStatus.textContent = 'Не удалось скопировать. Выделите адрес ссылки вручную.';
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
intro.addEventListener('pointerleave', () => {
  headlineHovered = false;
  setLinkActive();
});
linkWrap.addEventListener('focusin', () => {
  linkFocused = true;
  setLinkActive();
});
linkWrap.addEventListener('focusout', (event) => {
  linkFocused = linkWrap.contains(event.relatedTarget);
  setLinkActive();
});
