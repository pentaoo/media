// Optional browser regression: supply Playwright via PLAYWRIGHT_MODULE if not installed locally.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
const url = new URL('article.html?dev=0', process.env.MEDIA_TEST_URL || 'http://localhost:4173/').href;
const output = new URL('../deliverables/mobile-sheet-scroll/', import.meta.url);
await mkdir(output, { recursive: true });
const checks = [];
const errors = [];

async function checkPhone(width, height) {
  const context = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  page.on('pageerror', error => errors.push(error.message));
  const settle = () => page.waitForTimeout(650);
  // Surfaces finish their exit/entry transitions before end-state geometry is measured.
  const motion = () => page.evaluate(() => Promise.allSettled(document.getAnimations()
    .filter(animation => Number.isFinite(animation.effect?.getComputedTiming().endTime)).map(animation => animation.finished)));
  // The sheet moves with transform: its visible height is what lies above the bottom edge.
  const sheetVisible = () => page.locator('.mobile-shell__sheet').evaluate(element => innerHeight - element.getBoundingClientRect().top);
  const snap = () => page.locator('.mobile-shell').getAttribute('data-snap');
  const mode = () => page.locator('.mobile-shell').getAttribute('data-mode');
  const articleY = () => page.evaluate(() => scrollY);
  async function swipe(startY, endY) {
    const x = width / 2;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: startY }] });
    for (let step = 1; step <= 12; step++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: startY + (endY - startY) * step / 12 }] });
      await page.waitForTimeout(20);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await settle();
  }
  async function assertArticleSwipe(startY, endY) {
    const before = await articleY();
    await swipe(startY, endY);
    const delta = await articleY() - before;
    assert(Math.sign(delta) === Math.sign(startY - endY) && Math.abs(delta) > 40, `Article swipe failed at ${width}x${height}: ${delta}px`);
    return Math.round(delta);
  }
  const collapseSheet = () => swipe(54, Math.min(height - 90, 320));
  async function checkSheetControls(expectedSnap) {
    const fabs = page.locator('.mobile-shell__fabs');
    assert(await fabs.isVisible());
    assert.equal(await page.locator('[data-mobile-mode="context"]').isVisible(), false);
    assert.equal(await page.locator('.mobile-shell__collapse').count(), 0);
    const geometry = await fabs.evaluate(group => {
      const buttons = [...group.querySelectorAll('button:not(.mobile-fab--context)')];
      const [menu, search] = buttons.map(button => button.getBoundingClientRect());
      return { gap: search.top - menu.bottom, right: innerWidth - search.right, bottom: innerHeight - search.bottom,
        sizes: buttons.map(button => {
          const rect = button.getBoundingClientRect();
          const icon = button.querySelector('img');
          const image = icon.getBoundingClientRect();
          const hit = getComputedStyle(button, '::after');
          return { width: rect.width, height: rect.height, icon: [image.width, image.height], loaded: icon.complete && icon.naturalWidth > 0,
            hitTop: rect.top + parseFloat(hit.top), hitBottom: rect.bottom - parseFloat(hit.bottom) };
        }) };
    });
    assert.equal(geometry.gap, 8);
    assert.equal(geometry.right, 12);
    assert.equal(geometry.bottom, 12);
    for (const button of geometry.sizes) {
      assert.deepEqual([button.width, button.height, ...button.icon], [32, 32, 24, 24]);
      assert(button.loaded);
      assert.equal(button.hitBottom - button.hitTop, 44);
    }
    assert(geometry.sizes[0].hitBottom <= geometry.sizes[1].hitTop, 'FAB hit areas must not overlap');
    for (const surface of ['menu', 'search']) {
      const before = await articleY();
      await page.locator(`[data-mobile-mode="${surface}"]`).tap();
      assert.equal(await mode(), surface);
      assert.equal(await fabs.evaluate(element => element.inert), true, 'Leaving FABs must stop taking input at once');
      await motion();
      assert.equal(await fabs.isVisible(), false);
      const close = surface === 'menu' ? '.mobile-shell__menu-close' : '[data-search-close]';
      await page.locator(close).tap();
      await settle();
      await motion();
      assert.equal(await mode(), 'context');
      assert.equal(await snap(), expectedSnap);
      assert(await fabs.isVisible());
      assert.equal(await page.locator('.story-page').evaluate(element => element.inert), false);
      assert(Math.abs(await articleY() - before) < 2, 'Closing navigation must preserve the reading position');
    }
  }
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
  await settle();
  assert(!['hidden', 'clip'].includes(await page.evaluate(() => getComputedStyle(document.documentElement).overflowY)));
  assert.equal(await page.evaluate(() => getComputedStyle(document.body).overflow), 'visible');
  assert.equal(await articleY(), 0);
  const coverSwipe = await assertArticleSwipe(height * .65, height * .25);
  assert(await page.locator('.story-cover').evaluate(element => element.getBoundingClientRect().top < -40));
  await assertArticleSwipe(height * .25, height * .65);
  await page.locator('#artist-intro').evaluate(element => scrollTo(0, scrollY + element.getBoundingClientRect().top - Math.min(160, innerHeight * .25)));
  await settle();
  assert.equal(await snap(), 'preview');
  await motion();
  const previewHeight = await sheetVisible();
  assert(Math.abs(previewHeight - Math.min(88, height * .25)) < 1);
  await checkSheetControls('preview');
  // Browser chrome can resize visualViewport before innerHeight catches up.
  await page.evaluate(() => {
    Object.defineProperty(visualViewport, 'height', { configurable: true, get: () => innerHeight - 64 });
    visualViewport.dispatchEvent(new Event('resize'));
  });
  const previewBottomGap = await page.locator('.mobile-shell__sheet').evaluate(element => innerHeight - element.offsetTop - element.offsetHeight);
  assert(Math.abs(await sheetVisible() - previewHeight) < 1, 'Browser chrome must not move the preview edge');
  assert(Math.abs(previewBottomGap) < 1, `Browser chrome lifted the preview by ${previewBottomGap}px`);
  await page.evaluate(() => { delete visualViewport.height; visualViewport.dispatchEvent(new Event('resize')); });
  const forward = await assertArticleSwipe(height * .5, height * .2);
  const backward = await assertArticleSwipe(height * .2, height * .5);
  // The regression: this gesture starts on the visible card image, below its drag handle.
  const previewSwipe = await assertArticleSwipe(height - 16, Math.max(90, height - 250));
  assert.equal(await snap(), 'preview');
  assert.equal(await page.locator('.mobile-shell__content').evaluate(element => element.scrollTop), 0);
  await page.screenshot({ path: fileURLToPath(new URL(`preview-${width}x${height}.png`, output)) });
  await page.locator('.mobile-shell__preview-toggle').click({ position: { x: width / 2, y: previewHeight - 16 } });
  await settle();
  assert.equal(await snap(), 'expanded');
  await motion();
  const expandedHeight = await sheetVisible();
  assert(Math.abs(expandedHeight - (height - 48)) < 1);
  await checkSheetControls('expanded');
  await page.screenshot({ path: fileURLToPath(new URL(`expanded-${width}x${height}.png`, output)) });
  await collapseSheet();
  assert.equal(await snap(), 'preview', 'A single collapse must skip the former 40% stop');
  const handleY = height - previewHeight + 6;
  await swipe(handleY, Math.max(50, handleY - 240));
  assert.equal(await snap(), 'expanded');
  await collapseSheet();
  assert.equal(await snap(), 'preview');
  await swipe(handleY, height - 3);
  assert.equal(await mode(), 'closed');
  for (const surface of ['menu', 'search']) {
    await page.locator(`[data-mobile-mode="${surface}"]`).click();
    assert.equal(await page.locator('.story-page').evaluate(element => element.inert), true);
    await motion();
    const obstruction = Math.min(300, height * .4);
    await page.evaluate(obstruction => {
      Object.defineProperty(visualViewport, 'height', { configurable: true, get: () => innerHeight - obstruction });
      visualViewport.dispatchEvent(new Event('resize'));
    }, obstruction);
    const panel = page.locator(surface === 'search' ? '.mobile-shell__search' : '.mobile-shell__menu-surface');
    const bottom = await panel.evaluate(element => element.getBoundingClientRect().bottom);
    assert(Math.abs(bottom - (surface === 'search' ? height - obstruction : height)) < 1);
    await page.evaluate(() => { delete visualViewport.height; visualViewport.dispatchEvent(new Event('resize')); });
    await page.goBack();
    await settle();
    assert.equal(await mode(), 'closed');
    assert.equal(await page.locator('.story-page').evaluate(element => element.inert), false);
    assert.equal(await page.evaluate(() => document.documentElement.style.overflow), '');
    await assertArticleSwipe(height * .5, height * .2);
  }
  await page.locator('[data-mobile-mode="context"]').click();
  await settle();
  assert.equal(await snap(), 'expanded', 'The FAB should open the full card directly');
  if (width === 390) {
    // Use a known long card and a low viewport to exercise its separate native scroll.
    await page.locator('#artist-intro').evaluate(element => scrollTo(0, scrollY + element.getBoundingClientRect().top - Math.min(160, innerHeight * .25)));
    await page.setViewportSize({ width, height: 510 });
    await settle();
    const before = await articleY();
    await swipe(340, 160);
    assert(await page.locator('.mobile-shell__content').evaluate(element => element.scrollTop) > 0);
    assert(Math.abs(await articleY() - before) < 2, 'Expanded card scrolling must not move the article');
    await page.locator('.mobile-shell__content .context-image-trigger').first().click();
    await settle();
    assert.equal(await page.locator('.article-image-viewer[open]').count(), 1);
    await page.locator('.article-image-viewer__close').click();
    await settle();
    assert.equal(await page.locator('.article-image-viewer[open]').count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.style.overflow), '');
    await page.setViewportSize({ width, height });
    await collapseSheet();
    await assertArticleSwipe(height - 16, height - 250);
  }
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
  checks.push({ width, height, previewHeight, expandedHeight, previewBottomGap, coverSwipe, articleSwipe: forward, reverseSwipe: backward, swipeStartingOnPreview: previewSwipe });
  await context.close();
}

try {
  for (const [width, height] of [[320, 510], [390, 844], [760, 360]]) await checkPhone(width, height);
  const desktop = await browser.newPage({ viewport: { width: 761, height: 900 } });
  await desktop.goto(url);
  await desktop.locator('.mobile-shell').waitFor({ state: 'attached' });
  assert.equal(await desktop.locator('.mobile-shell__fabs').isVisible(), false, 'Phone FABs must stay hidden at 761px');
  await desktop.close();
  assert.deepEqual(errors, []);
  const result = { browser: 'Chromium with native touch input', checks, errors };
  await writeFile(new URL('validation.json', output), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
