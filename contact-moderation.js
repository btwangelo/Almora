(() => {
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const categories={suporte:'Suporte',denuncia:'Denúncia',sugestao:'Sugestão',parceria:'Parceria',privacidade:'Privacidade',outro:'Outro'};
const statuses={pending:'Pendente',in_progress:'Em análise',resolved:'Resolvida',archived:'Arquivada'};
const client=()=>window.almoraDB;
const me=async()=>{const {data:{user},error}=await client().auth.getUser();if(error)throw error;if(!user)throw new Error('Sessão expirada. Entre novamente.');return user;};
const badgeText=count=>count?String(count>99?'99+':count):'';
function ensureBadges(){
 const nav=document.querySelector('[data-studio-page="moderation"]');
 if(nav&&!nav.querySelector('#almora-contact-staff-sidebar-badge')){
  const badge=document.createElement('span');badge.id='almora-contact-staff-sidebar-badge';badge.className='almora-contact-unread-badge';nav.appendChild(badge);
 }
 const menuLink=document.querySelector('#almora-account-menu a[href="#studio"]');
 if(menuLink&&!menuLink.querySelector('#almora-contact-staff-menu-badge')){
  const badge=document.createElement('span');badge.id='almora-contact-staff-menu-badge';badge.className='almora-contact-unread-badge';menuLink.appendChild(badge);
 }
}
window.almoraRefreshContactStaffBadge=async()=>{
 ensureBadges();
 const badges=['#almora-contact-staff-badge','#almora-contact-staff-sidebar-badge','#almora-contact-staff-menu-badge']
  .map(selector=>document.querySelector(selector)).filter(Boolean);
 if(!badges.length)return;
 try{
  const user=await me();
  const [messagesResult,notificationsResult]=await Promise.all([
   client().from('contact_messages').select('id',{count:'exact'}).order('created_at',{ascending:false}).limit(1000),
   client().from('contact_staff_notifications').select('contact_message_id,read_at').eq('staff_user_id',user.id).limit(1000)
  ]);
  if(messagesResult.error)throw messagesResult.error;
  const notifications=notificationsResult.error?[]:(notificationsResult.data||[]);
  if(notificationsResult.error)console.warn('Avisos de solicitação indisponíveis; usando as solicitações como referência.',notificationsResult.error);
  const statusByMessage=new Map(notifications.map(item=>[item.contact_message_id,item.read_at]));
  const count=(messagesResult.data||[]).filter(item=>!statusByMessage.has(item.id)||!statusByMessage.get(item.id)).length;
  badges.forEach(el=>{el.textContent=badgeText(count);el.hidden=!count;});
 }catch(error){console.warn('Contagem de solicitações staff indisponível:',error);}
};
window.almoraShowContactRequests=()=>{
 const root=document.getElementById('almora-contact-requests');
 const filter=document.getElementById('almora-report-filter');
 const list=document.getElementById('almora-report-list');
 const reportLabel=document.querySelector('label[for="almora-report-filter"]');
 const refresh=[...document.querySelectorAll('#almora-moderation button')].find(b=>b.textContent.includes('Atualizar denúncias'));
 if(filter)filter.hidden=true;if(list)list.hidden=true;if(reportLabel)reportLabel.hidden=true;if(refresh)refresh.hidden=true;
 if(root)root.hidden=false;
 document.getElementById('almora-mod-tab-reports')?.classList.remove('on');
 document.getElementById('almora-mod-tab-contacts')?.classList.add('on');
 window.almoraLoadContactRequests();
};
window.almoraShowReportQueue=()=>{
 const root=document.getElementById('almora-contact-requests');
 const filter=document.getElementById('almora-report-filter');
 const list=document.getElementById('almora-report-list');
 const reportLabel=document.querySelector('label[for="almora-report-filter"]');
 const refresh=[...document.querySelectorAll('#almora-moderation button')].find(b=>b.textContent.includes('Atualizar denúncias'));
 if(filter)filter.hidden=false;if(list)list.hidden=false;if(reportLabel)reportLabel.hidden=false;if(refresh)refresh.hidden=false;
 if(root)root.hidden=true;
 document.getElementById('almora-mod-tab-contacts')?.classList.remove('on');
 document.getElementById('almora-mod-tab-reports')?.classList.add('on');
 window.almoraLoadReports?.();
};
window.almoraLoadContactRequests=async()=>{
 const root=document.getElementById('almora-contact-requests');
 if(!root||root.dataset.loading==='1')return;
 root.dataset.loading='1';root.innerHTML='<div class="empty">Carregando solicitações…</div>';
 try{
  const user=await me();
  // A tabela de mensagens é a fonte principal. Notificações nunca escondem solicitações.
  const {data:rows,error}=await client().from('contact_messages')
   .select('id,user_id,username_snapshot,display_name_snapshot,category,subject,message,status,staff_response,created_at,responded_at')
   .order('created_at',{ascending:false}).limit(500);
  if(error)throw error;
  let notifications=[];
  const noticeResult=await client().from('contact_staff_notifications')
   .select('id,contact_message_id,created_at,read_at')
   .eq('staff_user_id',user.id).order('created_at',{ascending:false}).limit(500);
  if(noticeResult.error)console.warn('Não foi possível atualizar o estado dos avisos:',noticeResult.error);
  else notifications=noticeResult.data||[];
  const unread=notifications.filter(n=>!n.read_at).map(n=>n.id);
  if(unread.length){
   const {error:readError}=await client().from('contact_staff_notifications')
    .update({read_at:new Date().toISOString()}).in('id',unread).eq('staff_user_id',user.id);
   if(readError)console.warn('Não foi possível marcar os avisos como lidos:',readError);
  }
  root.dataset.loaded='1';
  root.innerHTML='<div class="almora-contact-request-head"><div><span class="almora-studio-eyebrow">MODERAÇÃO · CONTATO COM LEITORES</span><h3>Solicitações dos usuários</h3><p>Mensagens vinculadas automaticamente às contas ALMORA. Responda por aqui; o usuário receberá a resposta nas próprias notificações.</p></div><button class="g" type="button" id="almora-contact-requests-refresh">Atualizar</button></div>'+
   ((rows||[]).map(row=>{
    const username=row.username_snapshot?'@'+row.username_snapshot:'Conta ALMORA';
    const display=row.display_name_snapshot||username;
    return '<article class="almora-mod-card almora-contact-request" data-contact-request="'+esc(row.id)+'"><div class="almora-mod-head"><div><span class="almora-mod-status">'+esc(categories[row.category]||row.category)+'</span> <span class="almora-mod-status">'+esc(statuses[row.status]||row.status)+'</span><h3>'+esc(row.subject)+'</h3></div><small>'+esc(new Date(row.created_at).toLocaleString('pt-BR'))+'</small></div><div class="almora-mod-meta">Enviado por <b>'+esc(display)+'</b> · <a href="#perfil/'+encodeURIComponent(row.user_id)+'" style="color:var(--ac)">'+esc(username)+'</a></div><div class="almora-mod-body">'+esc(row.message)+'</div><label for="almora-contact-response-'+esc(row.id)+'">Resposta da equipe</label><textarea id="almora-contact-response-'+esc(row.id)+'" rows="4" maxlength="5000" placeholder="Escreva uma resposta para este usuário…">'+esc(row.staff_response||'')+'</textarea><div class="almora-mod-actions"><button type="button" data-contact-reply="'+esc(row.id)+'">Enviar resposta</button><select aria-label="Status da solicitação" data-contact-status="'+esc(row.id)+'">'+Object.entries(statuses).map(([key,label])=>'<option value="'+key+'" '+(row.status===key?'selected':'')+'>'+label+'</option>').join('')+'</select></div><small class="almora-contact-response-feedback" role="status"></small></article>';
   }).join('')||'<div class="empty">Nenhuma solicitação encontrada.</div>');
  root.querySelector('#almora-contact-requests-refresh')?.addEventListener('click',()=>window.almoraLoadContactRequests());
  root.querySelectorAll('[data-contact-reply]').forEach(button=>button.addEventListener('click',async()=>{
   const id=button.dataset.contactReply,textarea=document.getElementById('almora-contact-response-'+id);
   const feedback=button.closest('article')?.querySelector('.almora-contact-response-feedback');
   const response=String(textarea?.value||'').trim();
   if(response.length<2){if(feedback)feedback.textContent='Escreva uma resposta antes de enviar.';return;}
   button.disabled=true;button.textContent='Enviando…';
   try{
    const {error}=await client().from('contact_messages').update({staff_response:response,responded_at:new Date().toISOString(),status:'in_progress',updated_at:new Date().toISOString()}).eq('id',id);
    if(error)throw error;
    if(feedback)feedback.textContent='Resposta enviada. O usuário será notificado na ALMORA.';
    button.textContent='Resposta enviada';
    await window.almoraLoadContactRequests();
   }catch(error){if(feedback)feedback.textContent='Não foi possível enviar: '+error.message;button.disabled=false;button.textContent='Enviar resposta';}
  }));
  root.querySelectorAll('[data-contact-status]').forEach(select=>select.addEventListener('change',async()=>{
   select.disabled=true;
   try{
    const {error}=await client().from('contact_messages').update({status:select.value,updated_at:new Date().toISOString()}).eq('id',select.dataset.contactStatus);
    if(error)throw error;
    await window.almoraRefreshContactStaffBadge();
   }catch(error){alert('Não foi possível atualizar o status: '+error.message);}
   finally{select.disabled=false;}
  }));
  await window.almoraRefreshContactStaffBadge();
 }catch(error){
  root.innerHTML='<div class="empty">Não foi possível carregar as solicitações: '+esc(error.message)+'</div>';
  console.error('ALMORA staff contact requests:',error);
 }finally{root.dataset.loading='0';}
};
const originalStudio=window.studio;
if(typeof originalStudio==='function'){
 window.studio=function(...args){
  const html=originalStudio.apply(this,args);
  const start=html.lastIndexOf('<section class="almora-mod" id="almora-moderation"');
  if(start<0)return html;
  const end=html.indexOf('</section>',start),descriptionEnd=html.indexOf('</p>',start);
  if(end<0||descriptionEnd<0||descriptionEnd>end)return html;
  const tabs='<div class="almora-mod-actions almora-contact-mod-tabs"><button id="almora-mod-tab-reports" class="on" type="button" onclick="almoraShowReportQueue()">Denúncias</button><button id="almora-mod-tab-contacts" class="g" type="button" onclick="almoraShowContactRequests()">Solicitações <span id="almora-contact-staff-badge" hidden class="almora-contact-unread-badge"></span></button></div><section id="almora-contact-requests" class="almora-contact-requests" hidden><div class="empty">Selecione esta aba para carregar as solicitações.</div></section>';
  const insertAt=descriptionEnd+4;
  return html.slice(0,insertAt)+tabs+html.slice(insertAt);
 };
}
function ensureLiveModerationTabs(){
 const root=document.getElementById('almora-moderation');
 if(!root||root.querySelector('#almora-mod-tab-contacts'))return;
 const description=root.querySelector('p');if(!description)return;
 const tabs=document.createElement('div');tabs.className='almora-mod-actions almora-contact-mod-tabs';
 tabs.innerHTML='<button id="almora-mod-tab-reports" class="on" type="button" onclick="almoraShowReportQueue()">Denúncias</button><button id="almora-mod-tab-contacts" class="g" type="button" onclick="almoraShowContactRequests()">Solicitações <span id="almora-contact-staff-badge" hidden class="almora-contact-unread-badge"></span></button>';
 const panel=document.createElement('section');panel.id='almora-contact-requests';panel.className='almora-contact-requests';panel.hidden=true;
 panel.innerHTML='<div class="empty">Selecione esta aba para carregar as solicitações.</div>';
 description.insertAdjacentElement('afterend',tabs);tabs.insertAdjacentElement('afterend',panel);
}
ensureLiveModerationTabs();
if(document.body){const moderationObserver=new MutationObserver(ensureLiveModerationTabs);moderationObserver.observe(document.body,{childList:true,subtree:true});}
const style=document.createElement('style');
style.textContent='.almora-contact-mod-tabs{margin:16px 0}.almora-contact-unread-badge{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 5px;margin-left:auto;border-radius:99px;background:#d93654;color:#fff;font-size:11px;font-weight:700}.almora-contact-request-head{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap}.almora-contact-request textarea{width:100%;box-sizing:border-box;margin:8px 0}.almora-contact-request .almora-mod-actions select{flex:1;min-width:140px}.almora-contact-response-feedback{display:block;color:var(--mu);margin-top:8px}.almora-contact-requests[hidden]{display:none!important}#almora-account-menu a[href="#studio"]{justify-content:space-between}';
document.head.appendChild(style);
document.addEventListener('click',event=>{
 if(event.target.closest('#almora-tab-mod,[data-studio-page="moderation"]'))setTimeout(()=>window.almoraRefreshContactStaffBadge?.(),0);
 if(event.target.closest('#acc .almora-header-gear'))setTimeout(()=>{ensureBadges();window.almoraRefreshContactStaffBadge?.();},0);
});
window.addEventListener('focus',()=>{ensureBadges();window.almoraRefreshContactStaffBadge?.();window.almoraRefreshNotificationBadge?.();});
window.setInterval(()=>{
 if(location.hash.startsWith('#studio')){
  window.almoraRefreshContactStaffBadge?.();
  const panel=document.getElementById('almora-contact-requests');
  if(panel&&!panel.hidden)window.almoraLoadContactRequests?.();
 }
 window.almoraRefreshNotificationBadge?.();
},45000);
window.almoraRefreshContactStaffBadge?.();
if(document.body){
 const observer=new MutationObserver(()=>{ensureBadges();});
 observer.observe(document.body,{childList:true,subtree:true});
}
})();