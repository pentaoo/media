const manifestUrl = new URL('../assets/video/editorial/manifest.json', import.meta.url);

/** A lazy city-video format. Sound is enabled only by an explicit button press. */
export function mountMobileCityVideo(host) {
  const controller = new AbortController();
  const options = { signal: controller.signal };
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  host.innerHTML = `<video muted playsinline loop preload="none" aria-label="Китай-город. Видео без звука"></video>
    <div class="mobile-city-video__controls">
      <button type="button" data-video-play>пауза</button>
      <button type="button" data-video-sound aria-pressed="false">включить звук</button>
      <button type="button" data-video-next>следующее →</button>
    </div><p class="mobile-city-video__status" role="status"></p>`;
  const video = host.querySelector('video');
  const play = host.querySelector('[data-video-play]');
  const sound = host.querySelector('[data-video-sound]');
  const status = host.querySelector('[role="status"]');
  let clips = [];
  let index = 0;
  let active = false;
  let paused = reducedMotion.matches || !!navigator.connection?.saveData;
  let loading;
  let failed = false;

  function updateControls() {
    play.textContent = video.paused ? 'смотреть' : 'пауза';
    sound.textContent = video.muted ? 'включить звук' : 'выключить звук';
    sound.setAttribute('aria-pressed', String(!video.muted));
  }
  async function sync() {
    if (!active || document.hidden || paused) { video.pause(); return; }
    try { await video.play(); } catch { /* The visible play button handles autoplay restrictions. */ }
    if (!active || document.hidden || paused || controller.signal.aborted) video.pause();
    updateControls();
  }
  function select() {
    const clip = clips[index];
    if (!clip) return;
    failed = false;
    status.textContent = '';
    video.pause();
    video.muted = true;
    video.poster = new URL(clip.articlePoster, manifestUrl).href;
    video.src = new URL(clip.article, manifestUrl).href;
    video.style.objectPosition = `${clip.focus[0] * 100}% ${clip.focus[1] * 100}%`;
    video.setAttribute('aria-label', `${clip.title}. Китай-город`);
    sync();
    updateControls();
  }
  function load() {
    if (loading) return loading;
    loading = fetch(manifestUrl, options).then(response => {
      if (!response.ok) throw new Error('Video manifest unavailable');
      return response.json();
    }).then(manifest => {
      if (controller.signal.aborted) return;
      clips = manifest.clips.filter(clip => clip.id.startsWith('kitay-'));
      if (!clips.length) throw new Error('No city videos');
      select();
    }).catch(() => {
      if (controller.signal.aborted) return;
      loading = null;
      failed = true;
      status.textContent = 'Видео не загрузилось. Нажми «Смотреть», чтобы повторить.';
      updateControls();
    });
    return loading;
  }
  play.addEventListener('click', () => {
    if (failed) { paused = false; if (clips.length) { video.load(); sync(); } else load(); }
    else { paused = !video.paused; sync(); }
  }, options);
  sound.addEventListener('click', () => {
    video.muted = !video.muted;
    paused = false;
    sync();
    updateControls();
  }, options);
  host.querySelector('[data-video-next]').addEventListener('click', () => {
    index = (index + 1) % Math.max(1, clips.length);
    select();
  }, options);
  for (const name of ['play', 'pause', 'volumechange']) video.addEventListener(name, updateControls, options);
  video.addEventListener('error', () => {
    failed = true;
    status.textContent = 'Видео не загрузилось. Нажми «Смотреть», чтобы повторить.';
    updateControls();
  }, options);
  video.addEventListener('playing', () => { failed = false; status.textContent = ''; }, options);
  document.addEventListener('visibilitychange', sync, options);
  reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) paused = true; sync(); }, options);
  updateControls();
  return {
    setActive(value) {
      if (active === value) return;
      active = value;
      if (!active) video.muted = true;
      if (active && !video.src) load();
      else sync();
    },
    dispose() {
      controller.abort();
      active = false;
      video.pause();
      video.removeAttribute('src');
      video.load();
    },
  };
}
