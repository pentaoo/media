// Focus rings are for keyboard navigation only. A click (or a .focus() call that follows one, e.g. the
// search toggle getting focus back after the field closes) must not leave a ring behind. Browsers decide
// :focus-visible on their own, so we track the last input: pointer down → no rings, Tab → rings again.
// styles.css / components.css hide outlines under html[data-input="pointer"].
const root = document.documentElement;

addEventListener('pointerdown', () => { root.dataset.input = 'pointer'; }, { capture: true, passive: true });
addEventListener('keydown', event => { if (event.key === 'Tab') root.dataset.input = 'keyboard'; }, { capture: true });
