// Tags and accent bursts, see the "Система тегов-бейджей" concept.
// A tag describes what a story is about; a burst marks one story as new.
const textures = new URL('../../assets/textures/', import.meta.url);
const burstFrames = [
  '97.8,27.2 80.2,33.3 97.0,44.0 72.3,42.3 78.1,58.1 57.4,47.4 47.9,59.1 40.1,47.0 26.8,49.2 25.9,41.1 10.9,39.3 19.4,31.8 12.3,25.9 22.6,21.9 15.1,10.8 34.5,14.5 37.3,0.1 51.3,12.1 68.0,-0.7 67.7,15.4 89.1,11.9 78.5,23.3',
  '93.2,29.0 79.8,34.4 84.8,41.9 71.0,43.1 69.9,53.0 55.6,47.6 45.8,54.0 38.4,46.6 17.0,54.1 24.8,40.3 -0.9,40.0 19.3,30.7 1.6,22.9 23.5,20.9 20.4,11.6 36.1,14.0 42.7,6.9 53.2,12.2 66.7,6.2 69.2,16.0 83.8,16.2 79.1,24.3',
  '101.3,25.8 80.4,32.6 93.6,41.7 73.2,41.8 77.4,55.0 58.6,47.2 49.8,61.9 41.3,47.2 27.1,50.7 26.7,41.7 15.0,39.2 19.6,32.5 4.4,26.1 22.1,22.5 10.9,10.1 33.5,14.9 36.6,3.1 50.1,12.1 64.5,1.5 66.7,15.0 91.5,9.2 78.0,22.6',
];

// Each rubric has its own sticker; placeholders until the 3D rubric objects are rendered.
const rubricStickers = {
  'фиты': 'fity', 'дропы': 'dropy', 'биты': 'bity', 'бифы': 'bify', 'сниппеты': 'snippety',
  'удалённое': 'udalyonnoe', 'пропавшие': 'propavshie', 'клипы': 'klipy', 'сохранёнки': 'sohranyonki',
  // Material types in article cards: the tag replaces the old text label.
  'артист': 'artist', 'альбом': 'album', 'трек': 'track',
};

function stickerFor(label) {
  const name = rubricStickers[label.toLocaleLowerCase('ru')];
  return name ? new URL(`../../assets/stickers/${name}.svg`, import.meta.url).href : new URL('topic-sticker.svg', textures).href;
}

const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

// Markup for pages rendered as strings (article cards are generated into article.html).
export function tagMarkup(label, name = rubricStickers[label.toLocaleLowerCase('ru')]) {
  const sticker = `./assets/${name ? `stickers/${name}` : 'textures/topic-sticker'}.svg`;
  return `<span class="ct-tag"><img class="ct-tag__sticker" src="${sticker}" alt="" decoding="async" loading="lazy"><span class="ct-tag__label">${escape(label)}</span></span>`;
}

export function createTag({ label, sticker = stickerFor(label) }) {
  const tag = document.createElement('span');
  tag.className = 'ct-tag';
  const art = document.createElement('img');
  art.className = 'ct-tag__sticker';
  art.src = sticker;
  art.alt = '';
  art.decoding = 'async';
  art.loading = 'lazy';
  const text = document.createElement('span');
  text.className = 'ct-tag__label';
  text.textContent = label;
  tag.append(art, text);
  return tag;
}

// Stickers are slapped on by hand: each gets a stable tilt and nudge from its text,
// so the same story always looks the same but a column of tags never lines up.
function scatter(text) {
  let hash = 0;
  for (const char of text) hash = (hash * 31 + char.codePointAt(0)) >>> 0;
  return { tilt: (hash % 11) - 5, nudge: ((hash >>> 4) % 17) & ~1 };
}

export function createTagList(tags, seed = '') {
  const list = document.createElement('span');
  list.className = 'ct-tags';
  for (const tag of tags) {
    const node = createTag(tag);
    const { tilt, nudge } = scatter(`${seed}:${tag.label}`);
    node.style.setProperty('--tag-tilt', `${tilt}deg`);
    node.style.setProperty('--tag-nudge', `${nudge}px`);
    list.append(node);
  }
  return list;
}

// String twins of createTagList and createBurst for pages rendered as strings (the landing).
export function tagListMarkup(labels, seed = '', className = '') {
  return `<span class="ct-tags${className ? ` ${className}` : ''}">${labels.map(label => {
    const { tilt, nudge } = scatter(`${seed}:${label}`);
    return tagMarkup(label).replace('<span class="ct-tag">', `<span class="ct-tag" style="--tag-tilt: ${tilt}deg; --tag-nudge: ${nudge}px">`);
  }).join('')}</span>`;
}

