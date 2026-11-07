/* ALMORA social discovery + guided profile appearance */
(() => {
  'use strict';
  const db = window.almoraDB;
  const currentUser = () => (typeof user !== 'undefined' ? user : null);
  const escHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const palettes = {
    rose: {label:'Rosa', accent:'#c66f91', soft:'#f7e8ee', ink:'#563344'},
    lilac: {label:'Lilás', accent:'#9475bd', soft:'#eee7f7', ink:'#443455'},
    sage: {label:'Sálvia', accent:'#6e9b83', soft:'#e7f0e9', ink:'#30483a'},
    honey: {label:'Mel', accent:'#b58a45', soft:'#f5eedc', ink:'#514126'},
    ocean: {label:'Azul', accent:'#648cae', soft:'#e5eef5', ink:'#2d4356'}
  };
  let appearance = null;
  let directoryRequest = 0;

  async function fetchProfiles(query) {
    let request = db.from('profiles').select('id,username,display_name,avatar_url,bio,created_at').order('created_at',{ascending:false}).limit(40);
    if (query) request = request.or('username.ilike.%'+query+'%,display_name.ilike.%'+query+'%');
    const {data,error} = await request;
    if (error) throw error;
    return data || [];
  }

  function personCard(p) {
    const label = p.display_name || p.username || 'Leitor(a)';
    return '<article class="almora-person-card"><a class="almora-person-main" href="#perfil/'+encodeURIComponent(p.id)+'">'+
      (p.avatar_url ? '<img src="'+escHtml(p.avatar_url)+'" alt="" loading="lazy">' : '<span class="almora-person-avatar">♡</span>')+
      '<span><b>'+escHtml(label)+'</b><small>@'+escHtml(p.username || 'leitor')+'</small><small>'+escHtml((p.bio || 'Leitor(a) da ALMORA').slice(0,100))+'</small></span></a>'+
      (currentUser() && currentUser().id !== p.id ? '<button class="g" type="button" onclick="almoraDirectoryToggleFollow(\''+p.id+'\',this)">Seguir</button>' : '')+'</article>';
  }

  async function renderDirectory(query='') {
    const app = document.getElementById('app');
    if (!app) return;
    const requestId = ++directoryRequest;
    app.innerHTML = '<h1>Comunidade</h1><div class="empty">Encontrando leitores...</div>';
    try {
      const people = await fetchProfiles(query.trim());
      if (requestId !== directoryRequest || location.hash.split('/')[0] !== '#comunidade') return;
      const me = currentUser();
      let followed = new Set();
      if (me && people.length) {
        const {data,error} = await db.from('follows').select('following_id').eq('follower_id',me.id).in('following_id',people.map(p=>p.id));
        if (error) throw error;
        followed = new Set((data||[]).map(x=>x.following_id));
      }
      app.innerHTML = '<section class="almora-directory"><div class="almora-directory-head"><div><h1>Comunidade</h1><p>Encontre leitores, conheça seus perfis e acompanhe suas publicações.</p></div></div>'+
        '<label class="almora-search-label" for="almora-people-search">Pesquisar perfis</label><input id="almora-people-search" type="search" value="'+escHtml(query)+'" placeholder="Buscar por @usuário ou nome..." autocomplete="off">'+
        '<div class="almora-directory-results">'+(people.length ? people.map(p=>{
          const card=personCard(p);
          return me && me.id!==p.id ? card.replace('>Seguir</button>', '>'+(followed.has(p.id)?'Seguindo':'Seguir')+'</button>').replace('almoraDirectoryToggleFollow', 'almoraDirectoryToggleFollow') : card;
        }).join('') : '<div class="empty">Nenhum perfil encontrado.</div>')+'</div></section>';
      const input=document.getElementById('almora-people-search');
      let timer;
      input?.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>renderDirectory(input.value),250);});
    } catch(error) {
      if (requestId===directoryRequest) app.innerHTML='<div class="empty">Não foi possível pesquisar perfis: '+escHtml(error.message)+'</div>';
    }
  }

  window.almoraDirectoryToggleFollow = async (id,button) => {
    const me=currentUser();
    if(!me)return toast('Entre na sua conta para seguir leitores.');
    if(me.id===id)return;
    if(button)button.disabled=true;
    try{
      const {data,error:readError}=await db.from('follows').select('follower_id').eq('follower_id',me.id).eq('following_id',id).maybeSingle();
      if(readError)throw readError;
      const result=data
        ? await db.from('follows').delete().eq('follower_id',me.id).eq('following_id',id)
        : await db.from('follows').insert({follower_id:me.id,following_id:id});
      if(result.error)throw result.error;
      if(location.hash==='#comunidade')renderDirectory(document.getElementById('almora-people-search')?.value||'');
      else if(button)button.textContent=data?'Seguir':'Seguindo';
    }catch(error){toast('Não foi possível atualizar o acompanhamento: '+error.message);if(button)button.disabled=false;}
  };

  window.almoraShowConnections = async (profileId, kind) => {
    const mount=document.getElementById('almora-connections-list');
    if(!mount)return;
    mount.innerHTML='<div class="empty">Carregando...</div>';
    try{
      const column=kind==='followers'?'follower_id':'following_id';
      const {data,error}=await db.from('follows').select('follower_id,following_id,created_at').eq(kind==='followers'?'following_id':'follower_id',profileId).order('created_at',{ascending:false}).limit(100);
      if(error)throw error;
      const ids=(data||[]).map(x=>kind==='followers'?x.follower_id:x.following_id);
      if(!ids.length){mount.innerHTML='<div class="empty">Ninguém por aqui ainda.</div>';return;}
      const result=await db.from('profiles').select('id,username,display_name,avatar_url,bio').in('id',ids);
      if(result.error)throw result.error;
      const map=new Map((result.data||[]).map(p=>[p.id,p]));
      mount.innerHTML='<h3>'+(kind==='followers'?'Seguidores':'Seguindo')+'</h3>'+ids.map(id=>map.get(id)).filter(Boolean).map(personCard).join('');
    }catch(error){mount.innerHTML='<div class="empty">Não foi possível carregar a lista. '+escHtml(error.message)+'</div>';}
  };

  async function loadAppearance(profileId) {
    const {data,error}=await db.from('profile_appearance').select('theme,layout,settings,cover_url').eq('user_id',profileId).maybeSingle();
    if(error)throw error;
    appearance=data||{theme:'system',layout:'moodboard',settings:{palette:'rose',decorations:'soft'},cover_url:null};
    const profile=document.querySelector('.almora-profile');
    if(!profile)return;
    const palette=palettes[appearance.settings?.palette]||palettes.rose;
    profile.dataset.palette=appearance.settings?.palette||'rose';
    profile.dataset.profileTheme=appearance.theme||'system';
    profile.style.setProperty('--profile-accent',palette.accent);
    profile.style.setProperty('--profile-soft',palette.soft);
    profile.style.setProperty('--profile-ink',palette.ink);
    if(appearance.cover_url){
      const banner=document.createElement('div');
      banner.className='almora-profile-cover';
      banner.style.backgroundImage='url("'+String(appearance.cover_url).replace(/["\\\\]/g,'')+'")';
      profile.prepend(banner);
    }
    profile.classList.add('almora-moodboard-profile');
  }

  window.almoraOpenProfileEditor = async () => {
    const me=currentUser();
    if(!me)return;
    const app=document.getElementById('app');
    app.innerHTML='<div class="empty">Carregando personalização...</div>';
    try{
      const {data,error}=await db.from('profile_appearance').select('theme,layout,settings,cover_url').eq('user_id',me.id).maybeSingle();
      if(error)throw error;
      const a=data||{theme:'system',layout:'moodboard',settings:{palette:'rose',decorations:'soft'},cover_url:''};
      app.innerHTML='<section class="almora-editor"><button class="g" type="button" onclick="location.hash=\'#perfil\'">← Voltar ao perfil</button><h1>Personalizar perfil</h1><p>Monte seu moodboard escolhendo opções que combinam com você.</p>'+
        '<label>Paleta de cores</label><div class="almora-palette-picker">'+Object.entries(palettes).map(([key,p])=>'<label><input type="radio" name="almora-palette" value="'+key+'" '+((a.settings?.palette||'rose')===key?'checked':'')+'><span style="background:'+p.soft+';border-color:'+p.accent+'"><i style="background:'+p.accent+'"></i>'+p.label+'</span></label>').join('')+'</div>'+
        '<label for="almora-profile-theme">Tema do perfil</label><select id="almora-profile-theme"><option value="system" '+(a.theme==='system'?'selected':'')+'>Acompanhar tema do site</option><option value="light" '+(a.theme==='light'?'selected':'')+'>Claro</option><option value="dark" '+(a.theme==='dark'?'selected':'')+'>Escuro</option></select>'+
        '<label for="almora-profile-cover">URL da capa (opcional)</label><input id="almora-profile-cover" type="url" maxlength="1000" placeholder="https://..." value="'+escHtml(a.cover_url||'')+'">'+
        '<label for="almora-profile-cover-file">Ou enviar imagem de capa</label><input id="almora-profile-cover-file" type="file" accept="image/*"><small>Imagem de até 5 MB. Formatos de imagem comuns.</small>'+
        '<label for="almora-profile-decor">Decoração</label><select id="almora-profile-decor"><option value="soft">Suave — flores e detalhes delicados</option><option value="minimal">Minimalista</option><option value="stars">Estrelas e brilho</option></select>'+
        '<div class="almora-editor-preview" id="almora-editor-preview"><b>Meu universo ♡</b><p>Uma pequena coleção de histórias, gostos e lembranças.</p></div>'+
        '<div class="act"><button type="button" onclick="almoraSaveAppearance()">Salvar personalização</button><button type="button" class="g" onclick="location.hash=\'#perfil\'">Cancelar</button></div></section>';
      document.querySelectorAll('input[name="almora-palette"]').forEach(input=>input.addEventListener('change',()=>{
        const p=palettes[input.value],preview=document.getElementById('almora-editor-preview');
        preview.style.background=p.soft;preview.style.borderColor=p.accent;preview.style.color=p.ink;
      }));
      const selected=document.querySelector('input[name="almora-palette"]:checked');
      if(selected)selected.dispatchEvent(new Event('change'));
      document.getElementById('almora-profile-decor').value=a.settings?.decorations||'soft';
    }catch(error){app.innerHTML='<div class="empty">Não foi possível abrir o editor: '+escHtml(error.message)+'</div>';}
  };

  window.almoraSaveAppearance = async () => {
    const me=currentUser();if(!me)return;
    const palette=document.querySelector('input[name="almora-palette"]:checked')?.value||'rose';
    const theme=document.getElementById('almora-profile-theme')?.value||'system';
    const decor=document.getElementById('almora-profile-decor')?.value||'soft';
    let cover=document.getElementById('almora-profile-cover')?.value.trim()||null;
    const file=document.getElementById('almora-profile-cover-file')?.files?.[0];
    if(file){
      if(!file.type.startsWith('image/'))return toast('Escolha um arquivo de imagem.');
      if(file.size>5*1024*1024)return toast('A capa deve ter no máximo 5 MB.');
      if(typeof almoraUploadToR2!=='function')return toast('O envio de imagens não está disponível neste momento.');
      try{cover=await almoraUploadToR2(file);}catch(error){return toast('Erro ao enviar capa: '+error.message);}
    }
    const payload={user_id:me.id,theme,layout:'moodboard',settings:{palette,decorations:decor,section_order:['about','library','works','achievements'],visible_sections:['about','library','works','achievements']},cover_url:cover,updated_at:new Date().toISOString()};
    try{
      const {error}=await db.from('profile_appearance').upsert(payload,{onConflict:'user_id'});
      if(error)throw error;
      toast('Personalização salva!');
      location.hash='#perfil';
    }catch(error){toast('Não foi possível salvar: '+error.message);}
  };

  function decorateProfile() {
    const profile=document.querySelector('.almora-profile');
    if(!profile)return;
    const profileId=location.hash.slice(1).split('/')[1]||currentUser()?.id;
    if(!profileId)return;
    if(!profile.querySelector('#almora-connections-list')){
      const social=document.getElementById('almora-profile-social');
      if(social){
        const lists=document.createElement('div');
        lists.className='almora-connection-tools';
        lists.innerHTML='<button class="g" type="button" onclick="almoraShowConnections(\''+profileId+'\',\'followers\')">Ver seguidores</button><button class="g" type="button" onclick="almoraShowConnections(\''+profileId+'\',\'following\')">Ver seguindo</button><div id="almora-connections-list"></div>';
        social.insertAdjacentElement('afterend',lists);
      }
    }
    const actions=profile.querySelector('.almora-profile-actions');
    if(actions && currentUser()?.id===profileId && !document.getElementById('almora-customize-profile')){
      const button=document.createElement('button');
      button.id='almora-customize-profile';button.className='g';button.type='button';button.textContent='Personalizar perfil';button.onclick=window.almoraOpenProfileEditor;
      actions.prepend(button);
    }
    if(!profile.dataset.appearanceLoaded){
      profile.dataset.appearanceLoaded='1';
      loadAppearance(profileId).catch(error=>console.warn('Aparência do perfil indisponível:',error));
    }
  }

  function addCommunityLink(){
    const nav=document.getElementById('nav');
    if(nav && !nav.querySelector('a[href="#comunidade"]')){
      const link=document.createElement('a');link.href='#comunidade';link.textContent='Comunidade';
      nav.appendChild(link);
    }
  }
  const app=document.getElementById('app');
  if(app)new MutationObserver(()=>{addCommunityLink();decorateProfile();}).observe(app,{childList:true,subtree:true});
  const nav=document.getElementById('nav');
  if(nav)new MutationObserver(addCommunityLink).observe(nav,{childList:true,subtree:true});
  window.addEventListener('hashchange',()=>{
    addCommunityLink();
    if(location.hash==='#comunidade')renderDirectory();
  });
  addCommunityLink();
  if(location.hash==='#comunidade')renderDirectory();
})();
