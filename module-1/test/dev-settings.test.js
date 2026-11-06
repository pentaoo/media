import test from 'node:test';
import assert from 'node:assert/strict';
import { devToolsEnabled, loadGridSettings, normalizeGridSettings } from '../src/dev-settings.js';

test('DEV tools require a local host or explicit URL flag; dev=0 disables them', () => {
  for (const host of ['localhost', '127.0.0.1', '[::1]']) assert.equal(devToolsEnabled(new URL(`http://${host}:4173/`)), true);
  assert.equal(devToolsEnabled(new URL('https://chinatown.site/article.html')), false);
  for (const flag of ['dev=1', 'light-editor=1']) assert.equal(devToolsEnabled(new URL(`https://chinatown.site/article.html?${flag}`)), true);
  assert.equal(devToolsEnabled(new URL('http://localhost:4173/?dev=0&light-editor=1')), false);
});

test('responsive grid profiles stay independent and unsafe stored values are ignored', () => {
  const settings = normalizeGridSettings({ visible: true, profiles: {
    'article-desktop': { margin: 64, gap: 40 },
    'article-mobile': { margin: 24, gap: Infinity },
    'landing-desktop': { margin: 'url(bad)', gap: -20 },
    'landing-mobile': { margin: 9000, gap: 14.6 },
  } });
  assert.deepEqual(settings.profiles['article-desktop'], { margin: 64, gap: 40 });
  assert.deepEqual(settings.profiles['article-mobile'], { margin: 24, gap: null });
  assert.deepEqual(settings.profiles['landing-desktop'], { margin: null, gap: 0 });
  assert.deepEqual(settings.profiles['landing-mobile'], { margin: 160, gap: 15 });
  assert.deepEqual(normalizeGridSettings(JSON.parse(JSON.stringify(settings))), settings);
});

test('blocked or corrupt storage preserves the responsive CSS defaults', () => {
  const defaults = normalizeGridSettings();
  assert.deepEqual(loadGridSettings({ getItem() { throw new Error('blocked'); } }), defaults);
  for (const value of ['{broken', 'null', '[]']) assert.deepEqual(loadGridSettings({ getItem: () => value }), defaults);
});
