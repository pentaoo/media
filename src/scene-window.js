import { liveChannels } from './live-channels.js';
import { getApprovedChannelStatuses } from './live-status.js';
import { chooseInitialChannel, playbackMode, prepareChannels, twitchParent } from './twitch-scene.js';

const SCRIPT_URL = 'https://player.twitch.tv/js/embed/v1.js';
let scriptPromise;

function loadTwitchPlayer() {
  if (window.Twitch?.Player) return Promise.resolve(window.Twitch);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    const timeout = window.setTimeout(() => fail(), 10000);
    function fail() {
      window.clearTimeout(timeout);
      script.remove();
      scriptPromise = undefined;
      reject(new Error('Twitch script unavailable'));
    }
    script.onerror = fail;
    script.onload = () => {
      window.clearTimeout(timeout);
      if (window.Twitch?.Player) resolve(window.Twitch);
      else fail();
    };
    document.head.append(script);
  });
  return scriptPromise;
}

function node(tag, className, content) {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (content !== undefined) item.textContent = content;
  return item;
}

function channelUrl(channel) {
  return `https://www.twitch.tv/${channel.login}`;
}

function recordingUrl(channel) {
  return `https://www.twitch.tv/videos/${channel.recordingId}`;
}

export function createSceneWindow() {
  const channels = prepareChannels(liveChannels);
  const section = node('section', 'scene-window');
  section.setAttribute('aria-labelledby', 'scene-window-title');
  const header = node('div', 'scene-window__header');
  const heading = node('h2', '', 'Окно в сцену');
  heading.id = 'scene-window-title';
  header.append(heading, node('small', '', 'Выбор редакции · Twitch'));
  section.append(header);

  if (!channels.length) {
    section.append(node('p', 'scene-window__empty', 'Подборка каналов готовится. Загляните позже.'));
    return section;
  }

  const statuses = Object.create(null);
  const unconfirmed = new Set();
  let selected = null;
  let generation = 0;
  let readyTimer;
  let probeTimer;
  let disposed = false;

  const layout = node('div', 'scene-window__layout');
  const videoColumn = node('div', 'scene-window__video-column');
  const videoViewport = node('div', 'scene-window__video-viewport');
  const videoSurface = node('div', 'scene-window__video-surface');
  const narrowNote = node('small', 'scene-window__narrow-note', 'На узком экране плеер прокручивается по горизонтали.');
  const playbackNote = node('p', 'scene-window__playback-note');
  playbackNote.setAttribute('aria-live', 'polite');
  videoViewport.append(videoSurface);
  videoColumn.append(videoViewport, narrowNote, playbackNote);

  const info = node('div', 'scene-window__info');
  const state = node('small', 'scene-window__state');
  state.setAttribute('aria-live', 'polite');
  const title = node('h3');
  const description = node('p');
  const tags = node('p', 'scene-window__tags');
  const tagNote = node('small', 'scene-window__tag-note', 'Метки — редакционные обозначения сообщества, а не геолокация эфира.');
  const link = node('a', 'scene-window__external', 'Открыть канал в Twitch ↗');
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  const archive = node('div', 'scene-window__archive');
  const archiveLabel = node('small', '', 'Последняя запись');
  const archiveTitle = node('p', 'scene-window__archive-title');
  const archiveChecked = node('small', 'scene-window__archive-checked');
  const archiveLink = node('a', '', 'Открыть запись в Twitch ↗');
  archiveLink.target = '_blank';
  archiveLink.rel = 'noopener noreferrer';
  archive.append(archiveLabel, archiveTitle, archiveChecked, archiveLink);
  const checkButton = node('button', 'scene-window__check', 'Проверить эфир');
  checkButton.type = 'button';
  checkButton.addEventListener('click', () => {
    delete statuses[selected.login];
    unconfirmed.delete(selected.login);
    updateText();
    mountSelected();
  });
  info.append(state, title, description, tags, tagNote, link, archive, checkButton);
  layout.append(videoColumn, info);

  const switcher = node('div', 'scene-window__switcher');
  switcher.hidden = channels.length < 2;
  switcher.append(node('h3', '', 'Каналы'));
  const channelList = node('div', 'scene-window__channels');
  switcher.append(channelList);
  section.append(layout, switcher);

  function statusText(channel) {
    const status = statuses[channel.login];
    const mode = playbackMode(status, channel.recordingId, unconfirmed.has(channel.login));
    if (mode === 'recording') return status === 'offline' ? 'Запись' : 'Запись · эфир не подтверждён';
    if (mode === 'empty') return status === 'offline' ? 'Сейчас без эфира' : 'Эфир не подтверждён';
    return statuses[channel.login] === 'live' ? 'Прямой эфир' : 'Статус эфира уточняется';
  }

  function updateText() {
    if (!selected) return;
    title.textContent = selected.name;
    description.textContent = selected.description;
    description.hidden = !selected.description;
    tags.textContent = selected.tags.length ? `Метки: ${selected.tags.join(' · ')}` : '';
    tags.hidden = !selected.tags.length;
    tagNote.hidden = !selected.tags.length;
    link.href = channelUrl(selected);
    archive.hidden = !selected.recordingId;
    if (selected.recordingId) {
      archiveTitle.textContent = selected.recordingTitle || `Запись ${selected.recordingId}`;
      archiveChecked.textContent = selected.recordingCheckedAt
        ? `Проверено редакцией ${selected.recordingCheckedAt.split('-').reverse().join('.')}`
        : '';
      archiveChecked.hidden = !selected.recordingCheckedAt;
      archiveLink.href = recordingUrl(selected);
    }
    state.textContent = statusText(selected);
    state.classList.toggle('scene-window__state--live', statuses[selected.login] === 'live');
    checkButton.hidden = statuses[selected.login] === 'live'
      || (statuses[selected.login] === undefined && !unconfirmed.has(selected.login));

    channelList.replaceChildren();
    for (const channel of channels) {
      const button = node('button', 'scene-window__channel');
      button.type = 'button';
      button.setAttribute('aria-pressed', String(channel.login === selected.login));
      button.append(node('span', '', channel.name));
      const channelStatus = statuses[channel.login];
      if (channelStatus === 'live' || channelStatus === 'offline') {
        button.append(node('small', '', channelStatus === 'live' ? 'В эфире' : 'Офлайн'));
      }
      button.addEventListener('click', () => selectChannel(channel));
      channelList.append(button);
    }
  }

  function showFallback(message, retry = false) {
    ++generation;
    window.clearTimeout(readyTimer);
    window.clearTimeout(probeTimer);
    videoSurface.classList.add('scene-window__video-surface--fallback');
    narrowNote.hidden = true;
    videoSurface.replaceChildren(node('p', 'scene-window__fallback', message));
    if (retry) {
      const button = node('button', 'scene-window__retry', 'Повторить загрузку');
      button.type = 'button';
      button.addEventListener('click', mountSelected);
      videoSurface.append(button);
    }
    playbackNote.textContent = 'Канал можно открыть по ссылке рядом с плеером.';
  }

  async function mountSelected() {
    if (disposed) return;
    const current = ++generation;
    window.clearTimeout(readyTimer);
    window.clearTimeout(probeTimer);
    videoSurface.classList.remove('scene-window__video-surface--fallback');
    narrowNote.hidden = false;
    videoSurface.replaceChildren(); // Удаление iframe останавливает предыдущее видео.
    const mode = playbackMode(statuses[selected.login], selected.recordingId, unconfirmed.has(selected.login));
    if (mode === 'empty') {
      showFallback(statuses[selected.login] === 'offline'
        ? 'Сейчас нет эфира и выбранной записи.'
        : 'Эфир не подтверждён. Выбранной записи нет.');
      return;
    }
    const parent = twitchParent(window.location);
    if (!parent) {
      showFallback('Встроенный плеер доступен на HTTPS.');
      return;
    }

    playbackNote.textContent = 'Загружаем плеер Twitch…';
    videoSurface.append(node('p', 'scene-window__fallback', 'Загружаем плеер Twitch…'));
    let Twitch;
    try {
      Twitch = await loadTwitchPlayer();
    } catch {
      if (current === generation) showFallback('Плеер Twitch не загрузился.', true);
      return;
    }
    if (current !== generation) return;

    const holder = node('div', 'scene-window__embed');
    holder.id = 'scene-window-embed';
    videoSurface.replaceChildren(holder);
    const options = {
      width: '100%',
      height: '100%',
      parent: [parent],
      autoplay: false, // На мобильных устройствах запуск всё равно требует действия пользователя.
      ...(mode === 'recording' ? { video: selected.recordingId } : { channel: selected.login }),
    };
    try {
      const player = new Twitch.Player(holder.id, options);
      let ready = false;
      const valid = () => current === generation;
      player.addEventListener(Twitch.Player.READY, () => {
        if (!valid()) return;
        ready = true;
        window.clearTimeout(readyTimer);
        playbackNote.textContent = mode === 'recording'
          ? 'Запись выбрана редакцией. Включите воспроизведение в плеере.'
          : 'Включите воспроизведение в плеере. Статус канала может уточняться.';
        if (mode === 'channel' && statuses[selected.login] === undefined) {
          probeTimer = window.setTimeout(() => {
            if (!valid() || statuses[selected.login] !== undefined) return;
            unconfirmed.add(selected.login);
            updateText();
            mountSelected();
          }, 8000);
        }
      });
      player.addEventListener(Twitch.Player.PLAYBACK_BLOCKED, () => {
        if (valid()) playbackNote.textContent = 'Автозапуск ограничен браузером. Нажмите Play в плеере Twitch.';
      });
      if (mode === 'channel') {
        player.addEventListener(Twitch.Player.ONLINE, () => {
          if (valid()) setStatus(selected.login, 'live');
        });
        player.addEventListener(Twitch.Player.OFFLINE, () => {
          if (valid()) setStatus(selected.login, 'offline');
        });
      }
      readyTimer = window.setTimeout(() => {
        if (valid() && !ready) showFallback('Плеер Twitch не ответил вовремя.', true);
      }, 12000);
    } catch {
      if (current === generation) showFallback('Не удалось открыть плеер Twitch.', true);
    }
  }

  function setStatus(login, value) {
    if (disposed || (value !== 'live' && value !== 'offline')) return;
    const previousMode = selected && playbackMode(statuses[selected.login], selected.recordingId, unconfirmed.has(selected.login));
    statuses[login] = value;
    unconfirmed.delete(login);
    updateText();
    if (selected?.login === login && previousMode !== playbackMode(value, selected.recordingId)) mountSelected();
  }

  function selectChannel(channel) {
    if (disposed || selected?.login === channel.login) return;
    selected = channel;
    updateText();
    mountSelected();
  }

  selectChannel(channels[0]);
  // Список разрешённых каналов — единственный вход в будущий источник статусов.
  getApprovedChannelStatuses(channels).then((result) => {
    if (disposed || !result || typeof result !== 'object') return;
    for (const channel of channels) setStatus(channel.login, result[channel.login]);
    const firstLive = chooseInitialChannel(channels, statuses);
    if (selected === channels[0] && firstLive && firstLive !== selected) selectChannel(firstLive);
  }).catch(() => {}); // Ошибка источника оставляет нейтральный статус.

  section.dispose = () => {
    disposed = true;
    ++generation;
    window.clearTimeout(readyTimer);
    window.clearTimeout(probeTimer);
    videoSurface.replaceChildren();
  };

  return section;
}
