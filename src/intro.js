import { mountVideoSphere } from './video-sphere.js';
import { createCountdown } from './countdown.js';
import { mountHeadlineGlitch } from './headline-glitch.js';

const SITE_URL = 'https://chinatown.ru';

const intro = document.querySelector('#intro');
const content = document.querySelector('#intro-content');
const continueButton = document.querySelector('#intro-continue');
const aboutLink = document.querySelector('#intro-about');
const brandTarget = document.querySelector('#intro-brand-target span');
const copyStatus = document.querySelector('#intro-copy-status');
const timer = document.querySelector('#intro-timer');
const headline = document.querySelector('#intro-headline');
const linkWrap = document.querySelector('#intro-link-wrap');
const siteLink = linkWrap.querySelector('.intro__site-link');
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
const fadedParts = [...headline.querySelectorAll('.intro__faded')];
const headlineGlitch = mountHeadlineGlitch(headline);
const pageBelow = [document.querySelector('.site-header'), document.querySelector('#app'), document.querySelector('#player')];
mountVideoSphere(intro);
let headlineHovered = false;
let linkFocused = false;
let pointerStart = null;
let pointerMoved = false;
let copyPending = false;
let compact = false;
let geometryFrame = 0;
const countdown = createCountdown();
let timerInterval = 0;

function renderCountdown() {
  const { remainingMs, text } = countdown.read();
  timer.textContent = text;
  if (!remainingMs) window.clearInterval(timerInterval);
}

function startCountdown() {
  window.clearInterval(timerInterval);
  countdown.reset();
  renderCountdown();
  timerInterval = window.setInterval(renderCountdown, 1000);
}

startCountdown();
document.addEventListener('visibilitychange', () => { if (!document.hidden) renderCountdown(); });
window.addEventListener('pagehide', () => window.clearInterval(timerInterval));
window.addEventListener('pageshow', (event) => { if (event.persisted) startCountdown(); });

document.body.classList.add('intro-active');
for (const item of pageBelow) if (item) item.inert = true;

// Measure the same link at both sizes so the entire headline can move using
// only a transform. The hidden target follows the compact Figma text layout.
function updateCompactGeometry() {
  geometryFrame = 0;
  const style = getComputedStyle(headline);
  const matrix = new DOMMatrixReadOnly(style.transform === 'none' ? undefined : style.transform);
  const headingRect = headline.getBoundingClientRect();
  const linkRect = siteLink.getBoundingClientRect();
  const targetRect = brandTarget.getBoundingClientRect();
  const currentScale = matrix.a || 1;
  const scale = parseFloat(getComputedStyle(brandTarget).fontSize) / parseFloat(style.fontSize);
  const originX = headingRect.left - matrix.e;
  const originY = headingRect.top - matrix.f;
  const linkX = (linkRect.left - headingRect.left) / currentScale;
  const linkY = (linkRect.top - headingRect.top) / currentScale;
  headline.style.setProperty('--intro-headline-scale', scale);
  headline.style.setProperty('--intro-headline-x', `${targetRect.left - originX - linkX * scale}px`);
  headline.style.setProperty('--intro-headline-y', `${targetRect.top - originY - linkY * scale}px`);
}

function queueGeometryUpdate() {
  if (!geometryFrame) geometryFrame = requestAnimationFrame(updateCompactGeometry);
}

function compactIntro() {
  if (compact) return;
  headlineGlitch.setSuspended(true);
  updateCompactGeometry();
  compact = true;
  const moveFocus = document.activeElement === continueButton;
  intro.classList.add('intro--compact', 'intro--transitioning');
  continueButton.inert = true;
  continueButton.setAttribute('aria-expanded', 'false');
  aboutLink.inert = false;
  aboutLink.removeAttribute('aria-hidden');
  for (const part of fadedParts) part.setAttribute('aria-hidden', 'true');
  headlineHovered = false;
  linkFocused = false;
  pointerStart = null;
  pointerMoved = false;
  intro.classList.remove('is-copy-hovered');
  setLinkActive();
  copyStatus.textContent = '';

  const finish = () => {
    intro.classList.remove('intro--transitioning', 'intro--revealed');
    headlineGlitch.setCompact(true);
    headlineGlitch.setSuspended(false);
    if (moveFocus && (document.activeElement === continueButton || document.activeElement === document.body)) {
      aboutLink.focus({ preventScroll: true });
    }
  };
  const animations = headline.getAnimations();
  if (animations.length) Promise.all(animations.map((animation) => animation.finished.catch(() => {}))).then(finish);
  else finish();
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
  headlineHovered = overText;
  intro.classList.toggle('is-copy-hovered', finePointer.matches && overText && !intro.querySelector('.is-dragging'));
  setLinkActive();
}

function isOverText(event) {
  if (event.target.closest('button, .intro__about')) return false;
  return containsPoint((compact ? siteLink : headline).getBoundingClientRect(), event.clientX, event.clientY);
}

function clearHover() {
  headlineHovered = false;
  intro.classList.remove('is-copy-hovered');
  setLinkActive();
}

function copyFromText(event) {
  if (content.hidden || !finePointer.matches || event.detail === 0 || event.button !== 0
    || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
    || event.target.closest('button, .intro__about') || !isOverText(event)) return;
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
    copyStatus.textContent = 'Не удалось скопировать ссылку.';
  } finally {
    copyPending = false;
  }
}

updateCompactGeometry();
window.addEventListener('resize', queueGeometryUpdate);
document.fonts.ready.then(queueGeometryUpdate);
continueButton.addEventListener('click', compactIntro);
siteLink.addEventListener('keydown', (event) => {
  if (event.key !== ' ' || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  if (!event.repeat) copySiteUrl();
});
intro.addEventListener('pointermove', updateHeadlineHover);
intro.addEventListener('pointerdown', (event) => {
  if (event.button !== 0 || event.pointerType === 'touch') return;
  pointerStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
  pointerMoved = false;
  updateHeadlineHover(event);
});
intro.addEventListener('pointerup', (event) => {
  if (event.pointerId !== pointerStart?.id) return;
  pointerStart = null;
  updateHeadlineHover(event);
});
intro.addEventListener('pointercancel', () => { pointerStart = null; pointerMoved = true; clearHover(); });
intro.addEventListener('pointerleave', clearHover);
intro.addEventListener('click', copyFromText);
intro.addEventListener('dragstart', (event) => event.preventDefault());
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
