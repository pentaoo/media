import { componentFamilies, designTasks, statusLabels, designBriefMarkdown } from './component-catalog-data.js';

const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);
const list = document.querySelector('#component-list');
const sourceUrl = source => `./${source}`;
const previewUrl = (family, variant) => `./component-preview.html?family=${encodeURIComponent(family.id)}&variant=${encodeURIComponent(variant)}&dev=0`;

function preview(family, mobile) {
  const width = mobile ? 390 : 1440;
  const height = mobile ? family.mobileHeight : family.height;
  const title = `${family.name} — ${mobile ? 'телефон' : 'десктоп'}`;
  return `<div class="preview-shell ${mobile ? 'preview-shell--mobile' : ''}">
    <div class="preview-shell__bar"><span>${mobile ? 'Телефон' : 'Десктоп'} <span aria-hidden="true">/</span> ${width} px</span><a href="${previewUrl(family,family.variants[0][0])}" target="_blank" rel="noopener" aria-label="${escape(title)}: открыть отдельно">↗</a></div>
    <div class="preview-canvas" data-width="${width}" data-height="${height}"><iframe title="${escape(title)}" data-src="${previewUrl(family,family.variants[0][0])}" width="${width}" height="${height}" loading="lazy"></iframe></div>
    <div class="preview-shell__foot">${mobile ? 'Мобильная вёрстка' : 'Десктопная вёрстка'} · <span data-scale></span> · прокрутка внутри</div>
  </div>`;
}

list.innerHTML = componentFamilies.map((family,index) => `<article class="component-card" id="component-${family.id}" data-family="${family.id}" data-status="${family.status}">
  <div class="component-card__head"><div class="component-card__identity"><span class="component-card__number">${String(index+1).padStart(2,'0')}</span><div><h3>${escape(family.name)}</h3><span class="component-card__parent">${escape(family.parent)}</span></div></div><span class="component-status" data-status="${family.status}">${statusLabels[family.status]}</span></div>
  <p class="component-card__description">${escape(family.description)}</p>
  ${family.scenarios ? `<div class="component-scenarios">${family.scenarios.map(scenario=>`<div><strong>${escape(scenario.title)}</strong><p>${escape(scenario.information)}</p><p class="component-scenarios__purpose">Зачем: ${escape(scenario.purpose)}</p></div>`).join('')}</div>` : ''}
  <div class="variant-switch" role="group" aria-label="${escape(family.name)}: варианты">${family.variants.map(([id,label],i) => `<button type="button" data-variant="${id}" aria-pressed="${i===0}">${escape(label)}</button>`).join('')}</div>
  <div class="component-previews">${preview(family,false)}${preview(family,true)}</div>
  <div class="component-card__notes"><div><strong>Где используется</strong><p>${escape(family.used)} <a href="./${family.route}" target="_blank" rel="noopener">На странице ↗</a></p></div><div><strong>Следующий шаг</strong><p>${escape(family.next)}</p></div></div>
  <div class="component-source">${family.sources.map(source=>`<a href="${sourceUrl(source)}" target="_blank" rel="noopener">${escape(source)}</a>`).join(' · ')}</div>
</article>`).join('');

document.querySelector('#family-nav').innerHTML = componentFamilies.map((family,index)=>`<a href="#component-${family.id}"><span>${String(index+1).padStart(2,'0')}</span>${escape(family.name)}</a>`).join('');
const shared = componentFamilies.filter(family=>family.status==='shared').length;
const variants = componentFamilies.reduce((count,family)=>count+family.variants.length,0);
const pluralRules = new Intl.PluralRules('ru');
const plural = (count, one, few, many) => ({one,few,many}[pluralRules.select(count)] || many);
document.querySelector('#catalog-stats').innerHTML = [[componentFamilies.length,`${plural(componentFamilies.length,'семейство','семейства','семейств')} компонентов`],[variants,`${plural(variants,'вариант','варианта','вариантов')} в превью`],[designTasks.length,`${plural(designTasks.length,'задача','задачи','задач')} на дизайн`],[shared,`${plural(shared,'общее семейство','общих семейства','общих семейств')} в коде`]].map(([count,label])=>`<div class="catalog-stat"><strong>${String(count).padStart(2,'0')}</strong><span>${label}</span></div>`).join('');

// Real viewport widths belong to the iframe; only the presentation is scaled.
const sizeObserver = new ResizeObserver(entries=>{
  for (const {target} of entries) {
    const scale = target.clientWidth / Number(target.dataset.width);
    const frame = target.querySelector('iframe');
    frame.style.transform = `scale(${scale})`;
    target.style.height = `${Number(target.dataset.height)*scale}px`;
    target.closest('.preview-shell').querySelector('[data-scale]').textContent = `${Math.round(scale*100)}%`;
  }
});
const lazyObserver = new IntersectionObserver(entries=>{
  for (const {target,isIntersecting} of entries) {
    const frame = target.querySelector('iframe');
    if (isIntersecting) {
      if (!frame.getAttribute('src')) {frame.dataset.state='loading';frame.src=frame.dataset.src;}
    } else if(frame.hasAttribute('src')) {
      // Release videos, WebGL and article observers while their samples are far away.
      frame.removeAttribute('src');frame.dataset.state='idle';
      delete frame.dataset.viewport;delete frame.dataset.overflow;
    }
  }
},{rootMargin:'350px'});
document.querySelectorAll('.preview-canvas').forEach(canvas=>{sizeObserver.observe(canvas);lazyObserver.observe(canvas);});

