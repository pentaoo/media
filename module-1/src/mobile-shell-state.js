export const mobileSnaps = ['hidden', 'preview', 'expanded'];

/** Reading context and the temporary search/menu surface share one sheet. */
export function initialMobileShellState(saved = {}) {
  const dismissed = saved.dismissed === true;
  return {
    mode: null, snap: 'hidden', id: null, unread: false,
    introduced: saved.introduced === true, dismissed,
  };
}

export function reduceMobileShell(state, event) {
  switch (event.type) {
    case 'context': {
      if (state.id === event.id) return state;
      const introduce = !!event.id && !state.introduced && !state.dismissed;
      const overlay = state.mode === 'menu' || state.mode === 'search';
      return {
        ...state, id: event.id,
        introduced: state.introduced || introduce,
        snap: introduce ? 'preview' : state.snap,
        mode: introduce && !overlay ? 'context' : state.mode,
        unread: !!event.id && (overlay || state.mode !== 'context') && !introduce,
      };
    }
    case 'open':
      return { ...state, mode: 'context', snap: event.snap === 'preview' ? 'preview' : 'expanded', dismissed: false, introduced: true, unread: false };
    case 'overlay':
      return state.mode === event.mode
        ? reduceMobileShell(state, { type: 'back' })
        : { ...state, mode: event.mode };
    case 'back':
      return { ...state, mode: state.snap === 'hidden' ? null : 'context', unread: state.snap === 'hidden' && state.unread };
    case 'snap':
      if (!mobileSnaps.includes(event.snap)) return state;
      if (event.snap === 'hidden') return reduceMobileShell(state, { type: 'hide' });
      return { ...state, mode: 'context', snap: event.snap, dismissed: false, unread: false };
    case 'hide':
      return { ...state, mode: null, snap: 'hidden', dismissed: true, unread: false };
    default:
      return state;
  }
}

export function mobileSnapHeights(height) {
  const preview = Math.min(88, height * .25);
  return { hidden: 0, preview, expanded: Math.max(preview, height - 48) };
}

/** A deliberate flick advances one stop; a slow drag lands at the nearest stop. */
export function mobileSnapAfterDrag({ snap, height, viewportHeight, velocity = 0 }) {
  const heights = mobileSnapHeights(viewportHeight);
  if (Math.abs(velocity) > .45) {
    return mobileSnaps[Math.max(0, Math.min(mobileSnaps.length - 1, mobileSnaps.indexOf(snap) + (velocity < 0 ? 1 : -1)))];
  }
  return mobileSnaps.reduce((best, candidate) => Math.abs(heights[candidate] - height) < Math.abs(heights[best] - height) ? candidate : best, 'hidden');
}
