/* ALMORA Studio: dashboard navigation over the existing admin tools */
(() => {
  'use strict';
  let activePage = 'works';
  let appObserver = null;
  const app = document.getElementById('app');
  const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pages = [
    ['works','Obras','library-big'],
    ['launch','Lançamento','file-plus'],
    ['moderation','Moderação','shield-check'],
    ['analytics','Análises','chart'],
    ['chapters','Capítulos','book-open'],
    ['settings','Configurações','settings']
  ];

  function isStudio(){return location.hash.split('/')[0]==='#studio';}
  function installNav(){
    if(!isStudio()||!app)return;
    const section=document.getElementById('almora-studio-works');
    if(!section)return;
    let nav=document.getElementById('almora-studio-dashboard-nav');
    if(!nav){
      nav=document.createElement('div');
      nav.id='almora-studio-dashboard-nav';
      nav.className='almora-studio-dashboard-nav';
      nav.innerHTML=pages.map(([id,label])=>'<button type="button" class="g" data-studio-page="'+id+'" onclick="almoraStudioPage(\''+id+'\')">'+label+'</button>').join('');
      const heading=app.querySelector('h2');
      if(heading)heading.insertAdjacentElement('afterend',nav);else app.prepend(nav);
    }
    const sectionBoxes=[...section.querySelectorAll(':scope > .box')];
    const listHeading=[...section.querySelectorAll(':scope > h2')].find(h=>h.textContent.toLowerCase().includes('obras cadastradas'));
    if(listHeading && !document.getElementById('almora-studio-work-search')){
      const search=document.createElement('input');
      search.id='almora-studio-work-search';search.type='search';search.placeholder='⌕ Pesquisar obras por título ou autora...';
      search.className='almora-studio-work-search';
      search.addEventListener('input',()=>filterWorks(search.value));
      listHeading.insertAdjacentElement('afterend',search);
      collapseChapterRows(listHeading);
    }
    let analytics=document.getElementById('almora-studio-analytics');
    if(!analytics){
      analytics=document.createElement('section');analytics.id='almora-studio-analytics';analytics.className='almora-studio-extra-page';analytics.hidden=true;
      analytics.innerHTML='<h2>Análises da ALMORA</h2><p style="color:var(--mu)">Indicadores gerais do catálogo.</p><div class="almora-studio-stat-grid" id="almora-studio-stats"></div>';
      section.insertAdjacentElement('afterend',analytics);
    }
    let settings=document.getElementById('almora-studio-settings');
    if(!settings){
      settings=document.createElement('section');settings.id='almora-studio-settings';settings.className='almora-studio-extra-page';settings.hidden=true;
      settings.innerHTML='<h2>Configurações</h2><div class="box"><b>Ferramentas administrativas</b><p style="color:var(--mu)">Faça backup dos dados e encerre sua sessão administrativa.</p><div class="act"><button class="g" type="button" onclick="bk()">Exportar backup (sem imagens)</button><button class="d" type="button" onclick="unlocked=false;ren()">Sair do Studio</button></div></div>';
      analytics.insertAdjacentElement('afterend',settings);
    }
    applyPage();
  }

  function collapseChapterRows(listHeading){
    let node=listHeading.nextElementSibling;
    while(node && node.tagName!=='H2'){
      if(node.classList?.contains('box')){
        const rows=[...node.querySelectorAll(':scope > .ch')];
        if(rows.length){
          const details=document.createElement('details');details.className='almora-studio-chapter-details';
          const summary=document.createElement('summary');summary.textContent='Ver '+rows.length+' capítulos';details.appendChild(summary);
          rows.forEach(row=>details.appendChild(row));node.appendChild(details);
        }
      }
      node=node.nextElementSibling;
    }
  }

  function filterWorks(query){
    const section=document.getElementById('almora-studio-works');if(!section)return;
    const h=[...section.querySelectorAll(':scope > h2')].find(x=>x.textContent.toLowerCase().includes('obras cadastradas'));
    if(!h)return;
    let node=h.nextElementSibling;
    const q=query.trim().toLocaleLowerCase('pt-BR');
    while(node && node.tagName!=='H2'){
      if(node.classList?.contains('box'))node.hidden=!!q&&!node.textContent.toLocaleLowerCase('pt-BR').includes(q);
      node=node.nextElementSibling;
    }
  }

  function updateAnalytics(){
    const target=document.getElementById('almora-studio-stats');if(!target)return;
    const works=Array.isArray(window.S?.works)?window.S.works:[];
    const chapters=works.reduce((sum,w)=>sum+(w.chapters?.length||0),0);
    const published=works.filter(w=>!w.archived).length;
    target.innerHTML=[
      ['Obras cadastradas',works.length],['Obras ativas',published],['Capítulos',chapters],
      ['Arquivadas',works.length-published]
    ].map(([label,value])=>'<article class="box"><small style="color:var(--mu)">'+label+'</small><strong>'+Number(value).toLocaleString('pt-BR')+'</strong></article>').join('');
  }

  window.almoraStudioPage = page => {
    if(!pages.some(item=>item[0]===page))return;
    activePage=page;applyPage();
  };

  function applyPage(){
    if(!isStudio()||!app)return;
    const section=document.getElementById('almora-studio-works');
    const moderation=document.getElementById('almora-moderation');
    const analytics=document.getElementById('almora-studio-analytics');
    const settings=document.getElementById('almora-studio-settings');
    const nav=document.getElementById('almora-studio-dashboard-nav');
    if(!section||!nav)return;
    const buttons=[...nav.querySelectorAll('[data-studio-page]')];
    buttons.forEach(b=>{const active=b.dataset.studioPage===activePage;b.classList.toggle('on',active);b.classList.toggle('g',!active);});
    const boxes=[...section.querySelectorAll(':scope > .box')];
    const workHeading=[...section.querySelectorAll(':scope > h2')].find(h=>h.textContent.toLowerCase().includes('obras cadastradas'));
    const search=document.getElementById('almora-studio-work-search');
    const listNodes=[];
    if(workHeading){let n=workHeading;while(n&&n.tagName!=='H2'){listNodes.push(n);n=n.nextElementSibling;}}
    section.hidden=activePage==='analytics'||activePage==='settings'||activePage==='moderation';
    if(moderation)moderation.style.display=activePage==='moderation'?'block':'none';
    if(analytics)analytics.hidden=activePage!=='analytics';
    if(settings)settings.hidden=activePage!=='settings';
    if(activePage==='works'){
      boxes.slice(0,3).forEach(x=>x.hidden=true);
      listNodes.forEach(x=>x.hidden=false);
      if(search)search.hidden=false;
    }else if(activePage==='launch'){
      boxes.forEach((x,i)=>x.hidden=i!==0);
      listNodes.forEach(x=>x.hidden=true);
      if(search)search.hidden=true;
    }else if(activePage==='chapters'){
      boxes.forEach((x,i)=>x.hidden=i===0||i>2);
      listNodes.forEach(x=>x.hidden=true);
      if(search)search.hidden=true;
    }else if(activePage==='moderation'){
      const modTab=document.getElementById('almora-tab-mod');
      if(modTab && moderation && moderation.style.display!=='block' && window.almoraStudioTab)window.almoraStudioTab('mod');
    }else{
      if(search)search.hidden=true;
    }
    if(activePage==='analytics')updateAnalytics();
  }

  function observe(){
    if(!app)return;
    if(appObserver)appObserver.disconnect();
    appObserver=new MutationObserver(()=>{if(isStudio())installNav();});
    appObserver.observe(app,{childList:true,subtree:true});
    if(isStudio())installNav();
  }
  window.addEventListener('hashchange',()=>{if(isStudio()){activePage='works';setTimeout(installNav,0);}});
  observe();
})();
