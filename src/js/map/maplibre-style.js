// Стиль MapLibre из состояния редактора.
// Данные: бесплатные векторные тайлы OpenFreeMap (схема OpenMapTiles, источник OpenStreetMap), без ключа.
// Слои собраны с нуля, чтобы каждой группе редактора соответствовали свои слои и ничего лишнего.

const TILES = 'https://tiles.openfreemap.org/planet';
const GLYPHS = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';
const FONT = ['Noto Sans Regular'];
const FONT_BOLD = ['Noto Sans Bold'];
const NAME = ['coalesce', ['get', 'name:ru'], ['get', 'name']];

// Цвета для групп, которые в редакторе выключены (не трогаем = базовая карта)
const BASE = {
  light: {
    land: '#f3f2ee', green: '#d4e6c6', water: '#a9cbe6', buildings: '#e1ddd5', 'buildings-outline': '#cbc5ba',
    'roads-major': '#ffffff', 'roads-minor': '#ffffff', 'roads-outline': '#d3cec4', paths: '#b9b1a3',
    'road-labels': '#4a4650', 'label-halo': '#ffffff', address: '#8d8796', poi: '#6d6875', transit: '#3d5bd9', admin: '#3b3742',
  },
  dark: {
    land: '#18171c', green: '#1d2b20', water: '#16263a', buildings: '#25232c', 'buildings-outline': '#302d39',
    'roads-major': '#3a3744', 'roads-minor': '#2e2c36', 'roads-outline': '#18171c', paths: '#4b4757',
    'road-labels': '#a7a2b3', 'label-halo': '#18171c', address: '#6e6979', poi: '#8d8899', transit: '#fc5cff', admin: '#c9c4d4',
  },
};

const MAJOR = ['motorway', 'trunk', 'primary', 'secondary'];
const MINOR = ['tertiary', 'minor', 'service', 'track', 'busway'];
const PATHS = ['path', 'pedestrian'];
const TRANSIT_POI = ['railway', 'bus'];

function zoomWidth(z12, z18, scale = 1) {
  return ['interpolate', ['exponential', 1.6], ['zoom'], 12, z12 * scale, 18, z18 * scale];
}

// Значения группы с учётом «не трогать»
function resolve(state) {
  const base = BASE[state.theme === 'dark' ? 'dark' : 'light'];
  const out = {};
  for (const [id, color] of Object.entries(base)) {
    const s = state.groups[id];
    out[id] = s?.enabled
      ? { visible: s.visible, color: s.color, opacity: s.opacity ?? 1, scale: s.scale ?? 1 }
      : { visible: id !== 'poi', color, opacity: 1, scale: 1 };
  }
  return out;
}

const vis = (g) => ({ visibility: g.visible ? 'visible' : 'none' });

