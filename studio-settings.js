/* ALMORA Studio — configurações avançadas, funcionais e com permissões por cargo */
(() => {
  'use strict';
  const db=()=>window.almoraDB;
  const mount=()=>document.getElementById('almora-studio-settings');
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const role=()=>window.almoraStudioRole||'reader';
  const roleLabel=r=>({superadmin:'Dono',admin:'Administrador',moderator:'Moderador',reader:'Leitor'}[r]||'Equipe');
  const pages=[
    {id:'platform',title:'Plataforma e acesso',desc:'Manutenção, disponibilidade, catálogo e novos cadastros.',icon:'◉',access:'Somente o dono',group:'Controles críticos'},
    {id:'personalization',title:'Identidade visual',desc:'Nome, assinatura institucional e cor principal.',icon:'◈',access:'Dono e administradores',group:'Aparência'},
    {id:'locale',title:'Idioma e região',desc:'Idioma padrão, fuso horário e formatos regionais.',icon:'◎',access:'Dono e administradores',group:'Aparência'},
    {id:'content',title:'Obras e publicações',desc:'Regras editoriais, direitos, classificação e limites de capítulos.',icon:'▤',access:'Dono, administradores e moderadores',group:'Conteúdo'},
    {id:'community',title:'Comunidade',desc:'Comentários, reações e diretrizes de convivência.',icon:'♡',access:'Dono e administradores',group:'Comunidade'},
    {id:'notifications',title:'Notificações e comunicados',desc:'Alertas de capítulos, avisos e notificações internas.',icon:'♧',access:'Somente o dono',group:'Controles críticos'},
    {id:'storage',title:'Armazenamento e uploads',desc:'Limites reais dos arquivos e formatos permitidos.',icon:'▣',access:'Somente o dono',group:'Controles críticos'},
    {id:'staff',title:'Equipe e permissões',desc:'Atribuição e remoção de cargos da equipe.',icon:'♙',access:'Somente o dono',group:'Controles críticos'},
    {id:'logs',title:'Registros e auditoria',desc:'Ativar ou pausar registros e consultar atividades.',icon:'≋',access:'Somente o dono',group:'Controles críticos'},
    {id:'security',title:'Segurança e sessões',desc:'Tempo máximo de inatividade do painel administrativo.',icon:'⬡',access:'Somente o dono',group:'Controles críticos'},
    {id:'about',title:'Sobre o ALMORA',desc:'Descrição institucional, versão e canal de suporte.',icon:'ⓘ',access:'Dono e administradores',group:'Informações'}
  ];
  const fields={
    platform:[
      ['maintenance_mode','Ativar modo de manutenção','checkbox',false,'Oculta as páginas públicas. O dono continua podendo entrar no Studio para desativar.'],
      ['maintenance_message','Mensagem exibida durante a manutenção','textarea','A ALMORA está passando por uma manutenção. Voltaremos em breve.','Texto mostrado aos visitantes.'],
      ['public_registration','Permitir novos cadastros','checkbox',true,'Quando desativado, o cadastro é bloqueado também no banco de autenticação.'],
      ['public_catalog','Manter o catálogo público','checkbox',true,'Quando desativado, obras e capítulos publicados deixam de aparecer para visitantes.']
    ],
    personalization:[
      ['site_name','Nome da plataforma','text','ALMORA'],
      ['tagline','Frase institucional','text','Onde o amor não precisa de tradução.'],
      ['accent_color','Cor principal','color','#b13df5','Atualiza a cor de destaque da interface nesta sessão.']
    ],
    locale:[
      ['language','Idioma de formatação','select','pt-BR','Atualiza o idioma do documento e os formatos de data; os textos da interface continuam em português.',[['pt-BR','Português (Brasil)'],['en','English'],['es','Español']]],
      ['timezone','Fuso horário','select','America/Sao_Paulo','Aplicado aos horários exibidos pelo site.',[['America/Sao_Paulo','Brasília (UTC−3)'],['UTC','UTC'],['Europe/Lisbon','Lisboa']]],
      ['date_format','Formato de data','select','DD/MM/AAAA','Aplica o formato selecionado às datas exibidas pelo site.',[['DD/MM/AAAA','DD/MM/AAAA'],['AAAA-MM-DD','AAAA-MM-DD'],['MM/DD/AAAA','MM/DD/AAAA']]]
    ],
    content:[
      ['require_rights','Exigir titular ou licença informada','checkbox',true,'Impede a publicação sem o campo de titular/licença preenchido.'],
      ['default_age_rating','Classificação indicativa padrão','select','Livre',null,[['Livre','Livre'],['14+','14+'],['16+','16+'],['18+','18+']]],
      ['max_chapter_pages','Máximo de páginas por capítulo','number',300,'Limite aplicado ao processamento e publicação.',1,300],
      ['max_chapter_mb','Tamanho máximo descompactado por capítulo (MB)','number',120,'Limite aplicado à leitura dos arquivos ZIP/CBZ.',1,120],
      ['editorial_note','Orientação editorial','textarea','Publique apenas obras próprias ou materiais com autorização.']
    ],
    community:[
      ['comments_enabled','Permitir novos comentários','checkbox',true,'O banco bloqueia novas inserções quando esta opção está desativada.'],
      ['reactions_enabled','Permitir reações nos capítulos','checkbox',true,'O banco bloqueia novas reações e alterações quando desativado.'],
      ['spoiler_reminders','Exibir lembrete sobre spoilers','checkbox',true],
      ['community_guidelines','Diretrizes da comunidade','textarea','Respeito, privacidade e convivência sem discriminação.']
    ],
    notifications:[
      ['announcements_enabled','Exibir comunicados públicos','checkbox',true,'Controla a visibilidade dos comunicados para leitores.'],
      ['chapter_alerts_enabled','Enviar alertas de novos capítulos','checkbox',true,'Interrompe a geração de alertas de capítulos.'],
      ['in_app_notifications','Ativar notificações internas','checkbox',true,'Controla a criação de notificações internas de capítulos.']
    ],
    storage:[
      ['r2_max_upload_mb','Limite geral por arquivo no Studio (MB)','number',80,'O painel bloqueia envios acima deste valor. O Worker de armazenamento mantém um teto externo fixo de 80 MB.',1,80],
      ['allowed_extensions','Extensões permitidas (separadas por vírgula)','text','jpg, jpeg, png, webp, zip, cbz','Aplicado aos envios pelo painel.'],
      ['avatar_max_upload_mb','Limite de avatar (MB)','number',50,'Atualiza o limite real do bucket de avatares.',1,50],
      ['cover_max_upload_mb','Limite de capas e imagens de anúncios (MB)','number',50,'Atualiza o limite real do bucket de capas.',1,50],
      ['chapter_page_max_upload_mb','Limite por página de capítulo (MB)','number',10,'Aplicado pelo painel antes do envio das páginas. Também atualiza o limite do bucket chapter-pages.',1,10]
    ],
    logs:[
      ['audit_enabled','Registrar ações administrativas','checkbox',true,'Desativar interrompe os registros automáticos gerados pelos gatilhos do banco.']
    ],
    security:[
      ['session_timeout_minutes','Encerrar sessão administrativa após inatividade (minutos)','number',60,'Aplicado ao ALMORA Studio. Use 0 para desativar.',0,1440]
    ],
    about:[
      ['version','Versão exibida','text','Em desenvolvimento'],
      ['description','Descrição institucional','textarea','A ALMORA é um espaço de descoberta e leitura de histórias GL e BL.'],
      ['support_url','Link de suporte','url','https://github.com/btwangelo/Almora/issues']
    ]
  };
  const access={
    platform:['superadmin'],notifications:['superadmin'],storage:['superadmin'],staff:['superadmin'],logs:['superadmin'],security:['superadmin'],
    personalization:['superadmin','admin'],locale:['superadmin','admin'],content:['superadmin','admin','moderator'],community:['superadmin','admin'],about:['superadmin','admin']
  };
  let busy=false;
  function allowed(id,r=role()){return (access[id]||[]).includes(r);}
  function notify(msg){if(typeof window.toast==='function')window.toast(msg);else console.info(msg);}
  function applyColor(color){if(/^#[0-9a-f]{6}$/i.test(color||'')){document.documentElement.style.setProperty('--ac',color);document.documentElement.style.setProperty('--ac2',color);}}
  function requiredRole(id){return pages.find(p=>p.id===id)?.access||'Dono';}
  function head(title,desc,eyebrow='CENTRAL DE CONTROLE'){
    return '<div class="almora-settings-head"><div><div class="almora-settings-eyebrow">'+esc(eyebrow)+'</div><h2>'+esc(title)+'</h2><p class="almora-settings-muted">'+esc(desc)+'</p></div><span class="almora-settings-role">'+esc(roleLabel(role()))+'</span></div>';
  }
  function renderHome(){
    const host=mount();if(!host)return;
    const available=pages.filter(p=>allowed(p.id)).length;
    host.innerHTML=head('Configurações do ALMORA','Controles reais da plataforma, organizados por área. Cada categoria é salva separadamente.')+
      '<div class="almora-settings-summary"><div><strong>'+available+'</strong><span>áreas liberadas para seu cargo</span></div><div><strong>'+pages.length+'</strong><span>áreas disponíveis no Studio</span></div><p>'+(role()==='superadmin'?'Você está usando o acesso do dono: todas as áreas, inclusive controles críticos, estão disponíveis.':role()==='admin'?'Seu cargo permite ajustes operacionais não críticos. Manutenção, segurança, armazenamento, auditoria e equipe ficam reservados ao dono.':'Seu cargo de moderador permite apenas consultar e ajustar as diretrizes editoriais. Controles globais ficam bloqueados.')+'</p></div>'+
      '<div class="almora-settings-group-label">APARÊNCIA E INFORMAÇÕES</div><div class="almora-settings-grid">'+pages.filter(p=>['personalization','locale','about'].includes(p.id)).map(card).join('')+'</div>'+
      '<div class="almora-settings-group-label">CONTEÚDO E COMUNIDADE</div><div class="almora-settings-grid">'+pages.filter(p=>['content','community','notifications'].includes(p.id)).map(card).join('')+'</div>'+
      '<div class="almora-settings-group-label">CONTROLES CRÍTICOS — ACESSO EXCLUSIVO DO DONO</div><div class="almora-settings-grid">'+pages.filter(p=>['platform','storage','staff','logs','security'].includes(p.id)).map(card).join('')+'</div>'+
      '<div class="almora-settings-foot">As categorias bloqueadas aparecem para informar a existência dos controles, mas seus dados não são carregados. As permissões também são aplicadas no banco de dados.</div>';
    host.querySelectorAll('[data-open-category]').forEach(b=>b.addEventListener('click',()=>renderPage(b.dataset.openCategory)));
  }
  function card(p){
    const can=allowed(p.id);
    return '<button type="button" class="almora-settings-card '+(can?'':'is-locked')+'" data-open-category="'+p.id+'" aria-label="'+esc(p.title)+(can?'':' — acesso bloqueado')+'"><span class="almora-settings-icon">'+p.icon+'</span><span class="almora-settings-card-copy"><strong>'+esc(p.title)+'</strong><small>'+esc(p.desc)+'</small><em>'+(can?'Acesso liberado':'🔒 '+esc(p.access))+'</em></span><span class="almora-settings-arrow">'+(can?'›':'⌑')+'</span></button>';
  }
  function fieldHtml(f,v){
    const [key,label,type,def,hint,min,max]=f;const options=f[5];
    const id='almora-setting-'+key,help=hint?'<small class="almora-settings-help">'+esc(hint)+'</small>':'';
    if(type==='checkbox')return '<label class="almora-settings-toggle" for="'+id+'"><span><strong>'+esc(label)+'</strong>'+help+'</span><input id="'+id+'" data-setting="'+key+'" type="checkbox" '+(v?'checked':'')+'></label>';
    if(type==='select')return '<label class="almora-settings-field"><span>'+esc(label)+'</span><select id="'+id+'" data-setting="'+key+'">'+(options||[]).map(o=>'<option value="'+esc(o[0])+'" '+(String(v)===o[0]?'selected':'')+'>'+esc(o[1])+'</option>').join('')+'</select>'+help+'</label>';
    if(type==='textarea')return '<label class="almora-settings-field"><span>'+esc(label)+'</span><textarea id="'+id+'" data-setting="'+key+'" rows="4">'+esc(v)+'</textarea>'+help+'</label>';
    const bounds=type==='number'?' min="'+(min??0)+'" max="'+(max??500)+'" step="1"':'';
    return '<label class="almora-settings-field"><span>'+esc(label)+'</span><input id="'+id+'" data-setting="'+key+'" type="'+type+'" value="'+esc(v)+'"'+bounds+'>'+help+'</label>';
  }
  function denied(id){
    const p=pages.find(x=>x.id===id),host=mount();if(!host)return;
    host.innerHTML='<section class="almora-settings-denied"><span class="almora-settings-denied-icon">🔒</span><div class="almora-settings-eyebrow">PERMISSÃO INSUFICIENTE</div><h2>Esta área é restrita.</h2><p>Seu cargo atual é <strong>'+esc(roleLabel(role()))+'</strong>. Para acessar <strong>'+esc(p?.title||'esta configuração')+'</strong>, é necessário: <strong>'+esc(requiredRole(id))+'</strong>.</p><p>Essa limitação protege as configurações críticas e os dados da equipe. Se você acredita que deveria ter acesso, solicite ao dono do ALMORA.</p><button type="button" id="almora-settings-back">Voltar às configurações</button></section>';
    host.querySelector('#almora-settings-back').addEventListener('click',renderHome);
  }
  async function renderPage(id){
    const host=mount(),page=pages.find(p=>p.id===id);if(!host||!page)return;
    if(!allowed(id)){denied(id);return;}
    host.innerHTML='<div class="empty">Carregando configurações...</div>';
    try{
      if(id==='staff'){await renderStaff(host,page);return;}
      if(id==='logs'){await renderLogs(host,page);return;}
      const result=await db().from('studio_settings').select('settings,updated_at').eq('category',id).maybeSingle();
      if(result.error)throw result.error;
      const current=result.data?.settings||{},spec=fields[id]||[];
      host.innerHTML=head(page.title,page.desc,'CONFIGURAÇÃO / '+page.title.toLocaleUpperCase('pt-BR'))+
        '<button type="button" class="g almora-settings-back" id="almora-settings-back">← Todas as configurações</button>'+
        '<form id="almora-settings-form" class="almora-settings-form">'+
        '<div class="almora-settings-form-intro"><strong>Preferências desta área</strong><small>Altere os campos e salve somente esta categoria. As opções conectadas ao site passam a valer após o salvamento.</small></div>'+
        spec.map(f=>fieldHtml(f,current[f[0]]===undefined?f[3]:current[f[0]])).join('')+
        '<div class="almora-settings-save-row"><small id="almora-settings-updated">'+(result.data?.updated_at?'Última atualização: '+new Date(result.data.updated_at).toLocaleString('pt-BR'):'Ainda não configurado — valores padrão em uso')+'</small><button type="submit" id="almora-settings-save">Salvar esta categoria</button></div></form>';
      host.querySelector('#almora-settings-back').addEventListener('click',renderHome);
      const form=host.querySelector('#almora-settings-form');
      form.addEventListener('input',()=>{const button=form.querySelector('#almora-settings-save');if(button&&!button.disabled)button.textContent='Salvar alterações • pendente';});
      form.addEventListener('submit',e=>savePage(e,id,spec));
    }catch(error){
      host.innerHTML='<div class="empty">Não foi possível carregar esta página: '+esc(error.message)+'</div><button type="button" class="g" id="almora-settings-retry">Voltar</button>';
      host.querySelector('#almora-settings-retry')?.addEventListener('click',renderHome);
    }
  }
  async function renderStaff(host,page){
    const [staff,profiles,auth]=await Promise.all([
      db().from('staff_roles').select('id,user_id,role_key,created_at').order('created_at',{ascending:true}),
      db().from('profiles').select('id,username,display_name').order('username'),
      db().auth.getUser()
    ]);
    if(staff.error)throw staff.error;if(profiles.error)throw profiles.error;
    const names=Object.fromEntries((profiles.data||[]).map(p=>[p.id,p]));
    const labels={owner:'Dono',admin:'Administrador',moderator:'Moderador',editor_bl:'Editor BL',editor_gl:'Editor GL',translator:'Tradutor',reviewer:'Revisor'};
    const roleOptions=['admin','moderator'];
    const rows=(staff.data||[]).map(item=>{
      const p=names[item.user_id]||{},name=p.display_name||p.username||'Conta da equipe';
      return '<div class="almora-staff-row"><span class="almora-staff-avatar">'+esc(name.slice(0,1).toUpperCase())+'</span><span><strong>'+esc(name)+'</strong><small>@'+esc(p.username||'conta')+'</small></span><b>'+esc(labels[item.role_key]||item.role_key)+'</b>'+(item.role_key==='owner'?'':'<button type="button" class="g almora-staff-remove" data-remove-role="'+esc(item.id)+'">Remover</button>')+'</div>';
    }).join('');
    host.innerHTML=head(page.title,page.desc,'CONTROLES DO DONO / EQUIPE')+
      '<button type="button" class="g almora-settings-back" id="almora-settings-back">← Todas as configurações</button>'+
      '<div class="almora-settings-warning"><strong>Área de alto privilégio</strong><p>Somente o dono pode atribuir ou remover cargos. O cargo de dono não pode ser criado nem removido por este painel.</p></div>'+
      '<form id="almora-staff-form" class="almora-settings-form"><h3>Adicionar pessoa à equipe</h3><label class="almora-settings-field"><span>Conta</span><select id="almora-staff-user" required><option value="">Selecione uma conta</option>'+(profiles.data||[]).map(p=>'<option value="'+p.id+'">'+esc((p.display_name||p.username||'Conta')+' (@'+(p.username||'sem usuário')+')')+'</option>').join('')+'</select></label><label class="almora-settings-field"><span>Cargo</span><select id="almora-staff-role" required>'+roleOptions.map(r=>'<option value="'+r+'">'+labels[r]+'</option>').join('')+'</select></label><button type="submit" id="almora-staff-add">Atribuir cargo</button></form>'+
      '<div class="almora-settings-form"><h3>Equipe atual</h3>'+(rows||'<div class="empty">Nenhuma pessoa cadastrada na equipe.</div>')+'</div>';
    host.querySelector('#almora-settings-back').addEventListener('click',renderHome);
    host.querySelector('#almora-staff-form').addEventListener('submit',async e=>{
      e.preventDefault();if(role()!=='superadmin')return denied('staff');
      const button=host.querySelector('#almora-staff-add');button.disabled=true;button.textContent='Atribuindo...';
      try{
        const userId=host.querySelector('#almora-staff-user').value,roleKey=host.querySelector('#almora-staff-role').value;
        if(!userId)throw new Error('Selecione uma conta.');
        if(userId===auth.data.user.id)throw new Error('A conta do dono já possui todos os privilégios e não precisa receber outro cargo.');
        const saved=await db().from('staff_roles').insert({user_id:userId,role_key:roleKey,assigned_by:auth.data.user.id});
        if(saved.error)throw saved.error;
        notify('Cargo atribuído com sucesso.');await renderStaff(host,page);
      }catch(error){notify('Não foi possível atribuir o cargo: '+error.message);}
      finally{button.disabled=false;button.textContent='Atribuir cargo';}
    });
    host.querySelectorAll('[data-remove-role]').forEach(button=>button.addEventListener('click',async()=>{
      if(role()!=='superadmin')return denied('staff');
      if(!confirm('Remover este cargo da equipe? A pessoa perderá as permissões correspondentes.'))return;
      button.disabled=true;
      const removed=await db().from('staff_roles').delete().eq('id',button.dataset.removeRole);
      if(removed.error){notify('Não foi possível remover: '+removed.error.message);button.disabled=false;return;}
      notify('Cargo removido.');await renderStaff(host,page);
    }));
  }
  async function renderLogs(host,page){
    const result=await db().from('audit_log').select('id,actor_id,action,target_type,target_id,details,created_at').order('created_at',{ascending:false}).limit(50);
    if(result.error)throw result.error;
    host.innerHTML=head(page.title,page.desc,'CONTROLES DO DONO / AUDITORIA')+
      '<button type="button" class="g almora-settings-back" id="almora-settings-back">← Todas as configurações</button>'+
      '<form id="almora-settings-form" class="almora-settings-form">'+fields.logs.map(f=>fieldHtml(f,f[3])).join('')+'<div class="almora-settings-save-row"><small>O registro é aplicado diretamente pelos gatilhos do banco.</small><button type="submit" id="almora-settings-save">Salvar auditoria</button></div></form>'+
      '<div class="almora-settings-form"><div class="almora-settings-form-intro"><strong>Atividades recentes</strong><small>Últimos 50 eventos registrados no banco.</small></div>'+
      ((result.data||[]).map(row=>'<div class="almora-audit-row"><strong>'+esc(row.action)+'</strong><span>'+esc(row.target_type||'registro')+' · '+esc(row.target_id||'—')+'</span><small>'+new Date(row.created_at).toLocaleString('pt-BR')+'</small></div>').join('')||'<div class="empty">Nenhum evento registrado.</div>')+'</div>';
    host.querySelector('#almora-settings-back').addEventListener('click',renderHome);
    host.querySelector('#almora-settings-form').addEventListener('submit',e=>savePage(e,'logs',fields.logs));
  }
  async function savePage(event,id,spec){
    event.preventDefault();if(busy||!allowed(id))return denied(id);
    const form=event.currentTarget,button=form.querySelector('#almora-settings-save'),settings={};
    let invalid=null;
    spec.forEach(f=>{
      const el=form.querySelector('[data-setting="'+f[0]+'"]');if(!el)return;
      if(f[2]==='checkbox')settings[f[0]]=el.checked;
      else if(f[2]==='number'){
        const value=Number(el.value);
        if(!Number.isFinite(value)||value<(f[5]??0)||value>(f[6]??500)){invalid=f[1];return;}
        settings[f[0]]=value;
      }else settings[f[0]]=el.value.trim();
    });
    if(invalid)return notify('Confira o valor do campo: '+invalid+'.');
    if(id==='personalization'&&!/^#[0-9a-f]{6}$/i.test(settings.accent_color||''))return notify('Informe uma cor hexadecimal válida.');
    if(id==='storage'){
      const extensions=(settings.allowed_extensions||'').split(',').map(x=>x.trim().toLowerCase().replace(/^\./,'')).filter(Boolean);
      if(!extensions.length||extensions.some(x=>! /^[a-z0-9]{2,8}$/.test(x)))return notify('Informe extensões válidas, separadas por vírgula.');
      settings.allowed_extensions=[...new Set(extensions)].join(',');
    }
    if(id==='about'&&settings.support_url&&!/^https?:\/\//i.test(settings.support_url))return notify('O link de suporte precisa começar com http:// ou https://.');
    busy=true;button.disabled=true;button.textContent='Salvando...';
    try{
      const auth=await db().auth.getUser();if(auth.error||!auth.data?.user)throw new Error('Sua sessão expirou. Entre novamente.');
      const verified=await db().rpc('current_user_role');if(verified.error)throw verified.error;
      if(!allowed(id,verified.data))throw new Error('Seu cargo não tem permissão para salvar esta categoria.');
      const now=new Date().toISOString();
      const saved=await db().from('studio_settings').upsert({category:id,settings,updated_by:auth.data.user.id,updated_at:now},{onConflict:'category'});
      if(saved.error)throw saved.error;
      if(id==='storage'){
        const applied=await db().rpc('almora_apply_storage_limits',{p_settings:settings});
        if(applied.error)throw new Error('As preferências foram salvas, mas os limites dos buckets não foram atualizados: '+applied.error.message);
      }
      if(id==='personalization')applyColor(settings.accent_color);
      if(window.almoraRefreshSiteSettings)await window.almoraRefreshSiteSettings(true);
      form.querySelector('#almora-settings-updated')?.replaceChildren(document.createTextNode('Salvo em '+new Date(now).toLocaleString('pt-BR')));
      notify('Configurações de '+pages.find(p=>p.id===id).title+' salvas e aplicadas.');
      button.textContent='Salvo';
    }catch(error){notify('Não foi possível salvar: '+error.message);button.textContent='Tentar novamente';}
    finally{busy=false;button.disabled=false;}
  }
  window.almoraRenderStudioSettings=async function(){
    const host=mount();if(!host)return;
    const verified=await db().rpc('current_user_role');
    if(verified.error){host.innerHTML='<div class="empty">Não foi possível confirmar seu cargo. Atualize a página e tente novamente.</div>';return;}
    window.almoraStudioRole=verified.data||'reader';
    if(!['superadmin','admin','moderator'].includes(window.almoraStudioRole)){
      host.innerHTML='<section class="almora-settings-denied"><span class="almora-settings-denied-icon">🔒</span><div class="almora-settings-eyebrow">ACESSO RESTRITO</div><h2>Seu cargo não permite abrir as configurações.</h2><p>Seu cargo atual é <strong>'+esc(roleLabel(window.almoraStudioRole))+'</strong>. Solicite ao dono do ALMORA a revisão das suas permissões.</p></section>';return;
    }
    renderHome();
    try{
      const result=await db().from('studio_settings').select('category,settings');
      if(result.error)throw result.error;
      const branding=(result.data||[]).find(x=>x.category==='personalization')?.settings;
      if(branding?.accent_color)applyColor(branding.accent_color);
    }catch(error){console.warn('Não foi possível carregar preferências de identidade:',error);}
  };
  const css=document.createElement('style');
  css.textContent=`
  #almora-studio-settings{color:var(--tx)}
  .almora-settings-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;flex-wrap:wrap;margin:10px 0 18px}
  .almora-settings-head h2{margin:5px 0 4px;font-size:23px}
  .almora-settings-eyebrow{font-size:10px;letter-spacing:1.4px;color:var(--mu);font-weight:800}
  .almora-settings-muted{color:var(--mu);font-size:13px;margin:0;max-width:650px}
  .almora-settings-role{display:inline-flex;padding:7px 11px;border:1px solid var(--bd);border-radius:99px;color:var(--ac);font-size:11px;font-weight:700}
  .almora-settings-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;background:var(--sf);border:1px solid var(--bd);border-radius:15px;padding:16px;margin-bottom:22px}
  .almora-settings-summary>div{display:grid;gap:3px}.almora-settings-summary>div strong{font-size:26px;color:var(--ac)}.almora-settings-summary>div span{font-size:11px;color:var(--mu)}
  .almora-settings-summary p{grid-column:1/-1;margin:0;padding-top:10px;border-top:1px solid var(--bd);font-size:12px;color:var(--mu);line-height:1.5}
  .almora-settings-group-label{font-size:10px;letter-spacing:1.3px;font-weight:800;color:var(--mu);margin:20px 0 10px}
  .almora-settings-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:10px}
  .almora-settings-card{display:flex;align-items:center;gap:12px;text-align:left;background:var(--sf);border:1px solid var(--bd);color:var(--tx);padding:14px;border-radius:13px;min-height:94px;transition:.18s}
  .almora-settings-card:hover{border-color:var(--ac);transform:translateY(-1px)}.almora-settings-card.is-locked{opacity:.72}
  .almora-settings-icon{width:42px;height:42px;display:grid;place-items:center;flex:0 0 42px;border-radius:11px;background:var(--sf2);font-size:21px;color:var(--ac)}
  .almora-settings-card-copy{display:grid;gap:4px;min-width:0;flex:1}.almora-settings-card-copy strong{font-size:13px}.almora-settings-card-copy small{font-size:11px;color:var(--mu);line-height:1.4}.almora-settings-card-copy em{font-size:10px;color:var(--ac);font-style:normal;font-weight:700}
  .almora-settings-arrow{font-size:23px;color:var(--mu)}
  .almora-settings-form{background:var(--sf);border:1px solid var(--bd);border-radius:14px;padding:17px;display:grid;gap:14px;margin-top:12px}
  .almora-settings-form-intro{display:grid;gap:4px;padding-bottom:10px;border-bottom:1px solid var(--bd)}.almora-settings-form-intro strong{font-size:14px}.almora-settings-form-intro small{font-size:11px;color:var(--mu);line-height:1.5}
  .almora-settings-field{display:grid;gap:6px;color:var(--tx);font-size:12px;font-weight:600}
  .almora-settings-field input,.almora-settings-field select,.almora-settings-field textarea{width:100%;color:var(--tx);background:var(--sf2);border:1px solid var(--bd);border-radius:9px;padding:10px;font:inherit;font-weight:400}
  .almora-settings-field input[type=color]{height:44px;padding:4px}.almora-settings-help{font-size:10px;color:var(--mu);font-weight:400;line-height:1.45}
  .almora-settings-toggle{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 0;border-bottom:1px solid var(--bd);color:var(--tx);font-size:13px}
  .almora-settings-toggle>span{display:grid;gap:4px}.almora-settings-toggle strong{font-size:13px}.almora-settings-toggle input{width:20px;height:20px;flex:0 0 20px;accent-color:var(--ac)}
  .almora-settings-save-row{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;padding-top:10px;border-top:1px solid var(--bd)}
  .almora-settings-save-row small,.almora-settings-foot{color:var(--mu);font-size:11px;line-height:1.5}
  .almora-settings-back{margin:0 0 8px}.almora-settings-warning{border:1px solid color-mix(in srgb,var(--ac) 35%,var(--bd));background:var(--sf);border-radius:12px;padding:13px}.almora-settings-warning p{font-size:11px;color:var(--mu);margin:4px 0 0}
  .almora-settings-denied{max-width:650px;margin:25px auto;text-align:center;padding:25px 18px;border:1px solid var(--bd);border-radius:16px;background:var(--sf)}.almora-settings-denied-icon{font-size:32px}.almora-settings-denied h2{margin:10px 0}.almora-settings-denied p{color:var(--mu);font-size:13px;line-height:1.6}
  .almora-staff-row{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--bd)}.almora-staff-avatar{width:36px;height:36px;display:grid;place-items:center;border-radius:50%;background:var(--sf2);color:var(--ac);font-weight:700}
  .almora-staff-row span:nth-child(2){display:grid;flex:1;min-width:0}.almora-staff-row small{color:var(--mu);font-size:10px}.almora-staff-row b{font-size:11px;color:var(--ac);text-align:right}.almora-staff-remove{padding:6px 8px;font-size:10px}
  .almora-audit-row{display:grid;gap:3px;padding:10px 0;border-bottom:1px solid var(--bd)}.almora-audit-row strong{font-size:12px}.almora-audit-row span,.almora-audit-row small{font-size:10px;color:var(--mu);overflow-wrap:anywhere}
  @media(max-width:480px){.almora-settings-form{padding:12px}.almora-settings-save-row{align-items:stretch}.almora-settings-save-row button{width:100%}.almora-staff-row{flex-wrap:wrap}.almora-staff-row b{margin-left:auto}}
  `;
  document.head.appendChild(css);
})();