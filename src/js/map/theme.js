// Модель темы карты для редактора.
// Тема — это настройки по группам объектов. Из неё собирается массив customization
// для YMapDefaultSchemeLayer (формат из типов @yandex/ymaps3-types):
//   { tags: {any: [...]}, elements: 'geometry' | 'label.text.fill' | ..., stylers: {color, opacity, scale, visibility} }
// Названия тегов взяты из документации Яндекса по памяти. Если тег не существует,
// правило просто ни на что не действует, карта не ломается.

export const GROUPS = [
  { id: 'land', label: 'земля', hint: 'фон города, кварталы', tags: ['landscape', 'land', 'urban_area', 'residential'], elements: 'geometry', fields: ['color'] },
  { id: 'green', label: 'зелень', hint: 'парки, скверы, дворы с деревьями', tags: ['park', 'vegetation', 'national_park', 'cemetery'], elements: 'geometry', fields: ['color', 'opacity'] },
  { id: 'water', label: 'вода', hint: 'пруды, река', tags: ['water'], elements: 'geometry', fields: ['color'] },
  { id: 'buildings', label: 'здания', hint: 'заливка домов', tags: ['building'], elements: 'geometry.fill', fields: ['color', 'opacity'] },
  { id: 'buildings-outline', label: 'контур зданий', hint: 'обводка домов', tags: ['building'], elements: 'geometry.outline', fields: ['color', 'opacity'] },
  { id: 'roads-major', label: 'большие улицы', hint: 'Маросейка, Солянка, бульвары', tags: ['road_1', 'road_2', 'road_3'], elements: 'geometry.fill', fields: ['color', 'scale'] },
  { id: 'roads-minor', label: 'переулки', hint: 'Хохловский, Подкопаевский, проезды', tags: ['road_4', 'road_5', 'road_6', 'road_7', 'road_minor', 'road_unclassified'], elements: 'geometry.fill', fields: ['color', 'scale'] },
  { id: 'roads-outline', label: 'обводка улиц', hint: 'край проезжей части', tags: ['road'], elements: 'geometry.outline', fields: ['color', 'opacity'] },
  { id: 'paths', label: 'пешеходные', hint: 'дорожки, лестницы, переходы', tags: ['path', 'crosswalk'], elements: 'geometry', fields: ['color', 'opacity'] },
  { id: 'road-labels', label: 'названия улиц', hint: 'текст подписей', tags: ['road'], elements: 'label.text.fill', fields: ['color', 'scale'] },
  { id: 'label-halo', label: 'обводка подписей', hint: 'ореол вокруг всех текстов', tags: ['road', 'poi', 'admin', 'address', 'transit'], elements: 'label.text.outline', fields: ['color', 'opacity'] },
  { id: 'address', label: 'номера домов', hint: 'адреса на зданиях', tags: ['address'], elements: 'label', fields: ['color'] },
  { id: 'poi', label: 'заведения Яндекса', hint: 'чужие точки: кафе, магазины', tags: ['poi'], elements: 'label', fields: ['color', 'opacity'] },
  { id: 'transit', label: 'метро и транспорт', hint: 'станции, входы, остановки', tags: ['transit'], elements: 'label', fields: ['color'] },
  { id: 'admin', label: 'районы', hint: 'названия районов и границы', tags: ['admin'], elements: 'label', fields: ['color'] },
];

const off = { visible: false };