export function buildMapLibreStyle(state) {
  const g = resolve(state);
  const layers = [
    { id: 'land', type: 'background', paint: { 'background-color': g.land.color } },
    {
      id: 'green-landcover', type: 'fill', source: 'omt', 'source-layer': 'landcover',
      filter: ['in', ['get', 'class'], ['literal', ['grass', 'wood', 'farmland']]],
      layout: vis(g.green), paint: { 'fill-color': g.green.color, 'fill-opacity': g.green.opacity },
    },
    {
      id: 'green-park', type: 'fill', source: 'omt', 'source-layer': 'park',
      layout: vis(g.green), paint: { 'fill-color': g.green.color, 'fill-opacity': g.green.opacity },
    },
    {
      id: 'green-landuse', type: 'fill', source: 'omt', 'source-layer': 'landuse',
      filter: ['in', ['get', 'class'], ['literal', ['cemetery', 'grass', 'park']]],
      layout: vis(g.green), paint: { 'fill-color': g.green.color, 'fill-opacity': g.green.opacity },
    },
    { id: 'water', type: 'fill', source: 'omt', 'source-layer': 'water', layout: vis(g.water), paint: { 'fill-color': g.water.color } },
    { id: 'waterway', type: 'line', source: 'omt', 'source-layer': 'waterway', layout: vis(g.water), paint: { 'line-color': g.water.color, 'line-width': 1.5 } },
  ];

  // улицы: сначала обводка, потом заливка; пешеходные поверх
  const road = (id, classes, w12, w18, group, extra = {}) => ({
    id, type: 'line', source: 'omt', 'source-layer': 'transportation',
    filter: ['in', ['get', 'class'], ['literal', classes]],
    layout: { ...vis(group), 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': group.color, 'line-width': zoomWidth(w12, w18, group.scale), ...extra },
  });
  const outline = g['roads-outline'];
  layers.push(
    { ...road('roads-minor-outline', MINOR, 1.2, 14, { ...outline, scale: g['roads-minor'].scale }), paint: { 'line-color': outline.color, 'line-opacity': outline.opacity, 'line-width': zoomWidth(1.2, 14, g['roads-minor'].scale) } },
    { ...road('roads-major-outline', MAJOR, 3, 26, { ...outline, scale: g['roads-major'].scale }), paint: { 'line-color': outline.color, 'line-opacity': outline.opacity, 'line-width': zoomWidth(3, 26, g['roads-major'].scale) } },
    road('roads-minor', MINOR, 0.6, 11, g['roads-minor']),
    road('roads-major', MAJOR, 2, 22, g['roads-major']),
    road('paths', PATHS, 0.5, 3, g.paths, { 'line-opacity': g.paths.opacity, 'line-dasharray': [2, 1.5] }),
    {
      id: 'rail', type: 'line', source: 'omt', 'source-layer': 'transportation', filter: ['==', ['get', 'class'], 'rail'],
      layout: vis(g.transit), paint: { 'line-color': g.transit.color, 'line-width': 1, 'line-opacity': 0.6 },
    },
  );

  // здания: плоские или объёмные
  if (state.buildings3d) {
    layers.push({
      id: 'buildings', type: 'fill-extrusion', source: 'omt', 'source-layer': 'building', minzoom: 14,
      layout: vis(g.buildings),
      paint: {
        'fill-extrusion-color': g.buildings.color,
        'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 10],
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
        'fill-extrusion-opacity': Math.min(g.buildings.opacity, 0.95),
      },
    });
  } else {
    layers.push({
      id: 'buildings', type: 'fill', source: 'omt', 'source-layer': 'building', minzoom: 13,
      layout: vis(g.buildings), paint: { 'fill-color': g.buildings.color, 'fill-opacity': g.buildings.opacity },
    });
    layers.push({
      id: 'buildings-outline', type: 'line', source: 'omt', 'source-layer': 'building', minzoom: 15,
      layout: vis(g['buildings-outline']), paint: { 'line-color': g['buildings-outline'].color, 'line-opacity': g['buildings-outline'].opacity, 'line-width': 0.7 },
    });
  }

  const halo = g['label-halo'];
  const haloPaint = { 'text-halo-color': halo.color, 'text-halo-width': halo.visible ? 1.6 * halo.opacity : 0 };
  layers.push(
    {
      id: 'road-labels', type: 'symbol', source: 'omt', 'source-layer': 'transportation_name', minzoom: 14,
      layout: { ...vis(g['road-labels']), 'symbol-placement': 'line', 'text-field': NAME, 'text-font': FONT, 'text-size': ['interpolate', ['linear'], ['zoom'], 14, 10 * g['road-labels'].scale, 18, 14 * g['road-labels'].scale] },
      paint: { 'text-color': g['road-labels'].color, ...haloPaint },
    },
    {
      id: 'address', type: 'symbol', source: 'omt', 'source-layer': 'housenumber', minzoom: 17,
      layout: { ...vis(g.address), 'text-field': ['get', 'housenumber'], 'text-font': FONT, 'text-size': 10 },
      paint: { 'text-color': g.address.color, ...haloPaint },
    },
    {
      id: 'poi', type: 'symbol', source: 'omt', 'source-layer': 'poi', minzoom: 16,
      filter: ['!', ['in', ['get', 'class'], ['literal', TRANSIT_POI]]],
      layout: { ...vis(g.poi), 'text-field': NAME, 'text-font': FONT, 'text-size': 11, 'text-max-width': 8 },
      paint: { 'text-color': g.poi.color, 'text-opacity': g.poi.opacity, ...haloPaint },
    },
    {
      id: 'transit', type: 'symbol', source: 'omt', 'source-layer': 'poi', minzoom: 14,
      filter: ['in', ['get', 'class'], ['literal', TRANSIT_POI]],
      layout: { ...vis(g.transit), 'text-field': NAME, 'text-font': FONT_BOLD, 'text-size': 11 },
      paint: { 'text-color': g.transit.color, ...haloPaint },
    },
    {
      id: 'admin', type: 'symbol', source: 'omt', 'source-layer': 'place',
      filter: ['in', ['get', 'class'], ['literal', ['suburb', 'quarter', 'neighbourhood']]],
      layout: { ...vis(g.admin), 'text-field': NAME, 'text-font': FONT_BOLD, 'text-size': 13, 'text-transform': 'uppercase', 'text-letter-spacing': 0.08 },
      paint: { 'text-color': g.admin.color, ...haloPaint },
    },
  );

  return {
    version: 8,
    name: `chinatown.site · ${state.preset ?? 'своя тема'}`,
    sources: { omt: { type: 'vector', url: TILES, attribution: '© OpenStreetMap contributors · OpenFreeMap' } },
    glyphs: GLYPHS,
    layers,
  };
}

export function parseMapLibreStyle(text) {
  const style = JSON.parse(text);
  if (style?.version !== 8 || !Array.isArray(style.layers)) throw new Error('Нужен стиль MapLibre: объект с "version": 8 и массивом "layers"');
  return style;
}
