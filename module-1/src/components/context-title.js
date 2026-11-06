/** Keep a single accessible heading while its overflowing text loops visually. */
export function mountContextTitles(root) {
  const titles = new Map();
  let frame = 0;
  let disposed = false;

  function measure() {
    frame = 0;
    for (const [title, entry] of titles) {
      const width = entry.text.getBoundingClientRect().width;
      const available = entry.viewport.clientWidth;
      const overflowing = available > 0 && width > available + 1;
      title.toggleAttribute('data-overflowing', overflowing);
      if (overflowing) {
        const distance = width + 32;
        title.style.setProperty('--context-title-distance', `${distance}px`);
        title.style.setProperty('--context-title-duration', `${distance / 32}s`);
      }
    }
  }
  function schedule() {
    if (!disposed && !frame) frame = requestAnimationFrame(measure);
  }
  const observer = new ResizeObserver(schedule);

  function restore(title, entry) {
    observer.unobserve(entry.viewport);
    observer.unobserve(entry.text);
    title.replaceChildren(...entry.original);
    title.removeAttribute('data-overflow-title');
    title.removeAttribute('data-overflowing');
    title.style.removeProperty('--context-title-distance');
    title.style.removeProperty('--context-title-duration');
    titles.delete(title);
  }

  function refresh() {
    cancelAnimationFrame(frame);
    const current = new Set(root.querySelectorAll('.scene-rail__context-content > [data-context-material] > h2'));
    for (const [title, entry] of titles) if (!current.has(title)) restore(title, entry);
    for (const title of current) {
      if (titles.has(title)) continue;
      const original = [...title.childNodes];
      const viewport = document.createElement('span');
      viewport.className = 'context-title__viewport';
      const track = document.createElement('span');
      track.className = 'context-title__track';
      const text = document.createElement('span');
      text.className = 'context-title__text';
      text.append(...original);
      const repeat = document.createElement('span');
      repeat.className = 'context-title__repeat';
      repeat.setAttribute('aria-hidden', 'true');
      repeat.textContent = text.textContent;
      track.append(text, repeat);
      viewport.append(track);
      title.replaceChildren(viewport);
      title.setAttribute('data-overflow-title', '');
      titles.set(title, { original, viewport, text });
      observer.observe(viewport);
      observer.observe(text);
    }
    measure();
  }

  document.fonts?.ready.then(schedule);
  return {
    refresh,
    setPaused(value) { root.toggleAttribute('data-titles-paused', value); },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      for (const [title, entry] of titles) restore(title, entry);
      root.removeAttribute('data-titles-paused');
    },
  };
}
