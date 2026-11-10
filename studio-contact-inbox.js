(() => {
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const categories={suporte:'Suporte',denuncia:'Denúncia',sugestao:'Sugestão',parceria:'Parceria',privacidade:'Privacidade',outro:'Outro'};
const statuses={pending:'Pendente',in_progress:'Em análise',resolved:'Resolvida',archived:'Arquivada'};
const date=v=>new Date(v).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});
window.almoraLoadContactInbox=async()=>{
 const root=document.getElementById('almora-studio-contact-inbox');
 if(!root||root.dataset.loading==='1')return;
 root.dataset.loading='1';
 root.innerHTML='<h1>Mensagens recebidas</h1><div class="box">Carregando mensagens…</div>';
 try{
  const {data,error}=await window.almoraDB.from('contact_messages').select('id,name,email,category,subject,message,status,created_at').order('created_at',{ascending:false}).limit(100);
  if(error)throw error;
  root.dataset.loaded='1';const rows=data||[];
  const cards=rows.map(row=>{
   const options=Object.entries(statuses).map(([key,label])=>'<option value="'+key+'" '+(row.status===key?'selected':'')+'>'+label+'</option>').join('');
   return '<article class="box almora-contact-message"><div class="almora-contact-message-head"><div><span class="pill">'+esc(categories[row.category]||row.category)+'</span> <span class="pill">'+esc(statuses[row.status]||row.status)+'</span><h3>'+esc(row.subject)+'</h3><small>'+esc(row.name)+' · <a href="mailto:'+esc(row.email)+'">'+esc(row.email)+'</a> · '+esc(date(row.created_at))+'</small></div><select aria-label="Status da mensagem" data-contact-status="'+esc(row.id)+'">'+options+'</select></div><p class="almora-contact-message-body">'+esc(row.message).replace(/\n/g,'<br>')+'</p></article>';
  }).join('');
  root.innerHTML='<div class="almora-studio-section-heading"><div><span class="almora-studio-eyebrow">CENTRAL DE ATENDIMENTO</span><h1>Mensagens recebidas</h1><p>Contatos enviados pelo formulário público. Caixa privada da equipe autorizada.</p></div><button type="button" class="g" id="almora-contact-inbox-refresh">Atualizar</button></div><div class="almora-contact-inbox-stats"><div class="box"><small>Total carregado</small><strong>'+rows.length+'</strong></div><div class="box"><small>Pendentes</small><strong>'+rows.filter(x=>x.status==='pending').length+'</strong></div><div class="box"><small>Em análise</small><strong>'+rows.filter(x=>x.status==='in_progress').length+'</strong></div></div><div id="almora-contact-inbox-list">'+(cards||'<div class="box">Ainda não há mensagens recebidas.</div>')+'</div>';
  root.querySelector('#almora-contact-inbox-refresh')?.addEventListener('click',()=>{root.dataset.loaded='0';window.almoraLoadContactInbox();});
  root.querySelectorAll('[data-contact-status]').forEach(select=>select.addEventListener('change',async()=>{
   select.disabled=true;
   const {error}=await window.almoraDB.from('contact_messages').update({status:select.value,updated_at:new Date().toISOString()}).eq('id',select.dataset.contactStatus);
   if(error){alert('Não foi possível atualizar o status.');root.dataset.loaded='0';window.almoraLoadContactInbox();return;}
   const pill=select.closest('article')?.querySelector('.pill:nth-child(2)');if(pill)pill.textContent=statuses[select.value];select.disabled=false;
  }));
 }catch(error){
  root.dataset.loaded='0';root.innerHTML='<h1>Mensagens recebidas</h1><div class="box">Não foi possível carregar a caixa de entrada. Verifique sua sessão e as permissões da equipe.</div>';console.error('ALMORA contact inbox:',error);
 }finally{root.dataset.loading='0';}
};
const style=document.createElement('style');
style.textContent='.almora-contact-inbox-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.almora-contact-inbox-stats .box{margin:0}.almora-contact-inbox-stats small,.almora-contact-inbox-stats strong{display:block}.almora-contact-inbox-stats small{color:var(--mu)}.almora-contact-inbox-stats strong{font-size:24px}.almora-contact-message-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}.almora-contact-message h3{margin:9px 0 3px}.almora-contact-message small{color:var(--mu)}.almora-contact-message-body{overflow-wrap:anywhere;margin:16px 0 0}.almora-contact-message-head select{max-width:145px}@media(max-width:600px){.almora-contact-inbox-stats{grid-template-columns:1fr}.almora-contact-message-head{flex-direction:column}.almora-contact-message-head select{max-width:100%;width:100%}}';
document.head.appendChild(style);
})();