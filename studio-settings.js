/* ALMORA Studio — páginas internas de configurações */
(() => {
  'use strict';
  const db=()=>window.almoraDB;
  const mount=()=>document.getElementById('almora-studio-settings');
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const role=()=>window.almoraStudioRole||'reader';
  const modCats=['content','community','notifications'];
  const pages=[
    {id:'personalization',title:'Personalização',desc:'Identidade visual e apresentação da ALMORA.',icon:'◈',access:'Administradores'},
    {id:'platform',title:'Plataforma',desc:'Disponibilidade, acesso e funcionamento geral.',icon:'◉',access:'Administradores'},
    {id:'locale',title:'Idioma e região',desc:'Idioma padrão, fuso horário e formatos.',icon:'◎',access:'Administradores'},
    {id:'staff',title:'Equipe e permissões',desc:'Cargos administrativos e editoriais.',icon:'♙',access:'Superadministrador'},
    {id:'content',title:'Obras e publicações',desc:'Regras editoriais e padrões de publicação.',icon:'▤',access:'Administradores e moderadores'},
    {id:'community',title:'Comunidade',desc:'Comentários, reações e proteção dos leitores.',icon:'♡',access:'Administradores e moderadores'},
    {id:'notifications',title:'Notificações',desc:'Comunicados e alertas da plataforma.',icon:'♧',access:'Administradores e moderadores'},
    {id:'storage',title:'Armazenamento',desc:'Limites de envio e formatos aceitos.',icon:'▣',access:'Administradores'},
    {id:'logs',title:'Registros e atividades',desc:'Política de auditoria e retenção.',icon:'≋',access:'Administradores'},
    {id:'security',title:'Segurança',desc:'Controles de sessão e confirmações sensíveis.',icon:'⬡',access:'Superadministrador'},
    {id:'about',title:'Sobre o ALMORA',desc:'Informações institucionais e versão.',icon:'ⓘ',access:'Administradores'}
  ];
  const fields={
    personalization:[
      ['site_name','Nome da plataforma','text','ALMORA'],
      ['tagline','Frase institucional','text','Onde o amor não precisa de tradução.'],
      ['accent_color','Cor de destaque','color','#b13df5']
    ],
    platform:[
      ['maintenance_mode','Ativar modo de manutenção','checkbox',false],
      ['maintenance_message','Mensagem de manutenção','textarea','Estamos realizando melhorias. Voltamos em breve.'],
      ['public_registration','Permitir novos cadastros','checkbox',true],
      ['public_catalog','Manter catálogo público','checkbox',true]
    ],
    locale:[
      ['language','Idioma padrão','select','pt-BR',[['pt-BR','Português (Brasil)'],['en','English'],['es','Español']]],
      ['timezone','Fuso horário','select','America/Sao_Paulo',[['America/Sao_Paulo','Brasília (UTC−3)'],['UTC','UTC'],['Europe/Lisbon','Lisboa']]],
      ['date_format','Formato de data','select','DD/MM/AAAA',[['DD/MM/AAAA','DD/MM/AAAA'],['AAAA-MM-DD','AAAA-MM-DD'],['MM/DD/AAAA','MM/DD/AAAA']]]
    ],
    content:[
      ['require_rights','Exigir informação de direitos/licença','checkbox',true],
      ['default_age_rating','Classificação indicativa padrão','select','Livre',[['Livre','Livre'],['14+','14+'],['16+','16+'],['18+','18+']]],
      ['editorial_note','Orientação editorial','textarea','Publique apenas obras próprias ou materiais com autorização.']
    ],
    community:[
      ['comments_enabled','Permitir comentários','checkbox',true],
      ['reactions_enabled','Permitir reações nos capítulos','checkbox',true],
      ['spoiler_reminders','Exibir lembrete sobre spoilers','checkbox',true],
      ['community_guidelines','Orientação da comunidade','textarea','Respeito, privacidade e convivência sem discriminação.']
    ],
    notifications:[
      ['announcements_enabled','Permitir comunicados públicos','checkbox',true],
      ['chapter_alerts_enabled','Alertas de novos capítulos','checkbox',true],
      ['in_app_notifications','Notificações dentro da plataforma','checkbox',true]
    ],
    storage:[
      ['max_upload_mb','Limite por arquivo (MB)','number',50],
      ['allowed_extensions','Extensões aceitas','text','jpg, jpeg, png, webp, zip, cbz'],
      ['storage_warning_percent','Avisar ao atingir (%)','number',80]
    ],
    logs:[
      ['audit_enabled','Registrar ações administrativas','checkbox',true],
      ['retention_days','Retenção desejada (dias)','number',180],
      ['log_note','Observação sobre auditoria','textarea','Registros administrativos devem ser consultados apenas por pessoas autorizadas.']
    ],
    security:[
      ['confirm_sensitive_actions','Exigir confirmação em ações sensíveis','checkbox',true],
      ['notify_new_sessions','Notificar novos acessos administrativos','checkbox',true],
      ['session_timeout_minutes','Tempo de inatividade (minutos)','number',60]
    ],
    about:[
      ['version','Versão exibida','text','Em desenvolvimento'],
      ['description','Descrição institucional','textarea','A ALMORA é um espaço de descoberta e leitura de histórias GL e BL.'],
      ['support_url','Link de suporte','url','https://github.com/btwangelo/Almora/issues']
    ]
  };
  let busy=false;
  function allowed(id,r=role()){
    if(r==='superadmin')return true;
    if(r==='admin')return !['staff','security'].includes(id);
    return r==='moderator'&&modCats.includes(id);
  }
  function notify(msg){if(typeof window.toast==='function')window.toast(msg);else console.info(msg);}
  function applyColor(color){
    if(/^#[0-9a-f]{6}$/i.test(color||'')){
      document.documentElement.style.setProperty('--ac',color);
      document.documentElement.style.setProperty('--ac2',color);
    }
  }
  function renderHome(){
    const host=mount();if(!host)return;
    const visible=pages.filter(p=>allowed(p.id));
    host.innerHTML=
      '<div class="almora-settings-head"><div><div class="almora-settings-eyebrow">CENTRAL DE CONTROLE</div>'+
      '<h2 style="margin:5px 0 4px">Configurações</h2><p class="almora-settings-muted">Gerencie cada área separadamente. As alterações são salvas individualmente.</p></div>'+
      '<span class="almora-settings-role">'+(role()==='superadmin'?'Superadministrador':role()==='admin'?'Administrador':'Moderador')+'</span></div>'+
      '<div class="almora-settings-grid">'+visible.map(p=>
        '<button type="button" class="almora-settings-card" data-open-category="'+p.id+'">'+
        '<span class="almora-settings-icon">'+p.icon+'</span><span class="almora-settings-card-copy"><strong>'+p.title+'</strong>'+
        '<small>'+p.desc+'</small><em>'+p.access+'</em></span><span class="almora-settings-arrow">›</span></button>'
      ).join('')+'</div>'+
      '<div class="almora-settings-foot">As permissões também são verificadas no banco de dados. A interface não é a única barreira de segurança.</div>';
    host.querySelectorAll('[data-open-category]').forEach(b=>b.addEventListener('click',()=>renderPage(b.dataset.openCategory)));
  }
  function fieldHtml(f,v){
    const key=f[0],label=f[1],type=f[2],id='almora-setting-'+key;
    if(type==='checkbox')return '<label class="almora-settings-toggle" for="'+id+'"><strong>'+label+'</strong><input id="'+id+'" data-setting="'+key+'" type="checkbox" '+(v?'checked':'')+'></label>';
    if(type==='select')return '<label class="almora-settings-field"><span>'+label+'</span><select id="'+id+'" data-setting="'+key+'">'+f[4].map(o=>'<option value="'+esc(o[0])+'" '+(String(v)===o[0]?'selected':'')+'>'+esc(o[1])+'</option>').join('')+'</select></label>';
    if(type==='textarea')return '<label class="almora-settings-field"><span>'+label+'</span><textarea id="'+id+'" data-setting="'+key+'" rows="4">'+esc(v)+'</textarea></label>';
    const min=type==='number'?' min="1" max="500"':'';
    return '<label class="almora-settings-field"><span>'+label+'</span><input id="'+id+'" data-setting="'+key+'" type="'+type+'" value="'+esc(v)+'"'+min+'></label>';
  }
  async function renderPage(id){
    const host=mount(),page=pages.find(p=>p.id===id);if(!host||!page||!allowed(id))return;
    host.innerHTML='<div class="empty">Carregando configurações...</div>';
    try{
      const result=await db().from('studio_settings').select('settings,updated_at').eq('category',id).maybeSingle();
      if(result.error)throw result.error;
      if(id==='staff'){await renderStaff(host,page);return;}
      const current=result.data?.settings||{},spec=fields[id]||[];
      host.innerHTML=
        '<div class="almora-settings-head"><div><button type="button" class="g almora-settings-back" id="almora-settings-back">← Todas as configurações</button>'+
        '<div class="almora-settings-eyebrow">CONFIGURAÇÃO / '+page.title.toLocaleUpperCase('pt-BR')+'</div>'+
        '<h2 style="margin:5px 0 4px">'+page.title+'</h2><p class="almora-settings-muted">'+page.desc+'</p></div>'+
        '<span class="almora-settings-role">'+(role()==='moderator'?'Acesso limitado':'Acesso administrativo')+'</span></div>'+
        '<form id="almora-settings-form" class="almora-settings-form">'+
        spec.map(f=>fieldHtml(f,current[f[0]]===undefined?f[3]:current[f[0]])).join('')+
        '<div class="almora-settings-save-row"><small id="almora-settings-updated">'+(result.data?.updated_at?'Última atualização: '+new Date(result.data.updated_at).toLocaleString('pt-BR'):'Ainda não configurado')+'</small>'+
        '<button type="submit" id="almora-settings-save">Salvar alterações</button></div></form>'+
        '<p class="almora-settings-foot">Cada categoria possui seu próprio salvamento. Algumas opções são armazenadas nesta etapa e precisarão ser conectadas ao comportamento global do site para produzir efeitos em toda a plataforma.</p>';
      host.querySelector('#almora-settings-back').addEventListener('click',renderHome);
      host.querySelector('#almora-settings-form').addEventListener('submit',e=>savePage(e,id,spec));
    }catch(error){
      host.innerHTML='<div class="empty">Não foi possível carregar esta página: '+esc(error.message)+'</div><button type="button" class="g" id="almora-settings-retry">Voltar</button>';
      host.querySelector('#almora-settings-retry')?.addEventListener('click',renderHome);
    }
  }
  async function renderStaff(host,page){
    const results=await Promise.all([
      db().from('staff_roles').select('user_id,role_key,created_at').order('created_at',{ascending:true}),
      db().from('profiles').select('id,username,display_name')
    ]);
    if(results[0].error)throw results[0].error;if(results[1].error)throw results[1].error;
    const people=Object.fromEntries((results[1].data||[]).map(p=>[p.id,p]));
    const labels={owner:'Proprietário',admin:'Administrador',moderator:'Moderador',editor_bl:'Editor BL',editor_gl:'Editor GL',translator:'Tradutor',reviewer:'Revisor'};
    host.innerHTML='<div class="almora-settings-head"><div><button type="button" class="g almora-settings-back" id="almora-settings-back">← Todas as configurações</button>'+
      '<div class="almora-settings-eyebrow">CONFIGURAÇÃO / EQUIPE</div><h2 style="margin:5px 0 4px">'+page.title+'</h2>'+
      '<p class="almora-settings-muted">'+page.desc+'</p></div><span class="almora-settings-role">Somente leitura</span></div>'+
      '<div class="almora-settings-form"><h3>Equipe cadastrada</h3>'+
      (results[0].data||[]).map(item=>{const p=people[item.user_id]||{},name=p.display_name||p.username||'Conta da equipe';return '<div class="almora-staff-row"><span class="almora-staff-avatar">'+esc(name.slice(0,1).toUpperCase())+'</span><span><strong>'+esc(name)+'</strong><small>'+esc(p.username||'')+'</small></span><b>'+esc(labels[item.role_key]||item.role_key)+'</b></div>';}).join('')+
      '<p class="almora-settings-foot">A gestão de cargos não é alterada por esta página. As atribuições continuam protegidas pelas regras de acesso do banco de dados.</p></div>';
    host.querySelector('#almora-settings-back').addEventListener('click',renderHome);
  }
  async function savePage(event,id,spec){
    event.preventDefault();if(busy||!allowed(id))return;
    const form=event.currentTarget,button=form.querySelector('#almora-settings-save'),settings={};
    spec.forEach(f=>{const el=form.querySelector('[data-setting="'+f[0]+'"]');if(el)settings[f[0]]=f[2]==='checkbox'?el.checked:f[2]==='number'?Number(el.value):el.value.trim();});
    if(id==='personalization'&&!/^#[0-9a-f]{6}$/i.test(settings.accent_color||''))return notify('Informe uma cor hexadecimal válida.');
    if(id==='about'&&settings.support_url&&!/^https?:\/\//i.test(settings.support_url))return notify('O link de suporte precisa começar com http:// ou https://.');
    busy=true;button.disabled=true;button.textContent='Salvando...';
    try{
      const auth=await db().auth.getUser();if(auth.error||!auth.data?.user)throw new Error('Sua sessão expirou. Entre novamente.');
      const verified=await db().rpc('current_user_role');if(verified.error)throw verified.error;
      if(!allowed(id,verified.data))throw new Error('Seu cargo não tem permissão para salvar esta categoria.');
      const now=new Date().toISOString();
      const result=await db().from('studio_settings').upsert({category:id,settings,updated_by:auth.data.user.id,updated_at:now},{onConflict:'category'});
      if(result.error)throw result.error;
      if(id==='personalization')applyColor(settings.accent_color);
      form.querySelector('#almora-settings-updated').textContent='Salvo em '+new Date(now).toLocaleString('pt-BR');
      notify('Configurações de '+pages.find(p=>p.id===id).title+' salvas.');
    }catch(error){notify('Não foi possível salvar: '+error.message);}
    finally{busy=false;button.disabled=false;button.textContent='Salvar alterações';}
  }
  window.almoraRenderStudioSettings=async function(){
    if(!mount())return;
    if(!['admin','superadmin','moderator'].includes(role())){mount().innerHTML='<div class="empty">Acesso não autorizado.</div>';return;}
    renderHome();
    try{
      const result=await db().from('studio_settings').select('category,settings');
      if(result.error)throw result.error;
      const branding=(result.data||[]).find(x=>x.category==='personalization')?.settings;
      if(branding?.accent_color)applyColor(branding.accent_color);
    }catch(error){console.warn('Não foi possível pré-carregar as configurações do Studio:',error);}
  };
  const css=document.createElement('style');
  css.textContent=
    '#almora-studio-settings{color:var(--tx)}'+
    '.almora-settings-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;flex-wrap:wrap;margin:10px 0 18px}'+
    '.almora-settings-eyebrow{font-size:10px;letter-spacing:1.4px;color:var(--mu);font-weight:700;margin-top:10px}'+
    '.almora-settings-muted{color:var(--mu);font-size:13px;margin:0}'+
    '.almora-settings-role{display:inline-flex;padding:6px 10px;border:1px solid var(--bd);border-radius:99px;color:var(--mu);font-size:11px}'+
    '.almora-settings-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:10px}'+
    '.almora-settings-card{display:flex;align-items:center;gap:12px;text-align:left;background:var(--sf);border:1px solid var(--bd);color:var(--tx);padding:14px;border-radius:13px;min-height:92px}'+
    '.almora-settings-card:hover{border-color:var(--ac)}'+
    '.almora-settings-icon{width:42px;height:42px;display:grid;place-items:center;flex:0 0 42px;border-radius:11px;background:var(--sf2);font-size:21px;color:var(--ac)}'+
    '.almora-settings-card-copy{display:grid;gap:3px;min-width:0;flex:1}.almora-settings-card-copy strong{font-size:14px}'+
    '.almora-settings-card-copy small{font-size:11px;color:var(--mu);line-height:1.35}.almora-settings-card-copy em{font-size:10px;color:var(--ac);font-style:normal}'+
    '.almora-settings-arrow{font-size:25px;color:var(--mu)}'+
    '.almora-settings-form{background:var(--sf);border:1px solid var(--bd);border-radius:14px;padding:16px;display:grid;gap:14px}'+
    '.almora-settings-field{display:grid;gap:6px;color:var(--mu);font-size:12px}'+
    '.almora-settings-field input,.almora-settings-field select,.almora-settings-field textarea{width:100%;color:var(--tx);background:var(--sf2);border:1px solid var(--bd);border-radius:9px;padding:10px}'+
    '.almora-settings-field input[type=color]{height:44px;padding:4px}'+
    '.almora-settings-toggle{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--bd);color:var(--tx);font-size:13px}'+
    '.almora-settings-toggle input{width:20px;height:20px;accent-color:var(--ac)}'+
    '.almora-settings-save-row{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;padding-top:8px;border-top:1px solid var(--bd)}'+
    '.almora-settings-save-row small,.almora-settings-foot{color:var(--mu);font-size:11px;line-height:1.5}.almora-settings-back{margin:0 0 8px}'+
    '.almora-staff-row{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--bd)}'+
    '.almora-staff-avatar{width:36px;height:36px;display:grid;place-items:center;border-radius:50%;background:var(--sf2);color:var(--ac);font-weight:700}'+
    '.almora-staff-row span:nth-child(2){display:grid;flex:1;min-width:0}.almora-staff-row small{color:var(--mu);font-size:11px}.almora-staff-row b{font-size:11px;color:var(--ac);text-align:right}'+
    '@media(max-width:480px){.almora-settings-form{padding:12px}.almora-settings-save-row{align-items:stretch}.almora-settings-save-row button{width:100%}}';
  document.head.appendChild(css);
})();