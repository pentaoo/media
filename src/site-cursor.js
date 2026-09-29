const root = document.documentElement;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
const glyphs = new Map();
let cursor = null;
let ready = false;
let loading = false;
let pointer = null;
let frame = 0;
let activeMode = '';

function hideCursor() {
  if (cursor) cursor.hidden = true;
  root.classList.remove('has-site-cursor');
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
}

function queueRender() {
  if (!frame && ready && pointer && finePointer.matches) frame = requestAnimationFrame(renderCursor);
}

function isInside(element, x, y) {
  if (!element) return false;
  const rect = element.getBoundingClientRect();
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function renderCursor() {
  frame = 0;
  if (!ready || !pointer || !finePointer.matches) return hideCursor();
  // Pointer capture owns the hand for the whole drag, even over a button.
  const draggingSphere = document.querySelector('.intro__sphere.is-dragging');
  const target = draggingSphere || document.elementFromPoint(pointer.x, pointer.y);
  if (!target) return hideCursor();
  const intro = target.closest('.intro');
  const copyArea = intro?.querySelector(intro.classList.contains('intro--compact')
    ? '.intro__site-link' : '.intro__headline');
  // The headline lets pointer events through to the sphere. Its copy area must
  // win regardless of which nested element happens to be underneath the mouse.
  const overText = intro && !target.closest('button, .intro__about')
    && isInside(copyArea, pointer.x, pointer.y);
  const requestedMode = draggingSphere ? 'grabbing' : overText ? 'copy'
    : getComputedStyle(target).getPropertyValue('--site-cursor-mode').trim();
  const mode = glyphs.has(requestedMode) ? requestedMode : 'default';
  if (mode !== activeMode) {
    for (const [name, glyph] of glyphs) glyph.hidden = name !== mode;
    activeMode = mode;
    cursor.dataset.mode = mode;
  }
  cursor.style.transform = `translate3d(${pointer.x}px, ${pointer.y}px, 0)`;
  cursor.hidden = false;
  root.classList.add('has-site-cursor');
  // Controls move under a stationary pointer during the intro transition.
  if (document.querySelector('.intro--transitioning')) queueRender();
}

async function initializeCursor() {
  if (!finePointer.matches || loading || ready) return;
  loading = true;
  const style = getComputedStyle(root);
  cursor = document.createElement('div');
  cursor.className = 'site-cursor';
  cursor.hidden = true;
  cursor.setAttribute('aria-hidden', 'true');
  const decoded = [];
  for (const mode of ['default', 'pointer', 'text', 'copy', 'grab', 'grabbing']) {
    const value = style.getPropertyValue(`--cursor-${mode}`).trim();
    const asset = value.match(/^url\(["']?(.*?)["']?\)\s+(\d+)\s+(\d+)/);
    if (!asset) continue;
    const glyph = new Image();
    glyph.className = 'site-cursor__image';
    glyph.alt = '';
    glyph.draggable = false;
    glyph.hidden = true;
    glyph.style.left = `-${asset[2]}px`;
    glyph.style.top = `-${asset[3]}px`;
    glyph.src = asset[1];
    glyphs.set(mode, glyph);
    cursor.append(glyph);
    decoded.push(glyph.decode());
  }
  document.body.append(cursor);
  try {
    await Promise.all(decoded);
    ready = glyphs.size === 6;
    queueRender();
  } catch {
    // Keep the native SVG cursor if any artwork could not be decoded.
    hideCursor();
  }
}

function trackPointer(event) {
  if (event.pointerType === 'touch' || !finePointer.matches) {
    pointer = null;
    return hideCursor();
  }
  pointer = { x: event.clientX, y: event.clientY };
  queueRender();
}

for (const event of ['pointermove', 'pointerdown', 'pointerup']) document.addEventListener(event, trackPointer);
document.addEventListener('pointerout', (event) => {
  if (!event.relatedTarget && (event.clientX <= 0 || event.clientY <= 0
    || event.clientX >= window.innerWidth || event.clientY >= window.innerHeight)) {
    pointer = null;
    hideCursor();
  }
});
document.addEventListener('pointercancel', () => { pointer = null; hideCursor(); });
window.addEventListener('blur', () => { pointer = null; hideCursor(); });
window.addEventListener('resize', queueRender);
document.addEventListener('scroll', queueRender, { passive: true });
finePointer.addEventListener('change', () => {
  if (finePointer.matches) initializeCursor();
  else { pointer = null; hideCursor(); }
});
initializeCursor();
