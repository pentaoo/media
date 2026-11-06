// Optional browser regression for the phone motion system; same environment variables as check-mobile-sheet.mjs.
// RECORD_VIDEO=1 also saves short clips of the main transitions to deliverables/mobile-motion/.
import assert from 'node:assert/strict';
import { mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
const base = process.env.MEDIA_TEST_URL || 'http://localhost:4173/';
const articleUrl = new URL('article.html?dev=0', base).href;
const landingUrl = new URL('index.html?dev=0', base).href;
const output = new URL('../deliverables/mobile-motion/', import.meta.url);
const record = process.env.RECORD_VIDEO === '1';
await mkdir(output, { recursive: true });
const checks = [];
const errors = [];

async function open(width, height, { url = articleUrl, reducedMotion = 'no-preference', video } = {}) {
  const videoDir = video && record ? fileURLToPath(new URL(`.video-${video}/`, output)) : null;
  const context = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true, reducedMotion,
    ...(videoDir ? { recordVideo: { dir: videoDir, size: { width, height } } } : {}) });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  const cdp = await context.newCDPSession(page);
  const touch = async (type, y, x = width / 2) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  async function close() {
    await context.close();
    if (!videoDir) return;
    const [file] = await readdir(videoDir);
    await rename(`${videoDir}${file}`, fileURLToPath(new URL(`${video}-${width}x${height}.webm`, output)));
    await rm(videoDir, { recursive: true, force: true });
  }
  return { page, touch, close };
}
// Waits for finite transitions only; looping media effects elsewhere on the page never finish.
const motion = page => page.evaluate(() => Promise.allSettled(document.getAnimations()
  .filter(animation => Number.isFinite(animation.effect?.getComputedTiming().endTime))
  .map(animation => animation.finished)));
const shell = (page, name) => page.locator('.mobile-shell').getAttribute(`data-${name}`);
const top = (page, selector) => page.locator(selector).evaluate(element => element.getBoundingClientRect().top);
async function reachMaterial(page) {
  await page.locator('#artist-intro').evaluate(element => scrollTo(0, scrollY + element.getBoundingClientRect().top - Math.min(160, innerHeight * .25)));
  await page.waitForTimeout(500);
  await motion(page);
}
/** Samples an element's top every frame for `duration` ms after `action` runs in the same task. */
function sampleTops(page, selector, duration, action) {
  return page.evaluate(([selector, duration, action]) => new Promise(resolve => {
    const element = document.querySelector(selector);
    const tops = [element.getBoundingClientRect().top];
    new Function(action)();
    const start = performance.now();
    requestAnimationFrame(function frame(now) {
      tops.push(element.getBoundingClientRect().top);
      if (now - start < duration) requestAnimationFrame(frame);
      else resolve(tops);
    });
  }), [selector, duration, action]);
}
const monotonic = (values, sign) => values.every((value, index) => !index || Math.sign(value - values[index - 1]) !== -sign || Math.abs(value - values[index - 1]) < .5);
const maxStep = values => Math.max(...values.slice(1).map((value, index) => Math.abs(value - values[index])));

