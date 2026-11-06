import { quoteTiming, quoteReadingLayout, quoteScrollState, quoteScrollStickiness, smoothQuoteTravel } from './quote-scroll-state.js';
import { mountQuoteBackgroundVideo } from './quote-background-video.js';

/** Fade in the concert, optionally scroll approved lyrics, and reveal the article. */
export function mountQuoteScenes(page, onActiveChange) {
  const scenes = [...page.querySelectorAll('[data-quote-scene]')].map(element => ({
    element,
    scroll: element.querySelector('.story-quote-scene__scroll'),
    stage: element.querySelector('.story-quote-scene__stage'),
    lyrics: element.querySelector('.story-quote-scene__lyrics'),
    media: element.querySelector('.story-quote-scene__media'),
    continuation: element.nextElementSibling,
    video: mountQuoteBackgroundVideo(element.querySelector('.story-quote-scene__media')),
    lines: [...element.querySelectorAll('[data-quote-line]')],
    offsets: [], stops: [], current: -1, visualTravel: null, targetTravel: null, height: 0, top: 0, travel: 0, runway: 0, exit: 0,
  }));
  if (!scenes.length) return () => {};
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const controller = new AbortController();
  const options = { signal: controller.signal };
  let active = false;
  let frame = 0;
  let headerHeight = 0;
  let needsMeasure = true;
  let lastFrameTime = 0;
  let lastScrollY = window.scrollY;
  let lastMoveTime = performance.now();
  let scrollSpeed = 0;
  let gestureStickiness = 1;

  function setActive(next) {
    if (active === next) return;
    active = next;
    onActiveChange(active);
  }

  function measure() {
    const enhanced = !reducedMotion.matches;
    headerHeight = parseFloat(getComputedStyle(page).getPropertyValue('--story-header-height'));
    for (const scene of scenes) {
      scene.element.classList.toggle('is-enhanced', enhanced);
      if (!enhanced) {
        scene.element.dataset.quotePhase = 'static';
        delete scene.element.dataset.quoteStickiness;
        scene.scroll.style.removeProperty('--quote-scroll-height');
        scene.lyrics.style.removeProperty('transform');
        scene.element.style.removeProperty('--quote-overlap');
        scene.element.style.removeProperty('--quote-media-opacity');
        scene.element.style.removeProperty('--quote-lyrics-opacity');
        scene.media.classList.remove('is-visible');
        scene.video.setActive(false);
        scene.lines.forEach(line => line.classList.remove('is-current', 'is-past'));
        scene.current = -1;
        scene.visualTravel = null;
        scene.targetTravel = null;
        continue;
      }
      scene.height = scene.stage.offsetHeight;
      // A concert can run without a lyric fragment; retain one stationary stop.
      scene.offsets = scene.lines.length ? scene.lines.map(line => line.offsetTop - scene.lines[0].offsetTop) : [0];
      Object.assign(scene, quoteReadingLayout(scene.height, scene.offsets));
      scene.visualTravel = null;
      scene.targetTravel = null;
      const height = `${Math.ceil(scene.height + scene.runway)}px`;
      if (scene.scroll.style.getPropertyValue('--quote-scroll-height') !== height) {
        scene.scroll.style.setProperty('--quote-scroll-height', height);
      }
      scene.top = scene.scroll.getBoundingClientRect().top + window.scrollY;
      scene.element.style.setProperty('--quote-overlap', `${scene.height * quoteTiming.overlap}px`);
      const continuationTop = scene.continuation?.getBoundingClientRect().top + window.scrollY;
      // Measure the full handoff; the video fades over its first half.
      scene.exit = Number.isFinite(continuationTop)
        ? Math.max(scene.height * .4, continuationTop - scene.top - scene.runway - headerHeight - 24)
        : scene.height * (1 - quoteTiming.overlap);
    }
    needsMeasure = false;
  }

  function render(now = performance.now()) {
    frame = 0;
    const elapsed = lastFrameTime ? Math.min(32, now - lastFrameTime) : 16;
    lastFrameTime = now;
    if (needsMeasure) measure();
    if (reducedMotion.matches) { lastFrameTime = 0; setActive(false); return; }
    const y = window.scrollY;
    const delta = y - lastScrollY;
    if (delta) {
      const interval = now - lastMoveTime;
      if (interval > 180) { scrollSpeed = 0; gestureStickiness = 1; }
      const speed = Math.abs(delta) / Math.max(16, interval);
      scrollSpeed = scrollSpeed * .65 + speed * .35;
      // Keep a fast gesture free through its momentum and settling tail.
      gestureStickiness = Math.min(gestureStickiness, quoteScrollStickiness(scrollSpeed));
      lastMoveTime = now;
    }
    let nextActive = false;
    let settling = false;
    for (const scene of scenes) {
      const distance = y - scene.top;
      const skip = Math.abs(delta) > scene.height * .35;
      if (skip) gestureStickiness = 0;
      const strength = gestureStickiness;
      scene.element.dataset.quoteStickiness = strength;
      const state = quoteScrollState(distance, scene, strength);
      scene.element.dataset.quotePhase = distance < -scene.height * quoteTiming.enter ? 'before'
        : distance < 0 ? 'entering'
          : distance <= scene.runway ? 'reading'
            : state.mediaOpacity > 0 ? 'leaving' : 'after';
      if (delta || scene.targetTravel === null) {
        // Changing speed must not pull the text against the user's direction.
        scene.targetTravel = scene.visualTravel === null ? state.travel
          : delta > 0 ? Math.max(scene.visualTravel, state.travel)
            : delta < 0 ? Math.min(scene.visualTravel, state.travel) : state.travel;
      }
      scene.visualTravel = scene.visualTravel === null || skip || !state.lyricsOpacity
        ? scene.targetTravel : smoothQuoteTravel(scene.visualTravel, scene.targetTravel, elapsed, strength);
      settling ||= scene.visualTravel !== scene.targetTravel;
      scene.lyrics.style.transform = `translate3d(0, ${-scene.visualTravel}px, 0)`;
      scene.element.style.setProperty('--quote-media-opacity', state.mediaOpacity);
      scene.element.style.setProperty('--quote-lyrics-opacity', state.lyricsOpacity);
      scene.media.classList.toggle('is-visible', state.mediaOpacity > 0);
      if (distance > -scene.height * .7 && distance < scene.runway + scene.exit) scene.video.preload();
      scene.video.setActive(state.mediaOpacity > 0 && !document.hidden);
      // Select the phrase nearest the reading position, including reverse scroll.
      let current = 0;
      for (let index = 1; index < scene.offsets.length; index++) {
        if (scene.visualTravel >= (scene.offsets[index - 1] + scene.offsets[index]) / 2) current = index;
      }
      if (current !== scene.current) {
        scene.lines.forEach((line, index) => {
          line.classList.toggle('is-current', index === current);
          line.classList.toggle('is-past', index < current);
        });
        scene.current = current;
      }
      nextActive ||= state.mediaOpacity > 0;
    }
    setActive(nextActive);
    lastScrollY = y;
    if (settling) frame = requestAnimationFrame(render);
    else lastFrameTime = 0;
  }

  function schedule({ measure: shouldMeasure = false } = {}) {
    needsMeasure ||= shouldMeasure;
    if (!frame) frame = requestAnimationFrame(render);
  }
  const resizeObserver = new ResizeObserver(() => schedule({ measure: true }));
  resizeObserver.observe(page);
  for (const scene of scenes) {
    resizeObserver.observe(scene.stage);
    resizeObserver.observe(scene.lyrics);
  }
  window.addEventListener('scroll', () => schedule(), { ...options, passive: true });
  window.addEventListener('resize', () => schedule({ measure: true }), options);
  window.addEventListener('pageshow', () => schedule({ measure: true }), options);
  document.addEventListener('visibilitychange', () => schedule(), options);
  reducedMotion.addEventListener('change', () => schedule({ measure: true }), options);
  document.fonts.ready.then(() => {
    if (!controller.signal.aborted) schedule({ measure: true });
  });
  render();

  return () => {
    controller.abort();
    resizeObserver.disconnect();
    cancelAnimationFrame(frame);
    setActive(false);
    for (const scene of scenes) {
      scene.video.dispose();
      scene.element.classList.remove('is-enhanced');
      delete scene.element.dataset.quotePhase;
      delete scene.element.dataset.quoteStickiness;
      scene.scroll.style.removeProperty('--quote-scroll-height');
      scene.lyrics.style.removeProperty('transform');
      for (const property of ['--quote-overlap', '--quote-media-opacity', '--quote-lyrics-opacity']) scene.element.style.removeProperty(property);
      scene.lines.forEach((line, index) => {
        line.classList.toggle('is-current', index === 0);
        line.classList.remove('is-past');
      });
    }
  };
}