// Burst family names used in design talk: «бах-бейдж» is the static НОВОЕ marker (createBurst), «бах-кнопка» the
// small one-word button (this function), «большой бах» the whole-burst «Читай дальше» link (bigBurstMarkup).
// Бах-кнопка: same white backing, outline and boil as the big one. It peeks out of a cover's corner and sends the
// reader to listen, watch or read. Without href it is a decoration inside a card that is itself the link.
export function burstLinkMarkup({ label, href }) {
  const shape = `<svg class="ct-big-burst__shape" viewBox="0 0 100 60" aria-hidden="true"><polygon class="ct-big-burst__backing" points="${burstFrames[1]}" transform="translate(3 3) rotate(3 50 30)"/><g class="ct-big-burst__frames">${burstFrames.map(points => `<polygon points="${points}"/>`).join('')}</g></svg>`;
  const text = `<span class="ct-big-burst__text"><span class="ct-big-burst__label">${escape(label)}</span></span>`;
  if (!href) return `<span class="ct-big-burst ct-big-burst--small" aria-hidden="true">${shape}${text}</span>`;
  return `<a class="ct-big-burst ct-big-burst--small" href="${escape(href)}" target="_blank" rel="noopener">${shape}${text}</a>`;
}

export function createBurst(label) {
  const burst = document.createElement('span');
  burst.className = 'ct-burst';
  burst.innerHTML = `<svg viewBox="0 0 100 60" aria-hidden="true">${burstFrames.map(points => `<polygon points="${points}"/>`).join('')}</svg>`;
  const text = document.createElement('span');
  text.className = 'ct-burst__label';
  text.textContent = label;
  burst.append(text);
  return burst;
}

// Big burst: one per screen, a whole-burst link at the end of an article. Desktop and mobile get their own outline
// (560×340 and 358×300); the white backing is a static offset copy, the neon frames boil like the small burst.
const bigBurstFrames = {
  wide: [
    '550.2,161.7 471.5,209.2 541.1,256.0 460.1,248.1 503.7,299.0 413.6,272.2 429.1,335.8 349.2,287.4 268.2,347.6 215.0,289.6 134.9,321.8 144.9,274.2 73.0,300.8 99.5,254.6 15.0,261.2 82.9,207.1 12.2,166.7 85.1,136.8 18.1,81.8 100.3,89.6 64.2,39.6 147.6,59.5 131.1,9.0 214.2,45.4 296.7,3.6 350.3,53.8 425.0,4.7 409.5,61.2 497.5,31.0 460.0,90.2 542.1,89.2 480.9,132.9',
    '572.9,157.8 483.1,205.4 540.6,249.8 449.5,252.4 497.0,303.9 414.1,277.3 433.7,334.9 349.9,287.5 307.9,335.9 215.4,294.9 144.8,325.1 143.8,283.0 63.2,308.2 101.3,253.0 11.1,260.4 78.6,209.5 -2.2,154.6 87.6,136.3 18.3,78.2 94.2,88.1 56.3,33.0 153.0,62.9 128.8,3.6 207.8,47.1 254.3,-3.2 350.4,45.0 429.5,10.4 406.4,64.4 500.3,36.7 460.1,83.2 550.3,81.6 474.0,128.9',
    '556.5,167.2 485.7,206.0 547.9,250.9 448.4,250.8 501.6,305.3 417.2,274.6 418.3,330.8 338.4,287.6 298.0,333.4 213.4,295.0 131.4,334.9 145.0,280.2 69.8,303.4 98.3,251.4 26.5,254.1 86.5,210.5 -8.6,180.3 74.1,133.2 29.2,82.9 102.2,89.8 56.3,41.2 155.2,64.4 144.3,14.9 215.1,45.2 260.6,8.4 336.6,48.3 407.9,14.2 418.2,58.6 496.5,37.4 452.0,92.6 536.7,87.0 486.7,130.8'
],
  narrow: [
    '350.7,157.5 308.6,191.9 342.0,240.9 282.4,230.8 294.5,275.9 240.2,254.3 223.2,297.2 146.7,256.8 82.3,298.3 92.9,239.8 39.0,263.0 59.1,215.2 1.8,201.3 49.3,145.3 2.1,100.7 60.5,89.2 27.1,39.4 98.2,57.8 97.5,13.5 148.6,45.7 227.3,-2.2 243.4,50.3 304.0,17.7 287.9,66.2 340.4,65.3 305.4,112.4',
    '356.7,156.4 300.3,190.2 340.4,238.4 280.8,229.3 298.2,277.1 244.1,254.6 222.1,306.1 149.3,254.9 90.7,293.2 94.6,245.7 38.3,264.4 58.7,213.9 0.6,199.8 50.4,160.9 -1.3,96.8 66.1,86.5 37.8,37.9 90.4,57.3 93.2,10.2 146.8,43.3 221.7,6.0 238.9,48.9 298.6,23.6 281.3,73.4 343.9,66.3 309.1,113.4',
    '355.9,139.4 304.6,186.6 345.5,239.6 284.2,228.8 306.5,283.3 245.3,255.8 225.0,291.4 150.9,256.8 85.9,297.5 93.6,242.6 31.9,260.5 63.3,213.8 1.3,212.5 53.5,160.3 1.9,92.7 59.7,85.3 28.7,30.3 96.4,55.0 93.7,12.5 149.6,45.5 228.7,-2.5 239.9,44.7 296.5,25.3 287.9,69.1 350.5,58.1 299.6,108.4'
],
};

