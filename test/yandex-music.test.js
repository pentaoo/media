import test from 'node:test';
import assert from 'node:assert/strict';
import { parseYandexMusicUrl, toYandexMusicIframeUrl } from '../src/yandex-music.js';

test('converts a track link to the official iframe path', () => {
  assert.deepEqual(parseYandexMusicUrl('https://music.yandex.ru/album/43927743/track/155697229'), {
    type: 'track',
    sourceUrl: 'https://music.yandex.ru/album/43927743/track/155697229',
    iframeUrl: 'https://music.yandex.ru/iframe/album/43927743/track/155697229',
  });
});

test('converts an album link to the official iframe path', () => {
  assert.equal(
    toYandexMusicIframeUrl('https://music.yandex.ru/album/43927743/'),
    'https://music.yandex.ru/iframe/album/43927743',
  );
});

test('rejects unsafe and unsupported URLs', () => {
  for (const value of [
    null,
    'http://music.yandex.ru/album/43927743',
    'https://music.yandex.ru.evil.test/album/43927743',
    'https://evil.test/album/43927743',
    'https://user:pass@music.yandex.ru/album/43927743',
    'https://music.yandex.ru/album/43927743?sid=rzt',
    'https://music.yandex.ru/album/43927743#track',
    'https://music.yandex.ru/iframe/album/43927743',
    'https://music.yandex.ru/album/abc',
    'https://music.yandex.ru/album/0',
    'https://music.yandex.ru/album/43927743/track/',
    'https://music.yandex.ru/album/1/../album/43927743',
    'https://music.yandex.ru/artist/1',
    'javascript:alert(1)',
  ]) {
    assert.equal(toYandexMusicIframeUrl(value), null, String(value));
  }
});
