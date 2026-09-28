const MUSIC_ORIGIN = 'https://music.yandex.ru';
const RELEASE_PATH = /^\/album\/([1-9]\d*)(?:\/track\/([1-9]\d*))?\/?$/;

/** Return canonical Yandex Music URLs only for supported album and track links. */
export function parseYandexMusicUrl(value) {
  if (typeof value !== 'string') return null;

  const input = value.trim();
  let url;
  try {
    url = new URL(input);
  } catch {
    return null;
  }

  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'music.yandex.ru' ||
    url.username ||
    url.password ||
    url.port ||
    url.search ||
    url.hash
  ) {
    return null;
  }

  // Reject paths normalized by URL (for example /album/1/../album/2).
  if (input !== `${MUSIC_ORIGIN}${url.pathname}`) return null;

  const match = RELEASE_PATH.exec(url.pathname);
  if (!match) return null;

  const path = `/album/${match[1]}${match[2] ? `/track/${match[2]}` : ''}`;
  return {
    type: match[2] ? 'track' : 'album',
    sourceUrl: `${MUSIC_ORIGIN}${path}`,
    iframeUrl: `${MUSIC_ORIGIN}/iframe${path}`,
  };
}

export function toYandexMusicIframeUrl(value) {
  return parseYandexMusicUrl(value)?.iframeUrl ?? null;
}
