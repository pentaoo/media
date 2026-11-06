const manifestUrl = new URL('../assets/video/editorial/manifest.json', import.meta.url);

/** A local, silent cut loads near the quote; the photograph remains the fallback. */
export function mountQuoteBackgroundVideo(media) {
  const clipId = media.dataset.videoClip;
  const host = media.querySelector('.story-quote-scene__video');
  const controller = new AbortController();
  const options = { signal: controller.signal };
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let video;
  let loading = false;
  let wanted = false;

  function fallback(state) {
    media.classList.remove('is-video-playing');
    media.dataset.videoState = state;
  }

  async function syncPlayback() {
    if (!video || controller.signal.aborted) return;
    if (!wanted || document.hidden || reducedMotion.matches) { video.pause(); return; }
    if (!video.paused) return;
    try {
      await video.play();
      if (!wanted || document.hidden || reducedMotion.matches || controller.signal.aborted) video.pause();
    } catch (error) {
      if (!controller.signal.aborted && wanted && !document.hidden && !reducedMotion.matches && error.name !== 'AbortError') {
        fallback(error.name === 'NotAllowedError' ? 'autoplay-blocked' : 'unavailable');
      }
    }
  }

  async function preload() {
    if (loading || !clipId || controller.signal.aborted || reducedMotion.matches || document.hidden) return;
    loading = true;
    media.dataset.videoState = 'loading';
    try {
      const response = await fetch(manifestUrl, options);
      if (!response.ok) throw new Error('Video manifest unavailable');
      const manifest = await response.json();
      if (controller.signal.aborted || reducedMotion.matches) { loading = false; return; }
      const clip = manifest.clips.find(item => item.id === clipId);
      if (!clip?.article) throw new Error('Quote cut unavailable');
      video = document.createElement('video');
      video.muted = true;
      video.defaultMuted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = 'auto';
      video.tabIndex = -1;
      video.setAttribute('aria-hidden', 'true');
      video.addEventListener('loadeddata', () => {
        media.dataset.videoState = 'ready';
        syncPlayback();
      }, options);
      video.addEventListener('playing', () => {
        if (!wanted || document.hidden || reducedMotion.matches) { video.pause(); return; }
        media.classList.add('is-video-playing');
        media.dataset.videoState = 'playing';
      }, options);
      video.addEventListener('pause', () => {
        if (!video.error && media.dataset.videoState !== 'autoplay-blocked') media.dataset.videoState = 'paused';
      }, options);
      video.addEventListener('waiting', () => { media.dataset.videoState = 'buffering'; }, options);
      video.addEventListener('error', () => fallback('unavailable'), options);
      video.src = new URL(clip.article, manifestUrl).href;
      host.append(video);
      syncPlayback();
    } catch {
      if (!controller.signal.aborted) fallback('unavailable');
    }
  }

  return {
    preload,
    setActive(active) {
      if (wanted === active) return;
      wanted = active;
      if (active) preload();
      syncPlayback();
    },
    dispose() {
      controller.abort();
      if (video) {
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
      host.replaceChildren();
      fallback('idle');
    },
  };
}
