import test from 'node:test';
import assert from 'node:assert/strict';
import { entityReferenceView, editorialQuoteView } from '../src/components/editorial-typography.js';
import { articleView } from '../src/article-view.js';
import { madk1dContext } from '../src/article-context-data.js';

test('all three entity references resolve to one canonical material and an accessible fallback', () => {
  const html = articleView();
  for (const type of ['artist', 'album', 'track']) {
    const material = madk1dContext.materials.find(item => item.entity?.type === type);
    assert(material);
    const reference = entityReferenceView(material);
    assert(reference.includes(`href="#${material.id}"`));
    assert(reference.includes('открыть карточку'));
    assert.equal(html.split(`data-context-material="${material.id}"`).length - 1, 1);
    assert(html.includes(`id="${material.id}-title"`));
  }
  assert(!html.includes('<li>'), 'the article body uses prose instead of an editorial list');
});

test('quotes require real attribution, while a pullquote needs no caption', () => {
  assert.throws(() => editorialQuoteView({ text: 'Unattributed words' }), TypeError);
  assert.throws(() => editorialQuoteView({ text: 'Words', author: 'Person', source: { label: 'Interview', href: 'javascript:alert(1)' } }), TypeError);
  const quote = editorialQuoteView({ text: '<Words>', author: '<Person>', source: { label: 'Interview', href: 'https://example.com/?a=1&b=2' } });
  assert(quote.includes('&lt;Words&gt;') && quote.includes('&lt;Person&gt;'));
  assert(quote.includes('cite="https://example.com/?a=1&amp;b=2"'));
  const pullquote = editorialQuoteView({ text: 'Editorial analysis', pullquote: true });
  assert(!pullquote.includes('<figcaption>'));
  assert(!pullquote.includes('<cite>'));
});

test('entity labels are escaped without losing the original artist casing', () => {
  const reference = entityReferenceView({ id: 'artist', title: 'madk1d <script>', entity: { type: 'artist' } });
  assert(reference.includes('madk1d &lt;script&gt;'));
  assert(!reference.includes('<script>'));
  assert.throws(() => entityReferenceView({ id: 'unknown', title: 'Unknown' }), TypeError);
});
