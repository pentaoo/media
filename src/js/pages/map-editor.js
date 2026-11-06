// Редактор темы карты (только для разработки).
// Слева настройки по группам объектов, справа живая карта Яндекса,
// внизу панели JSON, который можно скопировать в код карты на сайте.

import { GROUPS, PRESETS, stateFromPreset, buildCustomization, layerCustomization, parseCustomization } from '../map/theme.js';
import { loadYandexMaps } from '../map/yandex.js';
import { PLACES, KG_CENTER, KG_ZOOM } from '../map/places.js';

const STORAGE_KEY = 'kg-map-theme-editor';

const $ = (sel) => document.querySelector(sel);
const json = $('#json');
const status = $('#json-status');
const notice = $('[data-notice]');

let rawRules = null; // правила, вставленные вручную; пока они есть, группы не используются
let state = restore() ?? { ...stateFromPreset('night'), places: true };

// ---------- карта ----------
let map;
let scheme;
let markers = [];
let api;

async function initMap() {
  try {
    api = await loadYandexMaps();
  } catch (error) {
    showNotice(error.message);
    return;
  }
  const { YMap, YMapDefaultSchemeLayer, YMapDefaultFeaturesLayer } = api;
  map = new YMap($('#map'), { location: { center: KG_CENTER, zoom: KG_ZOOM }, theme: state.theme });
  scheme = new YMapDefaultSchemeLayer({ customization: currentCustomization() });
  map.addChild(scheme);
  map.addChild(new YMapDefaultFeaturesLayer({}));
  renderMarkers();
}

function renderMarkers() {
  if (!map) return;
  markers.forEach((m) => map.removeChild(m));
  markers = [];
  if (!state.places) return;
  for (const place of PLACES) {
    const el = document.createElement('div');
    el.className = 'kg-pin';
    el.style.setProperty('--pin', place.color);
    el.innerHTML = `<span class="kg-pin__dot"></span><span class="kg-pin__label"></span>`;
    el.querySelector('.kg-pin__label').textContent = place.name;
    el.title = place.mood;
    const marker = new api.YMapMarker({ coordinates: place.coordinates }, el);
    map.addChild(marker);
    markers.push(marker);
  }
}

function currentCustomization() {
  const rules = rawRules ?? buildCustomization(state);
  return layerCustomization(state, rules);
}

function applyToMap() {
  if (!map) return;
  map.update({ theme: state.theme });
  scheme.update({ customization: currentCustomization() });
}

function showNotice(text) {
  notice.hidden = false;
  notice.innerHTML = `<p class="map-editor__notice-title">КАРТА НЕ ЗАГРУЗИЛАСЬ</p><p></p>
    <p class="map-editor__notice-hint">Редактор и JSON работают и без карты.</p>`;
  notice.querySelectorAll('p')[1].textContent = text;
}

// ---------- панель ----------
function renderPresets() {
  const box = $('[data-presets]');
  box.innerHTML = '';
  for (const [id, preset] of Object.entries(PRESETS)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'map-editor__preset';
    b.textContent = preset.label;
    b.setAttribute('aria-pressed', String(state.preset === id && !rawRules));
    b.addEventListener('click', () => {
      state = { ...stateFromPreset(id), places: state.places };
      rawRules = null;
      renderAll();
    });
    box.append(b);
  }
}

function renderGroups() {
  const box = $('[data-groups]');
  box.innerHTML = '';
  for (const g of GROUPS) {
    const s = state.groups[g.id];
    const row = document.createElement('fieldset');
    row.className = 'map-editor__group';
    row.dataset.enabled = String(s.enabled);
    row.dataset.visible = String(s.visible);
    row.disabled = Boolean(rawRules);
    const id = `g-${g.id}`;
    row.innerHTML = `
      <legend class="map-editor__group-head">
        <label class="map-editor__check"><input type="checkbox" id="${id}-on" data-k="enabled" ${s.enabled ? 'checked' : ''} />
          <span><b>${g.label}</b><small>${g.hint}</small></span></label>
      </legend>
      <div class="map-editor__fields">
        <label class="map-editor__check"><input type="checkbox" id="${id}-vis" data-k="visible" ${s.visible ? 'checked' : ''} /> видно</label>
        ${g.fields.includes('color') ? `<label class="map-editor__field">цвет <input type="color" id="${id}-color" data-k="color" value="${s.color}" /></label>` : ''}
        ${g.fields.includes('opacity') ? `<label class="map-editor__field">прозрачность <input type="range" id="${id}-op" data-k="opacity" min="0" max="1" step="0.05" value="${s.opacity}" /></label>` : ''}
        ${g.fields.includes('scale') ? `<label class="map-editor__field">толщина <input type="range" id="${id}-sc" data-k="scale" min="0.5" max="3" step="0.1" value="${s.scale}" /></label>` : ''}
      </div>`;
    row.addEventListener('input', (e) => {
      const k = e.target.dataset.k;
      if (!k) return;
      const v = e.target.type === 'checkbox' ? e.target.checked : e.target.type === 'range' ? Number(e.target.value) : e.target.value;
      s[k] = v;
      // правка любого поля включает группу
      if (k !== 'enabled') {
        s.enabled = true;
        row.querySelector('[data-k="enabled"]').checked = true;
      }
      row.dataset.enabled = String(s.enabled);
      row.dataset.visible = String(s.visible);
      changed();
    });
    box.append(row);
  }
}

function renderOptions() {
  $('#opt-dark').checked = state.theme === 'dark';
  $('#opt-3d').checked = state.buildings3d;
  $('#opt-places').checked = state.places;
}

function renderJson() {
  json.value = JSON.stringify(currentCustomization(), null, 2);
  status.textContent = rawRules
    ? 'Сейчас действует вставленный JSON. Выбери пресет, чтобы вернуться к настройкам по группам.'
    : `${buildCustomization(state).length} правил`;
}

function renderAll() {
  renderPresets();
  renderOptions();
  renderGroups();
  renderJson();
  applyToMap();
  renderMarkers();
  save();
}

function changed() {
  state.preset = null;
  renderPresets();
  renderJson();
  applyToMap();
  save();
}

document.querySelectorAll('[data-opt]').forEach((input) =>
  input.addEventListener('change', () => {
    const k = input.dataset.opt;
    if (k === 'dark') state.theme = input.checked ? 'dark' : 'light';
    if (k === 'buildings3d') state.buildings3d = input.checked;
    if (k === 'places') {
      state.places = input.checked;
      renderMarkers();
      save();
      return;
    }
    changed();
  }),
);

$('[data-action="copy"]').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(json.value);
    status.textContent = 'Скопировано';
  } catch {
    json.select();
    status.textContent = 'Не получилось скопировать автоматически: текст выделен, нажми Cmd+C';
  }
});

$('[data-action="apply-json"]').addEventListener('click', () => {
  try {
    const parsed = parseCustomization(json.value);
    rawRules = parsed.rules;
    state.buildings3d = parsed.buildings3d;
    state.preset = null;
    renderAll();
  } catch (error) {
    status.textContent = `JSON не применён: ${error.message}`;
  }
});

// ---------- хранение ----------
function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state, rawRules }));
  } catch {
    /* хранилище недоступно — просто не запоминаем */
  }
}

function restore() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved?.state?.groups) return null;
    rawRules = saved.rawRules ?? null;
    // добавляем группы, которых не было в старом сохранении
    const base = stateFromPreset('yandex');
    return { ...base, ...saved.state, groups: { ...base.groups, ...saved.state.groups } };
  } catch {
    return null;
  }
}

renderAll();
initMap();
