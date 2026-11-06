// Optional Playwright regression; ANDROID_CDP_URL uses an already open Android tab.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const native = !!process.env.ANDROID_CDP_URL;
const browser = native ? await chromium.connectOverCDP(process.env.ANDROID_CDP_URL)
  : await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
const url = new URL('index.html?dev=0', process.env.MEDIA_TEST_URL || 'http://localhost:4182/').href;
const output = new URL('../deliverables/subscribe-dialog/', import.meta.url);
await mkdir(output, { recursive: true });
const checks = [];
const errors = [];

async function geometry(panel) {
  return panel.evaluate(element => {
    const field = document.querySelector('#subscribe-email').getBoundingClientRect();
    const submit = document.querySelector('#subscribe-form [type="submit"]').getBoundingClientRect();
    return { top: element.getBoundingClientRect().top, bottom: element.getBoundingClientRect().bottom,
      fieldTop: field.top, fieldBottom: field.bottom, submitBottom: submit.bottom,
      visualTop: visualViewport?.offsetTop || 0, visualBottom: (visualViewport?.offsetTop || 0) + (visualViewport?.height || innerHeight),
      scrollTop: element.scrollTop, height: innerHeight, visualHeight: visualViewport?.height || innerHeight };
  });
}

async function check(page, width, height) {
  const phone = width <= 760;
  page.on('pageerror', error => errors.push(error.message));
  if (!native) await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => document.fonts.ready);
  await page.locator('#intro-whitelist .action-button__content').waitFor();
  const modal = page.locator('#subscribe-modal');
  const panel = modal.locator('[role="dialog"]');
  const input = page.locator('#subscribe-email');
  const submit = page.locator('#subscribe-form [type="submit"]');
  const open = page.locator('#intro-whitelist');
  if (phone) {
    const placement = await open.evaluate(button => {
      const rect = button.getBoundingClientRect();
      const content = document.querySelector('#intro-content');
      const container = content.getBoundingClientRect();
      const style = getComputedStyle(content);
      return { left: rect.left - container.left, right: container.right - rect.right,
        leftGutter: parseFloat(style.paddingLeft), rightGutter: parseFloat(style.paddingRight) };
    });
    assert(Math.abs(placement.left - placement.leftGutter) < 1 && Math.abs(placement.right - placement.rightGutter) < 1,
      `Whitelist CTA must align with both page gutters: ${JSON.stringify(placement)}`);
  }
  if (native && await modal.isVisible()) await page.locator('#subscribe-close').click();
  await open.click();
  await page.waitForTimeout(400);
  assert.equal(await modal.evaluate(element => element.hidden), false);
  assert.equal(await page.locator('#intro').evaluate(element => element.inert), true);
  assert.equal(await page.evaluate(() => document.activeElement.id || document.activeElement.className), phone ? 'subscribe-modal__panel' : 'subscribe-email');
  const reading = await geometry(panel);
  if (phone) {
    assert.equal(await modal.evaluate(element => element.classList.contains('is-entering-email')), false);
    assert.equal(reading.scrollTop, 0);
    assert(reading.top >= -1 && reading.bottom <= reading.visualBottom + 1);
    if (native) {
      const ime = execFileSync('adb', ['shell', 'dumpsys', 'input_method'], { encoding: 'utf8' });
      assert(!/mInputShown=true/.test(ime), 'Opening the dialog must leave the Android keyboard closed');
      await writeFile(new URL('android-read.png', output), execFileSync('adb', ['exec-out', 'screencap', '-p']));
    } else if (width === 390) await page.screenshot({ path: fileURLToPath(new URL('mobile-read.png', output)) });
  }
  // Both CTA instances retain the shared component's centering and available width.
  for (const button of [open, submit]) {
    const state = await button.evaluate(button => {
      const box = button.getBoundingClientRect();
      const content = button.querySelector('.action-button__content').getBoundingClientRect();
      return { center: (content.left + content.right - box.left - box.right) / 2, fits: content.width <= box.width + 1 };
    });
    assert(Math.abs(state.center) < 1 && state.fits);
  }
  if (phone) {
    if (native) {
      const box = await input.boundingBox();
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await cdp.detach();
      await page.waitForFunction(fullHeight => visualViewport.height < fullHeight * .8, reading.visualHeight, { timeout: 5000 });
      await page.waitForTimeout(500);
      await writeFile(new URL('android-input.png', output), execFileSync('adb', ['exec-out', 'screencap', '-p']));
    } else {
      await input.tap();
      await page.evaluate(obstruction => {
        Object.defineProperty(visualViewport, 'height', { configurable: true, get: () => innerHeight - obstruction });
        visualViewport.dispatchEvent(new Event('resize'));
      }, Math.min(320, height * .5));
      await page.waitForTimeout(100);
    }
  }
  const entering = await geometry(panel);
  if (phone) {
    assert.equal(await modal.evaluate(element => element.classList.contains('is-entering-email')), true);
    assert(entering.fieldTop >= entering.visualTop - 1);
    assert(entering.fieldBottom <= entering.visualBottom + 1 && entering.submitBottom <= entering.visualBottom + 1, JSON.stringify(entering));
    if (!native && width === 390) await page.screenshot({ path: fileURLToPath(new URL('mobile-input.png', output)) });
  }
  await input.fill('not-an-email');
  await submit.click();
  assert.equal(await input.getAttribute('aria-invalid'), 'true');
  assert.match(await page.locator('#subscribe-status').textContent(), /корректный адрес/);
  let posted = false;
  await page.route('https://formspree.io/f/mockwhitelist', route => {
    assert.match(route.request().postData(), /reader@example\.com/);
    posted = true;
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.locator('#subscribe-form').evaluate(form => { form.action = 'https://formspree.io/f/mockwhitelist'; });
  await input.fill('reader@example.com');
  await submit.click();
  await page.waitForFunction(() => document.querySelector('#subscribe-status').textContent.includes('Заявка отправлена'));
  assert(posted, 'The form should submit after entering an address');
  if (!native) await page.evaluate(() => { delete visualViewport.height; visualViewport.dispatchEvent(new Event('resize')); });
  await page.locator('#subscribe-close').click();
  assert.equal(await page.locator('#intro').evaluate(element => element.inert), false);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'intro-whitelist');
  await open.click();
  await page.waitForTimeout(400);
  assert.equal(await panel.evaluate(element => element.scrollTop), 0);
  if (phone) {
    assert.equal(await panel.evaluate(element => document.activeElement === element), true);
    assert.equal(await modal.evaluate(element => element.classList.contains('is-entering-email')), false);
  }
  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'subscribe-close');
  await page.keyboard.press('Escape');
  // The dialog leaves input at once and hides after its exit transition.
  assert.equal(await modal.evaluate(element => element.inert), true);
  await page.waitForFunction(() => document.querySelector('#subscribe-modal').hidden, null, { timeout: 2000 });
  checks.push({ width, height, reading, entering, submission: 'mocked success', reopensWithoutInputFocus: phone });
}

try {
  if (native) {
    const context = browser.contexts()[0];
    const page = context.pages().find(page => page.url().includes('index.html')) || context.pages()[0];
    await page.waitForLoadState('domcontentloaded');
    const size = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
    await check(page, size.width, size.height);
  } else {
    for (const [width, height] of [[320, 568], [390, 844], [760, 360], [761, 900], [1440, 900]]) {
      const context = await browser.newContext({ viewport: { width, height }, isMobile: width <= 760, hasTouch: width <= 760 });
      const page = await context.newPage();
      await check(page, width, height);
      await context.close();
    }
  }
  assert.deepEqual(errors, []);
  await writeFile(new URL(native ? 'android-validation.json' : 'validation.json', output), JSON.stringify({ checks, errors }, null, 2));
  console.log(JSON.stringify({ profiles: checks.length, nativeAndroidKeyboard: native, checks, errors }, null, 2));
} finally {
  await browser.close();
}
