/** Coordinates use document pixels. Array order is the explicit overlap priority. */
export function contextAtPosition(ranges, readingY, previousId = null, tolerance = 24) {
  const previous = ranges.find(range => range.id === previousId);
  if (previous && readingY >= previous.start - tolerance && readingY < previous.end + tolerance) return previous.id;
  return ranges.find(range => readingY >= range.start && readingY < range.end)?.id || null;
}

/** A manual selection survives every automatic transition, while reading. */
export function selectContextState({ manualId = null, previewId = null, interactionId = null, automaticId = null } = {}) {
  if (manualId) return { type: 'material', id: manualId, manual: true };
  if (previewId) return { type: 'material', id: previewId, manual: false };
  if (interactionId) return { type: 'material', id: interactionId, manual: false };
  if (automaticId) return { type: 'material', id: automaticId, manual: false };
  return { type: 'video' };
}

/** Positive means a later source enters from the right; earlier sources enter from the left. */
export function contextTransitionDirection(previous, next) {
  if (!previous || previous.id === next.id || !Number.isFinite(previous.order) || !Number.isFinite(next.order)) return 0;
  return Math.sign(next.order - previous.order);
}
