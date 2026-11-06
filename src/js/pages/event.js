import '../common.js';
import { getEvent } from '../api/events.js';
import { escape, formatDate, loadingMarkup, stateMarkup, tagsMarkup } from '../ui/render.js';

const root = document.querySelector('[data-event-detail]');
const crumb = document.querySelector('[data-event-crumb]');
const id = new URLSearchParams(location.search).get('id');

function render(event) {
  document.title = `${event.title} — chinatown.site`;
  document.querySelector('meta[name="description"]')?.setAttribute('content', event.description || `${event.title} на Китай-городе`);
  crumb.textContent = event.title;
  root.innerHTML = `
    <h1 class="event__title">${escape(event.title)}</h1>
    <aside class="event__aside">
      <dl class="event__meta">
        <dt>когда</dt><dd><time ${event.date ? `datetime="${event.date.toISOString()}"` : ''}>${formatDate(event.date)}</time></dd>
        <dt>где</dt><dd>${escape(event.place || 'место уточняется')}</dd>
      </dl>
      ${tagsMarkup(event.tags)}
    </aside>
    <p class="event__description">${escape(event.description)}</p>
    <p><a class="button button--ghost" href="./events.html">ВСЕ СОБЫТИЯ</a></p>`;
}

async function load() {
  if (!id) {
    root.innerHTML = stateMarkup('не указано, какое событие открыть.');
    return;
  }
  root.setAttribute('aria-busy', 'true');
  root.innerHTML = loadingMarkup(1);
  try {
    const event = await getEvent(id);
    if (event) render(event);
    else root.innerHTML = stateMarkup('такого события нет — может, оно уже прошло.');
  } catch (error) {
    console.error(error);
    root.innerHTML = stateMarkup('не получилось загрузить событие.', { error: true, retry: true });
    root.querySelector('[data-retry]')?.addEventListener('click', load);
  } finally {
    root.removeAttribute('aria-busy');
  }
}

load();
