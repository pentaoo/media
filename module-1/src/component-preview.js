import { componentFamilies } from './component-catalog-data.js';
import { articleView } from './article-view.js';
import { madk1dContext } from './article-context-data.js';
import { editorialDataView } from './components/editorial-data.js';
import { articleCopy, articleSources } from './article-copy.js';
import { editorialQuoteView, entityReferenceView } from './components/editorial-typography.js';
import { createActionButton, mountActionButtons } from './components/action-button.js';
import { typographyView } from './components/typography.js';

const params=new URLSearchParams(location.search);
const family=componentFamilies.find(item=>item.id===params.get('family'));
const variant=family?.variants.find(([id])=>id===params.get('variant'))?.[0]||family?.variants[0][0];
const root=document.querySelector('#media-content');
// Specimens choose their own starting position after mounting their controllers.
history.scrollRestoration='manual';
const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);
const parse=html=>new DOMParser().parseFromString(html,'text/html');
let article;
const articleNode=selector=>(article??=parse(articleView())).querySelector(selector)?.outerHTML||'';
const material=id=>madk1dContext.materials.find(item=>item.id===id);
const afterLayout=async()=>{await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));};
function stage(html){root.innerHTML=`<div class="story-page"><div class="specimen-stage">${html}</div></div>`;}
function articleFragment(html){root.innerHTML=`<div class="story-page"><article class="story"><div class="story-content">${html}</div></article></div>`;}
async function lyricSpecimen(isVerse=false){
  if(isVerse){const analysis=(article??=parse(articleView())).querySelector('#verse-analysis');analysis.removeAttribute('aria-labelledby');analysis.setAttribute('aria-label','Разбор куплета');}
  articleFragment(articleNode(isVerse?'#verse-excerpt':'#quote')+articleNode(isVerse?'#verse-analysis':'#chorus-freedom'));
  const {mountQuoteScenes}=await import('./quote-scene.js');
  const dispose=mountQuoteScenes(root.querySelector('.story-page'),()=>{});window.addEventListener('pagehide',dispose,{once:true});
}
async function sourceDocument(path){const response=await fetch(path);if(!response.ok)throw new Error(`Не удалось загрузить ${path}`);return parse(await response.text());}

