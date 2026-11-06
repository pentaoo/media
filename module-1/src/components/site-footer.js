import { mountActionButtons } from './action-button.js';
import { mountEmailSubscribe } from '../email-subscribe.js';

// Page-relative, like the subscribe dialog: the article and «О нас» bake this markup into static HTML at build time.
const asset = path => `./assets/${path}`;

/** The site footer, Figma 444:737: the «держим связь» subscription on a pink band, the same on every page. */
export function siteFooterMarkup() {
  return `<footer class="site-footer" aria-labelledby="site-footer-title">
      <div class="site-footer__band">
        <div class="site-footer__copy">
          <h2 class="site-footer__title" id="site-footer-title">держим связь</h2>
          <p class="site-footer__text"><strong>подпишись на нас, чтобы участвовать в розыгрыше мерча,</strong> а&nbsp;также быть в&nbsp;курсе новостей медиа и&nbsp;тусовок на&nbsp;китай-городе</p>
        </div>
        <form class="site-footer__form" action="https://formspree.io/f/xkjjgwgy" method="POST" novalidate>
          <label class="visually-hidden" for="site-footer-email">электропочта</label>
          <input class="email-field email-field--ink" id="site-footer-email" name="email" type="email" placeholder="ЭЛЕКТРОПОЧТА" autocomplete="email" inputmode="email" aria-describedby="site-footer-status" required>
          <button class="action-button--ink" type="submit" data-action-button>ПОДПИСАТЬСЯ</button>
          <p class="site-footer__status" id="site-footer-status" role="status" aria-live="polite"></p>
        </form>
        <img class="site-footer__star" src="${asset('figma/footer-star.svg')}" alt="" aria-hidden="true" width="515" height="515" loading="lazy" decoding="async">
      </div>
    </footer>`;
}

/** Wire the footer form to the shared newsletter submission. */
export function mountSiteFooter(root = document, { signal } = {}) {
  const footer = root.querySelector('.site-footer');
  if (!footer) return;
  mountActionButtons(footer);
  mountEmailSubscribe(footer.querySelector('form'), { signal });
}
