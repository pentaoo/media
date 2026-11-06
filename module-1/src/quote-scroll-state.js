export const quoteTiming = { enter: .45, firstHold: .14, lineHold: .045, transitionDistance: 1.15, responseMs: 80, lastHold: .14, overlap: .32, fadeOut: .5, lyricsExit: .45 };
const clamp = value => Math.min(1, Math.max(0, value));
const ease = value => value * value * (3 - 2 * value);

/** Brief reading stops scale with the viewport, capped for a light scroll feel. */
export function quoteReadingLayout(height, offsets) {
  const lineHold = Math.min(48, Math.max(24, height * quoteTiming.lineHold));
  let distance = 0;
  const stops = offsets.map((offset, index) => {
    if (index) distance += (offset - offsets[index - 1]) * quoteTiming.transitionDistance;
    const start = distance;
    distance += offsets.length === 1 ? height * (quoteTiming.firstHold + quoteTiming.lastHold)
      : index === 0 ? height * quoteTiming.firstHold
        : index === offsets.length - 1 ? height * quoteTiming.lastHold : lineHold;
    return { offset, start, end: distance };
  });
  return { stops, travel: offsets.at(-1) ?? 0, runway: distance };
}

/** Follow the scroll target with brief, frame-rate-independent damping. */
export function smoothQuoteTravel(current, target, elapsed, stickiness = 1) {
  if (stickiness === 0) return target;
  const next = current + (target - current) * (1 - Math.exp(-elapsed / (quoteTiming.responseMs * stickiness)));
  return Math.abs(target - next) < .15 ? target : next;
}

/** Quiet reading keeps its magnets; sustained quick scrolling passes freely. */
export function quoteScrollStickiness(speed) {
  return 1 - ease(clamp((speed - .45) / .75));
}

function readingTravel(distance, stops) {
  for (let index = 0; index < stops.length; index++) {
    const stop = stops[index];
    if (distance <= stop.end) return stop.offset;
    const next = stops[index + 1];
    if (next && distance < next.start) {
      const progress = clamp((distance - stop.end) / (next.start - stop.end));
      // Ease to rest at both ends; reversing input follows the same curve.
      return stop.offset + (next.offset - stop.offset) * ease(progress);
    }
  }
  return stops.at(-1)?.offset ?? 0;
}

/** Scroll distances, rather than timers, control the reversible scene phases. */
export function quoteScrollState(distance, { height, stops, travel, runway, exit }, stickiness = 1) {
  const enter = clamp((distance + height * quoteTiming.enter) / (height * quoteTiming.enter));
  const leave = clamp((distance - runway) / exit);
  return {
    travel: travel * clamp(distance / runway) * (1 - stickiness) + readingTravel(distance, stops) * stickiness,
    mediaOpacity: enter * (1 - clamp(leave / quoteTiming.fadeOut)),
    lyricsOpacity: 1 - clamp(leave / quoteTiming.lyricsExit),
  };
}
