const manifestUrl = new URL('../assets/video/editorial/manifest.json', import.meta.url);

/** Optional article cuts: <video data-editorial-video="clip-id" controls playsinline>. */
export function mountEditorialVideos(content) {
  const videos = [...content.querySelectorAll('video[data-editorial-video]')];
  const controller = new AbortController();
  if (videos.length) fetch(manifestUrl, { signal: controller.signal }).then(response => {
    if (!response.ok) throw new Error('Video manifest unavailable');
    return response.json();
  }).then(manifest => {
    if (controller.signal.aborted) return;
    for (const video of videos) {
      const clip = manifest.clips.find(item => item.id === video.dataset.editorialVideo);
      if (!clip) continue;
      video.preload = 'none';
      video.playsInline = true;
      video.controls = true;
      video.poster = new URL(clip.articlePoster, manifestUrl).href;
      video.src = new URL(clip.article, manifestUrl).href;
    }
  }).catch(() => {});
  return () => {
    controller.abort();
    for (const video of videos) { video.pause(); video.removeAttribute('src'); video.load(); }
  };
}
