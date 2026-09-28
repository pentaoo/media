const LOGIN_PATTERN = /^[a-zA-Z0-9_]{4,25}$/;
const VIDEO_PATTERN = /^\d+$/;

export function prepareChannels(channels) {
  const seen = new Set();
  return channels
    .filter((channel) => {
      if (!channel || !LOGIN_PATTERN.test(channel.login || '') || !channel.name?.trim()) return false;
      const login = channel.login.toLowerCase();
      if (seen.has(login)) return false;
      seen.add(login);
      return true;
    })
    .map((channel) => ({
      name: channel.name.trim(),
      login: channel.login.toLowerCase(),
      description: channel.description?.trim() || '',
      tags: Array.isArray(channel.tags) ? channel.tags.filter((tag) => typeof tag === 'string' && tag.trim()).map((tag) => tag.trim()) : [],
      priority: Number.isFinite(channel.priority) ? channel.priority : 0,
      recordingId: VIDEO_PATTERN.test(channel.recordingId || '') ? channel.recordingId : '',
      recordingTitle: typeof channel.recordingTitle === 'string' ? channel.recordingTitle.trim() : '',
      recordingCheckedAt: /^\d{4}-\d{2}-\d{2}$/.test(channel.recordingCheckedAt || '') ? channel.recordingCheckedAt : '',
    }))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 5);
}

export function twitchParent(location) {
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  return location.protocol === 'https:' || (local && location.protocol === 'http:')
    ? location.hostname
    : null;
}

export function playbackMode(status, recordingId, probeFinished = false) {
  if (status === 'offline' || (status !== 'live' && probeFinished)) return recordingId ? 'recording' : 'empty';
  return 'channel'; // Unknown status stays neutral while the official player checks it.
}

export function chooseInitialChannel(channels, statuses) {
  return channels.find((channel) => statuses[channel.login] === 'live') || channels[0] || null;
}
