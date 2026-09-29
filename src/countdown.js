export const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export function formatCountdown(milliseconds) {
  const seconds = Math.ceil(Math.max(0, milliseconds) / 1000);
  const values = [
    Math.floor(seconds / 86400),
    Math.floor(seconds / 3600) % 24,
    Math.floor(seconds / 60) % 60,
    seconds % 60,
  ];
  return values.map((value) => String(value).padStart(2, '0')).join(':');
}

// Read elapsed wall time instead of subtracting a second on each interval:
// background tabs and sleeping devices can delay interval callbacks.
export function createCountdown({ durationMs = THIRTY_DAYS_MS, now = Date.now } = {}) {
  let deadline = now() + durationMs;
  return {
    reset() { deadline = now() + durationMs; },
    read() {
      const remainingMs = Math.min(durationMs, Math.max(0, deadline - now()));
      return { remainingMs, text: formatCountdown(remainingMs) };
    },
  };
}
