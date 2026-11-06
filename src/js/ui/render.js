// Разметка карточек и состояний. Весь пользовательский текст экранируется.

const escape = (value) =>
  String(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

const dateFormat = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' });

export const formatDate = (date) => (date ? dateFormat.format(date) : 'дата уточняется');

export const tagsMarkup = (tags) =>
  tags.length ? `<ul class="tag-list">${tags.map((tag) => `<li class="tag">${escape(tag)}</li>`).join('')}</ul>` : '';

export function eventCardMarkup(event) {
  return `
    <article class="event-card">
      <time class="event-card__date" ${event.date ? `datetime="${event.date.toISOString()}"` : ''}>${formatDate(event.date)}</time>
      <h3 class="event-card__title">
        <a class="event-card__link" href="./event.html?id=${encodeURIComponent(event.id)}">${escape(event.title)}</a>
      </h3>
      ${tagsMarkup(event.tags)}
      <p class="event-card__place">${escape(event.place)}</p>
    </article>`;
}

export function loadingMarkup(count = 3) {
  return Array.from({ length: count }, () => '<div class="skeleton" aria-hidden="true"></div>').join('') +
    '<p class="visually-hidden">загружаем события…</p>';
}

export function stateMarkup(text, { error = false, retry = false } = {}) {
  return `
    <div class="state${error ? ' state--error' : ''}" role="${error ? 'alert' : 'status'}">
      <p>${escape(text)}</p>
      ${retry ? '<button class="button button--ghost state__action" type="button" data-retry>ПОПРОБОВАТЬ СНОВА</button>' : ''}
    </div>`;
}

export { escape };