function bigBurstShape(kind, width, height) {
  const frames = bigBurstFrames[kind];
  return `<svg class="ct-big-burst__shape ct-big-burst__shape--${kind}" viewBox="0 0 ${width} ${height}" aria-hidden="true"><polygon class="ct-big-burst__backing" points="${frames[1]}" transform="translate(12 12) rotate(3 ${width / 2} ${height / 2})"/><g class="ct-big-burst__frames">${frames.map(points => `<polygon points="${points}"/>`).join('')}</g></svg>`;
}

// Большой бах says two words at most, one per line («Открыть / статью», «Читать / дальше»), with no kicker above.
// Anything longer, such as which story comes next, goes into the link's accessible name, not onto the burst.
export function bigBurstMarkup({ href, words, label }) {
  const lines = words.slice(0, 2).map(word => `<span class="ct-big-burst__word">${escape(word)}</span>`).join('');
  const name = label ? ` aria-label="${escape(label)}"` : '';
  return `<a class="ct-big-burst" href="${escape(href)}"${name}>${bigBurstShape('wide', 560, 340)}${bigBurstShape('narrow', 358, 300)}<span class="ct-big-burst__text"><span class="ct-big-burst__title">${lines}</span></span></a>`;
}

// The article ends with the last paragraph and the big burst side by side. When the free space right of the column
// (up to the right rail, or the screen edge when the rail is folded) fits the burst, it hangs there beside the
// paragraph; otherwise the paragraph narrows and shares the column with it. The room is kept in --big-burst-room.
export function mountBigBursts(root) {
  const ends = [...root.querySelectorAll('.story-end')];
  if (!ends.length) return () => {};
  const rail = document.querySelector('.scene-rail');
  let frame = 0;
  function measure() {
    cancelAnimationFrame(frame);
    frame = 0;
    const railBox = rail?.getBoundingClientRect();
    const railShown = railBox && railBox.width > 0 && getComputedStyle(rail).visibility !== 'hidden';
    const edge = Math.min(document.documentElement.clientWidth, railShown ? railBox.left : Infinity);
    for (const end of ends) {
      const room = Math.max(0, Math.round(edge - end.getBoundingClientRect().right));
      end.style.setProperty('--big-burst-room', `${room}px`);
      end.dataset.place = room >= 360 ? 'beside' : 'inline';
    }
  }
  const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
  const size = new ResizeObserver(schedule);
  size.observe(document.documentElement);
  ends.forEach(end => size.observe(end));
  if (rail) size.observe(rail);
  // Folding the rail slides it out over the shell motion; measure again once it has settled.
  const shell = new MutationObserver(() => { schedule(); setTimeout(schedule, 340); });
  shell.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  measure();
  return () => {
    cancelAnimationFrame(frame);
    size.disconnect();
    shell.disconnect();
  };
}

// Every бах keeps its words inside its own outline: --burst-text-inset (16px desktop, 8px phone) clear of the black
// contour, on all three boiling frames. The type size from CSS is the most it may be; when the words do not fit the
// burst at that size they shrink, and the block shifts to the roomiest spot between the spikes.
const fitted = new WeakSet();
let burstSize;

