export const CLUB_STORAGE_KEY = 'chinatown.story-club.settings.v1';

export const clubDefaults = Object.freeze({
  color: '#ff399b', blueColor: '#6580ff', greenColor: '#51ff98', background: '#131313',
  brightness: 100, ambient: 100, bloom: 100, width: 46, maxWidth: 880, mobileWidth: 96,
  sourceY: 50, softness: 0, pulseDepth: 50, pulseDuration: 5.8,
  beamStrength: 100, beamSoftness: 0, beamAngle: 0, beamSpeed: 1, seamWidth: 2,
  blueEnabled: true, greenEnabled: true, beamsEnabled: true,
});

export const clubRanges = Object.freeze({
  brightness: [0, 200], ambient: [0, 150], bloom: [0, 150], width: [10, 75], maxWidth: [160, 2000], mobileWidth: [32, 240],
  sourceY: [0, 100], softness: [0, 32], pulseDepth: [0, 100], pulseDuration: [1, 16],
  beamStrength: [0, 180], beamSoftness: [0, 8], beamAngle: [-30, 30], beamSpeed: [.25, 3], seamWidth: [0, 10],
});

export function normalizeClubSettings(input = {}) {
  const result = { ...clubDefaults };
  for (const [key, fallback] of Object.entries(clubDefaults)) {
    const value = input?.[key];
    if (clubRanges[key] && typeof value === 'number' && Number.isFinite(value)) {
      const [min, max] = clubRanges[key];
      result[key] = Math.round(Math.min(max, Math.max(min, value)) * 100) / 100;
    } else if (typeof fallback === 'boolean' && typeof value === 'boolean') result[key] = value;
    else if (typeof fallback === 'string' && typeof value === 'string' && /^#[\da-f]{6}$/i.test(value)) result[key] = value.toLowerCase();
  }
  return result;
}

function rgb(hex) {
  return [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16)).join(', ');
}

function highlight(hex) {
  return [1, 3, 5].map(start => Math.round(parseInt(hex.slice(start, start + 2), 16) * .2 + 255 * .8)).join(', ');
}

export function clubVariables(input) {
  const s = normalizeClubSettings(input);
  return {
    '--club-color': rgb(s.color), '--club-highlight': highlight(s.color), '--club-blue': rgb(s.blueColor), '--club-green': rgb(s.greenColor),
    '--story-bg': s.background, '--club-brightness': s.brightness / 100,
    '--club-ambient': s.ambient / 100, '--club-bloom': s.bloom / 100,
    '--club-width': `${s.width}vw`, '--club-max-width': `${s.maxWidth}px`, '--club-tablet-width': `${Number((s.width * 28 / 46).toFixed(3))}vw`, '--club-mobile-width': `${s.mobileWidth}px`,
    '--club-source-y': `${Number(((s.sourceY + 12) / 1.24).toFixed(3))}%`, '--club-softness': `${s.softness}px`,
    '--club-pulse-depth': s.pulseDepth / 100, '--club-pulse-duration': `${s.pulseDuration}s`,
    '--club-beam-strength': s.beamStrength / 100, '--club-beam-softness': `${s.beamSoftness}px`,
    '--club-beam-angle': `${s.beamAngle}deg`, '--club-seam-width': `${s.seamWidth}px`, '--club-seam-display': s.seamWidth > 0 ? 'block' : 'none',
    '--club-pink-duration': `${Number((9.4 / s.beamSpeed).toFixed(3))}s`,
    '--club-blue-duration': `${Number((13.2 / s.beamSpeed).toFixed(3))}s`,
    '--club-green-duration': `${Number((17.6 / s.beamSpeed).toFixed(3))}s`,
    '--club-blue-display': s.beamsEnabled && s.blueEnabled ? 'block' : 'none',
    '--club-green-display': s.beamsEnabled && s.greenEnabled ? 'block' : 'none',
    '--club-pink-display': s.beamsEnabled ? 'block' : 'none',
  };
}

export function applyClubSettings(page, input) {
  for (const [name, value] of Object.entries(clubVariables(input))) page.style.setProperty(name, value);
}

export function loadClubSettings(storage) {
  try { return normalizeClubSettings(JSON.parse(storage.getItem(CLUB_STORAGE_KEY))); }
  catch { return { ...clubDefaults }; }
}

export function exportClubDesign(input) {
  const settings = normalizeClubSettings(input);
  return {
    effect: 'chinatown-club-light', version: 1,
    settings,
    design: {
      blendMode: 'SCREEN', anchor: 'right edge, full viewport height',
      units: { brightness: '%', ambient: '%', bloom: '%', width: 'vw', maxWidth: 'px', mobileWidth: 'px', sourceY: '% of viewport height', softness: 'px', pulseDepth: '%', pulseDuration: 's', beamStrength: '%', beamSoftness: 'px', beamAngle: 'deg', beamSpeed: 'multiplier', seamWidth: 'px' },
      desktopWidthCap: `${settings.maxWidth}px`, tabletWidth: 'width × 28 / 46 vw (761–1100px)',
      layerOverscan: '12% beyond viewport top and bottom; sourceY is converted to layer coordinates in CSS.',
      mobileBreakpoint: '760px',
      motion: { easing: 'ease-in-out', iterations: 'infinite', pinkBeamSeconds: Number((9.4 / settings.beamSpeed).toFixed(3)), blueBeamSeconds: Number((13.2 / settings.beamSpeed).toFixed(3)), greenBeamSeconds: Number((17.6 / settings.beamSpeed).toFixed(3)), seamSeconds: 7.1 },
      reducedMotion: 'Static glow; no beams or pulsing.',
    },
    cssVariables: clubVariables(settings),
  };
}

export function parseClubDesign(text) {
  const data = JSON.parse(text);
  if (data?.effect !== 'chinatown-club-light' || data.version !== 1 || !data.settings || typeof data.settings !== 'object' || Array.isArray(data.settings)) {
    throw new Error('Вставьте JSON из кнопки «Данные для дизайна».');
  }
  return normalizeClubSettings(data.settings);
}

export function exportClubCSS(input) {
  return `/* Свет за стеной. Переменные для article.css. */\n.story-page {\n${Object.entries(clubVariables(input)).map(([key, value]) => `  ${key}: ${value};`).join('\n')}\n}`;
}
