const minimumContentWidth = 860;
const collapseDistance = 144;

/** Keep one semantic heading: wide on arrival, then sticky in the first column. */
export function mountSectionHeadings(page, header) {
  const sections = [...page.querySelectorAll('.story-section--anchored')].map(element => ({
    element,
    title: element.querySelector('.story-section__heading > :is(h2, h3)'),
    progress: -1,
  })).filter(section => section.title);
  const content = page.closest('.scene-reading-layout') || page.closest('#media-content') || page;
  const grid = page.querySelector('.story-content');
  const controller = new AbortController();
  const options = { signal: controller.signal };
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let frame = 0;
  let needsMeasure = true;
  let enabled = false;
  let measuredWidth = 0;
  const properties = ['--section-heading-wide', '--section-heading-narrow', '--section-heading-small', '--section-heading-space', '--section-heading-progress', '--section-heading-top'];

  function measure() {
    measuredWidth = content.clientWidth;
    const gridStyle = getComputedStyle(grid);
    const columns = gridStyle.display === 'grid'
      ? gridStyle.gridTemplateColumns.split(/\s+/).map(value => parseFloat(value)).filter(Number.isFinite) : [];
    const gap = parseFloat(gridStyle.columnGap) || 0;
    const column = columns[0];
    const wideSpan = Math.min(4, columns.length);
    enabled = measuredWidth >= minimumContentWidth && columns.length > 0;
    for (const section of sections) {
      const { element, title } = section;
      element.classList.toggle('is-heading-enhanced', enabled);
      section.progress = -1;
      if (!enabled) {
        for (const property of properties) element.style.removeProperty(property);
        continue;
      }
      element.style.setProperty('--section-heading-wide', `${column * wideSpan + gap * (wideSpan - 1)}px`);
      element.style.setProperty('--section-heading-narrow', `${column}px`);
      element.style.setProperty('--section-heading-small', `${Math.min(22, Math.max(18, measuredWidth * .018))}px`);
      // Width changes rewrap the title. Reserve its tallest state once so the
      // first paragraph never shifts or intersects a partially collapsed title.
      let height = 0;
      for (let step = 0; step <= 16; step++) {
        element.style.setProperty('--section-heading-progress', step / 16);
        height = Math.max(height, title.getBoundingClientRect().height);
      }
      element.style.setProperty('--section-heading-space', `${Math.ceil(height) + 32}px`);
    }
    needsMeasure = false;
  }

  function render() {
    frame = 0;
    if (controller.signal.aborted) return;
    if (needsMeasure) measure();
    if (!enabled) return;
    const top = (header.classList.contains('is-auto-hidden') ? 0 : header.offsetHeight) + 24;
    for (const section of sections) {
      const sectionTop = section.element.getBoundingClientRect().top;
      const progress = reducedMotion.matches ? Number(sectionTop <= top)
        : Math.min(1, Math.max(0, (top + collapseDistance - sectionTop) / collapseDistance));
      section.element.style.setProperty('--section-heading-top', `${top}px`);
      if (progress !== section.progress) {
        section.progress = progress;
        section.element.style.setProperty('--section-heading-progress', progress.toFixed(4));
      }
    }
  }
  function schedule({ measure: shouldMeasure = false } = {}) {
    needsMeasure ||= shouldMeasure;
    if (!controller.signal.aborted && !frame) frame = requestAnimationFrame(render);
  }
  const resize = new ResizeObserver(() => schedule({ measure: content.clientWidth !== measuredWidth }));
  resize.observe(content);
  const headerChanges = new MutationObserver(() => schedule());
  headerChanges.observe(header, { attributes: true, attributeFilter: ['class'] });
  const gridSettings = new MutationObserver(() => schedule({ measure: true }));
  gridSettings.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
  window.addEventListener('scroll', () => schedule(), { ...options, passive: true });
  window.addEventListener('resize', () => schedule({ measure: true }), options);
  window.addEventListener('pageshow', () => schedule({ measure: true }), options);
  window.addEventListener('hashchange', () => schedule(), options);
  page.addEventListener('load', () => schedule(), { ...options, capture: true });
  reducedMotion.addEventListener('change', () => schedule(), options);
  document.fonts.ready.then(() => schedule({ measure: true }));
  render();

  return {
    setSuspended(value) {
      page.classList.toggle('are-section-headings-suspended', value);
      schedule();
    },
    dispose() {
      controller.abort();
      resize.disconnect();
      headerChanges.disconnect();
      gridSettings.disconnect();
      cancelAnimationFrame(frame);
      page.classList.remove('are-section-headings-suspended');
      for (const { element } of sections) {
        element.classList.remove('is-heading-enhanced');
        for (const property of properties) element.style.removeProperty(property);
      }
    },
  };
}