async function checkPhone(width, height) {
  const result = { width, height };
  // 1. FAB rearrangement follows the sheet without a jump, then returns.
  {
    const { page, close } = await open(width, height, { video: width === 390 ? 'fab-rearrange' : null });
    const searchFab = '[data-mobile-mode="search"]';
    const before = await top(page, searchFab);
    const tops = await sampleTops(page, searchFab, 420, `document.querySelector('[data-mobile-mode="context"]').click()`);
    await motion(page);
    const after = await top(page, searchFab);
    assert.equal(await shell(page, 'snap'), 'expanded');
    assert(Math.abs(after - before - 80) < 1, `Search FAB should glide 80px down: ${before} → ${after}`);
    assert(monotonic(tops, 1), 'FAB motion must not reverse');
    assert(tops.length > 6 && maxStep(tops) < 40, `FAB motion must be gradual: ${maxStep(tops)}px max step`);
    assert.equal(await page.locator('[data-mobile-mode="context"]').isVisible(), false);
    if (record) await page.waitForTimeout(600);
    // Collapse twice via the title: expanded → preview, then Escape hides; the group returns.
    await page.locator('.mobile-shell__title').click();
    await motion(page);
    if (record) await page.waitForTimeout(500);
    const back = await sampleTops(page, searchFab, 420, `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
    await motion(page);
    assert.equal(await shell(page, 'snap'), 'hidden');
    assert(Math.abs(await top(page, searchFab) - before) < 1, 'FAB group should return to 404:664');
    assert(monotonic(back, -1) && maxStep(back) < 40, 'FAB return must be gradual');
    assert(await page.locator('[data-mobile-mode="context"]').isVisible());
    if (record) await page.waitForTimeout(600);
    result.fabTravel = Math.round(after - before);
    result.fabFrames = tops.length;
    await close();
  }
  // 2. Menu: rises with the dimming, reverses mid-way, and keeps the reading position.
  {
    const { page, touch, close } = await open(width, height, { video: width === 390 ? 'menu' : null });
    await page.evaluate(() => scrollTo(0, 900));
    await page.waitForTimeout(300);
    await motion(page);
    const y = await page.evaluate(() => scrollY);
    const restingMode = await shell(page, 'mode');
    const center = selector => page.locator(selector).evaluate(element => { const rect = element.getBoundingClientRect(); return [rect.left + rect.width / 2, rect.top + rect.height / 2]; });
    const menuFab = await center('[data-mobile-mode="menu"]');
    await page.locator('[data-mobile-mode="menu"]').tap();
    await page.waitForTimeout(90);
    const midOpen = await top(page, '.mobile-shell__menu-surface');
    assert(midOpen > height - (await page.locator('.mobile-shell__menu-surface').evaluate(element => element.offsetHeight)) + 2 && midOpen < height, 'Menu should be mid-rise');
    const backdrop = await page.locator('.mobile-shell__backdrop').evaluate(element => +getComputedStyle(element).opacity);
    assert(backdrop > 0 && backdrop < 1, 'Dimming should fade together with the menu');
    // Interrupt the entry: close immediately; the surface must leave from where it is.
    const reverse = await sampleTops(page, '.mobile-shell__menu-surface', 320, `document.querySelector('.mobile-shell__menu-close').click()`);
    // The first frame must continue from the mid-rise position, not snap to either end.
    assert(reverse[1] >= reverse[0] - 1 && reverse[1] - reverse[0] < (height - reverse[0]) / 2, `Close must start from the current position: ${reverse[0]} → ${reverse[1]}`);
    assert(monotonic(reverse, 1), 'Interrupted menu must leave downwards only');
    await motion(page);
    assert.equal(await page.locator('.mobile-shell__menu-surface').isVisible(), false);
    // Rapid real taps with no waiting: open, close mid-rise, open again settles open.
    const tap = async ([x, y]) => { await touch('touchStart', y, x); await touch('touchEnd'); };
    await tap(menuFab);
    await page.waitForTimeout(60);
    // Close on the still dimming rather than on the moving surface, so the tap cannot land on a menu link.
    await tap([width / 2, 20]);
    await page.waitForTimeout(40);
    await tap(menuFab);
    assert.equal(await shell(page, 'mode'), 'menu', 'Repeated taps must be handled immediately');
    await motion(page);
    assert(Math.abs(await page.locator('.mobile-shell__menu-surface').evaluate(element => element.getBoundingClientRect().bottom) - height) < 1);
    if (record) await page.waitForTimeout(500);
    await page.keyboard.press('Escape');
    await motion(page);
    assert.equal(await shell(page, 'mode'), restingMode);
    assert.equal(await page.evaluate(() => document.documentElement.style.overflow), '');
    assert(Math.abs(await page.evaluate(() => scrollY) - y) < 2, 'Menu must keep the reading position');
    if (record) {
      await page.locator('[data-mobile-mode="menu"]').tap();
      await page.waitForTimeout(800);
      await page.locator('.mobile-shell__menu-close').tap();
      await page.waitForTimeout(600);
    }
    result.menuInterruptedAt = Math.round(midOpen);
    await close();
  }
  // 3. Sheet gestures: first preview rises, drag during an unfinished transition, release settles.
  {
    const { page, touch, close } = await open(width, height, { video: width === 390 ? 'sheet-gestures' : null });
    const rise = await sampleTops(page, '.mobile-shell__sheet', 420, `document.querySelector('#artist-intro').scrollIntoView({ block: 'start' }); scrollBy(0, -Math.min(160, innerHeight * .25))`);
    await motion(page);
    assert.equal(await shell(page, 'snap'), 'preview');
    assert(rise[0] >= height - 1 && monotonic(rise.slice(1), -1), 'Preview must rise from the bottom edge');
    if (record) await page.waitForTimeout(500);
    // Tap the title to expand, then grab the handle while it is still moving.
    // Late in the transition the sheet is slow enough for the CDP round trip to land on the 44px handle.
    await page.locator('.mobile-shell__title').evaluate(button => button.click());
    await page.waitForTimeout(150);
    const moving = await top(page, '.mobile-shell__sheet');
    assert(moving < height - 88 - 2 && moving > 48 + 2, `Sheet should be mid-expansion: ${moving}`);
    const grabY = moving + 16;
    await touch('touchStart', grabY);
    const path = [];
    for (let step = 1; step <= 10; step++) {
      await touch('touchMove', grabY + step * 12);
      // Chrome coalesces pointermove to the next frame; measure after it.
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => resolve())));
      path.push({ finger: grabY + step * 12, top: await top(page, '.mobile-shell__sheet') });
    }
    // After the 6px threshold the sheet follows the finger 1:1 from where it was picked up.
    const following = path.slice(1);
    const offsets = following.map(point => point.top - point.finger);
    assert(Math.max(...offsets) - Math.min(...offsets) < 1.5, `Drag must follow the finger directly: ${JSON.stringify(offsets)}`);
    assert(Math.abs(path[0].top - moving) < 40, `Picking up mid-transition must not jump: ${moving} → ${path[0].top}`);
    // Reverse direction without lifting: it reacts immediately.
    await touch('touchMove', grabY + 60);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => resolve())));
    const reversed = await top(page, '.mobile-shell__sheet');
    assert(reversed < path.at(-1).top, 'Reversing the gesture must move the sheet up immediately');
    await touch('touchMove', grabY - 200);
    await touch('touchEnd');
    const released = await top(page, '.mobile-shell__sheet');
    await page.waitForTimeout(40);
    assert(Math.abs(await top(page, '.mobile-shell__sheet') - released) < 60, 'Release must continue smoothly');
    await motion(page);
    assert.equal(await shell(page, 'snap'), 'expanded');
    assert(Math.abs(await top(page, '.mobile-shell__sheet') - 48) < 1);
    if (record) await page.waitForTimeout(500);
    // Two downward swipes: expanded → preview → hidden; no new stops.
    for (const expected of ['preview', 'hidden']) {
      const start = await top(page, '.mobile-shell__sheet') + 6;
      await touch('touchStart', start);
      for (let step = 1; step <= 8; step++) { await touch('touchMove', start + step * 30); await page.waitForTimeout(16); }
      await touch('touchEnd');
      await motion(page);
      assert.equal(await shell(page, 'snap'), expected);
      if (record) await page.waitForTimeout(500);
    }
    assert.equal(await page.locator('.mobile-shell__sheet').isVisible(), false);
    result.dragOffsetSpread = +(Math.max(...offsets) - Math.min(...offsets)).toFixed(2);
    await close();
  }
  // 4. Search from the expanded sheet: covers it, typing adds no animations, closing restores the sheet.
  {
    const { page, close } = await open(width, height, { video: width === 390 ? 'search-return' : null });
    await reachMaterial(page);
    await page.locator('.mobile-shell__title').click();
    await motion(page);
    const y = await page.evaluate(() => scrollY);
    if (record) await page.waitForTimeout(400);
    await page.locator('[data-mobile-mode="search"]').tap();
    assert.equal(await shell(page, 'sheet'), 'covered');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'mobile-article-query');
    await motion(page);
    for (const letter of 'мос') {
      await page.keyboard.type(letter);
      assert.equal(await page.evaluate(() => document.querySelector('.mobile-shell').getAnimations({ subtree: true }).length), 0, 'Results must not replay an entry animation per letter');
      if (record) await page.waitForTimeout(250);
    }
    await page.locator('[data-search-close]').tap();
    await motion(page);
    assert.equal(await shell(page, 'mode'), 'context');
    assert.equal(await shell(page, 'snap'), 'expanded');
    assert.equal(await page.locator('.mobile-shell__sheet').evaluate(element => getComputedStyle(element).opacity), '1');
    assert(Math.abs(await page.evaluate(() => scrollY) - y) < 2);
    if (record) await page.waitForTimeout(600);
    await close();
  }
  // 5. Fast scroll across several linked paragraphs: no queue of stale cards, highlight keeps line boxes.
  {
    const { page, close } = await open(width, height);
    await reachMaterial(page);
    const paragraph = page.locator('.story-context-source').first();
    const box = await paragraph.evaluate(element => element.getBoundingClientRect().height);
    await page.waitForTimeout(300);
    assert.equal(await paragraph.evaluate(element => element.getBoundingClientRect().height), box, 'Highlight must not change text size');
    assert.equal(await paragraph.locator('[data-context-text]').evaluate(element => getComputedStyle(element).transitionProperty), 'background-color');
    let maxLayers = 0;
    const total = await page.evaluate(() => document.documentElement.scrollHeight);
    for (const direction of [1, -1]) {
      for (let i = 0; i < 24; i++) {
        await page.evaluate(step => scrollBy(0, step), direction * Math.round(total / 40));
        await page.waitForTimeout(30);
        maxLayers = Math.max(maxLayers, await page.locator('.mobile-shell__outgoing').count());
      }
    }
    await page.waitForTimeout(500);
    await motion(page);
    assert(maxLayers <= 1, `Fast scrolling must retarget, not queue cards: ${maxLayers}`);
    assert.equal(await page.locator('.mobile-shell__outgoing').count(), 0);
    assert(await page.locator('.mobile-shell__content > *').count() <= 1);
    result.fastScrollMaxOutgoing = maxLayers;
    await close();
  }
  // 6. Hidden sheet: new material only shows the indicator and one turn, no visible page turns.
  {
    const { page, close } = await open(width, height);
    await reachMaterial(page);
    await page.keyboard.press('Escape');
    await motion(page);
    assert.equal(await shell(page, 'snap'), 'hidden');
    await page.evaluate(() => {
      window.__turns = 0;
      const original = Element.prototype.animate;
      Element.prototype.animate = function (...args) {
        if (this.closest('.mobile-fab--context')) window.__turns++;
        return original.apply(this, args);
      };
    });
    for (const id of ['verse-paragraph-2', 'spread-paragraph-2', 'reach-paragraph-1']) {
      await page.locator(`#${id}`).evaluate(element => scrollTo(0, scrollY + element.getBoundingClientRect().top - Math.min(160, innerHeight * .25)));
      await page.waitForTimeout(400);
      assert.equal(await page.evaluate(() => document.getAnimations().filter(animation => animation.effect?.target?.closest?.('.mobile-shell__pages')).length), 0, 'A hidden sheet must not page');
    }
    assert(await page.locator('.mobile-fab__unread').isVisible());
    assert.equal(await page.evaluate(() => window.__turns), 1, 'Only the first unread material turns the FAB');
    await page.locator('[data-mobile-mode="context"]').click();
    await motion(page);
    assert.equal(await page.locator('.mobile-fab__unread').count() && await page.locator('.mobile-fab__unread').isVisible(), false);
    // 7. Last links in a long card stay reachable next to the FABs.
    await page.locator('.mobile-shell__content').evaluate(element => { element.scrollTop = element.scrollHeight; });
    const reachable = await page.locator('.mobile-shell__content a').evaluateAll(links => links.filter(link => {
      const rect = link.getBoundingClientRect();
      if (!rect.width || rect.bottom > innerHeight || rect.top < 0) return false;
      const hit = document.elementFromPoint(rect.left + Math.min(8, rect.width / 2), rect.top + rect.height / 2);
      return link.contains(hit);
    }).length);
    const lastVisible = await page.locator('.mobile-shell__content a').evaluateAll(links => links.filter(link => link.getBoundingClientRect().width).length);
    assert.equal(reachable, Math.min(reachable, lastVisible));
    result.unreadTurns = 1;
    await close();
  }
  checks.push(result);
}

