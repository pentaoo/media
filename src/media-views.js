import { siteHeaderView } from './article-view.js';
import { siteFooterMarkup } from './components/site-footer.js';
import { bigBurstMarkup, tagListMarkup } from './components/tag.js';

export { articleView } from './article-view.js';

const landingMenu = [
  { label: 'статьи', href: './article.html', route: true },
  { label: 'заглушка', href: './index.html' },
  { label: 'о нас', href: './about.html', route: true },
];

const directions = [
  ['гид по местам', 'кофейни, завтраки, площадки и культурные места центра. каждое место отмечено на карте и связано со статьёй.'],
  ['на любую тусу есть ответ', 'теги: дневное или ночное, тусовочное или спокойное, безопасно или можно нарваться. выбирай под настроение.'],
  ['разборы и истории', 'треки строка за строкой, артисты, концерты и события, которые стали частью сцены.'],
];

const rubrics = ['фиты', 'дропы', 'биты', 'бифы', 'сниппеты', 'удалённое', 'пропавшие', 'клипы', 'сохранёнки'];


function sectionLabel(id, label) {
  return `<h2 class="landing-section__label type-h3" id="${id}">${label}</h2>`;
}

function cardsView(items) {
  return `<ul class="landing-cards">${items.map(([title, text]) => `<li class="landing-card"><h3 class="type-h2">${title}</h3><p class="type-body">${text}</p></li>`).join('')}</ul>`;
}

/** Landing «О нас», Figma 440:696 (1440) / 415:399 (390). */
export function homeView() {
  return `<div class="landing" data-scene-rail="off">
    ${siteHeaderView(landingMenu)}
    <section class="landing-hero" aria-labelledby="landing-title" data-node-id="440:709">
      <img class="landing-hero__photo" src="./assets/figma/landing/hero-collage.jpg" alt="" width="1440" height="836" fetchpriority="high">
      ${tagListMarkup(['фиты', 'удалённое', 'сохранёнки'], 'landing-hero', 'ct-tags--stuck landing-hero__tags')}
      <div class="landing-hero__content">
        <h1 class="landing-hero__title type-display" id="landing-title"><span class="media-accent">CHINATOWN<wbr>.site</span> — гид и архив центра Москвы</h1>
        <div class="landing-hero__row">
          <p class="landing-hero__lead type-body">первый материал — про madk1d: почему его припев за пару недель запели все.</p>
          <a class="landing-hero__action" href="./article.html" data-media-route data-action-button>Читать первый материал</a>
        </div>
      </div>
    </section>
    <section class="landing-section" aria-labelledby="landing-about" data-node-id="440:715">
      ${sectionLabel('landing-about', 'о нас')}
      <div class="landing-section__content">
        <p class="type-h2">центр москвы — больше, чем бар</p>
        <p class="type-body">Обычно на Китай-городе всё решает один вопрос: куда пойдём пить? И все идут в знакомые места.</p>
        <p class="type-body">Мы отвечаем на другие вопросы. Где позавтракать после тусы, выпить кофе с утра, проявить плёнку, найти аптеку или место, о котором вы ещё не слышали. Чтобы сегодня вечером пойти туда, куда раньше не ходили.</p>
      </div>
    </section>
    <section class="landing-section" aria-labelledby="landing-inside" data-node-id="440:722">
      ${sectionLabel('landing-inside', 'что внутри')}
      <div class="landing-section__wide">
        ${cardsView(directions)}
        <div class="landing-rubrics">
          <h3 class="type-h3">рубрики</h3>
          ${tagListMarkup(rubrics, 'landing-rubrics')}
        </div>
      </div>
    </section>
    <section class="landing-section landing-section--closing" aria-labelledby="landing-why" data-node-id="440:735">
      ${sectionLabel('landing-why', 'почему сейчас')}
      <div class="landing-section__content">
        <p class="type-h2">пока это ещё можно застать</p>
        <p class="type-body">Нефор-культура меняется на глазах: артистам всё сложнее выступать, на Китай-городе всё больше полиции, места и люди пропадают. CHINATOWN собирает эту эпоху в один архив, чтобы от неё осталось больше, чем удалённые треки.</p>
        <p class="landing-stat"><span class="type-quote">≈<span class="media-accent">100</span> материалов</span><span class="type-caption">выйдет за первые три месяца</span></p>
      </div>
    </section>
    <section class="landing-feature film" aria-labelledby="landing-feature-title" data-node-id="440:744">
      <img class="landing-feature__photo" src="./assets/figma/article/madk1d-concert.png" alt="" loading="lazy" width="3516" height="1984">
      <div class="landing-feature__head">${tagListMarkup(['сниппеты', 'клипы'], 'madk1d')}</div>
      <div class="landing-feature__row">
        <h2 class="landing-feature__title type-h1" id="landing-feature-title"><span class="media-accent">madk1d</span>: слишком громко, чтобы было всё равно</h2>
        ${bigBurstMarkup({ href: './article.html', words: ['Открыть', 'статью'] }).replace('<a class="ct-big-burst"', '<a class="ct-big-burst landing-feature__burst" data-media-route aria-describedby="landing-feature-title"')}
      </div>
    </section>
    ${siteFooterMarkup()}
  </div>`;
}
