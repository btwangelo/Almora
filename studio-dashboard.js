/* ALMORA Studio — Layout 2: dashboard administrativo responsivo */
(() => {
  'use strict';
  const app=document.getElementById('app');
  const pages=[
    ['overview','Visão geral','⌂'],
    ['works','Obras','▤'],
    ['launch','Publicar obra','＋'],
    ['chapters','Capítulos','▥'],
    ['moderation','Moderação','⚑'],
    ['inbox','Mensagens recebidas','✉'],
    ['analytics','Estatísticas','▥'],
    ['announcements','Anúncios','▧'],
    ['settings','Configurações','⚙']
  ];
  let activePage='overview';
  let observer=null;
  const isStudio=()=>location.hash.split('/')[0]==='#studio';
  const boxes=section=>[...section.querySelectorAll(':scope > .box')];
  const workHeading=section=>[...section.querySelectorAll(':scope > h2')].find(h=>h.textContent.toLocaleLowerCase('pt-BR').includes('obras cadastradas'));
  const role=()=>window.almoraStudioRole||'admin';
  const roleName=()=>({superadmin:'Dono',admin:'Administrador',moderator:'Moderador'}[role()]||'Equipe ALMORA');
  const allowed=id=>{const r=role();if(r==='superadmin'||r==='admin')return true;if(r==='moderator')return ['overview','moderation','inbox','settings'].includes(id);return false;};

  function make(tag,cls,id){
    const el=document.createElement(tag);
    if(cls)el.className=cls;
    if(id)el.id=id;
    return el;
  }
  function buildShell(section){
    if(document.getElementById('almora-studio-shell'))return;
    const toolbar=[...app.querySelectorAll(':scope > .act')].find(n=>n.textContent.includes('Exportar backup')&&n.textContent.includes('Sair'));
    if(toolbar)toolbar.dataset.studioToolbar='true';

    let nav=document.getElementById('almora-studio-dashboard-nav');
    if(!nav){
      nav=make('nav','almora-studio-sidebar-nav','almora-studio-dashboard-nav');
      nav.setAttribute('aria-label','Navegação do ALMORA Studio');
      pages.filter(([id])=>allowed(id)).forEach(([id,label,icon])=>{
        const button=make('button','almora-studio-nav-item');
        button.type='button';button.dataset.studioPage=id;
        button.innerHTML='<span class="almora-studio-nav-icon" aria-hidden="true">'+icon+'</span><span>'+label+'</span>';
        button.addEventListener('click',()=>window.almoraStudioPage(id));
        nav.appendChild(button);
      });
    }

    let announcementPanel=document.getElementById('almora-studio-announcements');
    if(!announcementPanel){announcementPanel=make('section','','almora-studio-announcements');announcementPanel.hidden=true;section.insertAdjacentElement('beforebegin',announcementPanel);}
    let contactPanel=document.getElementById('almora-studio-contact-inbox');
    if(!contactPanel){contactPanel=make('section','','almora-studio-contact-inbox');contactPanel.hidden=true;section.insertAdjacentElement('beforebegin',contactPanel);}
    let settingsPanel=document.getElementById('almora-studio-settings');
    if(!settingsPanel){settingsPanel=make('section','','almora-studio-settings');settingsPanel.hidden=true;section.insertAdjacentElement('beforebegin',settingsPanel);}

    const shell=make('div','almora-studio-shell','almora-studio-shell');
    const sidebar=make('aside','almora-studio-sidebar');
    sidebar.innerHTML='<a class="almora-studio-brand" href="#studio" aria-label="ALMORA Studio"><span class="almora-studio-brand-mark"><svg viewBox="0 0 100 92" aria-hidden="true"><path d="M8 8l32 14c14-5 26-5 40 0l12-14 4 40c-2 20-14 34-34 40-24-3-40-18-46-38z" fill="#050508" transform="translate(-2 0)"/><path d="M50 36l4 9h10l-8 6 3 10-9-6-9 6 3-10-8-6h10z" fill="#e2d9fa" transform="translate(-6 -2) scale(.9)"/><path d="M62 38c10-5 18-3 20 0-4 12-12 18-20 16z" fill="#b13df5"/></svg></span><span><strong>ALMORA</strong><small>STUDIO</small></span></a><div class="almora-studio-sidebar-label">ESPAÇO DE TRABALHO</div>';
    sidebar.appendChild(nav);
    sidebar.insertAdjacentHTML('beforeend','<div class="almora-studio-sidebar-bottom"><span class="almora-studio-status-dot"></span><span>Plataforma ALMORA</span></div>');
    const workspace=make('div','almora-studio-workspace');
    const topbar=make('div','almora-studio-topbar');
    topbar.innerHTML='<div class="almora-studio-topbar-title"><span>PAINEL ADMINISTRATIVO</span><strong id="almora-studio-current-title">Visão geral</strong></div><div class="almora-studio-topbar-user"><span class="almora-studio-avatar">A</span><span><strong>Equipe ALMORA</strong><small>'+roleName()+'</small></span></div>';
    if(toolbar){toolbar.classList.add('almora-studio-toolbar');topbar.appendChild(toolbar);}
    const main=make('main','almora-studio-main');
    const overview=make('section','almora-studio-overview','almora-studio-overview');
    overview.innerHTML='<div class="almora-studio-welcome"><div><span class="almora-studio-eyebrow">CENTRAL DE OPERAÇÕES</span><h1>Bem-vindo ao Studio.</h1><p>Gerencie obras, publicações e a comunidade da ALMORA em um só lugar.</p></div><span class="almora-studio-welcome-mark">A</span></div><div class="almora-studio-section-heading"><div><span class="almora-studio-eyebrow">ATALHOS</span><h2>Acesso rápido</h2></div><span>Selecione uma área para começar</span></div><div class="almora-studio-quick-grid"><button type="button" data-go="works"><span>▤</span><strong>Obras cadastradas</strong><small>Consultar e organizar o catálogo</small><b>→</b></button><button type="button" data-go="launch"><span>＋</span><strong>Publicar obra</strong><small>Adicionar uma nova publicação</small><b>→</b></button><button type="button" data-go="chapters"><span>▥</span><strong>Capítulos</strong><small>Gerenciar capítulos das obras</small><b>→</b></button><button type="button" data-go="moderation"><span>⚑</span><strong>Moderação</strong><small>Acompanhar denúncias e comunidade</small><b>→</b></button><button type="button" data-go="analytics"><span>▧</span><strong>Estatísticas</strong><small>Consultar os dados da plataforma</small><b>→</b></button><button type="button" data-go="settings"><span>⚙</span><strong>Configurações</strong><small>Preferências e controles do Studio</small><b>→</b></button></div><div class="almora-studio-note"><span>✦</span><div><strong>Seu espaço de administração</strong><p>As ferramentas existentes foram mantidas. Use o menu lateral para alternar entre as áreas sem sair do Studio.</p></div></div>';
    overview.querySelectorAll('[data-go]').forEach(b=>{if(!allowed(b.dataset.go)){b.remove();return;}b.addEventListener('click',()=>window.almoraStudioPage(b.dataset.go));});
    main.appendChild(overview);

    shell.append(sidebar,workspace);
    workspace.append(topbar,main);
    const nodes=[...app.childNodes].filter(node=>node!==shell);
    nodes.forEach(node=>{if(node.nodeType===1&&node.tagName==='H2'&&node.textContent.trim()==='ALMORA STUDIO')node.hidden=true;});
    app.appendChild(shell);
    nodes.forEach(node=>{if(node!==nav&&node!==toolbar)main.appendChild(node);});
    // O conteúdo operacional continua intacto; apenas muda de posição no layout.
    main.insertBefore(overview,main.firstChild);
    if(!document.getElementById('almora-studio-work-search')){
      const heading=workHeading(section);
      if(heading){
        const search=document.createElement('input');search.id='almora-studio-work-search';search.type='search';search.className='almora-studio-work-search';
        search.placeholder='Pesquisar obras por título ou autora…';search.setAttribute('aria-label','Pesquisar obras cadastradas');
        search.addEventListener('input',()=>filterWorks(search.value));heading.insertAdjacentElement('afterend',search);
        collapseChapterRows(section,heading);
      }
    }
    app.classList.add('almora-studio-dashboard-active');
  }

  function collapseChapterRows(section,heading){
    let node=heading.nextElementSibling;
    while(node&&node.tagName!=='H2'){
      if(node.classList?.contains('box')&&!node.querySelector('.almora-studio-chapter-details')){
        const rows=[...node.querySelectorAll(':scope > .ch')];
        if(rows.length){const details=document.createElement('details');details.className='almora-studio-chapter-details';const summary=document.createElement('summary');summary.textContent='Mostrar '+rows.length+' capítulos';details.appendChild(summary);rows.forEach(row=>details.appendChild(row));node.appendChild(details);}
      }
      node=node.nextElementSibling;
    }
  }
  function filterWorks(query){
    const section=document.getElementById('almora-studio-works');const heading=section&&workHeading(section);if(!heading)return;
    const q=String(query||'').trim().toLocaleLowerCase('pt-BR');let node=heading.nextElementSibling;
    while(node&&node.tagName!=='H2'){if(node.classList?.contains('box')&&node.dataset.studioTranslate!=='true')node.hidden=!!q&&!node.textContent.toLocaleLowerCase('pt-BR').includes(q);node=node.nextElementSibling;}
  }
  function updateButtons(){
    const nav=document.getElementById('almora-studio-dashboard-nav');if(!nav)return;
    nav.querySelectorAll('[data-studio-page]').forEach(button=>{
      const active=button.dataset.studioPage===activePage;
      button.classList.toggle('is-active',active);
      if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
    });
    const title=pages.find(p=>p[0]===activePage)?.[1]||'Visão geral';
    const heading=document.getElementById('almora-studio-current-title');if(heading)heading.textContent=title;
  }
  window.almoraStudioPage=page=>{
    if(!pages.some(item=>item[0]===page)||!allowed(page))return;
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
    const announcementPanel=document.getElementById('almora-studio-announcements');
    const contactPanel=document.getElementById('almora-studio-contact-inbox');
    const settingsPanel=document.getElementById('almora-studio-settings');
    const overview=document.getElementById('almora-studio-overview');
    if(!section||!document.getElementById('almora-studio-shell'))return;
    if(!allowed(activePage))activePage='settings';
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
    if(overview){overview.hidden=activePage!=='overview';overview.style.display=activePage==='overview'?'block':'none';}
    if(announcementPanel){announcementPanel.hidden=activePage!=='announcements';announcementPanel.style.display=activePage==='announcements'?'block':'none';if(activePage==='announcements'&&announcementPanel.dataset.loaded!=='1'&&announcementPanel.dataset.loading!=='1')window.almoraLoadStudioAnnouncements?.();}
    if(contactPanel){contactPanel.hidden=activePage!=='inbox';contactPanel.style.display=activePage==='inbox'?'block':'none';if(activePage==='inbox'&&contactPanel.dataset.loaded!=='1'&&contactPanel.dataset.loading!=='1')window.almoraLoadContactInbox?.();}
    if(settingsPanel){settingsPanel.hidden=activePage!=='settings';settingsPanel.style.display=activePage==='settings'?'block':'none';if(activePage==='settings'&&settingsPanel.dataset.loaded!=='1'){settingsPanel.dataset.loaded='1';window.almoraRenderStudioSettings?.();}else if(activePage!=='settings')settingsPanel.dataset.loaded='0';}
    if(moderation)moderation.style.display=activePage==='moderation'?'block':'none';
    if(analytics)analytics.style.display=activePage==='analytics'?'block':'none';
    forms.forEach((box,index)=>{if(activePage==='launch')box.hidden=index!==0;else if(activePage==='chapters')box.hidden=index===0||index>2;else box.hidden=true;});
    if(heading)heading.hidden=activePage!=='works';
    listNodes.forEach(node=>{node.hidden=activePage!=='works'||node.dataset.studioTranslate==='true';});
    if(search){search.hidden=activePage!=='works';if(activePage==='works')filterWorks(search.value);}
    if(translate)translate.hidden=true;
    if(toolbar){toolbar.hidden=false;toolbar.style.display='flex';const backup=toolbar.querySelector('button[onclick="bk()"]');if(backup)backup.hidden=role()==='moderator';}
    updateButtons();
  }

  const style=document.createElement('style');
  style.textContent=`
  #app.almora-studio-dashboard-active{width:100%;max-width:100%;padding:0;margin:0}\n  #app.almora-studio-dashboard-active .almora-studio-tabs{display:none!important}
  #app.almora-studio-dashboard-active>.almora-studio-shell{display:grid;grid-template-columns:248px minmax(0,1fr);min-height:calc(100vh - 20px);background:var(--bg);border:1px solid var(--bd);border-radius:20px;overflow:hidden}
  .almora-studio-sidebar{background:linear-gradient(180deg,var(--sf),color-mix(in srgb,var(--sf) 88%,var(--ac)));border-right:1px solid var(--bd);padding:22px 15px;display:flex;flex-direction:column;gap:22px;min-width:0}
  .almora-studio-brand{display:flex;align-items:center;gap:11px;padding:3px 8px;color:var(--tx)}
  .almora-studio-brand-mark{width:38px;height:38px;flex:0 0 38px;display:grid;place-items:center;background:transparent;border:0;box-shadow:none}
  .almora-studio-brand-mark svg{display:block;width:36px;height:34px}
  .almora-studio-brand strong,.almora-studio-brand small{display:block;line-height:1.05}.almora-studio-brand strong{font:700 21px Fredoka,sans-serif;letter-spacing:.5px;color:var(--ac2)}.almora-studio-brand small{font:700 8px Inter,system-ui,sans-serif;color:var(--mu);letter-spacing:2.8px;margin-top:5px}
  .almora-studio-sidebar-label,.almora-studio-eyebrow{font-size:10px;font-weight:800;letter-spacing:1.5px;color:var(--mu)}
  .almora-studio-sidebar-label{padding:0 10px;margin-bottom:-13px}
  .almora-studio-sidebar-nav{display:grid;gap:5px;width:100%;padding:0;margin:0;overflow:visible;white-space:normal}
  .almora-studio-nav-item{width:100%;display:flex;align-items:center;gap:12px;text-align:left;background:transparent;color:var(--mu);border:1px solid transparent;border-radius:11px;padding:11px 12px;font-size:13px;font-weight:600;transition:.18s}
  .almora-studio-nav-item:hover{background:var(--sf2);color:var(--tx)}.almora-studio-nav-item.is-active{background:color-mix(in srgb,var(--ac) 17%,var(--sf));border-color:color-mix(in srgb,var(--ac) 35%,var(--bd));color:var(--tx)}
  .almora-studio-nav-icon{width:20px;text-align:center;font-size:17px;color:var(--ac)}
  .almora-studio-sidebar-bottom{margin-top:auto;border-top:1px solid var(--bd);padding:14px 8px 0;display:flex;align-items:center;gap:9px;color:var(--mu);font-size:11px}
  .almora-studio-status-dot{width:8px;height:8px;border-radius:50%;background:#39bd83;box-shadow:0 0 0 4px #39bd831a}
  .almora-studio-workspace{min-width:0;display:flex;flex-direction:column}
  .almora-studio-topbar{min-height:76px;padding:14px clamp(16px,3vw,30px);border-bottom:1px solid var(--bd);display:flex;align-items:center;justify-content:space-between;gap:15px;flex-wrap:wrap;background:color-mix(in srgb,var(--sf) 55%,var(--bg))}
  .almora-studio-topbar-title span{display:block;color:var(--mu);font-size:9px;letter-spacing:1.5px;font-weight:800}.almora-studio-topbar-title strong{display:block;font-size:18px;margin-top:2px}
  .almora-studio-topbar-user{display:flex;align-items:center;gap:9px;font-size:12px}.almora-studio-topbar-user strong,.almora-studio-topbar-user small{display:block}.almora-studio-topbar-user small{color:var(--mu);font-size:10px;margin-top:2px}
  .almora-studio-avatar{width:35px;height:35px;border-radius:50%;display:grid;place-items:center;background:var(--sf2);border:1px solid var(--bd);color:var(--ac);font-weight:800}
  .almora-studio-toolbar{margin:0;gap:7px}.almora-studio-toolbar button{font-size:11px;padding:8px 10px}
  .almora-studio-main{width:100%;max-width:1500px;margin:0 auto;padding:clamp(16px,3vw,32px);min-width:0}
  .almora-studio-overview[hidden]{display:none!important}
  .almora-studio-welcome{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:clamp(20px,4vw,34px);border:1px solid color-mix(in srgb,var(--ac) 30%,var(--bd));border-radius:18px;background:radial-gradient(ellipse at 90% 0%,color-mix(in srgb,var(--ac) 20%,transparent),transparent 55%),var(--sf)}
  .almora-studio-welcome h1{font-size:clamp(24px,3vw,34px);letter-spacing:-1px;margin:8px 0}.almora-studio-welcome p{color:var(--mu);margin:0;font-size:13px;max-width:520px}
  .almora-studio-welcome-mark{width:76px;height:76px;flex:0 0 76px;border-radius:23px;display:grid;place-items:center;background:linear-gradient(135deg,var(--ac),var(--ac2));color:white;font:700 43px Fredoka,sans-serif;box-shadow:0 12px 35px color-mix(in srgb,var(--ac) 25%,transparent)}
  .almora-studio-section-heading{display:flex;align-items:end;justify-content:space-between;gap:12px;margin:28px 0 13px}.almora-studio-section-heading h2{border:0;padding:0;margin:4px 0 0;font-size:18px}.almora-studio-section-heading>span{color:var(--mu);font-size:11px}
  .almora-studio-quick-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
  .almora-studio-quick-grid button{position:relative;display:grid;gap:7px;min-height:135px;padding:17px;text-align:left;background:var(--sf);border:1px solid var(--bd);border-radius:15px;color:var(--tx);transition:transform .18s,border-color .18s}
  .almora-studio-quick-grid button:hover{transform:translateY(-2px);border-color:var(--ac)}
  .almora-studio-quick-grid button>span{color:var(--ac);font-size:20px}.almora-studio-quick-grid button strong{font-size:13px}.almora-studio-quick-grid button small{color:var(--mu);font-size:11px;line-height:1.4}.almora-studio-quick-grid button>b{position:absolute;right:15px;top:15px;color:var(--mu)}
  .almora-studio-note{display:flex;gap:12px;margin-top:17px;padding:15px;border:1px solid var(--bd);border-radius:13px;background:var(--sf)}.almora-studio-note>span{color:var(--ac);font-size:20px}.almora-studio-note strong{font-size:12px}.almora-studio-note p{margin:3px 0 0;color:var(--mu);font-size:11px}
  .almora-studio-work-search{display:block;width:100%;margin:8px 0 14px}
  .almora-studio-chapter-details{margin-top:10px;border-top:1px solid var(--bd);padding-top:9px}.almora-studio-chapter-details summary{cursor:pointer;color:var(--ac);font-weight:600;padding:5px 0}
  .almora-settings-head,.almora-settings-grid,.almora-settings-form{max-width:100%}
  @media(max-width:900px){#app.almora-studio-dashboard-active>.almora-studio-shell{grid-template-columns:205px minmax(0,1fr)}.almora-studio-quick-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
  @media(max-width:650px){#app.almora-studio-dashboard-active>.almora-studio-shell{display:block;border-radius:14px}.almora-studio-sidebar{padding:12px 12px 9px;border-right:0;border-bottom:1px solid var(--bd);gap:10px}.almora-studio-brand{padding:0 4px} .almora-studio-brand-mark{width:34px;height:34px;flex-basis:34px}.almora-studio-brand-mark svg{width:32px;height:30px}.almora-studio-sidebar-label,.almora-studio-sidebar-bottom{display:none}.almora-studio-sidebar-nav{display:flex;overflow-x:auto;gap:6px;padding:2px 0 5px;scrollbar-width:thin}.almora-studio-nav-item{width:auto;flex:0 0 auto;white-space:nowrap;padding:9px 11px}.almora-studio-nav-icon{width:auto}.almora-studio-topbar{min-height:65px;padding:11px 14px}.almora-studio-topbar-user{display:none}.almora-studio-main{padding:15px 12px 25px}.almora-studio-welcome-mark{width:52px;height:52px;flex-basis:52px;border-radius:16px;font-size:30px}.almora-studio-quick-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.almora-studio-quick-grid button{min-height:125px;padding:13px}.almora-studio-section-heading>span{display:none}}
  @media(max-width:380px){.almora-studio-quick-grid{grid-template-columns:1fr}.almora-studio-toolbar{width:100%}.almora-studio-toolbar button{flex:1}}
  `;
  document.head.appendChild(style);

  function install(){
    if(!app||!isStudio()){app?.classList.remove('almora-studio-dashboard-active');return;}
    const section=document.getElementById('almora-studio-works');
    if(!section){app.classList.remove('almora-studio-dashboard-active');return;}
    if(!document.getElementById('almora-studio-shell'))buildShell(section);
    applyPage();
  }
  function start(){
    if(!app||observer)return;
    observer=new MutationObserver(()=>{if(isStudio())install();else app.classList.remove('almora-studio-dashboard-active');});
    observer.observe(app,{childList:true});
    if(isStudio())install();
  }
  window.addEventListener('hashchange',()=>{
    if(isStudio()){activePage='overview';app?.classList.remove('almora-studio-dashboard-active');Promise.resolve().then(install);}
    else app?.classList.remove('almora-studio-dashboard-active');
  });
  start();
})();