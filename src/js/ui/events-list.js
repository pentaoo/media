import { getEvents } from '../api/events.js';
import { eventCardMarkup, loadingMarkup, stateMarkup } from './render.js';

// Подключает список мероприятий к контейнеру [data-events-list].
// data-limit ограничивает количество карточек (на главной — три ближайших).
export function mountEventsList(root) {
  if (!root) return;
  const limit = Number(root.dataset.limit) || Infinity;

  async function load() {
    root.setAttribute('aria-busy', 'true');
    root.innerHTML = loadingMarkup(Math.min(limit, 3));
    try {
      const events = (await getEvents()).slice(0, limit);
      root.innerHTML = events.length ? events.map(eventCardMarkup).join('') : stateMarkup('событий пока нет — загляни позже.');
    } catch (error) {
      console.error(error);
      root.innerHTML = stateMarkup('не получилось загрузить события. проверь интернет и попробуй ещё раз.', { error: true, retry: true });
      root.querySelector('[data-retry]')?.addEventListener('click', load);
    } finally {
      root.removeAttribute('aria-busy');
    }
  }

  load();
}
