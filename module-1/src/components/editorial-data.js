// Editorial data keeps its scope and source beside the value, in every placement.
const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);
export function editorialDataView({ id, type = 'timeline', title, scope, caption, sources, points, value, label }) {
  if (!['timeline', 'fact'].includes(type)) throw new TypeError('Unknown editorial data type');
  if (!id || !title || !scope || !sources?.length || sources.some(source => !source.label || !/^https?:\/\//.test(source.href))) throw new TypeError('Editorial data needs a title, scope and sources');
  if (type === 'timeline' && (!points?.length || points.some(point => !point.date || !point.label))) throw new TypeError('A timeline needs dated, labelled points');
  if (type === 'fact' && (!value || !label)) throw new TypeError('A fact needs a value and an explanation');
  return `<figure class="editorial-data editorial-data--${type}" aria-labelledby="${escape(id)}-title">
    <h3 id="${escape(id)}-title">${escape(title)}</h3>
    <p class="editorial-data__scope">${escape(scope)}</p>
    ${type === 'timeline' ? `<ol class="editorial-data__points">${points.map(point => `<li class="editorial-data__point"><time${point.datetime ? ` datetime="${escape(point.datetime)}"` : ''}>${escape(point.date)}</time><strong>${escape(point.label)}</strong>${point.description ? `<p>${escape(point.description)}</p>` : ''}</li>`).join('')}</ol>` : `<p class="editorial-data__value">${escape(value)}</p><p class="editorial-data__label">${escape(label)}</p>`}
    <figcaption>${caption ? `${escape(caption)} ` : ''}<span class="editorial-data__sources">${sources.map(source => `<a href="${escape(source.href)}">${escape(source.label)}</a>`).join(' · ')}</span></figcaption>
  </figure>`;
}