try {
  for (const [width, height] of [[390, 844], [320, 510], [760, 360]]) await checkPhone(width, height);
  // Reduced motion: no transitions or Web Animations while every state still works.
  {
    const { page, close } = await open(390, 844, { reducedMotion: 'reduce' });
    await reachMaterial(page);
    for (const action of [
      () => page.locator('[data-mobile-mode="search"]').tap(),
      () => page.locator('[data-search-close]').tap(),
      () => page.locator('.mobile-shell__title').click(),
      () => page.locator('[data-mobile-mode="menu"]').tap(),
      () => page.keyboard.press('Escape'),
      () => page.keyboard.press('Escape'),
      () => page.keyboard.press('Escape'),
    ]) {
      await action();
      assert.equal(await page.evaluate(() => document.querySelector('.mobile-shell').getAnimations({ subtree: true }).length), 0, 'Reduced motion must not animate');
    }
    assert.equal(await shell(page, 'snap'), 'hidden');
    await close();
    checks.push({ reducedMotion: 'no transitions or animations' });
  }
  // Whitelist dialog: rises with dimming, keyboard keeps the field visible, exit reverses.
  for (const [width, height] of [[390, 844], [320, 568]]) {
    const { page, close } = await open(width, height, { url: landingUrl, video: width === 390 ? 'whitelist-keyboard' : null });
    const panel = '#subscribe-modal [role="dialog"]';
    await page.locator('#intro-whitelist').tap();
    await page.waitForTimeout(90);
    const mid = await top(page, panel);
    const final = await page.locator(panel).evaluate(element => innerHeight - element.offsetHeight);
    assert(mid > final + 2, 'Dialog should be rising');
    await motion(page);
    assert.equal(await page.evaluate(() => document.activeElement.classList.contains('subscribe-modal__panel')), true, 'Opening must not raise the keyboard');
    if (record) await page.waitForTimeout(500);
    await page.locator('#subscribe-email').tap();
    await page.evaluate(obstruction => {
      Object.defineProperty(visualViewport, 'height', { configurable: true, get: () => innerHeight - obstruction });
      visualViewport.dispatchEvent(new Event('resize'));
    }, Math.min(320, height * .5));
    // Focus styles may fade; the dialog itself must not move against the native keyboard resize.
    const moving = await page.evaluate(() => document.getAnimations().filter(animation => animation.effect?.target?.matches?.('.subscribe-modal, .subscribe-modal__panel, .subscribe-modal__backdrop')).map(animation => animation.transitionProperty || animation.animationName));
    assert.deepEqual(moving, [], 'Keyboard resizing must not add motion');
    const fit = await page.evaluate(() => {
      const bottom = visualViewport.height;
      return ['#subscribe-email', '#subscribe-form [type="submit"]'].every(selector => document.querySelector(selector).getBoundingClientRect().bottom <= bottom + 1);
    });
    assert(fit, 'Field and submit stay above the keyboard');
    if (record) await page.waitForTimeout(700);
    await page.evaluate(() => { delete visualViewport.height; visualViewport.dispatchEvent(new Event('resize')); });
    await page.locator('#subscribe-close').tap();
    assert.equal(await page.locator('#subscribe-modal').evaluate(element => element.inert), true);
    // Reopen during the exit: it reverses and resets scroll and input mode.
    await page.waitForTimeout(80);
    await page.locator('#intro-whitelist').evaluate(button => button.click());
    await motion(page);
    assert.equal(await page.locator('#subscribe-modal').evaluate(element => !element.hidden && !element.inert && !element.classList.contains('is-entering-email')), true);
    assert.equal(await page.locator(panel).evaluate(element => element.scrollTop), 0);
    assert(Math.abs(await top(page, panel) - final) < 1);
    if (record) await page.waitForTimeout(400);
    await page.locator('#subscribe-close').tap();
    await motion(page);
    await page.waitForFunction(() => document.querySelector('#subscribe-modal').hidden);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'intro-whitelist');
    if (record) await page.waitForTimeout(400);
    await close();
    checks.push({ whitelist: `${width}x${height}`, keyboardFit: fit });
  }
  // Desktop boundary and a regular desktop keep the shell off.
  for (const width of [761, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(articleUrl);
    await page.locator('.mobile-shell').waitFor({ state: 'attached' });
    assert.equal(await page.locator('.mobile-shell').isVisible(), false);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
    await page.close();
    checks.push({ desktop: width, mobileShell: 'hidden' });
  }
  assert.deepEqual(errors, []);
  const result = { browser: 'Chromium, CDP touch input', recorded: record, checks, errors };
  await writeFile(new URL('validation.json', output), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
