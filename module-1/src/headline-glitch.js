const SVG_NS = 'http://www.w3.org/2000/svg';
const FAMILIES = ['Elion Italic', 'East Gates', 'Sigma Boy'];
const IDLE_MS = 3000;
const PULSE_MS = 200;
const MAX_ACTIVE = 3;
// Idle twinkle: with nobody touching the page, one letter (sometimes two)
// flashes into another family and back, like a star.
const TWINKLE_PAUSE_MS = [1400, 3800];
const TWINKLE_HOLD_MS = [450, 950];

function between([min, max]) {
  return min + Math.random() * (max - min);
}

// The source stays in Benzin. Plain inline spans preserve the shaped text run;
// only the paint changes, and SVG replacements never participate in layout.
export function mountHeadlineGlitch(headline, { scroll = false, multiline = false, twinkle = true } = {}) {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const mouseInput = matchMedia('(min-width: 1025px) and (hover: hover) and (pointer: fine)');
  const runs = [];
  const letters = [];
  const active = new Set();
  const twinkling = new Map();
  const listeners = new AbortController();
  const context = document.createElement('canvas').getContext('2d');
  let families = [];
  let ready = false;
  let destroyed = false;
  let compact = false;
  let suspended = false;
  let idleTimer = 0;
  let ambientTimer = 0;
  let twinkleTimer = 0;
  let hoverTimer = 0;
  let hoveredLetter = null;
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

  function hide(letter) {
    letter.source.classList.remove('is-glitched');
    letter.glyph.classList.remove('is-active');
  }

  function show(letter, soft = false) {
    const currentFamily = letter.glyph.getAttribute('font-family');
    const alternatives = letter.variants.filter((variant) => variant.family !== currentFamily);
    const variants = alternatives.length ? alternatives : letter.variants;
    const variant = variants[Math.floor(Math.random() * variants.length)];
    letter.glyph.setAttribute('font-family', variant.family);
    letter.glyph.setAttribute('font-size', variant.size);
    letter.glyph.setAttribute('x', variant.x);
    letter.glyph.setAttribute('y', variant.y);
    letter.glyph.dataset.glitchFont = variant.family;
    letter.glyph.classList.toggle('is-twinkle', soft);
    letter.source.classList.toggle('is-twinkle', soft);
    letter.glyph.classList.add('is-active');
    letter.source.classList.add('is-glitched');
  }

  function untwinkle(letter) {
    clearTimeout(twinkling.get(letter));
    twinkling.delete(letter);
  }

  function restore() {
    clearTimeout(idleTimer);
    idleTimer = 0;
    for (const letter of active) hide(letter);
    active.clear();
    for (const letter of twinkling.keys()) {
      untwinkle(letter);
      hide(letter);
    }
  }

  function stop() {
    stopHover(false);
    restore();
    clearTimeout(ambientTimer);
    ambientTimer = 0;
    clearTimeout(twinkleTimer);
    twinkleTimer = 0;
    cancelAnimationFrame(inputFrame);
    inputFrame = 0;
    pendingInput = null;
    previousPointer = null;
  }

  function stopHover(hold = true) {
    const wasHovering = Boolean(hoverTimer);
    clearInterval(hoverTimer);
    hoverTimer = 0;
    hoveredLetter = null;
    if (hold && wasHovering && active.size) {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(restore, IDLE_MS);
    }
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
      const rect = (multiline ? headline : run.node).getBoundingClientRect();
      const matrix = getComputedStyle(headline).transform;
      const scale = matrix === 'none' ? 1 : new DOMMatrixReadOnly(matrix).a || 1;
      const size = parseFloat(style.fontSize);
      // Glyph coordinates are relative to the overlay's own origin. A positioned
      // ancestor inside the heading (the site link) can anchor it below the
      // heading's top, so never assume the heading's corner.
      const overlay = run.svg.getBoundingClientRect();
      const baseline = (run.baseline.getBoundingClientRect().top - overlay.top) / scale;
      const lastSourceTop = run.lastSource.getBoundingClientRect().top;
      run.svg.setAttribute('width', rect.width / scale);
      run.svg.setAttribute('height', rect.height / scale);
      context.font = font(size, style.fontFamily, style.fontWeight);
      const capHeight = context.measureText('Н').actualBoundingBoxAscent;
      for (const letter of run.letters) {
        const sourceRect = letter.source.getBoundingClientRect();
        // Wrapped runs share one overlay anchored to the heading. Keep each
        // replacement on its own line, using the run's final baseline as a
        // reference; the inline source spans preserve the original shaping.
        const letterBaseline = baseline + (sourceRect.top - lastSourceTop) / scale;
        context.font = font(size, style.fontFamily, style.fontWeight);
        const base = context.measureText(letter.character);
        const inkCenter = (base.actualBoundingBoxRight - base.actualBoundingBoxLeft) / 2;
        const origin = (sourceRect.left - overlay.left) / scale;
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
            y: letterBaseline,
          };
        });
      }
    }
    updateHover();
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

  function replace(candidates, limit, duration = IDLE_MS, requiredLetter = null) {
    if (!candidates.length) return;
    // Fisher-Yates over a local pool keeps all three families equally likely.
    const pool = [...candidates];
    const picked = [];
    for (let i = 0; i < Math.min(limit, pool.length); i++) {
      const index = i + Math.floor(Math.random() * (pool.length - i));
      [pool[i], pool[index]] = [pool[index], pool[i]];
      picked.push(pool[i]);
    }
    if (requiredLetter && !picked.includes(requiredLetter)) picked[0] = requiredLetter;
    for (const letter of active) {
      if (!picked.includes(letter)) {
        hide(letter);
        active.delete(letter);
      }
    }
    for (const letter of picked) {
      // A pointer or scroll takes over a twinkling letter and holds it.
      untwinkle(letter);
      show(letter);
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
    replace(candidates, compact ? 1 : Math.min(MAX_ACTIVE, 2 + Math.floor(Math.random() * 2)), IDLE_MS, hoveredLetter);
  }

  function queueInput(point) {
    if (!canAnimate()) return;
    pendingInput = { point };
    if (!inputFrame) inputFrame = requestAnimationFrame(renderInput);
  }

  function letterUnderPointer() {
    if (!previousPointer || !mouseInput.matches || !canAnimate()) return null;
    return eligibleLetters(previousPointer).find((letter) => {
      const rect = letter.source.getBoundingClientRect();
      return previousPointer.x >= rect.left && previousPointer.x < rect.right
        && previousPointer.y >= rect.top && previousPointer.y < rect.bottom;
    }) || null;
  }

  function pulseHover() {
    const letter = letterUnderPointer();
    if (!letter) return stopHover();
    hoveredLetter = letter;
    lastPulse = performance.now();
    replace(eligibleLetters(previousPointer), compact ? 1 : MAX_ACTIVE, IDLE_MS, letter);
  }

  function updateHover() {
    const letter = letterUnderPointer();
    if (!letter) return stopHover();
    if (letter === hoveredLetter && hoverTimer) return;
    stopHover(false);
    hoveredLetter = letter;
    pulseHover();
    // A stationary pointer keeps updating its letter; moving inside the same
    // letter does not restart the timer or postpone the next 200 ms tick.
    hoverTimer = setInterval(pulseHover, PULSE_MS);
  }

  function pointerMove(event) {
    if (!mouseInput.matches || event.pointerType !== 'mouse') return;
    if (event.buttons) {
      previousPointer = null;
      return stopHover();
    }
    previousPointer = { x: event.clientX, y: event.clientY };
    updateHover();
  }

  function scrollMove() {
    const position = window.scrollY;
    if (Math.abs(position - previousScroll) < 2) return;
    previousScroll = position;
    updateHover();
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

  function sparkle() {
    // The pointer is already playing with the letters; stars wait for it to leave.
    if (!canAnimate() || hoverTimer) return;
    const pool = eligibleLetters(null).filter((letter) => !active.has(letter) && !twinkling.has(letter));
    const count = Math.min(pool.length, Math.random() < .3 ? 2 : 1);
    for (let i = 0; i < count; i++) {
      const [letter] = pool.splice(Math.floor(Math.random() * pool.length), 1);
      show(letter, true);
      twinkling.set(letter, setTimeout(() => {
        twinkling.delete(letter);
        hide(letter);
      }, between(TWINKLE_HOLD_MS)));
    }
  }

  function scheduleTwinkle() {
    clearTimeout(twinkleTimer);
    twinkleTimer = 0;
    if (!twinkle || compact || !canAnimate()) return;
    twinkleTimer = setTimeout(() => {
      sparkle();
      scheduleTwinkle();
    }, between(TWINKLE_PAUSE_MS));
  }

  function scheduleIdle() {
    scheduleAmbient();
    scheduleTwinkle();
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
        run.lastSource = source;
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
    if (multiline) headline.classList.add('headline-glitch--multiline');
    measure();
    resizeObserver.observe(headline);
    scheduleIdle();
  }

  const resizeObserver = new ResizeObserver(queueMeasure);
  listen(document, 'pointermove', pointerMove, { passive: true });
  listen(document, 'pointerdown', () => { previousPointer = null; stopHover(); }, { passive: true });
  listen(document, 'pointerup', pointerMove, { passive: true });
  listen(document, 'pointercancel', () => { previousPointer = null; stopHover(); }, { passive: true });
  listen(document, 'pointerout', (event) => {
    if (!event.relatedTarget) { previousPointer = null; stopHover(); }
  }, { passive: true });
  if (scroll) listen(window, 'scroll', scrollMove, { passive: true });
  listen(window, 'resize', queueMeasure);
  // A window without focus can still be on the jury's screen: the pointer
  // effect stops, the stars keep going until the page is actually hidden.
  listen(window, 'blur', () => { stop(); scheduleTwinkle(); });
  listen(window, 'focus', scheduleIdle);
  listen(window, 'pagehide', stop);
  listen(window, 'pageshow', scheduleIdle);
  listen(document, 'visibilitychange', () => {
    if (document.hidden) stop();
    else scheduleIdle();
  });
  listen(mouseInput, 'change', () => { previousPointer = null; stopHover(false); restore(); });
  listen(reducedMotion, 'change', () => {
    stop();
    if (!reducedMotion.matches) { initialize(); scheduleIdle(); }
  });
  initialize();

  return {
    setSuspended(value) {
      suspended = value;
      if (value) stop();
      else { queueMeasure(); scheduleIdle(); }
    },
    setCompact(value) {
      compact = value;
      headline.classList.toggle('headline-glitch--soft', value);
      stop();
      queueMeasure();
      scheduleIdle();
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
      headline.classList.remove('headline-glitch', 'headline-glitch--soft', 'headline-glitch--multiline');
    },
  };
}
