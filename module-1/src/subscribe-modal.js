import { mountActionButtons } from './components/action-button.js';
import { mountSubscribeDialog } from './components/subscribe-dialog.js';

const intro = document.querySelector('#intro');
mountActionButtons();

// The intro: the whitelist button opens the dialog, and it prompts on its own after 45 seconds on the page.
mountSubscribeDialog(document.querySelector('#subscribe-modal'), {
  openButtons: [document.querySelector('#intro-whitelist')],
  background: intro,
});
