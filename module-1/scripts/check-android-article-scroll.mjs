// Native Android regression. Open the article in the browser/custom tab first,
// forward its DevTools socket, and set ANDROID_CDP_URL to that endpoint.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.connectOverCDP(process.env.ANDROID_CDP_URL || 'http://localhost:9224');
const adb = args => execFileSync(process.env.ADB_EXECUTABLE || 'adb', [...(process.env.ANDROID_SERIAL ? ['-s', process.env.ANDROID_SERIAL] : []), ...args], { encoding: 'utf8' }).trim();
const output = new URL('../deliverables/android-article-scroll/', import.meta.url);
await mkdir(output, { recursive: true });
const context = browser.contexts()[0];
const page = context.pages().find(page => page.url().includes('article.html')) || context.pages()[0];
assert(page, 'Open the article in the Android browser before running the check');
const size = adb(['shell', 'wm', 'size']).match(/Physical size: (\d+)x(\d+)/);
assert(size, 'ADB must report a screen size');
const width = Number(size[1]);
const height = Number(size[2]);
const errors = [];
const swipes = [];
page.on('pageerror', error => errors.push(error.message));
const read = () => page.evaluate(() => ({
  y: scrollY, height: innerHeight, visualHeight: visualViewport.height,
  rootOverflowY: getComputedStyle(document.documentElement).overflowY,
  bodyOverflow: getComputedStyle(document.body).overflow,
  touchAction: getComputedStyle(document.querySelector('#media-content')).touchAction,
  coverTop: document.querySelector('.story-cover').getBoundingClientRect().top,
}));
const collapseSheet = () => page.keyboard.press('Escape');

async function swipe(direction) {
  const before = await read();
  const start = direction === 'forward' ? .72 : .28;
  const end = direction === 'forward' ? .28 : .72;
  adb(['shell', 'input', 'swipe', String(Math.round(width / 2)), String(Math.round(height * start)), String(Math.round(width / 2)), String(Math.round(height * end)), '450']);
  await page.waitForTimeout(800);
  const after = await read();
  const delta = after.y - before.y;
  assert(direction === 'forward' ? delta > 40 : delta < -40, `Android ${direction} swipe moved the article only ${delta}px`);
  swipes.push({ direction, before, after });
}

try {
  await page.goto(new URL('article.html?dev=0', process.env.MEDIA_TEST_URL || 'http://localhost:4182/').href);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  const initial = await read();
  assert.equal(initial.y, 0);
  assert(!['hidden', 'clip'].includes(initial.rootOverflowY));
  assert.equal(initial.bodyOverflow, 'visible');
  await swipe('forward');
  assert((await read()).coverTop < -40, 'The cover itself must move, not just the browser toolbar');
  await page.screenshot({ path: fileURLToPath(new URL('cover-after-native-swipe.png', output)) });
  await swipe('backward');
  // Exercise a second gesture after the native toolbar changes viewport height.
  await swipe('forward');
  await page.locator('#artist-intro').evaluate(element => scrollTo(0, scrollY + element.getBoundingClientRect().top - 160));
  await page.waitForTimeout(500);
  if (await page.locator('.mobile-shell').getAttribute('data-snap') === 'hidden') await page.locator('[data-mobile-mode="context"]').click();
  if (await page.locator('.mobile-shell').getAttribute('data-snap') === 'expanded') await collapseSheet();
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    window.__sheetViewportTrace = { running: true, frames: [] };
    function record() {
      const trace = window.__sheetViewportTrace;
      const sheet = document.querySelector('.mobile-shell__sheet');
      trace.frames.push({
        height: innerHeight, visualHeight: visualViewport.height,
        // The sheet's box stays anchored at bottom: 0; snaps move it with transform, so its visible edge is measured separately.
        bottomGap: innerHeight - sheet.offsetTop - sheet.offsetHeight,
        visible: innerHeight - sheet.getBoundingClientRect().top,
        cssBottom: parseFloat(getComputedStyle(sheet).bottom),
        searchInset: parseFloat(document.querySelector('.mobile-shell').style.getPropertyValue('--mobile-search-inset')),
      });
      if (trace.running) requestAnimationFrame(record);
    }
    record();
  });
  for (const [start, end, duration] of [[.72, .32, 140], [.28, .72, 90]]) {
    adb(['shell', 'input', 'swipe', String(Math.round(width / 2)), String(Math.round(height * start)), String(Math.round(width / 2)), String(Math.round(height * end)), String(duration)]);
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(400);
  const viewportFrames = await page.evaluate(() => { window.__sheetViewportTrace.running = false; return window.__sheetViewportTrace.frames; });
  assert(viewportFrames.every(frame => Math.abs(frame.bottomGap) < 1 && frame.cssBottom === 0), 'Rapid reverse scrolling detached the sheet from the viewport bottom');
  assert(viewportFrames.every(frame => Math.abs(frame.visible - viewportFrames[0].visible) < 1), 'Browser toolbar changes must not move the preview edge');
  await page.screenshot({ path: fileURLToPath(new URL('sheet-after-fast-reverse-scroll.png', output)) });
  if (await page.locator('.mobile-shell').getAttribute('data-mode') === 'context') await collapseSheet();
  for (const mode of ['menu', 'search']) {
    await page.locator(`[data-mobile-mode="${mode}"]`).click();
    assert.equal(await page.evaluate(() => document.documentElement.style.overflow), 'hidden');
    if (mode === 'search') {
      await page.waitForTimeout(1000);
      assert(await page.locator('#mobile-article-query').evaluate(input => input.getBoundingClientRect().bottom <= visualViewport.height + visualViewport.offsetTop));
    }
    await page.goBack();
    await page.waitForTimeout(500);
    assert(!['hidden', 'clip'].includes((await read()).rootOverflowY));
    await swipe('forward');
    if (await page.locator('.mobile-shell').getAttribute('data-mode') === 'context') await collapseSheet();
  }
  assert.deepEqual(errors, []);
  const activity = adb(['shell', 'dumpsys', 'activity', 'activities']).split('\n').find(line => line.includes('topResumedActivity='))?.trim();
  const viewport = { frames: viewportFrames.length, maxBottomGap: Math.max(...viewportFrames.map(frame => Math.abs(frame.bottomGap))), previewVisible: viewportFrames[0].visible, maxSearchInset: Math.max(...viewportFrames.map(frame => frame.searchInset)) };
  await writeFile(new URL('validation.json', output), JSON.stringify({ userAgent: await page.evaluate(() => navigator.userAgent), activity, input: 'adb shell input swipe', initial, swipes, viewport, errors }, null, 2));
  console.log(JSON.stringify({ activity, nativeSwipes: swipes.length + 2, viewport, errors }, null, 2));
} finally {
  await browser.close();
}
