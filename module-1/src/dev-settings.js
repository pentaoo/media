export const DEV_STORAGE_KEY = 'chinatown.dev-grid.v1';
export const gridRanges = Object.freeze({ margin: [0, 160], gap: [0, 96] });

export function devToolsEnabled(url) {
  const params = url.searchParams;
  if (params.get('dev') === '0') return false;
  return ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    || params.has('dev') || params.has('light-editor');
}

export function normalizeGridSettings(input) {
  const result = { visible: input?.visible === true, profiles: {} };
  for (const surface of ['landing', 'article']) {
    for (const viewport of ['desktop', 'mobile']) {
      const key = `${surface}-${viewport}`;
      result.profiles[key] = {};
      for (const [name, [min, max]] of Object.entries(gridRanges)) {
        const value = input?.profiles?.[key]?.[name];
        result.profiles[key][name] = typeof value === 'number' && Number.isFinite(value)
          ? Math.round(Math.min(max, Math.max(min, value))) : null;
      }
    }
  }
  return result;
}

export function loadGridSettings(storage) {
  try { return normalizeGridSettings(JSON.parse(storage.getItem(DEV_STORAGE_KEY))); }
  catch { return normalizeGridSettings(); }
}
