// The same markup is used by static articles and client-side navigation.
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const types = { artist: 'артист', album: 'альбом', track: 'трек' };

export function entityReferenceView(material, label = material.title) {
  const type = types[material.entity?.type];
  if (!type) throw new TypeError('An entity reference needs an artist, album or track material');
  return `<a class="story-entity" href="#${escape(material.id)}" data-context-ref="${escape(material.id)}" data-entity-type="${material.entity.type}" aria-label="${escape(label)} — ${type.toLowerCase()}, открыть карточку">${escape(label)}</a>`;
}

/** External quotations need attribution; pullquotes reuse the article's own text. */
export function editorialQuoteView({ text, author, source, pullquote = false }) {
  const href = /^https?:\/\//i.test(source?.href || '') ? escape(source.href) : '';
  if (!pullquote && (!author || !href || !source.label)) throw new TypeError('A quotation needs an author and a source URL');
  return `<figure class="editorial-quote${pullquote ? ' editorial-quote--pull' : ''}">
    <blockquote${href ? ` cite="${href}"` : ''}><p>${escape(text)}</p></blockquote>
    ${pullquote ? '' : `<figcaption><span class="editorial-quote__author">${escape(author)}</span><cite><a href="${href}">${escape(source.label)}</a></cite></figcaption>`}
  </figure>`;
}
