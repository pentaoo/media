// Optional browser regression; provide PLAYWRIGHT_MODULE when it is not installed locally.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
const url = new URL('article.html?dev=0', process.env.MEDIA_TEST_URL || 'http://localhost:4173/').href;
const output = new URL('../deliverables/mobile-lyric-scenes/', import.meta.url);
await mkdir(output, { recursive: true });
const checks = [];
const errors = [];

async function setup(width, height, options = {}) {
  const context = await browser.newContext({ viewport: { width, height }, isMobile: width <= 760, hasTouch: width <= 760, ...options });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  return { context, page };
}

async function metrics(scene) {
  return scene.evaluate(element => {
    const scroll = element.querySelector('.story-quote-scene__scroll');
    const stage = element.querySelector('.story-quote-scene__stage');
    const media = element.querySelector('.story-quote-scene__media');
    const lyrics = element.querySelector('.story-quote-scene__lyrics');
    const lines = [...element.querySelectorAll('[data-quote-line]')];
    const video = media.querySelector('video');
    return {
      enhanced: element.classList.contains('is-enhanced'), phase: element.dataset.quotePhase,
      top: scroll.getBoundingClientRect().top + scrollY, runway: scroll.offsetHeight - stage.offsetHeight,
      stageTop: stage.getBoundingClientRect().top, height: stage.offsetHeight,
      inset: stage.getBoundingClientRect().left + parseFloat(getComputedStyle(stage).paddingLeft),
      current: lines.findIndex(line => line.classList.contains('is-current')),
      offsets: lines.map(line => line.offsetTop - lines[0].offsetTop),
      transform: new DOMMatrixReadOnly(getComputedStyle(lyrics).transform).m42,
      mediaDisplay: getComputedStyle(media).display, mediaOpacity: Number(getComputedStyle(media).opacity),
      lyricsOpacity: Number(getComputedStyle(lyrics).opacity), videoState: media.dataset.videoState,
      video: video ? { muted: video.muted, playsInline: video.playsInline, paused: video.paused } : null,
      overflow: document.documentElement.scrollWidth > innerWidth,
      analysis: !!element.nextElementSibling?.querySelector('.story-section__copy > p'),
    };
  });
}

async function scrollTo(page, y) {
  await page.evaluate(y => window.scrollTo(0, y), y);
  await page.waitForTimeout(350);
}

async function swipe(context, page, start, end) {
  const cdp = await context.newCDPSession(page);
  const x = page.viewportSize().width / 2;
  const before = await page.evaluate(() => scrollY);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: start }] });
  for (let step = 1; step <= 15; step++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: start + (end - start) * step / 15 }] });
    await page.waitForTimeout(30);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(400);
  await cdp.detach();
  const delta = await page.evaluate(() => scrollY) - before;
  assert(Math.abs(delta) > 30 && Math.sign(delta) === Math.sign(start - end), `Native article scroll failed: ${delta}px`);
  return Math.round(delta);
}

