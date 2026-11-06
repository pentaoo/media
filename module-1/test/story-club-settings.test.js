import test from 'node:test';
import assert from 'node:assert/strict';
import { CLUB_STORAGE_KEY, clubDefaults, normalizeClubSettings, clubVariables, loadClubSettings, exportClubDesign, exportClubCSS, parseClubDesign } from '../src/story-club-settings.js';

test('a tuned design survives JSON export and import with precise colors, units and timing', () => {
  const tuned = { ...clubDefaults, color: '#22aaff', width: 62, maxWidth: 1200, beamSpeed: 2, pulseDuration: 7.3, greenEnabled: false };
  const design = exportClubDesign(tuned);
  assert.deepEqual(parseClubDesign(JSON.stringify(design)), tuned);
  assert.equal(design.design.blendMode, 'SCREEN');
  assert.equal(design.design.units.width, 'vw');
  assert.equal(design.design.motion.pinkBeamSeconds, 4.7);
  assert.equal(design.cssVariables['--club-green-display'], 'none');
  assert.match(exportClubCSS(tuned), /--club-color: 34, 170, 255;/);
  assert.match(exportClubCSS(tuned), /--club-max-width: 1200px;/);
});

test('import accepts the editor schema and rejects unrelated or unsupported files', () => {
  for (const data of ['null', '{}', '[]', '{"settings":{}}', JSON.stringify({ ...exportClubDesign(clubDefaults), version: 2 })]) assert.throws(() => parseClubDesign(data));
  assert.throws(() => parseClubDesign('not json'));
});

test('untrusted settings cannot inject CSS, add properties, or create invalid durations', () => {
  const result = normalizeClubSettings({ color: 'red; background:url(bad)', brightness: Infinity, width: -100, beamSpeed: 0, greenEnabled: 'false', beamAngle: NaN, unknown: 'bad' });
  assert.equal(result.color, clubDefaults.color);
  assert.equal(result.brightness, clubDefaults.brightness);
  assert.equal(result.width, 10);
  assert.equal(result.beamSpeed, .25);
  assert.equal(result.greenEnabled, true);
  assert.equal(result.beamAngle, 0);
  assert.equal('unknown' in result, false);
  assert(!Object.values(clubVariables(result)).some(value => /NaN|Infinity|url\(/.test(String(value))));
});

test('corrupt or blocked storage restores defaults; valid saved settings are restored', () => {
  assert.deepEqual(loadClubSettings({ getItem: () => '{broken' }), clubDefaults);
  assert.deepEqual(loadClubSettings({ getItem() { throw new Error('Storage blocked'); } }), clubDefaults);
  assert.deepEqual(loadClubSettings({ getItem: () => null }), clubDefaults);
  const saved = loadClubSettings({ getItem(key) { assert.equal(key, CLUB_STORAGE_KEY); return JSON.stringify({ mobileWidth: 148, color: '#AABBCC' }); } });
  assert.equal(saved.mobileWidth, 148);
  assert.equal(saved.color, '#aabbcc');
});
