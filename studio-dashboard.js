/* ALMORA Studio — navegação única sobre os formulários e painéis existentes */
(() => {
  'use strict';
  const app=document.getElementById('app');
  const pages=[['works','Obras'],['launch','Publicar obra'],['chapters','Capítulos'],['moderation','Moderação'],['analytics','Estatísticas'],['settings','Configurações'],['announcements','Anúncios']];
  let activePage='works';
  let observer=null;
  const isStudio=()=>location.hash.split('/')[0]==='#studio';
  const boxes=section=>[...section.querySelectorAll(':scope > .box')];
  const workHeading=section=>[...section.querySelectorAll(':scope > h2')].find(h=>h.textContent.toLocaleLowerCase('pt-BR').includes('obras cadastradas'));

  function install(){
    if(!app||!isStudio()){app?.classList.remove('almora-studio-dashboard-active');return;}
    const section=document.getElementById('almora-studio-works');
    if(!section){app.classList.remove('almora-studio-dashboard-active');return;}
    app.classList.add('almora-studio-dashboard-active');
    const toolbar=[...app.querySelectorAll(':scope > .act')].find(node=>node.textContent.includes('Exportar backup')&&node.textContent.includes('Sair'));
    if(toolbar)toolbar.dataset.studioToolbar='true';
    let nav=document.getElementById('almora-studio-dashboard-nav');
    if(!nav){
      nav=document.createElement('nav');nav.id='almora-studio-dashboard-nav';nav.className='almora-studio-dashboard-nav';nav.setAttribute('aria-label','Seções do Studio');
      const role=window.almoraStudioRole||'admin';
      const visiblePages=role==='moderator'?pages.filter(([id])=>['moderation','settings'].includes(id)):pages;
      visiblePages.forEach(([id,label])=>{
        const button=document.createElement('button');button.type='button';button.className='g';button.dataset.studioPage=id;button.textContent=label;
        button.addEventListener('click',()=>window.almoraStudioPage(id));nav.appendChild(button);
      });
      section.insertAdjacentElement('beforebegin',nav);
    }
    let announcementPanel=document.getElementById('almora-studio-announcements');
    if(!announcementPanel){
      announcementPanel=document.createElement('section');announcementPanel.id='almora-studio-announcements';announcementPanel.style.display='none';
      section.insertAdjacentElement('beforebegin',announcementPanel);
    }
    let settingsPanel=document.getElementById('almora-studio-settings');
    if(!settingsPanel){
      settingsPanel=document.createElement('section');settingsPanel.id='almora-studio-settings';settingsPanel.style.display='none';
      section.insertAdjacentElement('beforebegin',settingsPanel);
    }
    const heading=workHeading(section);
    if(heading&&!document.getElementById('almora-studio-work-search')){
      const search=document.createElement('input');search.id='almora-studio-work-search';search.type='search';search.className='almora-studio-work-search';
      search.placeholder='⌕ Pesquisar obras por título ou autora...';search.setAttribute('aria-label','Pesquisar obras cadastradas');
      search.addEventListener('input',()=>filterWorks(search.value));heading.insertAdjacentElement('afterend',search);
      collapseChapterRows(section,heading);
    }
    applyPage();
  }

  function collapseChapterRows(section,heading){
    let node=heading.nextElementSibling;
    while(node&&node.tagName!=='H2'){
      if(node.classList?.contains('box')&&!node.querySelector('.almora-studio-chapter-details')){
        const rows=[...node.querySelectorAll(':scope > .ch')];
        if(rows.length){
          const details=document.createElement('details');details.className='almora-studio-chapter-details';
          const summary=document.createElement('summary');summary.textContent='Mostrar '+rows.length+' capítulos';details.appendChild(summary);
          rows.forEach(row=>details.appendChild(row));node.appendChild(details);
        }
      }
      node=node.nextElementSibling;
    }
  }

  function filterWorks(query){
    const section=document.getElementById('almora-studio-works');const heading=section&&workHeading(section);if(!heading)return;
    const q=String(query||'').trim().toLocaleLowerCase('pt-BR');let node=heading.nextElementSibling;
    while(node&&node.tagName!=='H2'){
      if(node.classList?.contains('box')&&node.dataset.studioTranslate!=='true')node.hidden=!!q&&!node.textContent.toLocaleLowerCase('pt-BR').includes(q);
      node=node.nextElementSibling;
    }
  }

  function updateButtons(){
    const nav=document.getElementById('almora-studio-dashboard-nav');if(!nav)return;
    nav.querySelectorAll('[data-studio-page]').forEach(button=>{
      const active=button.dataset.studioPage===activePage;
      button.classList.toggle('on',active);button.classList.toggle('g',!active);
      if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
    });
  }

  window.almoraStudioPage=page=>{
    if(!pages.some(item=>item[0]===page))return;
    if((window.almoraStudioRole||'admin')==='moderator'&&!['moderation','settings'].includes(page))return;
    activePage=page;
    if(page==='announcements'){const panel=document.getElementById('almora-studio-announcements');if(panel)panel.dataset.loaded='0';}
    applyPage();
  };

  function applyPage(){
    if(!isStudio()||!app)return;
    const section=document.getElementById('almora-studio-works');
    const moderation=document.getElementById('almora-moderation');
    const analytics=document.getElementById('almora-studio-statistics');
    const toolbar=app.querySelector('[data-studio-toolbar]');
    const nav=document.getElementById('almora-studio-dashboard-nav');
    const announcementPanel=document.getElementById('almora-studio-announcements');
    const settingsPanel=document.getElementById('almora-studio-settings');
    if(!section||!nav)return;
    if((window.almoraStudioRole||'admin')==='moderator'&&!['moderation','settings'].includes(activePage))activePage='settings';
    const allBoxes=boxes(section);const forms=allBoxes.filter(box=>box.dataset.studioTranslate!=='true');
    const translate=allBoxes.find(box=>box.dataset.studioTranslate==='true');
    const heading=workHeading(section);const search=document.getElementById('almora-studio-work-search');
    const listNodes=[];
    if(heading){let node=heading.nextElementSibling;while(node&&node.tagName!=='H2'){listNodes.push(node);node=node.nextElementSibling;}}
    if(activePage==='moderation'&&typeof window.almoraStudioTab==='function')window.almoraStudioTab('mod');
    else if(activePage==='analytics'&&typeof window.almoraStudioTab==='function')window.almoraStudioTab('stats');
    else if(typeof window.almoraStudioTab==='function')window.almoraStudioTab('works');

    const showMain=['works','launch','chapters'].includes(activePage);
    section.hidden=!showMain;section.style.display=showMain?'block':'none';
    if(announcementPanel){
      announcementPanel.hidden=activePage!=='announcements';announcementPanel.style.display=activePage==='announcements'?'block':'none';
      if(activePage==='announcements'&&announcementPanel.dataset.loaded!=='1'&&announcementPanel.dataset.loading!=='1')window.almoraLoadStudioAnnouncements?.();
    }
    if(settingsPanel){
      settingsPanel.hidden=activePage!=='settings';
      settingsPanel.style.display=activePage==='settings'?'block':'none';
      if(activePage==='settings')window.almoraRenderStudioSettings?.();
    }
    if(moderation)moderation.style.display=activePage==='moderation'?'block':'none';
    if(analytics)analytics.style.display=activePage==='analytics'?'block':'none';
    forms.forEach((box,index)=>{
      if(activePage==='launch')box.hidden=index!==0;
      else if(activePage==='chapters')box.hidden=index===0||index>2;
      else box.hidden=true;
    });
    if(heading)heading.hidden=activePage!=='works';
    listNodes.forEach(node=>{node.hidden=activePage!=='works'||node.dataset.studioTranslate==='true';});
    if(search){search.hidden=activePage!=='works';if(activePage==='works')filterWorks(search.value);}
    if(translate)translate.hidden=true;
    if(toolbar){toolbar.hidden=activePage!=='settings';toolbar.style.display=activePage==='settings'?'flex':'none';}
    updateButtons();
  }

  const style=document.createElement('style');
  style.textContent='#app.almora-studio-dashboard-active .almora-studio-tabs{display:none!important}'+
    '.almora-studio-dashboard-nav{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:14px 0 22px;overflow:visible;padding:0;white-space:normal;width:100%;min-width:0}'+
    '.almora-studio-dashboard-nav button{min-height:46px;padding:10px 8px;white-space:normal}'+
    '.almora-studio-dashboard-nav button.on{background:var(--ac2);color:#fff}'+
    '.almora-studio-work-search{display:block;width:100%;margin:8px 0 14px}'+
    '.almora-studio-chapter-details{margin-top:10px;border-top:1px solid var(--bd);padding-top:9px}'+
    '.almora-studio-chapter-details summary{cursor:pointer;color:var(--ac);font-weight:600;padding:5px 0}'+
    '@media(max-width:420px){.almora-studio-dashboard-nav{grid-template-columns:repeat(2,minmax(0,1fr))}}';
  document.head.appendChild(style);

  function start(){
    if(!app||observer)return;
    observer=new MutationObserver(()=>{if(isStudio())install();else app.classList.remove('almora-studio-dashboard-active');});
    observer.observe(app,{childList:true});
    if(isStudio())install();
  }
  window.addEventListener('hashchange',()=>{
    if(isStudio()){activePage='works';app?.classList.remove('almora-studio-dashboard-active');Promise.resolve().then(install);}
    else app?.classList.remove('almora-studio-dashboard-active');
  });
  start();
})();
