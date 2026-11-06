import { applyClubSettings, loadClubSettings } from './story-club-settings.js';

/** Light in the right window appears when the reader reaches the article end. */
export function mountStoryClub(page) {
  const light = page.querySelector('[data-story-club]');
  const end = page.querySelector('[data-article-end]');
  if (!light || !end) return { setSuspended() {}, setPreview() {}, dispose() {} };

  const controller = new AbortController();
  const options = { signal: controller.signal };
  let frame = 0;
  let suspended = false;
  let preview = false;
  try { applyClubSettings(page, loadClubSettings(window.localStorage)); } catch { /* Storage may be unavailable. */ }

  function render() {
    frame = 0;
    // Use the same real end marker as the continuation card, not page progress.
    const reachedEnd = end.getBoundingClientRect().top < window.innerHeight - 24;
    const amount = suspended || document.hidden || (!preview && !reachedEnd) ? 0 : 1;
    page.style.setProperty('--club-presence', amount.toFixed(3));
    page.classList.toggle('is-club-lit', amount > 0);
  }

  function schedule() {
    if (!controller.signal.aborted && !frame) frame = requestAnimationFrame(render);
  }

  page.classList.add('has-club-light');
  const observer = new ResizeObserver(schedule);
  observer.observe(page);
  window.addEventListener('scroll', schedule, { ...options, passive: true });
  window.addEventListener('resize', schedule, options);
  window.addEventListener('pageshow', schedule, options);
  document.addEventListener('visibilitychange', schedule, options);
  render();

  return {
    setPreview(value) {
      preview = Boolean(value);
      schedule();
    },
    setSuspended(value) {
      suspended = value;
      schedule();
    },
    dispose() {
      controller.abort();
      observer.disconnect();
      cancelAnimationFrame(frame);
      page.classList.remove('has-club-light', 'is-club-lit');
      page.style.removeProperty('--club-presence');
    },
  };
}