async function subscription({buttonLabel='ПОПАСТЬ В ВАЙТ-ЛИСТ',open=false,disabled=false,secondary=false}={}){
  const source=await sourceDocument('./index.html');
  stage(`<p class="specimen-stage__label">ActionButton · ${secondary?'Figma 388:752':'Figma 276:101 / 388:748'}</p><div class="specimen-button-place" id="intro"></div>`);
  const button=createActionButton({label:buttonLabel,variant:secondary?'secondary':'primary'});button.id='intro-whitelist';button.disabled=disabled;
  button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls','subscribe-modal');
  document.querySelector('#intro').append(button);
  document.body.append(source.querySelector('#subscribe-modal'));
  await import('./subscribe-modal.js');
  await afterLayout();
  if(open)button.click();
  if(variant==='error'){
    document.querySelector('#subscribe-email').value='неверный-адрес';
    document.querySelector('#subscribe-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
  }
  if(variant==='unconfigured'){
    document.querySelector('#subscribe-email').value='reader@example.com';
    document.querySelector('#subscribe-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
  }
}

async function fullArticle({rail=true}={}){
  root.innerHTML=articleView();
  const page=root.querySelector('.story-page');
  const header=page.querySelector('.story-header');
  const headerRoot=document.createElement('div');headerRoot.className='media-site-header';root.before(headerRoot);headerRoot.append(header);
  document.body.style.setProperty('--media-header-height','64px');
  let sceneRail;
  if(rail){const {mountSceneRail}=await import('./scene-rail.js');sceneRail=mountSceneRail(root);}
  const {mountArticle}=await import('./article.js');
  const dispose=mountArticle(page,header,sceneRail);
  window.addEventListener('pagehide',()=>{dispose();sceneRail?.dispose();},{once:true});
  await afterLayout();
  return {page,header,sceneRail};
}
function scrollToNode(node){
  if(!node)return;
  const top=node.getBoundingClientRect().top+window.scrollY-88;
  window.scrollTo({top:Math.max(0,top),behavior:'instant'});
}
async function fullContext(id){
  const state=await fullArticle();
  const trigger=state.page.querySelector(`[data-context-ref="${id}"]`);
  const chapter=madk1dContext.chapters.find(item=>item.materialId===id);
  scrollToNode(trigger?.closest('p')||state.page.querySelector(`#${chapter?.id||'artist'}`));
  await new Promise(resolve=>requestAnimationFrame(resolve));
  trigger?.click();
  if(!trigger&&innerWidth<1200)scrollToNode(state.page.querySelector(`#${id}`));
  return state;
}

async function render(){
  if(!family)throw new Error('Компонент не найден');
  document.title=`${family.name} · ${family.variants.find(([id])=>id===variant)[1]} — CHINATOWN`;
  document.body.dataset.specimen=family.id;
  switch(family.id){
    case 'action':
      await subscription({buttonLabel:variant==='subscribe'?'ПОДПИСАТЬСЯ':'ПОПАСТЬ В ВАЙТ-ЛИСТ',disabled:variant==='disabled',secondary:variant==='secondary'});break;
    case 'email':{
      const source=await sourceDocument('./index.html');
      stage('<label class="specimen-stage__label" for="subscribe-email">EmailField · Figma 388:756</label><div class="specimen-email-place"></div><p class="specimen-type-caption" id="email-specimen-status" role="status" aria-live="polite"></p>');
      const input=source.querySelector('#subscribe-email');input.setAttribute('aria-describedby','email-specimen-status');
      root.querySelector('.specimen-email-place').append(input);
      const status=root.querySelector('#email-specimen-status');
      if(variant==='filled')input.value='reader@example.com';
      if(variant==='invalid'){input.value='неверный-адрес';input.setAttribute('aria-invalid','true');status.textContent='проверь адрес электропочты';}
      input.addEventListener('input',()=>{input.removeAttribute('aria-invalid');status.textContent='';});
      break;
    }
    case 'links':{
      if(variant==='text')stage(`<p class="specimen-stage__label">Текстовые действия · текущие варианты</p><div class="specimen-links"><a class="text-button" href="./about.html"><span>О НАС</span><img src="./assets/figma/intro-north-east.svg" alt="" aria-hidden="true"></a></div><div class="editorial-prose specimen-prose"><p>Ссылка на <a href="./article.html">источник материала</a> внутри обычного текста.</p></div>`);
      else if(variant==='entity')stage(`<p class="specimen-stage__label">Упоминания → карточки сущностей</p><div class="specimen-links"><div class="editorial-prose">${entityReferenceView(material('artist-madk1d'))}</div><div class="editorial-prose">${entityReferenceView(material('track-tak'))}</div><div class="editorial-prose">${entityReferenceView(material('sexyswag-artwork'),'sexyswag')}</div></div><p class="specimen-stage__label">Поведение карточек — в семействе «Карточки сущностей»</p>`);
      else stage(`<p class="specimen-stage__label">Иконки из шапки · текущий размер 32 px</p><div class="specimen-links">${[['star','Навигация'],['search','Поиск'],['close','Закрыть'],['menu','Меню']].map(([icon,label])=>`<button class="story-icon" type="button" aria-label="${label}" title="Образец иконки: ${label}"><img src="./assets/figma/article/header/${icon}.svg" alt="" width="32" height="32"></button>`).join('')}</div>`);
      if(variant==='entity')root.querySelectorAll('[data-context-ref]').forEach(link=>link.addEventListener('click',event=>{event.preventDefault();location.href=`./component-preview.html?family=entities&variant=${link.dataset.entityType}&dev=0`;}));
      break;
    }
    case 'typography':
      if(variant==='accents')stage('<p class="specimen-stage__label">EditorialProse · демонстрационный редакционный текст</p><div class="editorial-prose specimen-prose"><p>У каждой сцены есть <strong>свой голос</strong>. Мы сохраняем его в тексте, фотографии и музыке.</p><p><em>Курсив задаёт интонацию</em>, а <mark>маркер выделяет понятие</mark>.</p><p>Для фактов оставляем <a href="./article.html">ссылку на источник</a>; для артиста, трека и альбома — отдельное интерактивное упоминание.</p></div>');
      else if(variant==='lyrics')await lyricSpecimen();
      else stage(typographyView(variant));
      break;
    case 'header':{
      const {header}=await fullArticle({rail:false});
      if(variant==='menu'&&window.innerWidth<=760)header.querySelector('.story-menu-toggle').click();
      if(['search','results','empty'].includes(variant)){
        header.querySelector('.story-search-toggle').click();
        if(variant!=='search'){
          const input=header.querySelector('input');input.value=variant==='results'?'припев':'несуществующий-запрос';input.dispatchEvent(new Event('input',{bubbles:true}));
        }
      }
      break;
    }
    case 'cover':root.innerHTML=`<div class="story-page"><article class="story">${articleNode('.story-cover')}</article></div>`;break;
    case 'section':{
      const {page}=await fullArticle();scrollToNode(page.querySelector(variant==='delivery'?'#delivery':'#artist'));break;
    }
    case 'quote':{
      const text=articleCopy.sections.analysis.paragraphs[0];
      const quote=variant==='pull'?editorialQuoteView({text,pullquote:true}):editorialQuoteView({text,author:'Редакция CHINATOWN · пример подписи',source:{label:'Текст этой статьи',href:new URL('./article.html',location.href).href}});
      stage(`<p class="specimen-stage__label">${variant==='pull'?'Выносная фраза из статьи':'Демонстрация атрибуции на редакционном тексте'}</p><div class="editorial-prose specimen-prose">${quote}</div>`);break;
    }
    case 'lyrics':{
      await lyricSpecimen(variant==='verse');break;
    }
    case 'entities':await fullContext({artist:'artist-madk1d',track:'track-tak',album:'sexyswag-artwork'}[variant]);break;
    case 'context':await fullContext({footnote:'footnote-1',note:'address-note',card:'references'}[variant]);break;
    case 'image':{
      const {page}=await fullArticle({rail:false});
      const image=page.querySelector('#sexyswag-artwork');scrollToNode(image);
      if(variant==='viewer')image.querySelector('.context-image-trigger')?.click();break;
    }
    case 'timeline':{
      if(variant==='scenarios'){
        stage(`<p class="specimen-stage__label">Редакционный сценарий · структура для дизайна</p><div class="editorial-prose specimen-prose"><h2 class="type-h2">Как выбрать подачу</h2><p><strong>Что и в каком порядке произошло?</strong><br>Хронология: 2–6 датированных событий с коротким объяснением.</p><p><strong>Как изменился масштаб?</strong><br>Ряд значений: один показатель, одинаковые единицы, территория и источник. Пропуски сохраняем.</p><p><strong>Что нужно запомнить?</strong><br>Один ключевой факт: значение, его смысл, дата и источник. Сразу после — редакционный вывод.</p><p>Применение к артисту, месту, сообществу, событию и вещи описано рядом с превью в каталоге.</p></div>`);
      }else{
        const data=variant==='fact'?editorialDataView({id:'spread-fact',type:'fact',title:'Где трек оказался первым',scope:'«Так пох*й» · Spotify · Украина · недельный чарт',value:articleCopy.timeline.points[2].position,label:articleCopy.timeline.points[2].date,caption:'Позиция в одном недельном чарте. Она не описывает популярность во всех странах или сервисах.',sources:[{label:articleSources.kworb.label,href:articleSources.kworb.url}]}):articleNode('.editorial-data');
        stage(`<div class="editorial-prose specimen-prose">${data}</div>`);
      }
      break;
    }
    case 'rail':{
      const {page,sceneRail}=await fullArticle();
      scrollToNode(page.querySelector('#artist'));await new Promise(resolve=>requestAnimationFrame(resolve));
      if(variant==='context')page.querySelector('[data-context-ref="artist-madk1d"]').click();
      if(variant==='collapsed')sceneRail.rail.querySelector('.scene-rail__toggle').click();
      break;
    }
    case 'subscribe':await subscription({open:true});break;
    case 'intro':{
      const source=await sourceDocument('./index.html');root.replaceChildren(source.querySelector('#intro'));document.body.append(source.querySelector('#subscribe-modal'));
      await import('./intro.js');await import('./subscribe-modal.js');break;
    }
    case 'tools':{
      const {page}=await fullArticle();
      const {mountStoryClub}=await import('./story-club.js');const club=mountStoryClub(page);
      const {mountDevPanel}=await import('./dev-panel.js');mountDevPanel({page,club});
      document.querySelector('.dev-tool__launcher').click();
      if(variant==='light')document.querySelector('#dev-tab-light').click();
      break;
    }
  }
  mountActionButtons();
  document.querySelectorAll('a[href]').forEach(link=>{
    const href=link.getAttribute('href');
    if(!href.startsWith('#')&&!link.hasAttribute('data-context-ref')){link.target='_blank';link.rel='noopener noreferrer';}
  });
  await afterLayout();
  if(family.id==='lyrics'||family.id==='typography'&&variant==='lyrics') {
    const transitions=[...document.querySelectorAll('[data-quote-line]')].flatMap(line=>line.getAnimations()).filter(animation=>animation.effect?.getComputedTiming().iterations!==Infinity);
    await Promise.all(transitions.map(animation=>animation.finished.catch(()=>{})));
  }
  document.body.dataset.previewReady='true';
  const controls=[...document.querySelectorAll('.action-button, .email-field')].map(control=>{
    const box=control.getBoundingClientRect();const style=getComputedStyle(control);
    const label=control.querySelector('.action-button__label');const labelStyle=label&&getComputedStyle(label);
    const groupBox=control.querySelector('.action-button__content')?.getBoundingClientRect();
    const icon=control.querySelector('.action-button__icon img');const iconBox=icon?.getBoundingClientRect();
    return {kind:control.classList.contains('email-field')?'email':'button',secondary:control.classList.contains('action-button--secondary'),width:box.width,height:box.height,fontSize:style.fontSize,lineHeight:style.lineHeight,borderWidth:style.borderTopWidth,padding:style.padding,placeholder:control.matches('input')?getComputedStyle(control,'::placeholder').color:undefined,group:groupBox?{width:groupBox.width,height:groupBox.height,centerDelta:(groupBox.left+groupBox.width/2)-(box.left+box.width/2)}:undefined,label:label?{width:label.getBoundingClientRect().width,fontSize:labelStyle.fontSize,lineHeight:labelStyle.lineHeight,padding:labelStyle.padding}:undefined,icon:icon?{width:iconBox.width,height:iconBox.height,src:icon.currentSrc,loaded:icon.complete&&icon.naturalWidth>0}:undefined};
  });
  const textStyles=['typography','section','lyrics','quote'].includes(family.id)?[...document.querySelectorAll('[data-type-specimen] > :last-child, .story-quote-scene__lyrics, [data-quote-line], .story-section h2, .story-section__copy > p, .editorial-quote blockquote, .editorial-quote figcaption')].map(node=>{
    const style=getComputedStyle(node);const box=node.getBoundingClientRect();
    return {role:node.parentElement.dataset.typeSpecimen||node.className,nodeId:node.dataset.nodeId,fontFamily:style.fontFamily,fontSize:style.fontSize,lineHeight:style.lineHeight,fontWeight:style.fontWeight,letterSpacing:style.letterSpacing,opacity:style.opacity,gap:style.gap,width:box.width,height:box.height};
  }):[];
  parent.postMessage({type:'chinatown:component-preview',state:'ready',viewport:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,controls,textStyles},location.origin);
}

render().catch(error=>{
  console.error('Component preview:',error);
  root.innerHTML='<div class="specimen-error"><p>Не удалось показать компонент.</p><a href="./components.html" target="_blank" rel="noopener">Вернуться в каталог ↗</a></div>';
  document.body.dataset.previewError='true';
  parent.postMessage({type:'chinatown:component-preview',state:'error',viewport:innerWidth},location.origin);
});
