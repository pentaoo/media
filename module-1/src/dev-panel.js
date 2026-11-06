import { DEV_STORAGE_KEY, gridRanges, loadGridSettings, normalizeGridSettings } from './dev-settings.js';
import { mountClubEditor } from './story-club-editor.js';

function range(name, label) {
  const [min, max] = gridRanges[name];
  return `<div class="dev-panel__range"><label for="dev-${name}">${label}</label><span><input id="dev-${name}-number" data-grid-setting="${name}" type="number" min="${min}" max="${max}" step="1" aria-label="${label}, точное значение"><span>px</span></span><input id="dev-${name}" data-grid-setting="${name}" type="range" min="${min}" max="${max}" step="1"></div>`;
}

export function mountDevPanel({ page, club } = {}) {
  const controller = new AbortController();
  const options = { signal: controller.signal };
  const root = document.documentElement;
  const surface = page ? 'article' : 'landing';
  const query = new URLSearchParams(location.search);
  let settings;
  try { settings = loadGridSettings(localStorage); } catch { settings = normalizeGridSettings(); }
  let activeTab = query.has('light-editor') ? 'light' : 'grid';
  let currentProfile = '';
  let frame = 0;
  let lastFocus;
  let disposed = false;
  let lightMounted = false;
  let previewActive = false;
  let disposeLight = () => {};
  const originalVariables = new Map(['article', 'landing'].flatMap(name => ['margin', 'gap'].map(key => {
    const property = `--dev-${name}-${key}`;
    return [property, root.style.getPropertyValue(property)];
  })));
  if (!document.querySelector('[data-dev-panel-style]')) {
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = new URL('../dev-panel.css', import.meta.url).href;
    style.dataset.devPanelStyle = '';
    document.head.append(style);
    style.addEventListener('load', schedule, options);
  }
  const host = document.createElement('div');
  host.className = 'dev-tool';
  host.innerHTML = `<button class="dev-tool__launcher" type="button" aria-label="Открыть DEV-настройки сайта" aria-expanded="false" aria-controls="dev-panel"><span>DEV</span><span class="dev-tool__launcher-label">Настройки сайта</span></button>
    <section class="dev-panel" id="dev-panel" aria-labelledby="dev-panel-title" hidden>
      <header class="dev-panel__header"><div><span>CHINATOWN / DEV</span><h2 id="dev-panel-title">Настройки сайта</h2></div><button type="button" data-dev-action="close" aria-label="Свернуть DEV-панель">−</button></header>
      <div class="dev-panel__tabs" role="tablist" aria-label="Настройки сайта"><button type="button" id="dev-tab-grid" role="tab" aria-controls="dev-pane-grid" data-dev-tab="grid">Сетка</button><button type="button" id="dev-tab-light" role="tab" aria-controls="dev-pane-light" data-dev-tab="light">Свет</button></div>
      <div class="dev-panel__pane dev-panel__grid" id="dev-pane-grid" role="tabpanel" aria-labelledby="dev-tab-grid">
        <p class="dev-panel__intro">Проверяй вёрстку поверх страницы. Поля и промежутки меняются сразу.</p>
        <label class="dev-panel__toggle"><span>Показать колонки</span><input type="checkbox" data-grid-visible></label>
        <p class="dev-panel__context" data-grid-context></p>
        ${range('margin', 'Внешние поля')}${range('gap', 'Между колонками')}
        <p class="dev-panel__note" data-grid-note></p>
        <div class="dev-panel__metrics" aria-label="Размеры сетки"><div><span>Колонка</span><output data-grid-width>—</output></div><div><span>Область</span><output data-grid-area>—</output></div></div>
        <button class="dev-panel__reset" type="button" data-dev-action="reset-grid">Вернуть исходную сетку</button>
        <p class="dev-panel__note" role="status" data-grid-status>Сохраняется в этом браузере. Телефон и десктоп настраиваются отдельно.</p>
      </div>
      <div class="dev-panel__pane dev-panel__light" id="dev-pane-light" role="tabpanel" aria-labelledby="dev-tab-light" hidden>
        ${page ? `<div class="dev-panel__preview"><label class="dev-panel__toggle"><span>Показать свет сейчас</span><input type="checkbox" data-dev-preview></label><p class="dev-panel__note" data-dev-preview-note></p><button type="button" data-dev-action="article-end">К концу статьи ↓</button></div><div data-dev-light-editor></div>` : `<div class="dev-panel__empty"><p>Свет появляется после прочтения статьи. Открой статью, чтобы настроить его на месте.</p><a href="./article.html?dev=1&light-editor=1">Настроить свет в статье ↗</a></div>`}
      </div>
    </section>`;
  const overlay = document.createElement('div');
  overlay.className = 'dev-grid';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.hidden = true;
  const headerOverlay = overlay.cloneNode();
  document.body.append(overlay, headerOverlay, host);
  const panel = host.querySelector('.dev-panel');
  const launcher = host.querySelector('.dev-tool__launcher');
  const gridToggle = host.querySelector('[data-grid-visible]');
  const preview = host.querySelector('[data-dev-preview]');
  gridToggle.checked = settings.visible;

  function profileKey() {
    return `${surface}-${window.innerWidth <= 760 ? 'mobile' : 'desktop'}`;
  }
  function targetGrid() {
    return page?.querySelector('.story-content')
      || document.querySelector('.subscribe-modal:not([hidden]) .subscribe-modal__panel')
      || document.querySelector('.intro:not([hidden]) .intro__content');
  }
  function applyProfile() {
    currentProfile = profileKey();
    const profile = settings.profiles[currentProfile];
    for (const key of Object.keys(gridRanges)) {
      const property = `--dev-${surface}-${key}`;
      if (profile[key] === null) root.style.removeProperty(property);
      else root.style.setProperty(property, `${profile[key]}px`);
    }
  }
  function save() {
    try {
      localStorage.setItem(DEV_STORAGE_KEY, JSON.stringify(settings));
      host.querySelector('[data-grid-status]').textContent = 'Сохранено в этом браузере. Телефон и десктоп настраиваются отдельно.';
    } catch {
      host.querySelector('[data-grid-status]').textContent = 'Изменения работают, но браузер не разрешил их сохранить.';
    }
  }
  function renderGrid() {
    frame = 0;
    if (disposed) return;
    if (currentProfile !== profileKey()) applyProfile();
    syncPreview();
    const target = targetGrid();
    if (!target) { overlay.hidden = true; headerOverlay.hidden = true; return; }
    // The wide article uses four of the site's five tracks; the rail owns the fifth.
    const headerGrid = page && document.querySelector('.media-site-header .story-header__bar');
    const siteGrid = page && window.innerWidth >= 1200 && headerGrid ? headerGrid : target;
    const style = getComputedStyle(siteGrid);
    const rect = siteGrid.getBoundingClientRect();
    const margin = parseFloat(style.paddingLeft) || 0;
    const width = Math.max(0, rect.width - margin - (parseFloat(style.paddingRight) || 0));
    const count = style.display === 'grid' ? style.gridTemplateColumns.split(/\s+/).length : 1;
    const gap = count > 1 ? parseFloat(style.columnGap) || 0 : 0;
    const columnWidth = Math.max(0, (width - gap * (count - 1)) / count);
    const mobile = currentProfile.endsWith('mobile');
    host.querySelector('[data-grid-context]').textContent = `${page ? 'Статья' : 'Лендинг'} · ${mobile ? 'Телефон' : 'Десктоп'} · ${count} ${count === 1 ? 'колонка' : 'колонок'}`;
    host.querySelector('[data-grid-note]').textContent = count === 1
      ? 'На телефоне статья идёт в одну колонку. Здесь меняются внешние поля.'
      : page && window.innerWidth >= 1200
        ? 'Общая сетка сайта. Статья занимает первые четыре колонки, правое окно — пятую и правое поле.'
        : 'Поля задаются с двух сторон. Направляющие совпадают с реальными колонками страницы.';
    host.querySelector('[data-grid-width]').value = `${Math.round(columnWidth * 10) / 10} px`;
    host.querySelector('[data-grid-area]').value = `${Math.round(width)} px`;
    for (const input of host.querySelectorAll('[data-grid-setting]')) {
      const key = input.dataset.gridSetting;
      // Do not interrupt an exact number while it is being typed.
      if (input !== document.activeElement || input.type !== 'number') input.value = key === 'margin' ? Math.round(margin) : Math.round(gap);
      input.disabled = key === 'gap' && count === 1;
    }
    overlay.hidden = !settings.visible;
    const headerRect = headerGrid?.getBoundingClientRect();
    overlay.style.top = `${Math.max(0, headerRect?.bottom || 0)}px`;
    overlay.style.left = `${rect.left + margin}px`;
    overlay.style.width = `${width}px`;
    overlay.style.columnGap = `${gap}px`;
    overlay.style.gridTemplateColumns = `repeat(${count}, minmax(0, 1fr))`;
    if (overlay.childElementCount !== count) overlay.innerHTML = Array.from({ length: count }, (_, i) => `<div><span>${String(i + 1).padStart(2, '0')}</span></div>`).join('');
    // Measure the header's actual tracks, including its separate mobile controls.
    headerOverlay.hidden = !settings.visible || !headerGrid || headerRect.bottom <= 0;
    if (!headerOverlay.hidden) {
      const headerStyle = getComputedStyle(headerGrid);
      headerOverlay.style.left = `${headerRect.left + parseFloat(headerStyle.paddingLeft)}px`;
      headerOverlay.style.width = `${headerRect.width - parseFloat(headerStyle.paddingLeft) - parseFloat(headerStyle.paddingRight)}px`;
      headerOverlay.style.top = `${Math.max(0, headerRect.top)}px`;
      headerOverlay.style.height = `${Math.max(0, headerRect.bottom - Math.max(0, headerRect.top))}px`;
      headerOverlay.style.bottom = 'auto';
      headerOverlay.style.columnGap = headerStyle.columnGap;
      headerOverlay.style.gridTemplateColumns = headerStyle.gridTemplateColumns;
      const headerCount = headerStyle.gridTemplateColumns.split(/\s+/).length;
      if (headerOverlay.childElementCount !== headerCount) headerOverlay.innerHTML = Array.from({ length: headerCount }, () => '<div></div>').join('');
    }
  }
  function schedule() {
    if (!disposed && !frame) frame = requestAnimationFrame(renderGrid);
  }
  function syncPreview() {
    if (preview) {
      preview.disabled = window.innerWidth < 1200;
      const note = preview.disabled
        ? 'Свет находится в правом окне статьи. Для предпросмотра нужна ширина окна от 1200 px.'
        : 'Предпросмотр в любом месте статьи. После сворачивания свет снова появляется только в конце.';
      const hint = host.querySelector('[data-dev-preview-note]');
      if (hint.textContent !== note) hint.textContent = note;
    }
    const nextPreview = Boolean(preview && !panel.hidden && activeTab === 'light' && !preview.disabled && preview.checked);
    if (previewActive !== nextPreview) {
      previewActive = nextPreview;
      club?.setPreview(previewActive);
    }
    if (panel.hidden || activeTab !== 'light') {
      page?.classList.remove('is-club-clean');
      const clean = host.querySelector('[data-light-clean]');
      if (clean) clean.checked = false;
    }
  }
  function selectTab(tab) {
    activeTab = tab;
    for (const button of host.querySelectorAll('[data-dev-tab]')) {
      const selected = button.dataset.devTab === tab;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
    }
    host.querySelector('#dev-pane-grid').hidden = tab !== 'grid';
    host.querySelector('#dev-pane-light').hidden = tab !== 'light';
    if (tab === 'light' && page && !lightMounted) {
      lightMounted = true;
      disposeLight = mountClubEditor(page, club, { container: host.querySelector('[data-dev-light-editor]') });
    }
    syncPreview();
    schedule();
  }
  function open() {
    lastFocus = document.activeElement;
    panel.hidden = false;
    launcher.hidden = true;
    launcher.setAttribute('aria-expanded', 'true');
    syncPreview();
    host.querySelector(`[data-dev-tab="${activeTab}"]`).focus({ preventScroll: true });
    schedule();
  }
  function close() {
    panel.hidden = true;
    launcher.hidden = false;
    launcher.setAttribute('aria-expanded', 'false');
    if (preview) preview.checked = false;
    syncPreview();
    (lastFocus?.isConnected ? lastFocus : launcher).focus({ preventScroll: true });
  }
  function updateInput(input) {
    if (!Number.isFinite(input.valueAsNumber)) { input.value = ''; schedule(); return; }
    const key = input.dataset.gridSetting;
    settings.profiles[currentProfile][key] = input.valueAsNumber;
    settings = normalizeGridSettings(settings);
    applyProfile();
    save();
    schedule();
  }
  launcher.addEventListener('click', open, options);
  host.addEventListener('input', event => {
    if (event.target.matches('[data-grid-setting][type="range"]')) updateInput(event.target);
  }, options);
  host.addEventListener('change', event => {
    const input = event.target;
    if (input.matches('[data-grid-setting][type="number"]')) updateInput(input);
    if (input === gridToggle) { settings.visible = input.checked; save(); schedule(); }
    if (input === preview) syncPreview();
  }, options);
  host.addEventListener('click', event => {
    const tab = event.target.closest('[data-dev-tab]');
    if (tab) selectTab(tab.dataset.devTab);
    const action = event.target.closest('[data-dev-action]')?.dataset.devAction;
    if (action === 'close') close();
    if (action === 'reset-grid') {
      settings.profiles[currentProfile] = { margin: null, gap: null };
      applyProfile(); save(); schedule();
      host.querySelector('[data-grid-status]').textContent = 'Исходная сетка для этого экрана восстановлена.';
    }
    if (action === 'article-end') page.querySelector('[data-article-end]')?.scrollIntoView({ block: 'center', behavior: 'instant' });
  }, options);
  host.addEventListener('keydown', event => {
    if (event.key === 'Enter' && event.target.matches('[data-grid-setting][type="number"]')) event.target.blur();
    if (event.target.matches('[data-dev-tab]') && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      selectTab(event.key === 'Home' ? 'grid' : event.key === 'End' ? 'light' : activeTab === 'grid' ? 'light' : 'grid');
      host.querySelector(`[data-dev-tab="${activeTab}"]`).focus();
    }
  }, options);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) { event.preventDefault(); close(); }
  }, options);
  window.addEventListener('resize', schedule, options);
  window.addEventListener('scroll', schedule, { ...options, passive: true });
  const resizeObserver = new ResizeObserver(schedule);
  const baseTarget = targetGrid();
  if (baseTarget) resizeObserver.observe(baseTarget);
  const modal = document.querySelector('.subscribe-modal');
  const modalObserver = new MutationObserver(schedule);
  if (modal) modalObserver.observe(modal, { attributes: true, attributeFilter: ['hidden'] });
  document.fonts?.ready.then(schedule);
  applyProfile();
  selectTab(activeTab);
  if (query.has('dev') || query.has('light-editor')) open();
  schedule();
  return () => {
    disposed = true;
    controller.abort();
    cancelAnimationFrame(frame);
    resizeObserver.disconnect();
    modalObserver.disconnect();
    club?.setPreview(false);
    disposeLight();
    for (const [name, value] of originalVariables) {
      if (value) root.style.setProperty(name, value);
      else root.style.removeProperty(name);
    }
    host.remove();
    overlay.remove();
    headerOverlay.remove();
  };
}
