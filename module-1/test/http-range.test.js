import test from 'node:test';
import assert from 'node:assert/strict';
import { parseByteRange } from '../scripts/http-range.mjs';

test('media requests support start, open-ended and suffix byte ranges', () => {
  assert.equal(parseByteRange(undefined, 100), null);
  assert.deepEqual(parseByteRange('bytes=0-0', 100), { start: 0, end: 0 });
  assert.deepEqual(parseByteRange('bytes=20-', 100), { start: 20, end: 99 });
  assert.deepEqual(parseByteRange('bytes=-10', 100), { start: 90, end: 99 });
  assert.deepEqual(parseByteRange('bytes=90-200', 100), { start: 90, end: 99 });
});

test('invalid ranges cannot produce a negative or out-of-file stream', () => {
  for (const range of ['bytes=100-', 'bytes=80-10', 'bytes=-0', 'bytes=-', 'bytes=0-1,5-8', 'items=0-1', 'bytes=999999999999999999999999-']) {
    assert.equal(parseByteRange(range, 100), false, range);
  }
  assert.equal(parseByteRange('bytes=0-', 0), false);
});
