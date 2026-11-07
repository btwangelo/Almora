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
  const validColor=value=>/^#[0-9a-f]{6}$/i.test(String(value||''));
  const colorHue=value=>{
    if(!validColor(value))return 0;
    const r=parseInt(value.slice(1,3),16)/255,g=parseInt(value.slice(3,5),16)/255,b=parseInt(value.slice(5,7),16)/255;
    const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;
    if(!d)return 0;
    let h=max===r?((g-b)/d)%6:max===g?(b-r)/d+2:(r-g)/d+4;
    return Math.round((h*60+360)%360);
  };
  const hslHex=(h,s,l)=>{
    s/=100;l/=100;const k=n=>(n+h/30)%12,a=s*Math.min(l,1-l);
    const f=n=>Math.round(255*(l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1)))));
    return '#'+[f(0),f(8),f(4)].map(v=>v.toString(16).padStart(2,'0')).join('');
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
    const target='#conexoes/'+encodeURIComponent(profileId)+'/'+kind;
    if(location.hash===target){
      renderConnectionsPage(profileId,kind);
      return;
    }
    location.hash=target;
  };
  window.almoraRenderConnectionsPage=renderConnectionsPage;

  let connectionsPageRequest=0;
  async function renderConnectionsPage(profileId,kind){
    const app=document.getElementById('app');
    if(!app)return;
    const request=++connectionsPageRequest;
    const expectedHash='#conexoes/'+encodeURIComponent(profileId)+'/'+kind;
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
      if(request!==connectionsPageRequest||location.hash!==expectedHash)return;
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
      if(request!==connectionsPageRequest||location.hash!==expectedHash)return;
      const byId=new Map((result.data||[]).map(person=>[person.id,person]));
      const people=ids.map(id=>byId.get(id)||{id,username:'privado',display_name:'Perfil privado',bio:'Este perfil não está público.'});
      let followed=new Set();
      const me=currentUser();
      if(me){
        const relation=await db.from('follows').select('following_id').eq('follower_id',me.id).in('following_id',ids);
        if(relation.error)throw relation.error;
        followed=new Set((relation.data||[]).map(row=>row.following_id));
      }
      if(request!==connectionsPageRequest||location.hash!==expectedHash)return;
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
      if(request!==connectionsPageRequest||location.hash!==expectedHash)return;
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
    const colors=a.settings?.colors||{};
    const colorSet={
      top:validColor(colors.top)?colors.top:palette.soft,
      bottom:validColor(colors.bottom)?colors.bottom:palette.soft,
      bannerA:validColor(colors.bannerA)?colors.bannerA:palette.accent,
      bannerB:validColor(colors.bannerB)?colors.bannerB:palette.soft,
      accent:validColor(colors.accent)?colors.accent:palette.accent,
      text:validColor(colors.text)?colors.text:palette.ink
    };
    profile.dataset.palette='custom';
    profile.dataset.profileTheme=a.theme||'system';
    profile.style.setProperty('--profile-accent',colorSet.accent);
    profile.style.setProperty('--profile-soft',colorSet.top);
    profile.style.setProperty('--profile-ink',colorSet.text);
    profile.style.setProperty('--profile-top',colorSet.top);
    profile.style.setProperty('--profile-bottom',colorSet.bottom);
    profile.style.setProperty('--profile-banner-a',colorSet.bannerA);
    profile.style.setProperty('--profile-banner-b',colorSet.bannerB);
    if(!profile.querySelector('.almora-profile-cover')){
      const banner=document.createElement('div');
      banner.className='almora-profile-cover';
      if(a.cover_url)banner.style.backgroundImage='linear-gradient(110deg, '+colorSet.bannerA+'99, '+colorSet.bannerB+'99),url('+JSON.stringify(String(a.cover_url))+')';
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
      const fallback=palettes[a.settings?.palette]||palettes.rose;
      const saved=a.settings?.colors||{};
      const colorValues={
        top:validColor(saved.top)?saved.top:fallback.soft,
        bottom:validColor(saved.bottom)?saved.bottom:fallback.soft,
        bannerA:validColor(saved.bannerA)?saved.bannerA:fallback.accent,
        bannerB:validColor(saved.bannerB)?saved.bannerB:fallback.soft,
        accent:validColor(saved.accent)?saved.accent:fallback.accent,
        text:validColor(saved.text)?saved.text:fallback.ink
      };
      const colorControl=(id,title,value)=>'<div class="almora-color-control"><label for="almora-color-'+id+'">'+title+'</label><div class="almora-color-row"><input type="color" id="almora-color-'+id+'" value="'+value+'" aria-label="Escolher '+title+'"><input type="text" id="almora-hex-'+id+'" value="'+value+'" maxlength="7" spellcheck="false" aria-label="Código hexadecimal de '+title+'" placeholder="#RRGGBB"></div><input class="almora-hue-slider" type="range" min="0" max="360" value="'+colorHue(value)+'" id="almora-hue-'+id+'" aria-label="Ajustar matiz de '+title+'"><small class="almora-color-code" id="almora-code-'+id+'">'+value.toUpperCase()+'</small></div>';
      app.innerHTML='<section class="almora-editor"><button class="g" type="button" id="almora-editor-back">← Voltar ao perfil</button><h1>Personalizar perfil</h1><p>Escolha qualquer cor, digite um código HEX ou ajuste o seletor. As mudanças aparecem na prévia antes de salvar.</p>'+
        '<h2>Cores do perfil</h2><div class="almora-color-grid">'+colorControl('top','Parte superior do perfil',colorValues.top)+colorControl('bottom','Parte inferior do perfil',colorValues.bottom)+colorControl('accent','Cor de destaque',colorValues.accent)+colorControl('text','Cor dos textos',colorValues.text)+'</div>'+
        '<h2>Degradê do banner</h2><p>Escolha duas cores para misturar no banner. Se enviar uma imagem de capa, o degradê fica sobre ela suavemente.</p><div class="almora-color-grid">'+colorControl('bannerA','Cor inicial do banner',colorValues.bannerA)+colorControl('bannerB','Cor final do banner',colorValues.bannerB)+'</div>'+
        '<div class="almora-color-preview" id="almora-color-preview"><span>Prévia das cores</span></div>'+
        '<label for="almora-profile-theme">Tema do perfil</label><select id="almora-profile-theme"><option value="system" '+(a.theme==='system'?'selected':'')+'>Acompanhar tema do site</option><option value="light" '+(a.theme==='light'?'selected':'')+'>Claro</option><option value="dark" '+(a.theme==='dark'?'selected':'')+'>Escuro</option></select>'+
        '<label for="almora-profile-cover">URL da capa (opcional)</label><input id="almora-profile-cover" type="url" maxlength="1000" placeholder="https://..." value="'+escHtml(a.cover_url||'')+'">'+
        '<label for="almora-profile-cover-file">Ou enviar imagem de capa</label><input id="almora-profile-cover-file" type="file" accept="image/*"><small>Imagem de até 5 MB. Formatos de imagem comuns.</small>'+
        '<div class="act"><button type="button" id="almora-editor-save">Salvar personalização</button><button type="button" class="g" id="almora-editor-cancel">Cancelar</button></div></section>';
      const colorIds=['top','bottom','bannerA','bannerB','accent','text'];
      const readColor=id=>document.getElementById('almora-color-'+id)?.value||colorValues[id];
      const updatePreview=()=>{
        const top=readColor('top'),bottom=readColor('bottom'),bannerA=readColor('bannerA'),bannerB=readColor('bannerB'),accent=readColor('accent'),ink=readColor('text');
        const preview=document.getElementById('almora-color-preview');
        preview.style.background='linear-gradient(180deg,'+top+','+bottom+')';
        preview.style.color=ink;
        preview.style.borderColor=accent;
        preview.style.setProperty('--preview-banner','linear-gradient(110deg,'+bannerA+','+bannerB+')');
        preview.innerHTML='<span>Prévia das cores</span><div class="almora-preview-banner"></div><b>Seu perfil na ALMORA</b><small>Assim ficam o fundo, o banner e os destaques.</small>';
      };
      colorIds.forEach(id=>{
        const picker=document.getElementById('almora-color-'+id),hex=document.getElementById('almora-hex-'+id),slider=document.getElementById('almora-hue-'+id),code=document.getElementById('almora-code-'+id);
        const setColor=value=>{
          if(!/^#[0-9a-f]{6}$/i.test(value))return;
          const normalized=value.toLowerCase();
          picker.value=normalized;hex.value=normalized;code.textContent=normalized.toUpperCase();slider.value=colorHue(normalized);updatePreview();
        };
        picker.addEventListener('input',()=>setColor(picker.value));
        hex.addEventListener('change',()=>setColor(hex.value.trim().startsWith('#')?hex.value.trim():'#'+hex.value.trim()));
        slider.addEventListener('input',()=>setColor(hslHex(Number(slider.value),75,55)));
        hex.addEventListener('input',()=>{if(/^#[0-9a-f]{6}$/i.test(hex.value))setColor(hex.value);});
      });
      updatePreview();
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
    const palette='rose';
    const colors={};
    ['top','bottom','bannerA','bannerB','accent','text'].forEach(id=>{
      const value=document.getElementById('almora-color-'+id)?.value;
      colors[id]=validColor(value)?value:palettes.rose.soft;
    });
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
    const payload={user_id:me.id,theme,layout:'moodboard',settings:{palette,colors,section_order:['about','library','works','achievements'],visible_sections:['about','library','works','achievements']},cover_url:cover,updated_at:new Date().toISOString()};
    try{
      const {error}=await db.from('profile_appearance').upsert(payload,{onConflict:'user_id'});
      if(error)throw error;
      toast('Personalização salva!');
      if(typeof window.ren==='function')window.ren();
    }catch(error){toast('Não foi possível salvar: '+error.message);}
  };

  function decorateProfile(){
    // Aguarda o perfil terminar de montar: app.innerHTML += recria o DOM
    // e poderia desconectar o elemento enquanto a aparência é carregada.
    const app=document.getElementById('app');
    if(app?.dataset.almoraProfileLoading==='1')return;
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

  // Chamado explicitamente quando loadProfile conclui toda a montagem do perfil.
  window.almoraApplyProfileAppearance=decorateProfile;

  const style=document.createElement('style');
  style.textContent='.almora-moodboard-profile{position:relative;overflow:hidden;padding:16px;border-radius:18px;background:linear-gradient(180deg,var(--profile-top,var(--profile-soft,#f7e8ee)),var(--profile-bottom,var(--profile-soft,#f7e8ee)));color:var(--profile-ink,#563344);border:1px solid color-mix(in srgb,var(--profile-accent,#c66f91) 35%,transparent)}'+
    '.almora-profile-cover{height:clamp(110px,24vw,210px);margin:-16px -16px 18px;background-image:linear-gradient(110deg,var(--profile-banner-a,var(--profile-accent)),var(--profile-banner-b,var(--profile-soft)));background-position:center;background-size:cover;background-color:var(--profile-soft);border-radius:17px 17px 0 0}'+
    '.almora-moodboard-profile .almora-profile-info h1{color:inherit}.almora-moodboard-profile .almora-username{color:var(--profile-accent)}'+
    '.almora-moodboard-profile[data-profile-theme="dark"]{color:var(--profile-ink)}.almora-moodboard-profile[data-profile-theme="light"]{color:var(--profile-ink)}'+
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
    '.almora-color-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px}.almora-color-control{padding:12px;border:1px solid var(--bd);border-radius:13px;background:var(--sf2)}.almora-color-control>label{display:block;font-weight:600;margin:0 0 8px}.almora-color-row{display:grid;grid-template-columns:54px minmax(0,1fr);gap:10px;align-items:center}.almora-color-row input[type=color]{width:54px;height:44px;padding:3px;cursor:pointer}.almora-color-row input[type=text]{min-width:0;font-family:monospace;text-transform:uppercase}.almora-hue-slider{appearance:none;height:10px;padding:0!important;margin:14px 0 7px;cursor:pointer;border:0;border-radius:999px;background:linear-gradient(90deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)}.almora-hue-slider::-webkit-slider-thumb{appearance:none;width:18px;height:18px;border:2px solid #fff;border-radius:50%;background:#222;box-shadow:0 1px 4px #0008}.almora-hue-slider::-moz-range-thumb{width:14px;height:14px;border:2px solid #fff;border-radius:50%;background:#222;box-shadow:0 1px 4px #0008}.almora-color-code{display:block;color:var(--mu);font:12px monospace}.almora-color-preview{display:grid;gap:8px;margin:16px 0;padding:16px;min-height:130px;border:2px solid;border-radius:14px;overflow:hidden}.almora-color-preview>span{font-weight:700}.almora-preview-banner{height:45px;border-radius:9px;background:var(--preview-banner)}.almora-color-preview small{opacity:.8}'+
    '@media(max-width:520px){.almora-person-card{align-items:flex-start}.almora-person-card>button{padding:7px 10px}.almora-moodboard-profile{padding:12px}.almora-profile-cover{margin:-12px -12px 14px}.almora-color-grid{grid-template-columns:1fr}}';
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