function framePolygons(burst) {
  const shape = [...burst.querySelectorAll('.ct-big-burst__shape')].find(svg => getComputedStyle(svg).display !== 'none');
  if (!shape) return null;
  const [, , viewWidth, viewHeight] = shape.getAttribute('viewBox').split(/[\s,]+/).map(Number);
  const width = burst.offsetWidth;
  const height = burst.offsetHeight;
  const scale = Math.min(width / viewWidth, height / viewHeight);
  const left = (width - viewWidth * scale) / 2;
  const top = (height - viewHeight * scale) / 2;
  const frames = [...shape.querySelectorAll('.ct-big-burst__frames polygon')];
  const style = getComputedStyle(frames[0]);
  const stroke = parseFloat(style.strokeWidth) * (style.vectorEffect === 'non-scaling-stroke' ? 1 : scale);
  const polygons = frames.map(frame => frame.getAttribute('points').trim().split(/\s+/).map(pair => {
    const [x, y] = pair.split(',').map(Number);
    return [left + x * scale, top + y * scale];
  }));
  return { polygons, stroke, width, height };
}

function pointInside(polygon, x, y) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// A box lies inside a polygon when its corners do and no vertex of the outline pokes into it.
function boxInside(polygons, left, top, right, bottom) {
  return polygons.every(polygon => [[left, top], [right, top], [right, bottom], [left, bottom]].every(([x, y]) => pointInside(polygon, x, y))
    && !polygon.some(([x, y]) => x > left && x < right && y > top && y < bottom));
}

export function fitBurstText(burst) {
  const text = burst.querySelector('.ct-big-burst__text');
  const outline = text && burst.offsetWidth ? framePolygons(burst) : null;
  if (!outline) return;
  const words = text.firstElementChild || text;
  words.style.removeProperty('font-size');
  text.style.removeProperty('translate');
  // Layout sizes ignore the burst's tilt; the text box is max-content wide, so it is exactly the widest word.
  const wordsWidth = text.offsetWidth;
  const wordsHeight = text.offsetHeight;
  if (!wordsWidth) return;
  const inset = (parseFloat(getComputedStyle(burst).getPropertyValue('--burst-text-inset')) || 0) + outline.stroke / 2;
  const { polygons, width, height } = outline;
  let best = { scale: 0, x: 0, y: 0 };
  // Try the centre first, then nearby spots; keep the one that lets the words stay biggest.
  for (let step = 0; step <= 6; step++) {
    for (const [dx, dy] of step ? [[step, 0], [-step, 0], [0, step], [0, -step], [step, step], [-step, step], [step, -step], [-step, -step]] : [[0, 0]]) {
      const x = dx * width * .025;
      const y = dy * height * .025;
      let low = 0;
      let high = 1;
      const fits = scale => {
        const halfWidth = wordsWidth * scale / 2 + inset;
        const halfHeight = wordsHeight * scale / 2 + inset;
        return boxInside(polygons, width / 2 + x - halfWidth, height / 2 + y - halfHeight, width / 2 + x + halfWidth, height / 2 + y + halfHeight);
      };
      if (fits(1)) low = 1;
      else for (let i = 0; i < 12; i++) { const mid = (low + high) / 2; if (fits(mid)) low = mid; else high = mid; }
      if (low > best.scale + .01) best = { scale: low, x, y };
    }
    if (best.scale >= 1) break;
  }
  if (best.scale < 1) {
    const size = parseFloat(getComputedStyle(words).fontSize);
    words.style.fontSize = `${Math.floor(size * best.scale * 2) / 2}px`;
  }
  if (best.x || best.y) text.style.translate = `${best.x.toFixed(1)}px ${best.y.toFixed(1)}px`;
}

// Bursts appear late (search results, sheets, the copied-link toast), so any burst added to the page is watched.
function watchBursts(root) {
  for (const burst of root.matches?.('.ct-big-burst') ? [root] : root.querySelectorAll?.('.ct-big-burst') || []) {
    if (fitted.has(burst)) continue;
    fitted.add(burst);
    burstSize.observe(burst);
  }
}

if (typeof document !== 'undefined' && typeof ResizeObserver !== 'undefined') {
  burstSize = new ResizeObserver(entries => entries.forEach(entry => fitBurstText(entry.target)));
  const refitAll = () => document.querySelectorAll('.ct-big-burst').forEach(fitBurstText);
  new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => node.nodeType === 1 && watchBursts(node))))
    .observe(document.documentElement, { childList: true, subtree: true });
  watchBursts(document.documentElement);
  document.fonts?.ready.then(refitAll);
  matchMedia('(max-width: 760px)').addEventListener('change', refitAll);
}