// Report the actual child viewport and render status without reaching into its DOM.
window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.data?.type!=='chinatown:component-preview')return;
  const frame=[...document.querySelectorAll('.preview-canvas iframe')].find(item=>item.contentWindow===event.source);
  if(!frame)return;
  frame.dataset.state=event.data.state;
  frame.dataset.viewport=String(event.data.viewport);
  frame.dataset.overflow=String(event.data.overflow);
  if(event.data.controls)frame.dataset.controls=JSON.stringify(event.data.controls);
  if(event.data.textStyles)frame.dataset.textStyles=JSON.stringify(event.data.textStyles);
});

list.addEventListener('click',event=>{
  const button=event.target.closest('[data-variant]');
  if(!button) return;
  const card=button.closest('[data-family]');
  const family=componentFamilies.find(family=>family.id===card.dataset.family);
  card.querySelectorAll('[data-variant]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
  const url=previewUrl(family,button.dataset.variant);
  card.querySelectorAll('iframe').forEach(frame=>{frame.dataset.state='loading';frame.dataset.src=url;frame.src=url;});
  card.querySelectorAll('.preview-shell__bar a').forEach(link=>{link.href=url;});
});

let activeFilter='all';
const search=document.querySelector('#component-search');
function filter() {
  const query=search.value.trim().toLocaleLowerCase('ru');
  let count=0;
  for(const family of componentFamilies) {
    const match=(activeFilter==='all'||activeFilter===family.status)&&[family.name,family.parent,family.group,family.description,...family.sources,...family.variants.flat()].join(' ').toLocaleLowerCase('ru').includes(query);
    document.querySelector(`#component-${family.id}`).hidden=!match;
    if(match)count++;
  }
  document.querySelector('#visible-count').textContent=`${count} / ${componentFamilies.length}`;
  document.querySelector('#filter-status').textContent=`Показано семейств: ${count}`;
  document.querySelector('#catalog-empty').hidden=count!==0;
}
search.addEventListener('input',filter);
document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{
  activeFilter=button.dataset.filter;
  document.querySelectorAll('[data-filter]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
  filter();
}));
document.querySelector('#family-nav').addEventListener('click',event=>{
  const link=event.target.closest('a');
  if(!link)return;
  activeFilter='all';search.value='';
  document.querySelectorAll('[data-filter]').forEach(item=>item.setAttribute('aria-pressed',String(item.dataset.filter==='all')));
  filter();
});
filter();

const storageKey='chinatown:component-design-review:v1';
let completed=[];
try {const saved=JSON.parse(localStorage.getItem(storageKey)||'[]');if(Array.isArray(saved))completed=saved.filter(id=>designTasks.some(task=>task.id===id));}catch{/* Browser storage is optional. */}
document.querySelector('#brief-list').innerHTML=designTasks.map(task=>`<article class="brief-item"><label class="brief-check"><input type="checkbox" data-task="${task.id}" aria-label="Дизайн готов: ${escape(task.title)}" ${completed.includes(task.id)?'checked':''}></label><span class="brief-priority">${task.priority}</span><div><h3>${escape(task.title)}</h3><p>${escape(task.state)} ${escape(task.request)}</p><p><span>Проверить:</span> ${escape(task.acceptance)}</p>${task.families.map(id=>`<a href="#component-${id}">${escape(componentFamilies.find(family=>family.id===id).name)} ↗</a>`).join(' · ')}</div></article>`).join('');
function updateProgress(){document.querySelector('#brief-progress').textContent=`Дизайн готов: ${completed.length} из ${designTasks.length}`;}
updateProgress();
document.querySelector('#brief-list').addEventListener('change',event=>{
  const checkbox=event.target.closest('[data-task]');
  if(!checkbox)return;
  completed=[...document.querySelectorAll('[data-task]:checked')].map(item=>item.dataset.task);
  try{localStorage.setItem(storageKey,JSON.stringify(completed));}catch{/* Still usable without persistence. */}
  updateProgress();
});
document.querySelector('#brief-list').addEventListener('click',event=>{
  if(!event.target.closest('a'))return;
  activeFilter='all';search.value='';
  document.querySelectorAll('[data-filter]').forEach(item=>item.setAttribute('aria-pressed',String(item.dataset.filter==='all')));filter();
});
document.querySelector('#download-brief').addEventListener('click',()=>{
  const blob=new Blob([designBriefMarkdown()],{type:'text/markdown;charset=utf-8'});
  const url=URL.createObjectURL(blob);const link=document.createElement('a');
  link.href=url;link.download='chinatown-component-design-brief.md';link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
});

// Mirror the section in the navigation without adding history entries on scroll.
const sectionObserver=new IntersectionObserver(entries=>{
  const entry=entries.find(item=>item.isIntersecting);
  if(!entry)return;
  document.querySelectorAll('#family-nav a').forEach(link=>{
    if(link.hash===`#${entry.target.id}`)link.setAttribute('aria-current','location');
    else link.removeAttribute('aria-current');
  });
},{rootMargin:'-100px 0px -65% 0px',threshold:0});
document.querySelectorAll('.component-card').forEach(card=>sectionObserver.observe(card));
