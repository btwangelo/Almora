/* ALMORA — aplicação dos controles públicos configurados no Studio */
(() => {
  'use strict';
  const db=()=>window.almoraDB;
  const defaults={
    maintenance_mode:false,maintenance_message:'A ALMORA está passando por uma manutenção. Voltaremos em breve.',
    public_registration:true,public_catalog:true,comments_enabled:true,reactions_enabled:true,
    announcements_enabled:true,chapter_alerts_enabled:true,in_app_notifications:true,
    r2_max_upload_mb:80,allowed_extensions:'jpg,jpeg,png,webp,zip,cbz',
    max_chapter_pages:300,max_chapter_mb:120,require_rights:true,default_age_rating:'Livre',
    session_timeout_minutes:60
  };
  let status={...defaults},statusReady=false,roleReady=false,owner=false,loading=null,timeoutId=null;
  const route=()=>location.hash.slice(1).split('/')[0]||'home';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const refresh=async(force=false)=>{
    if(loading)return loading;
    if(statusReady&&!force)return status;
    loading=(async()=>{
      const client=db();if(!client)return status;
      const [site,roleResult]=await Promise.all([
        client.rpc('almora_public_site_status'),
        client.rpc('current_user_role')
      ]);
      if(!site.error&&site.data)status={...defaults,...site.data};
      if(!roleResult.error){owner=roleResult.data==='superadmin';roleReady=true;}
      statusReady=true;
      window.almoraSiteSettings=status;
      window.almoraIsSiteOwner=owner;
      return status;
    })();
    try{return await loading;}finally{loading=null;}
  };
  window.almoraRefreshSiteSettings=refresh;
  window.almoraSiteSettings=status;

  function maintenancePage(){
    const app=document.getElementById('app');if(!app)return;
    app.innerHTML='<section class="almora-maintenance-page"><div class="almora-maintenance-mark">A</div><div class="almora-maintenance-eyebrow">ALMORA · MANUTENÇÃO</div><h1>Estamos preparando algo melhor.</h1><p>'+esc(status.maintenance_message)+'</p><div class="almora-maintenance-actions"><a href="#conta">Entrar na minha conta</a></div><small>Obrigado pela paciência. Voltaremos em breve.</small></section>';
    app.dataset.almoraMaintenance='true';
    if(!document.getElementById('almora-maintenance-style')){
      const style=document.createElement('style');style.id='almora-maintenance-style';
      style.textContent='.almora-maintenance-page{min-height:65vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:35px 18px;max-width:680px;margin:auto}.almora-maintenance-mark{width:72px;height:72px;border-radius:22px;display:grid;place-items:center;background:linear-gradient(135deg,var(--ac),var(--ac2));color:#fff;font:700 40px Fredoka,sans-serif;margin-bottom:22px}.almora-maintenance-eyebrow{font-size:10px;letter-spacing:2px;color:var(--mu);font-weight:800}.almora-maintenance-page h1{font-size:clamp(26px,5vw,42px);margin:12px 0}.almora-maintenance-page p{color:var(--mu);font-size:14px;line-height:1.65;max-width:520px;white-space:pre-wrap}.almora-maintenance-actions{margin:18px 0}.almora-maintenance-actions a{display:inline-block;padding:11px 17px;border-radius:10px;background:var(--ac);color:#fff;font-weight:700}.almora-maintenance-page small{color:var(--mu);font-size:11px}';
      document.head.appendChild(style);
    }
  }
  const originalRen=window.ren;
  if(typeof originalRen==='function'){
    window.ren=function(...args){
      const currentRoute=route();
      if(!statusReady){
        const result=originalRen.apply(this,args);
        refresh(true).then(()=>window.ren());
        return result;
      }
      if(status.maintenance_mode&&currentRoute!=='studio'&&currentRoute!=='conta'){
        if(!roleReady){
          refresh(true).then(()=>window.ren());
          maintenancePage();
          return;
        }
        if(!owner){maintenancePage();return;}
      }
      const result=originalRen.apply(this,args);
      const app=document.getElementById('app');if(app)delete app.dataset.almoraMaintenance;
      setTimeout(applyDefaults,0);
      resetSessionTimer();
      return result;
    };
  }

  function applyDefaults(){
    const rating=document.getElementById('n_ag');
    if(rating&&status.default_age_rating&&[...rating.options].some(o=>o.value===status.default_age_rating))rating.value=status.default_age_rating;
    const rights=document.querySelector('#n_l')?.previousElementSibling;
    if(rights)rights.textContent=status.require_rights===false?'Titular dos direitos / licença (opcional)':'Titular dos direitos / licença (obrigatório)';
  }

  const originalMail=window.mail;
  if(typeof originalMail==='function'){
    window.mail=async function(...args){
      if(document.getElementById('a_p2')){
        const current=await refresh(true);
        if(current.public_registration===false){
          if(typeof window.toast==='function')window.toast('Novos cadastros estão temporariamente fechados pela equipe da ALMORA.');
          return;
        }
      }
      return originalMail.apply(this,args);
    };
  }

  const originalUpload=window.almoraUploadToR2;
  if(typeof originalUpload==='function'){
    window.almoraUploadToR2=async function(file){
      const current=await refresh();
      if(file&&Number(file.size)>Number(current.r2_max_upload_mb||80)*1048576)
        throw new Error('O arquivo ultrapassa o limite atual de '+current.r2_max_upload_mb+' MB definido pela administração.');
      const allowed=String(current.allowed_extensions||defaults.allowed_extensions).split(',').map(x=>x.trim().toLowerCase().replace(/^\./,'')).filter(Boolean);
      const typeExt={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','image/avif':'avif','application/zip':'zip'};
      const extension=(file?.name?.split('.').pop()||typeExt[file?.type]||'').toLowerCase();
      if(extension&&allowed.length&&!allowed.includes(extension))
        throw new Error('O formato .'+extension+' não está liberado nas configurações de armazenamento.');
      return originalUpload.call(this,file);
    };
  }

  function resetSessionTimer(){
    clearTimeout(timeoutId);timeoutId=null;
    const minutes=Number(status.session_timeout_minutes??60);
    if(route()!=='studio'||!minutes||minutes<1||!db())return;
    timeoutId=setTimeout(async()=>{
      try{await db().auth.signOut();}catch(error){console.warn('Falha ao encerrar sessão por inatividade.',error);}
      window.almoraStudioRole='reader';
      if(typeof window.toast==='function')window.toast('Sua sessão administrativa foi encerrada por inatividade.');
      location.hash='#conta';
    },minutes*60000);
  }
  ['pointerdown','keydown','touchstart','mousemove'].forEach(eventName=>document.addEventListener(eventName,()=>{if(route()==='studio')resetSessionTimer();},{passive:true}));
  window.addEventListener('hashchange',()=>{
    refresh(true).then(()=>{if(typeof window.ren==='function')window.ren();});
  });
  if(db()?.auth?.onAuthStateChange){
    db().auth.onAuthStateChange((event)=>{if(!['SIGNED_IN','SIGNED_OUT','INITIAL_SESSION'].includes(event))return;roleReady=false;refresh(true).then(()=>{if(typeof window.ren==='function')window.ren();});});
  }
  refresh(true).then(()=>{if(typeof window.ren==='function')window.ren();});
})();