import { devToolsEnabled } from './dev-settings.js';

export function mountDevTools(context = {}) {
  if (!devToolsEnabled(new URL(location.href))) return () => {};
  let disposed = false;
  let disposePanel = () => {};
  import('./dev-panel.js').then(({ mountDevPanel }) => {
    if (!disposed) disposePanel = mountDevPanel(context);
  });
  return () => { disposed = true; disposePanel(); };
}

if (document.querySelector('#intro')) mountDevTools();
