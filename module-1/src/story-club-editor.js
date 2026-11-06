import { CLUB_STORAGE_KEY, clubDefaults, clubRanges, normalizeClubSettings, applyClubSettings, loadClubSettings, exportClubDesign, exportClubCSS, parseClubDesign } from './story-club-settings.js';

const presets = {
  club: { ...clubDefaults },
  haze: { ...clubDefaults, ambient: 120, bloom: 115, width: 58, softness: 24, beamStrength: 25, pulseDepth: 22, pulseDuration: 10, seamWidth: 1 },
  lasers: { ...clubDefaults, ambient: 35, bloom: 45, beamStrength: 165, beamSpeed: 1.6, beamAngle: -8, pulseDuration: 3.8 },
  blue: { ...clubDefaults, color: '#627bff', blueColor: '#55d9ff', greenColor: '#c8a3ff', ambient: 90, bloom: 85, pulseDuration: 8 },
};

function range(key, label, unit, step = 1) {
  const [min, max] = clubRanges[key];
  return `<div class="light-editor__range"><label for="light-${key}">${label}</label><span><input id="light-${key}-number" data-light-setting="${key}" type="number" min="${min}" max="${max}" step="${step}" aria-label="${label}, точное значение"><span>${unit}</span></span><input id="light-${key}" data-light-setting="${key}" type="range" min="${min}" max="${max}" step="${step}"></div>`;
}
function color(key, label) {
  return `<div class="light-editor__color"><label for="light-${key}">${label}</label><input id="light-${key}" data-light-setting="${key}" type="color"><input data-light-setting="${key}" type="text" pattern="#[0-9a-fA-F]{6}" maxlength="7" spellcheck="false" aria-label="${label}, HEX"></div>`;
}
function toggle(key, label) {
  return `<label class="light-editor__toggle"><span>${label}</span><input type="checkbox" data-light-setting="${key}"></label>`;
}