export const PRESETS = {
  yandex: {
    label: 'Яндекс как есть',
    theme: 'light',
    buildings3d: true,
    groups: {},
  },
  night: {
    label: 'А · ночной контур',
    theme: 'dark',
    buildings3d: false,
    groups: {
      land: { color: '#0f0d14' },
      green: { color: '#14241a', opacity: 1 },
      water: { color: '#122236' },
      buildings: { color: '#1c1826', opacity: 1 },
      'buildings-outline': { color: '#26213a', opacity: 1 },
      'roads-major': { color: '#3a3352', scale: 1 },
      'roads-minor': { color: '#2b2540', scale: 1.2 },
      'roads-outline': { color: '#0f0d14', opacity: 1 },
      paths: { color: '#4a3f6b', opacity: 0.8 },
      'road-labels': { color: '#8c84ad', scale: 1 },
      'label-halo': { color: '#0f0d14', opacity: 1 },
      address: { color: '#5d5678' },
      poi: off,
      transit: { color: '#fc5cff' },
      admin: { color: '#6b6385' },
    },
  },
  riso: {
    label: 'Б · ризограф',
    theme: 'light',
    buildings3d: false,
    groups: {
      land: { color: '#f2f1ec' },
      green: { color: '#fdbdfe', opacity: 0.7 },
      water: { color: '#8a9ee8' },
      buildings: { color: '#c9d1f4', opacity: 1 },
      'buildings-outline': { color: '#3d5bd9', opacity: 1 },
      'roads-major': { color: '#ffffff', scale: 1.3 },
      'roads-minor': { color: '#ffffff', scale: 1.4 },
      'roads-outline': { color: '#fc5cff', opacity: 1 },
      paths: { color: '#fc5cff', opacity: 0.6 },
      'road-labels': { color: '#3d5bd9', scale: 1 },
      'label-halo': { color: '#f2f1ec', opacity: 1 },
      address: { color: '#3d5bd9' },
      poi: off,
      transit: { color: '#fc5cff' },
      admin: { color: '#fc5cff' },
    },
  },
  hill: {
    label: 'В · горка',
    theme: 'light',
    buildings3d: true,
    groups: {
      land: { color: '#e6ebe3' },
      green: { color: '#a8c991', opacity: 1 },
      water: { color: '#8db7d6' },
      buildings: { color: '#fdfcf8', opacity: 1 },
      'buildings-outline': { color: '#9aa094', opacity: 1 },
      'roads-major': { color: '#fbfbf7', scale: 1.1 },
      'roads-minor': { color: '#fbfbf7', scale: 1.2 },
      'roads-outline': { color: '#c9cfc2', opacity: 1 },
      paths: { color: '#b7a98c', opacity: 1 },
      'road-labels': { color: '#4d5a45', scale: 1 },
      'label-halo': { color: '#e6ebe3', opacity: 1 },
      address: { color: '#7a8571' },
      poi: off,
      transit: { color: '#16131c' },
      admin: { color: '#5f6d55' },
    },
  },
};

// Полное состояние: у каждой группы есть все поля, даже если пресет их не задал.
export function stateFromPreset(id) {
  const preset = PRESETS[id] ?? PRESETS.yandex;
  const groups = {};
  for (const g of GROUPS) {
    const p = preset.groups[g.id];
    groups[g.id] = { enabled: Boolean(p), visible: p?.visible !== false, color: p?.color ?? '#888888', opacity: p?.opacity ?? 1, scale: p?.scale ?? 1 };
  }
  return { preset: id, theme: preset.theme, buildings3d: preset.buildings3d, groups };
}

// Правила customization из состояния. Группы с enabled: false не трогают карту.
export function buildCustomization(state) {
  const rules = [];
  for (const g of GROUPS) {
    const s = state.groups[g.id];
    if (!s?.enabled) continue;
    const tags = g.tags.length === 1 ? g.tags[0] : { any: g.tags };
    if (!s.visible) {
      rules.push({ tags, elements: g.elements, stylers: { visibility: 'off' } });
      continue;
    }
    const stylers = {};
    if (g.fields.includes('color')) stylers.color = s.color;
    if (g.fields.includes('opacity') && s.opacity !== 1) stylers.opacity = round(s.opacity);
    if (g.fields.includes('scale') && s.scale !== 1) stylers.scale = round(s.scale);
    rules.push({ tags, elements: g.elements, stylers });
  }
  return rules;
}

// То, что передаётся в слой: массив правил или объект с отключённым 3D.
export function layerCustomization(state, rules = buildCustomization(state)) {
  return state.buildings3d ? rules : { style: rules, 'render-3d': 'off' };
}

// Проверка вставленного JSON: массив правил или {style: [...]}.
export function parseCustomization(text) {
  const value = JSON.parse(text);
  const rules = Array.isArray(value) ? value : value?.style;
  if (!Array.isArray(rules)) throw new Error('Нужен массив правил или объект {"style": [...]}');
  rules.forEach((rule, i) => {
    if (typeof rule !== 'object' || rule === null) throw new Error(`Правило ${i + 1} не объект`);
    if (!rule.stylers) throw new Error(`В правиле ${i + 1} нет stylers`);
  });
  return { rules, buildings3d: Array.isArray(value) || value['render-3d'] !== 'off' };
}

function round(n) {
  return Math.round(n * 100) / 100;
}
