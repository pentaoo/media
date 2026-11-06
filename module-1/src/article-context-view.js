import { burstLinkMarkup, tagMarkup } from './components/tag.js';

// Trusted editorial data is escaped here, including URLs and attributes.
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const safeUrl = value => /^(https?:\/\/|\.\.?\/|#)/i.test(value || '') ? escape(value) : '';
const entityTypes = { artist: 'Артист', album: 'Альбом', track: 'Трек' };

export function contextMaterialView(material) {
  const { id, title, paragraphs, image, sources, backTo, kind, entity, listen } = material;
  return `<aside class="article-context-material${entity ? ` entity-card entity-card--${escape(entity.type)}` : ''}" id="${escape(id)}" data-context-material="${escape(id)}" tabindex="-1"${kind === 'footnote' ? ' role="doc-footnote"' : ''}${title ? ` aria-labelledby="${escape(id)}-title"` : ' aria-label="Пояснение к тексту"'}>
    ${title ? `<h2 id="${escape(id)}-title">${escape(title)}</h2>` : ''}
    ${entity && entityTypes[entity.type] ? `<p class="entity-card__type">${tagMarkup(entityTypes[entity.type])}</p>` : ''}
    ${image ? `<figure${listen ? ' class="entity-card__cover"' : ''}><img src="${safeUrl(image.src)}" alt="${escape(image.alt)}" width="${image.width}" height="${image.height}" loading="lazy">${image.credit ? `<figcaption>${escape(image.credit)}</figcaption>` : ''}${listen && safeUrl(listen.href) ? burstLinkMarkup(listen) : ''}</figure>` : ''}
    ${entity?.subtitle ? `<p class="entity-card__subtitle">${escape(entity.subtitle)}</p>` : ''}
    ${entity?.details?.length ? `<dl class="entity-card__details">${entity.details.map(item => `<div><dt>${escape(item.label)}</dt><dd>${escape(item.value)}</dd></div>`).join('')}</dl>` : ''}
    ${paragraphs.map(text => `<p>${escape(text)}</p>`).join('')}
    ${sources?.length ? `<p class="article-context-sources">${sources.map(source => `<a href="${safeUrl(source.href)}">${escape(source.label)}</a>`).join('')}</p>` : ''}
    ${backTo ? `<a class="article-context-backlink" href="#${escape(backTo)}" role="doc-backlink">к тексту ↑</a>` : ''}
  </aside>`;
}

export function contextEntryView(material) {
  return `<p class="article-context-entry"><span data-context-text><a href="#${escape(material.id)}" data-context-ref="${escape(material.id)}">${escape(material.title)}</a></span></p>`;
}