export function mountClubEditor(page, club, { container } = {}) {
  const controller = new AbortController();
  const options = { signal: controller.signal };
  let settings;
  try { settings = loadClubSettings(window.localStorage); } catch { settings = { ...clubDefaults }; }
  let paused = false;
  let phase = 3;
  let disposed = false;
  let saveTimer = 0;
  let phaseFrame = 0;
  let lastFocus;
  if (!document.querySelector('[data-light-editor-style]')) {
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = new URL('../light-editor.css', import.meta.url).href;
    stylesheet.dataset.lightEditorStyle = '';
    document.head.append(stylesheet);
  }
  const host = document.createElement('div');
  host.className = container ? 'light-tool light-tool--embedded' : 'light-tool';
  host.innerHTML = `<button class="light-tool__launcher" type="button" aria-expanded="false" aria-controls="light-editor"><span aria-hidden="true">◉</span> Настроить свет</button>
    <section class="light-editor" id="light-editor" aria-labelledby="light-editor-title" hidden>
      <header class="light-editor__header"><div><span>CHINATOWN / LAB</span><h2 id="light-editor-title">Свет за стеной</h2></div><button type="button" data-light-action="close" aria-label="Свернуть настройки света">−</button></header>
      <div class="light-editor__body">
        <p class="light-editor__intro">Меняй свет на статье. Выбранный вариант сохраняется в этом браузере.</p>
        <div class="light-editor__presets" role="group" aria-label="Пресеты света"><button type="button" data-light-preset="club">Клуб</button><button type="button" data-light-preset="haze">Туман</button><button type="button" data-light-preset="lasers">Лазеры</button><button type="button" data-light-preset="blue">Холодный</button></div>
        <details open><summary>Свечение</summary><div class="light-editor__group">${color('color', 'Основной цвет')}${range('brightness', 'Общая яркость', '%')}${range('ambient', 'Постоянный свет', '%')}${range('bloom', 'Ореол', '%')}${range('width', 'Ширина на десктопе', 'vw')}${range('maxWidth', 'Предельная ширина', 'px', 10)}${range('mobileWidth', 'Ширина на телефоне', 'px')}${range('sourceY', 'Высота источника', '%')}${range('softness', 'Размытие свечения', 'px')}${range('seamWidth', 'Щель у края', 'px', .5)}</div></details>
        <details><summary>Пульсация и лучи</summary><div class="light-editor__group">${range('pulseDepth', 'Глубина пульсации', '%')}${range('pulseDuration', 'Период пульсации', 'с', .1)}${toggle('beamsEnabled', 'Показывать лучи')}${range('beamStrength', 'Яркость лучей', '%')}${range('beamSoftness', 'Размытие лучей', 'px', .1)}${range('beamAngle', 'Угол лучей', '°')}${range('beamSpeed', 'Скорость лучей', '×', .05)}${toggle('blueEnabled', 'Синий луч')}${color('blueColor', 'Цвет синего луча')}${toggle('greenEnabled', 'Зелёный луч')}${color('greenColor', 'Цвет зелёного луча')}</div></details>
        <details><summary>Фон и текст</summary><div class="light-editor__group">${color('background', 'Фон статьи')}<label class="light-editor__toggle"><span>Только свет на фоне</span><input type="checkbox" data-light-clean></label></div></details>
        <div class="light-editor__motion"><button type="button" data-light-action="pause" aria-pressed="false">Ⅱ Пауза</button><label for="light-phase">Кадр <output for="light-phase">3.0 с</output></label><input type="range" id="light-phase" min="0" max="20" step=".1" value="3" aria-label="Время кадра анимации, секунд"><p data-light-motion-note>Ползунок кадра ставит анимацию на паузу.</p></div>
        <details class="light-editor__transfer"><summary>Вставить настройки</summary><label class="light-editor__sr" for="light-transfer">JSON с настройками света</label><textarea id="light-transfer" spellcheck="false" placeholder="Вставь скопированные данные для дизайна"></textarea><button type="button" data-light-action="import">Применить JSON</button></details>
        <button class="light-editor__reset" type="button" data-light-action="reset">Вернуть исходный свет</button>
      </div>
      <footer class="light-editor__footer"><div><button class="light-editor__primary" type="button" data-light-action="design">Данные для дизайна ⧉</button><button type="button" data-light-action="css">CSS</button></div><button class="light-editor__download" type="button" data-light-action="download">Скачать .json ↓</button><p role="status" aria-live="polite" data-light-status>Цвета, размеры и тайминги · JSON</p></footer>
    </section>`;
  (container || document.body).append(host);
  const panel = host.querySelector('.light-editor');
  const launcher = host.querySelector('.light-tool__launcher');
  const pauseButton = host.querySelector('[data-light-action="pause"]');
  const status = host.querySelector('[data-light-status]');
  const transfer = host.querySelector('textarea');

  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { window.localStorage.setItem(CLUB_STORAGE_KEY, JSON.stringify(settings)); }
      catch { status.textContent = 'Настройки работают. Для сохранения скопируй JSON.'; }
    }, 120);
  }
  function syncInputs() {
    for (const input of host.querySelectorAll('[data-light-setting]')) {
      const value = settings[input.dataset.lightSetting];
      if (input.type === 'checkbox') input.checked = value;
      else input.value = value;
      input.removeAttribute('aria-invalid');
    }
    for (const button of host.querySelectorAll('[data-light-preset]')) {
      button.setAttribute('aria-pressed', String(Object.keys(clubDefaults).every(key => settings[key] === presets[button.dataset.lightPreset][key])));
    }
  }
  function setFrame() {
    cancelAnimationFrame(phaseFrame);
    phaseFrame = requestAnimationFrame(() => {
      if (disposed || !paused) return;
      for (const animation of page.querySelector('.story-club').getAnimations({ subtree: true })) {
        if (animation.animationName) animation.currentTime = phase * 1000;
      }
    });
  }
  function update(next) {
    settings = normalizeClubSettings(next);
    applyClubSettings(page, settings);
    syncInputs();
    if (paused) setFrame();
    save();
  }
  function pause(value) {
    paused = value;
    page.classList.toggle('is-club-paused', paused);
    pauseButton.setAttribute('aria-pressed', String(paused));
    pauseButton.textContent = paused ? '▶ Продолжить' : 'Ⅱ Пауза';
    if (paused) {
      const animation = page.querySelector('.story-club__bloom').getAnimations()[0];
      phase = Number(((animation?.currentTime ?? phase * 1000) / 1000).toFixed(1));
      host.querySelector('#light-phase').max = Math.max(20, Math.ceil(phase / 10) * 10);
      host.querySelector('#light-phase').value = phase;
      host.querySelector('output').value = `${phase.toFixed(1)} с`;
    }
  }
  function open() {
    lastFocus = document.activeElement;
    panel.hidden = false;
    launcher.hidden = true;
    launcher.setAttribute('aria-expanded', 'true');
    page.querySelector('[data-article-end]').scrollIntoView({ block: 'center', behavior: 'instant' });
    panel.querySelector('[data-light-action="close"]').focus({ preventScroll: true });
  }
  function close() {
    panel.hidden = true;
    launcher.hidden = false;
    launcher.setAttribute('aria-expanded', 'false');
    page.classList.remove('is-club-clean');
    host.querySelector('[data-light-clean]').checked = false;
    (lastFocus?.isConnected ? lastFocus : launcher).focus({ preventScroll: true });
  }
  function designData() {
    const light = page.querySelector('.story-club');
    return {
      ...exportClubDesign(settings),
      preview: {
        viewport: { width: window.innerWidth, height: window.innerHeight },
        lightWidthPx: Math.round(light.getBoundingClientRect().width),
        paused,
        layers: [...light.children].map(layer => {
          const style = getComputedStyle(layer);
          return { name: layer.className, visible: style.display !== 'none', opacity: Number(style.opacity), transform: style.transform, rotation: style.rotate, filter: style.filter, background: style.backgroundImage, animationTimeMs: Math.round(layer.getAnimations()[0]?.currentTime || 0) };
        }),
      },
    };
  }
  async function copy(text, message) {
    try {
      await navigator.clipboard.writeText(text);
      if (!disposed) status.textContent = message;
    } catch {
      if (disposed) return;
      transfer.value = text;
      transfer.closest('details').open = true;
      transfer.focus();
      transfer.select();
      status.textContent = 'Текст выделен. Скопируй его через Ctrl/Cmd+C.';
    }
  }
  launcher.addEventListener('click', open, options);
  host.addEventListener('input', event => {
    const input = event.target;
    if (input.matches('[data-light-setting]')) {
      if (input.type === 'number') return; // Commit exact numbers after typing; sliders remain live.
      const key = input.dataset.lightSetting;
      let value = input.type === 'checkbox' ? input.checked : clubRanges[key] ? input.valueAsNumber : input.value;
      if (input.type === 'text' && !/^#[\da-f]{6}$/i.test(value)) { input.setAttribute('aria-invalid', 'true'); return; }
      if (typeof value === 'number' && !Number.isFinite(value)) return;
      update({ ...settings, [key]: value });
    } else if (input.matches('[data-light-clean]')) page.classList.toggle('is-club-clean', input.checked);
    else if (input.id === 'light-phase') {
      const selectedPhase = input.valueAsNumber;
      if (!paused) pause(true);
      phase = selectedPhase;
      input.value = phase;
      host.querySelector('output').value = `${phase.toFixed(1)} с`;
      setFrame();
    }
  }, options);
  host.addEventListener('change', event => {
    const input = event.target;
    if (!input.matches('input[type="number"][data-light-setting]')) return;
    if (Number.isFinite(input.valueAsNumber)) update({ ...settings, [input.dataset.lightSetting]: input.valueAsNumber });
    else syncInputs();
  }, options);
  host.addEventListener('keydown', event => {
    if (event.key === 'Enter' && event.target.matches('input[type="number"][data-light-setting]')) event.target.blur();
  }, options);
  host.addEventListener('click', event => {
    const preset = event.target.closest('[data-light-preset]');
    if (preset) { update(presets[preset.dataset.lightPreset]); status.textContent = `Пресет «${preset.textContent}» применён.`; return; }
    const action = event.target.closest('[data-light-action]')?.dataset.lightAction;
    if (action === 'close') close();
    if (action === 'pause') pause(!paused);
    if (action === 'reset') { update(clubDefaults); status.textContent = 'Исходный свет восстановлен.'; }
    if (action === 'design') copy(JSON.stringify(designData(), null, 2), 'Данные для дизайна скопированы.');
    if (action === 'css') copy(exportClubCSS(settings), 'CSS-переменные скопированы.');
    if (action === 'import') {
      try { update(parseClubDesign(transfer.value)); status.textContent = 'Настройки из JSON применены.'; }
      catch { status.textContent = 'Не удалось прочитать JSON. Вставь данные из кнопки «Данные для дизайна».'; }
    }
    if (action === 'download') {
      const url = URL.createObjectURL(new Blob([JSON.stringify(designData(), null, 2)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'chinatown-club-light.json';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      status.textContent = 'Файл chinatown-club-light.json сохранён.';
    }
  }, options);
  document.addEventListener('keydown', event => {
    if (!container && event.key === 'Escape' && !panel.hidden) { event.preventDefault(); close(); }
  }, options);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  function syncMotionNote() {
    host.querySelector('[data-light-motion-note]').textContent = reducedMotion.matches
      ? 'В системе включено уменьшение движения: свет статичен.'
      : 'Ползунок кадра ставит анимацию на паузу.';
    pauseButton.disabled = reducedMotion.matches;
    host.querySelector('#light-phase').disabled = reducedMotion.matches;
  }
  reducedMotion.addEventListener('change', syncMotionNote, options);
  syncMotionNote();
  syncInputs();
  if (container) {
    panel.hidden = false;
    launcher.hidden = true;
  } else if (new URLSearchParams(location.search).has('light-editor')) open();
  return () => {
    disposed = true;
    controller.abort();
    clearTimeout(saveTimer);
    cancelAnimationFrame(phaseFrame);
    try { window.localStorage.setItem(CLUB_STORAGE_KEY, JSON.stringify(settings)); } catch { /* Export remains available. */ }
    page.classList.remove('is-club-paused', 'is-club-clean');
    host.remove();
  };
}
