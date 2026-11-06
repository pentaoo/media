import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

const videoRoot = new URL('../assets/video/editorial/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', videoRoot), 'utf8'));
const recipes = JSON.parse(await readFile(new URL('../config/video-cuts.json', import.meta.url), 'utf8')).clips;

function atoms(buffer, start = 0, end = buffer.length) {
  const result = [];
  for (let offset = start; offset + 8 <= end;) {
    const size = buffer.readUInt32BE(offset);
    assert(size >= 8 && offset + size <= end, 'MP4 atom must be complete');
    result.push({ type: buffer.toString('ascii', offset + 4, offset + 8), start: offset + 8, end: offset + size });
    offset += size;
  }
  return result;
}

test('every recipe has published posters and correctly sized exports with portable URLs', async () => {
  assert.deepEqual(manifest.clips.map(clip => clip.id), recipes.map(recipe => recipe.id));
  for (const clip of manifest.clips) {
    for (const path of [clip.poster, clip.articlePoster, clip.article, clip.rail.small, clip.rail.large]) {
      const url = new URL(path, videoRoot);
      assert(url.href.startsWith(videoRoot.href) && !path.includes('video-originals'));
      assert((await stat(url)).size > 0);
    }
    assert.equal(clip.rail.small, clip.exports['rail-small'].src);
    assert.equal(clip.rail.large, clip.exports['rail-large'].src);
    assert.equal(clip.article, clip.exports.article.src);
    const recipe = recipes.find(item => item.id === clip.id);
    assert.equal(clip.railEnabled !== false, recipe.railEnabled !== false);
    if (recipe.articleAudio === false) assert.equal(clip.exports.article.hasAudio, false);
    assert(clip.exports['rail-small'].width <= 360 && clip.exports['rail-small'].height <= 640);
    assert(clip.exports['rail-large'].width <= 720 && clip.exports['rail-large'].height <= 1280);
    assert(Math.max(clip.exports.article.width, clip.exports.article.height) <= 1280);
  }
});

test('actual MP4 files start progressively, contain the intended audio tracks and match cut durations', async () => {
  for (const clip of manifest.clips) {
    const recipe = recipes.find(item => item.id === clip.id);
    for (const [name, exported] of Object.entries(clip.exports)) {
      const data = await readFile(new URL(exported.src, videoRoot));
      assert.equal(data.length, exported.bytes, `${clip.id}/${name}: manifest size is stale`);
      const top = atoms(data);
      const moov = top.find(atom => atom.type === 'moov');
      const mdat = top.find(atom => atom.type === 'mdat');
      assert(moov && mdat && moov.start < mdat.start, `${clip.id}/${name}: faststart missing`);
      const children = atoms(data, moov.start, moov.end);
      const header = children.find(atom => atom.type === 'mvhd');
      const version = data[header.start];
      const timescale = data.readUInt32BE(header.start + (version === 1 ? 20 : 12));
      const ticks = version === 1 ? Number(data.readBigUInt64BE(header.start + 24)) : data.readUInt32BE(header.start + 16);
      const duration = ticks / timescale;
      const expected = name.startsWith('rail') ? Math.min(recipe.duration, 20) : recipe.duration;
      assert(Math.abs(duration - expected) < .15, `${clip.id}/${name}: incorrect cut duration`);
      const handlers = children.filter(atom => atom.type === 'trak').flatMap(track => {
        const media = atoms(data, track.start, track.end).find(atom => atom.type === 'mdia');
        const handler = atoms(data, media.start, media.end).find(atom => atom.type === 'hdlr');
        return data.toString('ascii', handler.start + 8, handler.start + 12);
      });
      assert(handlers.includes('vide'));
      assert.equal(handlers.includes('soun'), exported.hasAudio, `${clip.id}/${name}: audio differs from manifest`);
      if (name.startsWith('rail')) assert(!handlers.includes('soun'), 'Ambient video must be silent');
    }
  }
});
