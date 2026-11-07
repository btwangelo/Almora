/* ALMORA — comunidade, conexões e personalização de perfis */
(() => {
  'use strict';
  const db = window.almoraDB || (typeof almoraDB !== 'undefined' ? almoraDB : null);
  const currentUser = () => (typeof user !== 'undefined' ? user : null);
  const escHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const palettes = {
    rose:{label:'Rosa',accent:'#c66f91',soft:'#f7e8ee',ink:'#563344'},
    lilac:{label:'Lilás',accent:'#9475bd',soft:'#eee7f7',ink:'#443455'},
    sage:{label:'Sálvia',accent:'#6e9b83',soft:'#e7f0e9',ink:'#30483a'},
    honey:{label:'Mel',accent:'#b58a45',soft:'#f5eedc',ink:'#514126'},
    ocean:{label:'Azul',accent:'#648cae',soft:'#e5eef5',ink:'#2d4356'}
  };
  let directoryRequest = 0;

  async function fetchProfiles(query) {
    const q=String(query||'').trim().replace(/^@+/, '').replace(/[%,()]/g,' ').replace(/\s+/g,' ').trim();
    let request=db.from('profiles').select('id,username,display_name,avatar_url,bio,created_at').order('created_at',{ascending:false}).limit(40);
    if(q)request=request.or('username.ilike.%'+q+'%,display_name.ilike.%'+q+'%');
    const {data,error}=await request;
    if(error)throw error;
    return data||[];
  }

  window.almoraRenderDirectory = renderDirectory;

  function personCard(p,followed=false) {
    const label=p.display_name||p.username||'Leitor(a)';
    const canFollow=currentUser()&&currentUser().id!==p.id;
    return '<article class="almora-person-card" data-search="'+escHtml((label+' '+(p.username||'')).toLowerCase())+'"><a class="almora-person-main" href="#perfil/'+encodeURIComponent(p.id)+'">'+
      (p.avatar_url?'<img src="'+escHtml(p.avatar_url)+'" alt="" loading="lazy">':'<span class="almora-person-avatar">♡</span>')+
      '<span><b>'+escHtml(label)+'</b><small>@'+escHtml(p.username||'leitor')+'</small><small>'+escHtml((p.bio||'Leitor(a) da ALMORA').slice(0,100))+'</small></span></a>'+
      (canFollow?'<button class="g" type="button" data-follow-id="'+escHtml(p.id)+'">'+(followed?'Seguindo':'Seguir')+'</button>':'')+'</article>';
  }

  function bindFollowButtons(root) {
    root.querySelectorAll('[data-follow-id]').forEach(button=>{
      if(button.dataset.followBound==='1')return;
      button.dataset.followBound='1';
      button.addEventListener('click',()=>window.almoraDirectoryToggleFollow(button.dataset.followId,button));
    });
  }

  async function renderDirectory(query='') {
    const app=document.getElementById('app');
    if(!app)return;
    if(!currentUser()){
      app.innerHTML='<section class="almora-directory"><h1>Comunidade</h1><div class="empty">Entre na sua conta para pesquisar perfis, conhecer leitores e seguir pessoas.<br><a href="#conta" style="color:var(--ac)">Entrar ou criar conta</a></div></section>';
      return;
    }
    const requestId=++directoryRequest;
    app.innerHTML='<section class="almora-directory"><h1>Comunidade</h1><div class="empty">Encontrando leitores...</div></section>';
    try{
      const people=await fetchProfiles(query);
      if(requestId!==directoryRequest||location.hash.split('/')[0]!=='#comunidade')return;
      const me=currentUser();
      let followed=new Set();
      if(me&&people.length){
        const {data,error}=await db.from('follows').select('following_id').eq('follower_id',me.id).in('following_id',people.map(p=>p.id));
        if(error)throw error;
        followed=new Set((data||[]).map(x=>x.following_id));
      }
      app.innerHTML='<section class="almora-directory"><div class="almora-directory-head"><div><h1>Comunidade</h1><p>Encontre leitores, conheça seus perfis e acompanhe suas publicações.</p></div></div>'+
        '<label class="almora-search-label" for="almora-people-search">Pesquisar perfis</label><input id="almora-people-search" type="search" value="'+escHtml(query)+'" placeholder="Buscar por @usuário ou nome..." autocomplete="off">'+
        '<div class="almora-directory-results">'+(people.length?people.map(p=>personCard(p,followed.has(p.id))).join(''):'<div class="empty">Nenhum perfil encontrado.</div>')+'</div></section>';
      bindFollowButtons(app);
      const input=document.getElementById('almora-people-search');
      let timer;
      input?.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>renderDirectory(input.value),300);});
    }catch(error){
      if(requestId===directoryRequest)app.innerHTML='<div class="empty">Não foi possível pesquisar perfis: '+escHtml(error.message)+'</div>';
    }
  }

  window.almoraDirectoryToggleFollow=async(id,button)=>{
    const me=currentUser();
    if(!me)return toast('Entre na sua conta para seguir leitores.');
    if(me.id===id)return;
    if(button)button.disabled=true;
    try{
      const {data,error:readError}=await db.from('follows').select('follower_id').eq('follower_id',me.id).eq('following_id',id).maybeSingle();
      if(readError)throw readError;
      const result=data
        ?await db.from('follows').delete().eq('follower_id',me.id).eq('following_id',id)
        :await db.from('follows').insert({follower_id:me.id,following_id:id});
      if(result.error)throw result.error;
      if(location.hash==='#comunidade')renderDirectory(document.getElementById('almora-people-search')?.value||'');
      else if(button){button.textContent=data?'Seguir':'Seguindo';button.disabled=false;}
    }catch(error){
      toast('Não foi possível atualizar o acompanhamento: '+error.message);
      if(button)button.disabled=false;
    }
  };

  window.almoraOpenConnectionsPage=(profileId,kind)=>{
    if(!profileId||!['followers','following'].includes(kind))return;
    location.hash='#conexoes/'+encodeURIComponent(profileId)+'/'+kind;
    if(typeof window.ren==='function')window.ren();
  };
  window.almoraRenderConnectionsPage=renderConnectionsPage;

  async function renderConnectionsPage(profileId,kind){
    const app=document.getElementById('app');
    if(!app)return;
    const followers=kind==='followers';
    const title=followers?'Seguidores':'Seguindo';
    app.innerHTML='<section class="almora-connections-page"><button class="g" type="button" id="almora-connections-back">← Voltar ao perfil</button><h1>'+title+'</h1><div class="empty">Carregando...</div></section>';
    const back=()=>{location.hash='#perfil/'+encodeURIComponent(profileId);};
    document.getElementById('almora-connections-back')?.addEventListener('click',back);
    try{
      const {data,error}=await db.from('follows').select('follower_id,following_id,created_at')
        .eq(followers?'following_id':'follower_id',profileId)
        .order('created_at',{ascending:false}).limit(100);
      if(error)throw error;
      const ids=(data||[]).map(row=>followers?row.follower_id:row.following_id);
      const page=app.querySelector('.almora-connections-page');
      if(!page)return;
      if(!ids.length){
        page.innerHTML='<button class="g" type="button" id="almora-connections-back">← Voltar ao perfil</button><h1>'+title+'</h1><div class="empty">'+(followers?'Este perfil ainda não tem seguidores.':'Este perfil ainda não segue ninguém.')+'</div>';
        document.getElementById('almora-connections-back')?.addEventListener('click',back);
        return;
      }
      const result=await db.from('profiles').select('id,username,display_name,avatar_url,bio').in('id',ids);
      if(result.error)throw result.error;
      const byId=new Map((result.data||[]).map(person=>[person.id,person]));
      const people=ids.map(id=>byId.get(id)||{id,username:'privado',display_name:'Perfil privado',bio:'Este perfil não está público.'});
      let followed=new Set();
      const me=currentUser();
      if(me){
        const relation=await db.from('follows').select('following_id').eq('follower_id',me.id).in('following_id',ids);
        if(relation.error)throw relation.error;
        followed=new Set((relation.data||[]).map(row=>row.following_id));
      }
      page.innerHTML='<button class="g" type="button" id="almora-connections-back">← Voltar ao perfil</button><h1>'+title+'</h1>'+
        '<label class="almora-search-label" for="almora-connections-search">'+(followers?'Pesquisar seguidores':'Pesquisar pessoas que você segue')+'</label>'+
        '<input id="almora-connections-search" type="search" placeholder="'+(followers?'Buscar seguidor por nome ou @usuário...':'Buscar pessoa seguida por nome ou @usuário...')+'" autocomplete="off">'+
        '<div class="almora-connections-results">'+people.map(person=>personCard(person,followed.has(person.id))).join('')+'</div>';
      document.getElementById('almora-connections-back')?.addEventListener('click',back);
      const search=document.getElementById('almora-connections-search');
      search?.addEventListener('input',()=>{
        const term=search.value.trim().toLocaleLowerCase('pt-BR');
        page.querySelectorAll('.almora-connections-results .almora-person-card').forEach(card=>{
          card.hidden=!!term&&!String(card.dataset.search||'').includes(term);
        });
      });
      bindFollowButtons(page);
    }catch(error){
      const page=app.querySelector('.almora-connections-page');
      if(page)page.innerHTML='<button class="g" type="button" onclick="location.hash=\'#perfil/'+encodeURIComponent(profileId)+'\'">← Voltar ao perfil</button><h1>'+title+'</h1><div class="empty">Não foi possível carregar a lista: '+escHtml(error.message)+'</div>';
    }
  }

  window.almoraShowConnections=async(profileId,kind)=>{
    const mount=document.getElementById('almora-connections-list');
    if(!mount)return;
    mount.innerHTML='<div class="empty">Carregando...</div>';
    try{
      const {data,error}=await db.from('follows').select('follower_id,following_id,created_at')
        .eq(kind==='followers'?'following_id':'follower_id',profileId).order('created_at',{ascending:false}).limit(100);
      if(error)throw error;
      const ids=(data||[]).map(x=>kind==='followers'?x.follower_id:x.following_id);
      if(!ids.length){mount.innerHTML='<div class="empty">Ninguém por aqui ainda.</div>';return;}
      const result=await db.from('profiles').select('id,username,display_name,avatar_url,bio').in('id',ids);
      if(result.error)throw result.error;
      const map=new Map((result.data||[]).map(p=>[p.id,p]));
      mount.innerHTML='<div class="almora-connections-heading">'+(kind==='followers'?'Pessoas que seguem este perfil':'Pessoas seguidas por este perfil')+'</div>'+
        '<input type="search" class="almora-connections-search" aria-label="Pesquisar conexões" placeholder="'+(kind==='followers'?'Pesquisar seguidores por nome ou @usuário...':'Pesquisar pessoas seguidas por nome ou @usuário...')+'">'+
        '<div class="almora-connections-results">'+ids.map(id=>map.get(id)).filter(Boolean).map(p=>personCard(p)).join('')+'</div>';
      const search=mount.querySelector('.almora-connections-search');
      search?.addEventListener('input',()=>{
        const term=search.value.trim().toLocaleLowerCase('pt-BR');
        mount.querySelectorAll('.almora-connections-results .almora-person-card').forEach(card=>{
          card.hidden=!!term&&!String(card.dataset.search||'').includes(term);
        });
      });
      bindFollowButtons(mount);
    }catch(error){
      mount.innerHTML='<div class="empty">Não foi possível carregar a lista. '+escHtml(error.message)+'</div>';
    }
  };

  async function loadAppearance(profileId,profile){
    const {data,error}=await db.from('profile_appearance').select('theme,layout,settings,cover_url').eq('user_id',profileId).maybeSingle();
    if(error)throw error;
    if(!profile.isConnected||(location.hash.slice(1).split('/')[1]||currentUser()?.id)!==profileId)return;
    const a=data||{theme:'system',layout:'moodboard',settings:{palette:'rose',decorations:'soft'},cover_url:null};
    const palette=palettes[a.settings?.palette]||palettes.rose;
    profile.dataset.palette=a.settings?.palette||'rose';
    profile.dataset.profileTheme=a.theme||'system';
    profile.style.setProperty('--profile-accent',palette.accent);
    profile.style.setProperty('--profile-soft',palette.soft);
    profile.style.setProperty('--profile-ink',palette.ink);
    if(a.cover_url&&!profile.querySelector('.almora-profile-cover')){
      const banner=document.createElement('div');
      banner.className='almora-profile-cover';
      banner.style.backgroundImage='url('+JSON.stringify(String(a.cover_url))+')';
      profile.prepend(banner);
    }
    profile.classList.add('almora-moodboard-profile');
  }

  window.almoraOpenProfileEditor=async()=>{
    const me=currentUser();
    if(!me)return;
    const app=document.getElementById('app');
    app.innerHTML='<div class="empty">Carregando personalização...</div>';
    try{
      const {data,error}=await db.from('profile_appearance').select('theme,layout,settings,cover_url').eq('user_id',me.id).maybeSingle();
      if(error)throw error;
      const a=data||{theme:'system',layout:'moodboard',settings:{palette:'rose'},cover_url:''};
      app.innerHTML='<section class="almora-editor"><button class="g" type="button" id="almora-editor-back">← Voltar ao perfil</button><h1>Personalizar perfil</h1><p>Monte seu moodboard escolhendo opções que combinam com você.</p>'+
        '<label>Paleta de cores</label><div class="almora-palette-picker">'+Object.entries(palettes).map(([key,p])=>'<label><input type="radio" name="almora-palette" value="'+key+'" '+((a.settings?.palette||'rose')===key?'checked':'')+'><span style="background:'+p.soft+';border-color:'+p.accent+'"><i style="background:'+p.accent+'"></i>'+p.label+'</span></label>').join('')+'</div>'+
        '<label for="almora-profile-theme">Tema do perfil</label><select id="almora-profile-theme"><option value="system" '+(a.theme==='system'?'selected':'')+'>Acompanhar tema do site</option><option value="light" '+(a.theme==='light'?'selected':'')+'>Claro</option><option value="dark" '+(a.theme==='dark'?'selected':'')+'>Escuro</option></select>'+
        '<label for="almora-profile-cover">URL da capa (opcional)</label><input id="almora-profile-cover" type="url" maxlength="1000" placeholder="https://..." value="'+escHtml(a.cover_url||'')+'">'+
        '<label for="almora-profile-cover-file">Ou enviar imagem de capa</label><input id="almora-profile-cover-file" type="file" accept="image/*"><small>Imagem de até 5 MB. Formatos de imagem comuns.</small>'+
        '<div class="act"><button type="button" id="almora-editor-save">Salvar personalização</button><button type="button" class="g" id="almora-editor-cancel">Cancelar</button></div></section>';
      const back=()=>{if(typeof window.ren==='function')window.ren();};
      document.getElementById('almora-editor-back').addEventListener('click',back);
      document.getElementById('almora-editor-cancel').addEventListener('click',back);
      document.getElementById('almora-editor-save').addEventListener('click',window.almoraSaveAppearance);
    }catch(error){
      app.innerHTML='<div class="empty">Não foi possível abrir o editor: '+escHtml(error.message)+'</div>';
    }
  };

  window.almoraSaveAppearance=async()=>{
    const me=currentUser();
    if(!me)return;
    const palette=document.querySelector('input[name="almora-palette"]:checked')?.value||'rose';
    const theme=document.getElementById('almora-profile-theme')?.value||'system';
    let cover=document.getElementById('almora-profile-cover')?.value.trim()||null;
    const file=document.getElementById('almora-profile-cover-file')?.files?.[0];
    if(file){
      if(!file.type.startsWith('image/'))return toast('Escolha um arquivo de imagem.');
      if(file.size>5*1024*1024)return toast('A capa deve ter no máximo 5 MB.');
      if(typeof almoraUploadToR2!=='function')return toast('O envio de imagens não está disponível neste momento.');
      try{cover=await almoraUploadToR2(file);}catch(error){return toast('Erro ao enviar capa: '+error.message);}
    }
    if(cover&&!/^https:\/\//i.test(cover))return toast('A URL da capa precisa começar com https://.');
    const payload={user_id:me.id,theme,layout:'moodboard',settings:{palette,section_order:['about','library','works','achievements'],visible_sections:['about','library','works','achievements']},cover_url:cover,updated_at:new Date().toISOString()};
    try{
      const {error}=await db.from('profile_appearance').upsert(payload,{onConflict:'user_id'});
      if(error)throw error;
      toast('Personalização salva!');
      if(typeof window.ren==='function')window.ren();
    }catch(error){toast('Não foi possível salvar: '+error.message);}
  };

  function decorateProfile(){
    // Só a visualização pública recebe decoração. A tela de edição também
    // usa a classe .almora-profile, mas não deve receber controles sociais.
    const profile=document.querySelector('.almora-profile-view');
    if(!profile)return;
    const profileId=location.hash.slice(1).split('/')[1]||currentUser()?.id;
    if(!profileId)return;
    if(!profile.dataset.appearanceLoaded){
      profile.dataset.appearanceLoaded='1';
      loadAppearance(profileId,profile).catch(error=>{delete profile.dataset.appearanceLoaded;console.warn('Aparência do perfil indisponível:',error);});
    }
  }

  const style=document.createElement('style');
  style.textContent='.almora-moodboard-profile{position:relative;overflow:hidden;padding:16px;border-radius:18px;background:var(--profile-soft,#f7e8ee);color:var(--profile-ink,#563344);border:1px solid color-mix(in srgb,var(--profile-accent,#c66f91) 35%,transparent)}'+
    '.almora-profile-cover{height:clamp(110px,24vw,210px);margin:-16px -16px 18px;background-position:center;background-size:cover;background-color:var(--profile-soft);border-radius:17px 17px 0 0}'+
    '.almora-moodboard-profile .almora-profile-info h1{color:inherit}.almora-moodboard-profile .almora-username{color:var(--profile-accent)}'+
    '.almora-moodboard-profile[data-profile-theme="dark"]{--profile-soft:#292330!important;--profile-ink:#f4edf6!important}.almora-moodboard-profile[data-profile-theme="light"]{background:var(--profile-soft);color:var(--profile-ink)}'+
    '.almora-directory,.almora-editor{max-width:850px;margin:0 auto}.almora-directory-head p,.almora-editor>p{color:var(--mu)}'+
    '.almora-search-label,.almora-editor>label{display:block;margin:14px 0 5px;font-weight:600}.almora-directory input[type=search],.almora-editor input,.almora-editor select{width:100%;max-width:100%}'+
    '.almora-directory-results{display:grid;gap:10px;margin-top:16px}.almora-person-card{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px;background:var(--sf);border:1px solid var(--bd);border-radius:14px}'+
    '.almora-person-main{display:flex;align-items:center;gap:12px;min-width:0;flex:1}.almora-person-main img,.almora-person-avatar{width:48px;height:48px;flex:0 0 48px;object-fit:cover;border-radius:50%;background:var(--sf2);display:grid;place-items:center}'+
    '.almora-person-main span:last-child{min-width:0;display:grid;gap:2px}.almora-person-main small{color:var(--mu);overflow-wrap:anywhere}'+
    '#almora-profile-social{display:block!important;margin-top:18px!important}'+
    '.almora-social-counts{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px!important;width:100%;margin:0 0 12px}'+
    '.almora-social-count-button{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;min-width:0;padding:12px 8px;background:var(--sf);color:var(--tx);border:1px solid var(--bd);border-radius:12px;text-align:center;width:100%}.almora-social-count-button b{font-size:20px;color:var(--tx)}.almora-social-count-button span{font-size:13px;color:var(--mu)}'+
    '.almora-social-counts span b{font-size:20px;color:var(--tx)}'+
    '#almora-profile-social #almora-follow-button{min-height:42px;padding:9px 18px}'+
    '.almora-connections-page{max-width:850px;margin:0 auto}.almora-connections-page .almora-connections-results{display:grid;gap:10px;margin-top:16px}.almora-connections-page [hidden]{display:none!important}'+
    '.almora-connection-buttons{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:12px}.almora-connection-buttons button{width:100%;min-height:48px;padding:10px 14px;border:1px solid var(--bd);border-radius:12px;white-space:normal}'+
    '.almora-connections-search{width:100%;margin:10px 0}.almora-connections-results{display:grid;gap:10px}.almora-connections-results [hidden]{display:none!important}'+
    '#almora-connections-list{display:grid;gap:10px;margin-top:16px}#almora-connections-list .almora-person-card{margin:0}.almora-connections-heading{font-weight:600;color:var(--mu);margin:4px 0}'+
    '.almora-editor{background:var(--sf);border:1px solid var(--bd);border-radius:18px;padding:16px}.almora-editor input[type=file]{margin:6px 0}'+
    '.almora-palette-picker{display:grid;grid-template-columns:repeat(auto-fit,minmax(105px,1fr));gap:8px}.almora-palette-picker label{margin:0!important}.almora-palette-picker input{position:absolute;opacity:0;pointer-events:none}'+
    '.almora-palette-picker span{display:flex;align-items:center;gap:7px;padding:10px;border:2px solid var(--bd);border-radius:12px;cursor:pointer}.almora-palette-picker input:checked+span{outline:2px solid var(--ac);outline-offset:2px}'+
    '.almora-palette-picker i{width:18px;height:18px;border-radius:50%}@media(max-width:520px){.almora-person-card{align-items:flex-start}.almora-person-card>button{padding:7px 10px}.almora-moodboard-profile{padding:12px}.almora-profile-cover{margin:-12px -12px 14px}}';
  document.head.appendChild(style);

  function addCommunityLink(){
    const nav=document.getElementById('nav');
    if(nav&&!nav.querySelector('a[href="#comunidade"]')){
      const link=document.createElement('a');link.href='#comunidade';link.textContent='Comunidade';nav.appendChild(link);
    }
  }
  const app=document.getElementById('app');
  if(app)new MutationObserver(()=>{addCommunityLink();decorateProfile();}).observe(app,{childList:true});
  const nav=document.getElementById('nav');
  if(nav)new MutationObserver(addCommunityLink).observe(nav,{childList:true});
  window.addEventListener('hashchange',()=>{
    addCommunityLink();
    if(location.hash==='#comunidade')renderDirectory();
  });
  addCommunityLink();
  if(location.hash==='#comunidade')renderDirectory();
  const initialRoute=location.hash.slice(1).split('/');
  if(initialRoute[0]==='conexoes'&&initialRoute[1]&&['followers','following'].includes(initialRoute[2])){
    renderConnectionsPage(decodeURIComponent(initialRoute[1]),initialRoute[2]);
  }
})();
