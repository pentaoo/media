// Редактор темы карты (только для разработки).
// Слева настройки по группам объектов, справа живая карта, внизу панели JSON,
// который можно скопировать в код карты на сайте.
// Два движка: MapLibre с бесплатными тайлами OpenFreeMap (без ключа) и Яндекс Карты v3 (нужен ключ).

import { Map as MapLibreMap, Marker, setWorkerUrl } from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { GROUPS, PRESETS, stateFromPreset, buildCustomization, layerCustomization, parseCustomization } from '../map/theme.js';
import { buildMapLibreStyle, parseMapLibreStyle } from '../map/maplibre-style.js';
import { loadYandexMaps } from '../map/yandex.js';
import { PLACES, KG_CENTER, KG_ZOOM } from '../map/places.js';

setWorkerUrl(maplibreWorkerUrl);

const STORAGE_KEY = 'kg-map-theme-editor';

const $ = (sel) => document.querySelector(sel);
const json = $('#json');
const status = $('#json-status');
const notice = $('[data-notice]');

let raw = null; // JSON, вставленный вручную; пока он есть, настройки по группам не используются
let state = restore() ?? { ...stateFromPreset('night'), places: true, engine: 'maplibre' };

function pinElement(place) {
  const wrap = document.createElement('div');
  wrap.className = 'kg-pin-anchor';
  const el = document.createElement('div');
  el.className = 'kg-pin';
  el.style.setProperty('--pin', place.color);
  el.title = place.mood;
  el.innerHTML = '<span class="kg-pin__dot"></span><span class="kg-pin__label"></span>';
  el.querySelector('.kg-pin__label').textContent = place.name;
  wrap.append(el);
  return wrap;
}

// ---------- движки ----------
const ENGINES = {
  maplibre: {
    label: 'MapLibre · без ключа',
    exportJson: () => raw ?? buildMapLibreStyle(state),
    parse: parseMapLibreStyle,
    async mount(container) {
      const map = new MapLibreMap({ container, style: this.exportJson(), center: KG_CENTER, zoom: KG_ZOOM, attributionControl: { compact: true } });
      map.on('error', (e) => console.warn('MapLibre:', e.error?.message ?? e));
      let markers = [];
      return {
        apply: () => map.setStyle(this.exportJson()),
        markers(show) {
          markers.forEach((m) => m.remove());
          markers = show ? PLACES.map((p) => new Marker({ element: pinElement(p) }).setLngLat(p.coordinates).addTo(map)) : [];
        },
        destroy: () => map.remove(),
      };
    },
  },
  yandex: {
    label: 'Яндекс · нужен ключ',
    exportJson: () => (raw ? layerCustomization(state, raw) : layerCustomization(state, buildCustomization(state))),
    parse(text) {
      const parsed = parseCustomization(text);
      state.buildings3d = parsed.buildings3d;
      return parsed.rules;
    },
    async mount(container) {
      const api = await loadYandexMaps();
      const { YMap, YMapDefaultSchemeLayer, YMapDefaultFeaturesLayer, YMapMarker } = api;
      const map = new YMap(container, { location: { center: KG_CENTER, zoom: KG_ZOOM }, theme: state.theme });
      const scheme = new YMapDefaultSchemeLayer({ customization: this.exportJson() });
      map.addChild(scheme);
      map.addChild(new YMapDefaultFeaturesLayer({}));
      let markers = [];
      return {
        apply: () => {
          map.update({ theme: state.theme });
          scheme.update({ customization: this.exportJson() });
        },
        markers(show) {
          markers.forEach((m) => map.removeChild(m));
          markers = show ? PLACES.map((p) => new YMapMarker({ coordinates: p.coordinates }, pinElement(p))) : [];
          markers.forEach((m) => map.addChild(m));
        },
        destroy: () => map.destroy?.(),
      };
    },
  },
};

const engine = () => ENGINES[state.engine] ?? ENGINES.maplibre;

// ---------- карта ----------
let view = null;
let mounting = 0;

async function initMap() {
  const ticket = ++mounting;
  view?.destroy();
  view = null;
  notice.hidden = true;
  const container = $('#map');
  container.replaceChildren();
  try {
    const v = await engine().mount(container);
    if (ticket !== mounting) return v.destroy();
    view = v;
    view.markers(state.places);
  } catch (error) {
    if (ticket === mounting) showNotice(error.message);
  }
}

function renderMarkers() {
  view?.markers(state.places);
}

function applyToMap() {
  view?.apply();
}

function showNotice(text) {
  notice.hidden = false;
  notice.innerHTML = `<p class="map-editor__notice-title">КАРТА НЕ ЗАГРУЗИЛАСЬ</p><p></p>
    <p class="map-editor__notice-hint">Редактор и JSON работают и без карты. Можно переключиться на MapLibre: он без ключа.</p>`;
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
    b.setAttribute('aria-pressed', String(state.preset === id && !raw));
    b.addEventListener('click', () => {
      state = { ...stateFromPreset(id), places: state.places, engine: state.engine };
      raw = null;
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
    row.disabled = Boolean(raw);
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
  $('#opt-engine').value = state.engine;
  $('#opt-dark').checked = state.theme === 'dark';
  $('#opt-3d').checked = state.buildings3d;
  $('#opt-places').checked = state.places;
}

function renderJson() {
  json.value = JSON.stringify(engine().exportJson(), null, 2);
  status.textContent = raw
    ? 'Сейчас действует вставленный JSON. Выбери пресет, чтобы вернуться к настройкам по группам.'
    : state.engine === 'yandex'
      ? `${buildCustomization(state).length} правил для customization`
      : 'Стиль MapLibre целиком: его можно открыть в Maputnik';
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
    raw = engine().parse(json.value);
    state.preset = null;
    renderAll();
  } catch (error) {
    status.textContent = `JSON не применён: ${error.message}`;
  }
});

// ---------- хранение ----------
function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state, raw }));
  } catch {
    /* хранилище недоступно — просто не запоминаем */
  }
}

function restore() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved?.state?.groups) return null;
    raw = saved.raw ?? null;
    // добавляем группы, которых не было в старом сохранении
    const base = stateFromPreset('yandex');
    return { ...base, engine: 'maplibre', ...saved.state, groups: { ...base.groups, ...saved.state.groups } };
  } catch {
    return null;
  }
}

$('#opt-engine').addEventListener('change', (e) => {
  state.engine = e.target.value;
  raw = null;
  renderAll();
  initMap();
});

renderAll();
initMap();
