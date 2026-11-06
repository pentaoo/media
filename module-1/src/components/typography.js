const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);
const body = 'Всё началось на ск и всё ушло в телегу. все фитуют со всеми и все знают всех но никто не знает как всё это называется. всё удаляют. все пропадают. всё выходит заново и всё заново исчезает. все пришли на кг и нас стало три тысячи вместо ста пятидесяти и тогда все сверху захотели узнать кто мы все такие. ';

/** Font roles taken from the sample text, excluding the board's comparison labels. */
export const typographySpecimens = [
  { id:'display', label:'Display', node:'388:784', textNode:'388:766', className:'type-display', size:'40 / 40', font:'Benzin ExtraBold', text:'ВАУ!' },
  { id:'h1', label:'H1', node:'388:785', textNode:'388:769', className:'type-h1', size:'64 / 64', font:'Benzin ExtraBold', text:'Большой Madk1d' },
  { id:'h2', label:'H2', node:'388:786', textNode:'388:771', className:'type-h2', size:'36 / 48', font:'Giga Sans ExtraBold', text:'Тут все началось' },
  { id:'h3', label:'H3', node:'388:787', textNode:'388:773', className:'type-h3', size:'14 / 16', font:'Giga Sans ExtraBold', text:'Тут все закончилось' },
  { id:'body', label:'Body', node:'388:788', textNode:'388:775', className:'type-body', size:'16 / 26', font:'Giga Sans Regular', text:body + body },
  { id:'caption', label:'Caption', node:'388:789', textNode:'388:777', className:'type-caption', size:'12 / 16', font:'Giga Sans Regular', text:'Какая-то подпись милип*здрючка' },
  { id:'quote', label:'Цитата / строка', node:'388:793', textNode:'388:778', className:'type-quote', size:'32 / 38,4', font:'Benzin Bold', text:'Цитата/строчка песни' },
];

function specimenView(specimen, { compact = false } = {}) {
  const text = compact && specimen.id === 'body' ? body : specimen.text;
  return `<div class="type-specimen" data-type-specimen="${specimen.id}"><p class="specimen-stage__label">${specimen.label} · ${specimen.font} · моб. ${specimen.size} px · ${specimen.node}</p><p class="${specimen.className}" data-node-id="${specimen.textNode}">${escape(text)}</p></div>`;
}

/** Reuse the production classes for every specimen rather than styling a second copy. */
export function typographyView(variant = 'scale') {
  if (variant === 'display-example') return '<div class="type-specimen" data-type-specimen="display-example"><p class="specimen-stage__label">Display · Benzin ExtraBold · моб. 40 / 40 px · 388:767</p><p class="type-display" data-node-id="388:767">НЕФОРЫ,<br>CHINATOWN.RU –<br>ВАШЕ <span class="type-accent">МЕДИА</span></p></div>';
  const specimen = typographySpecimens.find(item => item.id === variant);
  return specimen ? specimenView(specimen) : typographySpecimens.map(item => specimenView(item, {compact:true})).join('');
}
