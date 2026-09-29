const SVG_NS = 'http://www.w3.org/2000/svg';
const FAMILIES = ['Elion Italic', 'East Gates', 'Sigma Boy'];
const IDLE_MS = 3000;
const PULSE_MS = 160;
const MAX_ACTIVE = 3;

// The source stays in Benzin. Plain inline spans preserve the shaped text run;
// only the paint changes, and SVG replacements never participate in layout.
export function mountHeadlineGlitch(headline, { scroll = false } = {}) {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const mouseInput = matchMedia('(min-width: 1025px) and (hover: hover) and (pointer: fine)');
  const runs = [];
  const letters = [];
  const active = new Set();
  const listeners = new AbortController();
  const context = document.createElement('canvas').getContext('2d');
  let families = [];
  let ready = false;
  let destroyed = false;
  let compact = false;
  let suspended = false;
  let idleTimer = 0;
  let ambientTimer = 0;
  let measureFrame = 0;
  let inputFrame = 0;
  let lastPulse = -Infinity;
  let previousPointer = null;
  let previousScroll = window.scrollY;
  let pendingInput = null;

  function listen(target, event, handler, options = {}) {
    target.addEventListener(event, handler, { ...options, signal: listeners.signal });
  }

  function canAnimate() {
    return ready && !destroyed && !suspended && !document.hidden && !reducedMotion.matches;
  }

  function restore() {
    clearTimeout(idleTimer);
    idleTimer = 0;
    for (const letter of active) {
      letter.source.classList.remove('is-glitched');
      letter.glyph.classList.remove('is-active');
    }
    active.clear();
  }

  function stop() {
    restore();
    clearTimeout(ambientTimer);
    ambientTimer = 0;
    cancelAnimationFrame(inputFrame);
    inputFrame = 0;
    pendingInput = null;
    previousPointer = null;
  }

  function font(size, family, weight = 400) {
    return `${weight} ${size}px ${family}`;
  }

  function measure() {
    measureFrame = 0;
    if (!ready || destroyed || suspended) return;
    restore();
    for (const run of runs) {
      const style = getComputedStyle(run.node);
      const rect = run.node.getBoundingClientRect();
      const matrix = getComputedStyle(headline).transform;
      const scale = matrix === 'none' ? 1 : new DOMMatrixReadOnly(matrix).a || 1;
      const size = parseFloat(style.fontSize);
      const baseline = (run.baseline.getBoundingClientRect().top - rect.top) / scale;
      run.svg.setAttribute('width', rect.width / scale);
      run.svg.setAttribute('height', rect.height / scale);
      context.font = font(size, style.fontFamily, style.fontWeight);
      const capHeight = context.measureText('Н').actualBoundingBoxAscent;
      for (const letter of run.letters) {
        const sourceRect = letter.source.getBoundingClientRect();
        context.font = font(size, style.fontFamily, style.fontWeight);
        const base = context.measureText(letter.character);
        const inkCenter = (base.actualBoundingBoxRight - base.actualBoundingBoxLeft) / 2;
        const origin = (sourceRect.left - rect.left) / scale;
        const maxWidth = Math.max(base.actualBoundingBoxLeft + base.actualBoundingBoxRight, sourceRect.width / scale) * 1.12;
        letter.variants = families.map((family) => {
          context.font = font(100, `"${family}"`);
          const cap = context.measureText('Н').actualBoundingBoxAscent;
          let replacementSize = size * (capHeight / size) / (cap / 100);
          context.font = font(replacementSize, `"${family}"`);
          let metrics = context.measureText(letter.character);
          const width = metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight;
          if (width > maxWidth) {
            replacementSize *= maxWidth / width;
            context.font = font(replacementSize, `"${family}"`);
            metrics = context.measureText(letter.character);
          }
          return {
            family,
            size: replacementSize,
            x: origin + inkCenter - (metrics.actualBoundingBoxRight - metrics.actualBoundingBoxLeft) / 2,
            y: baseline,
          };
        });
      }
    }
  }

  function queueMeasure() {
    if (!measureFrame && ready && !destroyed) measureFrame = requestAnimationFrame(measure);
  }

  function eligibleLetters(point) {
    return letters.filter((letter) => {
      if (compact && !letter.source.closest('.intro__site-link')) return false;
      const rect = letter.source.getBoundingClientRect();
      if (!rect.width || rect.bottom < 0 || rect.top > innerHeight || rect.right < 0 || rect.left > innerWidth) return false;
      if (!point) return true;
      const distance = Math.hypot(rect.left + rect.width / 2 - point.x, rect.top + rect.height / 2 - point.y);
      return distance <= Math.max(36, rect.height * 1.25);
    });
  }

  function replace(candidates, limit, duration = IDLE_MS) {
    if (!candidates.length) return;
    // Fisher-Yates over a local pool keeps all three families equally likely.
    const pool = [...candidates];
    const picked = [];
    for (let i = 0; i < Math.min(limit, pool.length); i++) {
      const index = i + Math.floor(Math.random() * (pool.length - i));
      [pool[i], pool[index]] = [pool[index], pool[i]];
      picked.push(pool[i]);
    }
    for (const letter of active) {
      if (!picked.includes(letter)) {
        letter.source.classList.remove('is-glitched');
        letter.glyph.classList.remove('is-active');
        active.delete(letter);
      }
    }
    for (const letter of picked) {
      const variant = letter.variants[Math.floor(Math.random() * letter.variants.length)];
      letter.glyph.setAttribute('font-family', variant.family);
      letter.glyph.setAttribute('font-size', variant.size);
      letter.glyph.setAttribute('x', variant.x);
      letter.glyph.setAttribute('y', variant.y);
      letter.glyph.dataset.glitchFont = variant.family;
      letter.glyph.classList.add('is-active');
      letter.source.classList.add('is-glitched');
      active.add(letter);
    }
    clearTimeout(idleTimer);
    idleTimer = setTimeout(restore, duration);
  }

  function renderInput() {
    inputFrame = 0;
    const input = pendingInput;
    pendingInput = null;
    if (!canAnimate() || !input) return;
    const candidates = eligibleLetters(input.point);
    if (!candidates.length) return;
    // Even movements within the throttle window extend the three-second hold.
    clearTimeout(idleTimer);
    idleTimer = setTimeout(restore, IDLE_MS);
    const now = performance.now();
    if (now - lastPulse < PULSE_MS) return;
    lastPulse = now;
    replace(candidates, compact ? 1 : Math.min(MAX_ACTIVE, 2 + Math.floor(Math.random() * 2)));
  }

  function queueInput(point) {
    if (!canAnimate()) return;
    pendingInput = { point };
    if (!inputFrame) inputFrame = requestAnimationFrame(renderInput);
  }

  function pointerMove(event) {
    if (!mouseInput.matches || event.pointerType !== 'mouse' || event.buttons) return;
    const point = { x: event.clientX, y: event.clientY };
    if (previousPointer && Math.hypot(point.x - previousPointer.x, point.y - previousPointer.y) < 3) return;
    previousPointer = point;
    queueInput(point);
  }

  function scrollMove() {
    const position = window.scrollY;
    if (Math.abs(position - previousScroll) < 2) return;
    previousScroll = position;
    queueInput(null);
  }

  function scheduleAmbient() {
    clearTimeout(ambientTimer);
    if (!compact || !canAnimate()) return;
    ambientTimer = setTimeout(() => {
      if (canAnimate() && !active.size) replace(eligibleLetters(null), 1, 700);
      scheduleAmbient();
    }, 9000 + Math.random() * 7000);
  }

  function createRuns() {
    const walker = document.createTreeWalker(headline, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
      if (walker.currentNode.textContent.trim()) nodes.push(walker.currentNode);
    }
    for (const original of nodes) {
      const node = document.createElement('span');
      node.className = 'headline-glitch__run';
      // Expose complete phrases to assistive technology, including the link's
      // own name, instead of making it read the decorative spans letter by letter.
      const accessibleText = document.createElement('span');
      accessibleText.className = 'headline-glitch__accessible';
      accessibleText.textContent = original.textContent;
      node.append(accessibleText);
      const svg = document.createElementNS(SVG_NS, 'svg');
      svg.classList.add('headline-glitch__overlay');
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('focusable', 'false');
      const baseline = document.createElement('span');
      baseline.className = 'headline-glitch__baseline';
      baseline.setAttribute('aria-hidden', 'true');
      const run = { node, svg, baseline, letters: [] };
      const characters = typeof Intl.Segmenter === 'function'
        ? [...new Intl.Segmenter('ru', { granularity: 'grapheme' }).segment(original.textContent)].map((item) => item.segment)
        : Array.from(original.textContent);
      const uppercase = getComputedStyle(original.parentElement).textTransform === 'uppercase';
      for (const character of characters) {
        const source = document.createElement('span');
        source.className = 'headline-glitch__source';
        source.setAttribute('aria-hidden', 'true');
        source.textContent = character;
        node.append(source);
        // Keep spaces and domain punctuation in the original font.
        if (!/^\p{L}$/u.test(character)) continue;
        const glyph = document.createElementNS(SVG_NS, 'text');
        glyph.classList.add('headline-glitch__glyph');
        glyph.textContent = uppercase ? character.toLocaleUpperCase('ru') : character;
        svg.append(glyph);
        const letter = { source, glyph, character: glyph.textContent, variants: [] };
        run.letters.push(letter);
        letters.push(letter);
      }
      node.append(baseline, svg);
      original.replaceWith(node);
      runs.push(run);
    }
  }

  async function initialize() {
    if (ready || destroyed || reducedMotion.matches || !context) return;
    const loaded = await Promise.allSettled(FAMILIES.map((family) => document.fonts.load(`400 100px "${family}"`, 'НH')));
    await document.fonts.ready;
    if (ready || destroyed || reducedMotion.matches) return;
    families = FAMILIES.filter((_, index) => loaded[index].status === 'fulfilled' && loaded[index].value.length);
    if (!families.length) return;
    createRuns();
    ready = true;
    headline.classList.add('headline-glitch');
    measure();
    resizeObserver.observe(headline);
    scheduleAmbient();
  }

  const resizeObserver = new ResizeObserver(queueMeasure);
  listen(document, 'pointermove', pointerMove, { passive: true });
  if (scroll) listen(window, 'scroll', scrollMove, { passive: true });
  listen(window, 'resize', queueMeasure);
  listen(window, 'blur', stop);
  listen(window, 'focus', scheduleAmbient);
  listen(window, 'pagehide', stop);
  listen(window, 'pageshow', scheduleAmbient);
  listen(document, 'visibilitychange', () => {
    if (document.hidden) stop();
    else scheduleAmbient();
  });
  listen(mouseInput, 'change', restore);
  listen(reducedMotion, 'change', () => {
    stop();
    if (!reducedMotion.matches) { initialize(); scheduleAmbient(); }
  });
  initialize();

  return {
    setSuspended(value) {
      suspended = value;
      if (value) stop();
      else { queueMeasure(); scheduleAmbient(); }
    },
    setCompact(value) {
      compact = value;
      headline.classList.toggle('headline-glitch--soft', value);
      stop();
      queueMeasure();
      scheduleAmbient();
    },
    destroy() {
      destroyed = true;
      stop();
      cancelAnimationFrame(measureFrame);
      resizeObserver.disconnect();
      listeners.abort();
      for (const run of runs) {
        const text = [...run.node.querySelectorAll('.headline-glitch__source')].map((source) => source.textContent).join('');
        run.node.replaceWith(document.createTextNode(text));
      }
      headline.classList.remove('headline-glitch', 'headline-glitch--soft');
    },
  };
}