async function checkProfile(width, height) {
  const { context, page } = await setup(width, height);
  for (const id of ['quote', 'verse-excerpt']) {
    const scene = page.locator(`#${id}`);
    const layout = await metrics(scene);
    assert(layout.enhanced, `Lyric animation must also run at ${width}px`);
    assert(layout.offsets.length >= 4 && layout.analysis, 'Keep the original lyric fragment followed by its analysis');
    assert(layout.mediaDisplay !== 'none');
    if (width <= 760) assert.equal(layout.inset, 20, 'Mobile lyrics retain the phone gutter');
    await scrollTo(page, layout.top - layout.height * .6);
    assert.equal((await metrics(scene)).mediaOpacity, 0);
    await scrollTo(page, layout.top + 1);
    const first = await metrics(scene);
    assert.equal(first.phase, 'reading');
    assert.equal(first.current, 0);
    assert(first.mediaOpacity > .99 && Math.abs(first.stageTop) < 1 && !first.overflow);
    await page.waitForFunction(id => document.querySelector(`#${id} .story-quote-scene__media`).dataset.videoState === 'playing', id);
    const playing = await metrics(scene);
    assert(playing.video.muted && playing.video.playsInline && !playing.video.paused);
    if (width === 390) await page.screenshot({ path: fileURLToPath(new URL(`${id}-reading.png`, output)) });
    const seen = new Set([0]);
    // Small, paced scrolls exercise every phrase and the reversible reading stops.
    for (let distance = 0; distance < layout.runway; distance += 28) {
      await page.evaluate(y => window.scrollTo(0, y), layout.top + distance);
      await page.waitForTimeout(65);
      seen.add((await metrics(scene)).current);
    }
    await scrollTo(page, layout.top + layout.runway - 1);
    const last = await metrics(scene);
    seen.add(last.current);
    assert.equal(seen.size, layout.offsets.length, 'Every original line becomes the active phrase');
    assert.equal(last.current, layout.offsets.length - 1);
    assert(Math.abs(last.transform + layout.offsets.at(-1)) < 1 && last.mediaOpacity > .99);
    if (width === 390) {
      const forward = await swipe(context, page, height * .65, height * .35);
      const backward = await swipe(context, page, height * .35, height * .65);
      checks.push({ width, height, id, nativeForward: forward, nativeBackward: backward });
    }
    await scrollTo(page, layout.top + layout.runway + layout.height * .45);
    const after = await metrics(scene);
    assert.equal(after.mediaOpacity, 0);
    assert.equal(after.lyricsOpacity, 0);
    assert.equal(after.phase, 'after');
    assert.equal(after.video.paused, true);
    assert.equal(await page.locator('body').evaluate(element => element.classList.contains('is-story-quote-active')), false);
    await scrollTo(page, layout.top + 1);
    const reverse = await metrics(scene);
    assert.equal(reverse.current, 0);
    // scrollTo rounds fractional document positions to physical CSS pixels.
    assert(reverse.mediaOpacity > .99 && Math.abs(reverse.transform) < 2, JSON.stringify({ width, height, id, reverse }));
    checks.push({ width, height, id, lines: layout.offsets.length, stageHeight: layout.height, first, last, after });
  }
  console.log(`Lyric scenes passed at ${width} × ${height}`);
  await context.close();
}

try {
  for (const [width, height] of [[320, 568], [390, 844], [760, 360], [761, 900], [1440, 900]]) await checkProfile(width, height);
  const { context, page } = await setup(390, 844);
  const scene = page.locator('#quote');
  let layout = await metrics(scene);
  await scrollTo(page, layout.top + layout.runway / 2);
  await page.setViewportSize({ width: 390, height: 690 });
  await page.waitForTimeout(400);
  layout = await metrics(scene);
  assert.equal(layout.height, 690);
  await scrollTo(page, layout.top + 1);
  assert(Math.abs((await metrics(scene)).stageTop) < 1);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(400);
  assert.equal((await metrics(scene)).phase, 'static');
  assert.equal((await metrics(scene)).enhanced, false);
  assert.equal(await page.locator('body').evaluate(element => element.classList.contains('is-story-quote-active')), false);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.waitForTimeout(400);
  assert.equal((await metrics(scene)).enhanced, true);
  checks.push({ resizeAndMotionPreference: 'passed' });
  await context.close();
  const fallback = await setup(390, 844);
  await fallback.page.route('**/assets/video/editorial/**/article.mp4', route => route.abort());
  layout = await metrics(fallback.page.locator('#quote'));
  await scrollTo(fallback.page, layout.top + 1);
  assert((await metrics(fallback.page.locator('#quote'))).mediaOpacity > .99);
  assert.equal(await fallback.page.locator('#quote .story-quote-scene__photo').evaluate(image => image.complete && image.naturalWidth > 0), true);
  checks.push({ failedVideoKeepsPhotoAndLyrics: 'passed' });
  await fallback.context.close();
  assert.deepEqual(errors, []);
  await writeFile(new URL('validation.json', output), JSON.stringify({ browser: 'Chromium', checks, errors }, null, 2));
  console.log(JSON.stringify({ profiles: 5, lyricScenes: 10, checks: ['native touch forward and reverse', 'every lyric line', 'background video and photo fallback', 'fade back to article', 'viewport resize', 'reduced motion'], errors }, null, 2));
} finally {
  await browser.close();
}
