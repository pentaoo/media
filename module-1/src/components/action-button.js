const NEXT_ICON_URL = new URL('../../assets/icons/intro-navigate-next.svg', import.meta.url).href;
const MOBILE_NEXT_ICON_URL = new URL('../../assets/figma/components/action-next-mobile.svg', import.meta.url).href;

/** Mount the shared Figma 276:101 content without replacing the native control. */
export function mountActionButton(button) {
  if (button.querySelector(':scope > .action-button__content')) return button;

  const label = document.createElement('span');
  label.className = 'action-button__label';
  label.textContent = button.textContent.trim();

  const icon = document.createElement('picture');
  icon.className = 'action-button__icon';
  icon.setAttribute('aria-hidden', 'true');
  const mobileSource = document.createElement('source');
  mobileSource.media = '(max-width: 760px)';
  mobileSource.srcset = MOBILE_NEXT_ICON_URL;
  const image = document.createElement('img');
  image.src = NEXT_ICON_URL;
  image.alt = '';
  image.width = 64;
  image.height = 64;
  icon.append(mobileSource, image);

  const content = document.createElement('span');
  content.className = 'action-button__content';
  content.append(label, icon);
  button.classList.add('action-button');
  button.replaceChildren(content);
  return button;
}

/** Create another instance using the same markup and native button behavior. */
export function createActionButton({ label, type = 'button', variant = 'primary' }) {
  const button = document.createElement('button');
  button.type = type;
  button.textContent = label;
  if (variant === 'secondary') button.classList.add('action-button--secondary');
  return mountActionButton(button);
}

/** Enhance buttons and action links, preserving their native behavior. */
export function mountActionButtons(root = document) {
  root.querySelectorAll('button[data-action-button], a[data-action-button]').forEach(mountActionButton);
}
