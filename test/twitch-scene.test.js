import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseInitialChannel, playbackMode, prepareChannels, twitchParent } from '../src/twitch-scene.js';

const rawChannels = [
  { name: 'Проверенный канал А', login: 'channel_a', description: 'Описание', tags: ['Китай-город'], priority: 2, recordingId: '12345', recordingTitle: 'Запись А', recordingCheckedAt: '2026-09-24' },
  { name: 'Проверенный канал Б', login: 'channel_b', priority: 10, recordingId: '' },
];

test('keeps only valid approved channels and orders them by editorial priority', () => {
  const channels = prepareChannels([
    ...rawChannels,
    { name: 'Повтор', login: 'CHANNEL_A', priority: 99 },
    { name: 'Плохой адрес', login: 'not/a/login', priority: 100 },
  ]);
  assert.deepEqual(channels.map((channel) => channel.login), ['channel_b', 'channel_a']);
  assert.equal(channels[1].recordingId, '12345');
  assert.equal(channels[1].recordingTitle, 'Запись А');
  assert.equal(channels[1].recordingCheckedAt, '2026-09-24');
  assert.deepEqual(channels[1].tags, ['Китай-город']);
});

test('uses only confirmed live status for live selection', () => {
  const channels = prepareChannels(rawChannels);
  assert.equal(chooseInitialChannel(channels, {}).login, 'channel_b');
  assert.equal(chooseInitialChannel(channels, { channel_a: 'live' }).login, 'channel_a');
  assert.equal(playbackMode(undefined, '12345'), 'channel');
  assert.equal(playbackMode(undefined, '12345', true), 'recording');
  assert.equal(playbackMode(undefined, '', true), 'empty');
  assert.equal(playbackMode('live', '12345'), 'channel');
});

test('offline switches to a recording or an empty state', () => {
  assert.equal(playbackMode('offline', '12345'), 'recording');
  assert.equal(playbackMode('offline', ''), 'empty');
});

test('embed parent is the page hostname and requires HTTPS outside local development', () => {
  assert.equal(twitchParent(new URL('https://media.example:8443/')), 'media.example');
  assert.equal(twitchParent(new URL('http://localhost:4173/')), 'localhost');
  assert.equal(twitchParent(new URL('http://media.example/')), null);
  assert.equal(twitchParent(new URL('file:///tmp/index.html')), null);
});
