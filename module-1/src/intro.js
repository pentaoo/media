import { mountVideoSphere } from './video-sphere.js';
import { mountHeadlineGlitch } from './headline-glitch.js';
import { burstLinkMarkup } from './components/tag.js';

const intro = document.querySelector('#intro');
const sphere = document.querySelector('#intro-sphere');
const headline = document.querySelector('#intro-headline');
const siteLink = headline.querySelector('.intro__site-link');
const copyStatus = document.querySelector('#intro-copy-status');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
mountVideoSphere(intro);
mountHeadlineGlitch(headline, { multiline: true });
document.body.classList.add('intro-active');

let pointerStart = null;
let pointerMoved = false;
let copyPending = false;
let copyFeedbackTimer = 0;

function isOverHeadline(event) {
  const rect = headline.getBoundingClientRect();
  return event.clientX >= rect.left && event.clientX <= rect.right
    && event.clientY >= rect.top && event.clientY <= rect.bottom;
}

function updateCopyHover(event) {
  intro.classList.toggle('is-copy-hovered', intro.classList.contains('is-copy-pressed')
    || finePointer.matches && event.pointerType !== 'touch'
    && !sphere.classList.contains('is-dragging')
    && !event.target.closest('button, .intro__about') && isOverHeadline(event));
}

function showCopyFeedback(success, point) {
  clearTimeout(copyFeedbackTimer);
  intro.classList.remove('is-copied');
  copyStatus.classList.remove('is-visible');
  copyStatus.dataset.state = success ? 'success' : 'error';
  // Success is a sticker answering the reader's click (a бах on the spot); an error stays a plain interface plate.
  if (success) copyStatus.innerHTML = `<span class="visually-hidden">Ссылка скопирована</span>${burstLinkMarkup({ label: 'Скопировано' })}`;
  else copyStatus.textContent = 'не получилось скопировать ссылку';
  const rect = headline.getBoundingClientRect();
  const x = point ? point.x + 24 : rect.left;
  const y = point ? point.y + 48 : rect.bottom + 16;
  copyStatus.style.left = `${Math.max(16, Math.min(x, innerWidth - copyStatus.offsetWidth - 16))}px`;
  copyStatus.style.top = `${Math.max(16, Math.min(y, innerHeight - copyStatus.offsetHeight - 16))}px`;
  // Commit the reset so repeated clicks replay the acknowledgement.
  void copyStatus.offsetWidth;
  intro.classList.toggle('is-copied', success);
  copyStatus.classList.add('is-visible');
  copyFeedbackTimer = setTimeout(() => {
    intro.classList.remove('is-copied');
    copyStatus.classList.remove('is-visible');
  }, success ? 1800 : 4000);
}

async function copySiteUrl(point) {
  if (copyPending) return;
  copyPending = true;
  try {
    await navigator.clipboard.writeText(siteLink.href);
    showCopyFeedback(true, point);
  } catch {
    showCopyFeedback(false, point);
  } finally {
    copyPending = false;
  }
}

intro.addEventListener('pointermove', (event) => {
  if (pointerStart?.id === event.pointerId) {
    pointerMoved ||= Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 6;
  }
  updateCopyHover(event);
});
intro.addEventListener('pointerdown', (event) => {
  if (event.pointerType === 'touch' || event.button !== 0) return;
  pointerStart = { id: event.pointerId, x: event.clientX, y: event.clientY };
  pointerMoved = false;
  if (finePointer.matches && !event.target.closest('button, .intro__about') && isOverHeadline(event)) {
    // The text lets pointer events through; claim its click before the sphere
    // starts dragging or captures the pointer underneath it.
    event.stopPropagation();
    intro.setPointerCapture(event.pointerId);
    intro.classList.add('is-copy-pressed');
  }
  updateCopyHover(event);
}, { capture: true });
intro.addEventListener('pointerup', (event) => {
  if (event.pointerId !== pointerStart?.id) return;
  intro.classList.remove('is-copy-pressed');
  updateCopyHover(event);
  pointerStart = null;
});
function cancelPointer() {
  if (pointerStart && intro.hasPointerCapture(pointerStart.id)) intro.releasePointerCapture(pointerStart.id);
  pointerStart = null;
  pointerMoved = true;
  intro.classList.remove('is-copy-pressed', 'is-copy-hovered');
}
intro.addEventListener('pointercancel', cancelPointer);
window.addEventListener('blur', cancelPointer);
intro.addEventListener('pointerleave', () => {
  if (!intro.classList.contains('is-copy-pressed')) intro.classList.remove('is-copy-hovered');
});
intro.addEventListener('click', (event) => {
  if (!finePointer.matches || event.detail === 0 || event.button !== 0
    || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
    || event.target.closest('button, a') || pointerMoved || !isOverHeadline(event)) return;
  event.preventDefault();
  copySiteUrl({ x: event.clientX, y: event.clientY });
});
intro.addEventListener('dragstart', (event) => event.preventDefault());
siteLink.addEventListener('keydown', (event) => {
  if (event.key !== ' ' || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  if (!event.repeat) copySiteUrl();
});
