import test from 'node:test';
import assert from 'node:assert/strict';
import { exceedsDragThreshold, DRAG_HINT_THRESHOLD_PX, mountDragHint } from '../src/drag-hint.js';

test('plain click does not count as drag', () => {
  assert.equal(exceedsDragThreshold({ x: 100, y: 100 }, 100, 100), false);
});

test('small pointer jitter does not count as drag', () => {
  assert.equal(exceedsDragThreshold({ x: 100, y: 100 }, 105, 104), false);
});

test('movement at threshold counts as a real drag', () => {
  assert.equal(
    exceedsDragThreshold({ x: 100, y: 100 }, 100 + DRAG_HINT_THRESHOLD_PX, 100),
    true,
  );
});

// Exercise pointer sequences and visit persistence without requiring WebGL.
class HintNode extends EventTarget {
  constructor() {
    super();
    this.children = [];
    this.className = '';
    this.classList = {
      add: (...names) => { this.className += ` ${names.join(' ')}`; },
      contains: (name) => this.className.split(/\s+/).includes(name),
    };
  }

  append(...children) {
    for (const child of children) {
      child.parent = this;
      this.children.push(child);
    }
  }

  setAttribute() {}

  remove() {
    if (this.parent) this.parent.children = this.parent.children.filter((child) => child !== this);
  }
}

function fixture(t, { blockedStorage = false } = {}) {
  const storage = new Map();
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const controllers = [];
  globalThis.document = {
    createElement(tag) {
      const node = new HintNode();
      if (tag === 'template') node.content = { firstElementChild: new HintNode() };
      return node;
    },
  };
  globalThis.window = {
    setTimeout,
    clearTimeout,
    sessionStorage: {
      getItem(key) {
        if (blockedStorage) throw new Error('Storage blocked');
        return storage.get(key) ?? null;
      },
      setItem(key, value) {
        if (blockedStorage) throw new Error('Storage blocked');
        storage.set(key, value);
      },
    },
  };
  t.after(() => {
    controllers.forEach((controller) => controller.destroy());
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
    else delete globalThis.document;
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else delete globalThis.window;
  });
  return {
    storage,
    mount() {
      const host = new HintNode();
      const overlay = new HintNode();
      const controller = mountDragHint(host, overlay);
      controllers.push(controller);
      controller.reveal();
      return { host, overlay, controller, hint: overlay.children[0] };
    },
  };
}

function pointer(host, type, { id = 1, x = 100, y = 100, pointerType = 'mouse', button = 0 } = {}) {
  const event = new Event(type);
  Object.assign(event, { pointerId: id, clientX: x, clientY: y, pointerType, button });
  host.dispatchEvent(event);
}

test('clicks, pointer jitter and cancelled gestures keep the hint visible', (t) => {
  const visit = fixture(t);
  const { host, hint } = visit.mount();
  pointer(host, 'pointerdown');
  pointer(host, 'pointermove', { x: 105, y: 104 });
  pointer(host, 'pointerup', { x: 105, y: 104 });
  pointer(host, 'pointermove', { x: 160 });
  pointer(host, 'pointerdown');
  pointer(host, 'pointercancel');
  pointer(host, 'pointermove', { x: 160 });
  assert.equal(hint.hidden, false);
  assert.equal(hint.classList.contains('is-dismissed'), false);
  assert.equal(visit.storage.size, 0);
});

test('a completed drag dismisses the hint and remembers it on remount', (t) => {
  const visit = fixture(t);
  const { host, hint, controller, overlay } = visit.mount();
  pointer(host, 'pointerdown');
  pointer(host, 'pointermove', { id: 2, x: 160 });
  assert.equal(hint.classList.contains('is-dismissed'), false);
  pointer(host, 'pointermove', { x: 106, y: 106 });
  assert.equal(hint.classList.contains('is-dismissed'), true);
  hint.dispatchEvent(new Event('transitionend'));
  assert.equal(hint.hidden, true);
  controller.destroy();
  assert.equal(overlay.children.length, 0);
  assert.equal(visit.mount().hint.hidden, true);
});

test('a second touch cannot replace the finger that started the drag', (t) => {
  const { host, hint } = fixture(t).mount();
  pointer(host, 'pointerdown', { pointerType: 'touch' });
  pointer(host, 'pointerdown', { id: 2, pointerType: 'touch' });
  pointer(host, 'pointermove', { id: 2, x: 160, pointerType: 'touch' });
  assert.equal(hint.classList.contains('is-dismissed'), false);
  pointer(host, 'pointermove', { x: 108, pointerType: 'touch' });
  assert.equal(hint.classList.contains('is-dismissed'), true);
});

test('blocked session storage does not prevent showing or dismissing the hint', (t) => {
  const { host, hint } = fixture(t, { blockedStorage: true }).mount();
  assert.equal(hint.hidden, false);
  pointer(host, 'pointerdown');
  pointer(host, 'pointermove', { x: 108 });
  assert.equal(hint.classList.contains('is-dismissed'), true);
});
