/** Slide the actual editorial nodes; retiring a page returns it to its article home. */
export function createContextPager(host, { canAnimate, onUpdate, outgoingClassName = 'scene-rail__context-content scene-rail__context-outgoing', duration = 360 }) {
  const panel = host.parentElement;
  let current = null;
  let outgoing = null;
  let animations = [];
  let revision = 0;
  let paused = false;

  function offset(element) {
    const transform = getComputedStyle(element).transform;
    return transform === 'none' ? 0 : new DOMMatrixReadOnly(transform).m41;
  }
  function stop() {
    const positions = { current: offset(host), outgoing: outgoing ? offset(outgoing.host) : 0 };
    revision++;
    for (const animation of animations) animation.cancel();
    animations = [];
    return positions;
  }
  function retire(entry) {
    if (!entry) return;
    if (entry.release) entry.release(entry.node);
    else entry.node.remove();
    entry.host.remove();
  }
  function update() {
    host.hidden = !current;
    panel.hidden = !current && !outgoing;
    onUpdate({ node: current?.node, outgoingNode: outgoing?.node, moving: animations.length > 0 });
  }
  function finish() {
    stop();
    retire(outgoing);
    outgoing = null;
    delete panel.dataset.contextMotion;
    update();
  }
  function set(node, { direction = 0, animate = true, release } = {}) {
    if (current?.node === node || !current && !node) {
      if (current && release) current.release = release;
      if (!animate) finish();
      return;
    }
    const positions = stop();
    let incomingOffset;
    let incomingScroll = 0;
    // Reverse an unfinished turn from the two pages' visible positions.
    if (outgoing?.node === node) {
      incomingOffset = positions.outgoing;
      incomingScroll = outgoing.host.scrollTop;
      outgoing.host.remove();
    } else retire(outgoing);
    outgoing = null;
    if (current) {
      const layer = host.ownerDocument.createElement('div');
      layer.className = outgoingClassName;
      layer.inert = true;
      layer.setAttribute('aria-hidden', 'true');
      const scrollTop = host.scrollTop;
      layer.append(current.node);
      panel.insertBefore(layer, host);
      layer.scrollTop = scrollTop;
      outgoing = { ...current, host: layer };
    }
    current = node ? { node, release } : null;
    host.replaceChildren(...(node ? [node] : []));
    host.scrollTop = incomingScroll;
    host.hidden = !current;
    panel.hidden = !current && !outgoing;
    const distance = panel.clientWidth;
    if (!animate || !direction || !distance || !canAnimate()) {
      finish();
      return;
    }
    const timing = { duration, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'both' };
    const translate = x => `translateX(${x}px)`;
    if (outgoing) animations.push(outgoing.host.animate([
      { transform: translate(positions.current) },
      { transform: translate(-direction * distance) },
    ], timing));
    if (current) animations.push(host.animate([
      { transform: translate(incomingOffset ?? direction * distance) },
      { transform: 'translateX(0px)' },
    ], timing));
    panel.dataset.contextMotion = direction > 0 ? 'forward' : 'backward';
    if (paused) for (const animation of animations) animation.pause();
    const turn = revision;
    update();
    Promise.all(animations.map(animation => animation.finished)).then(() => {
      if (turn === revision) finish();
    }, () => {});
  }

  return {
    set,
    finish,
    setPaused(value) {
      paused = value;
      for (const animation of animations) value ? animation.pause() : animation.play();
    },
    dispose() { set(null, { animate: false }); },
  };
}
