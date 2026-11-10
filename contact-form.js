(() => {
'use strict';
function showContactSuccessModal(){
 const existing=document.getElementById('almora-contact-success-modal');
 if(existing)existing.remove();
 const overlay=document.createElement('div');
 overlay.id='almora-contact-success-modal';
 overlay.className='almora-contact-modal-overlay';
 overlay.innerHTML='<section class="almora-contact-modal" role="dialog" aria-modal="true" aria-labelledby="almora-contact-modal-title" aria-describedby="almora-contact-modal-message"><div class="almora-contact-modal-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="m5 12.5 4.2 4.2L19 7" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div><h2 id="almora-contact-modal-title">Solicitação enviada!</h2><p id="almora-contact-modal-message">Sua solicitação foi encaminhada à equipe do ALMORA com sucesso.</p><p class="almora-contact-modal-detail">Nossa staff irá analisar sua mensagem. Você poderá acompanhar as atualizações na área de solicitações.</p><button type="button" class="almora-contact-modal-confirm" id="almora-contact-modal-confirm">Entendi</button></section>';
 document.body.appendChild(overlay);
 const close=()=>{overlay.remove();document.removeEventListener('keydown',onKey);};
 const onKey=event=>{if(event.key==='Escape')close();};
 overlay.addEventListener('click',event=>{if(event.target===overlay)close();});
 overlay.querySelector('#almora-contact-modal-confirm')?.addEventListener('click',close);
 document.addEventListener('keydown',onKey);
 overlay.querySelector('#almora-contact-modal-confirm')?.focus();
}
window.almoraInitContactForm = async () => {
 const form=document.getElementById('almora-contact-form');
 if(!form||form.dataset.ready==='1')return;
 form.dataset.ready='1';
 const feedback=document.getElementById('almora-contact-feedback');
 const button=document.getElementById('almora-contact-submit');
 const client=window.almoraDB;
 const showFeedback=(message,type='info')=>{
  if(feedback){feedback.textContent=message;feedback.dataset.state=type;}
  if(type==='error')window.toast?.(message);
 };
 if(!client){showFeedback('O serviço de contato está indisponível no momento.','error');if(button)button.disabled=true;return;}
 let user;
 try{
  const result=await client.auth.getUser();
  if(result.error)throw result.error;
  user=result.data?.user;
 }catch(error){
  console.error('ALMORA contact auth:',error);
  showFeedback('Não foi possível verificar sua sessão. Atualize a página e tente novamente.','error');
  if(button)button.disabled=true;
  return;
 }
 if(!user){
  showFeedback('Entre na sua conta ALMORA para enviar uma solicitação e acompanhar a resposta nas notificações.','error');
  if(button)button.disabled=true;
  return;
 }
 form.addEventListener('submit',async event=>{
  event.preventDefault();
  if(button?.disabled)return;
  const value=id=>String(document.getElementById(id)?.value||'').trim();
  if(value('almora-contact-website'))return;
  const payload={category:value('almora-contact-category'),subject:value('almora-contact-subject'),message:value('almora-contact-message')};
  if(payload.subject.length<3||payload.message.length<10){showFeedback('Informe um título e uma mensagem com pelo menos 10 caracteres.','error');return;}
  const last=Number(sessionStorage.getItem('almora_contact_last_sent')||0);
  if(Date.now()-last<30000){showFeedback('Aguarde um pouco antes de enviar outra solicitação.','error');return;}
  if(button){button.disabled=true;button.textContent='Enviando…';}
  showFeedback('Enviando sua solicitação à equipe…');
  try{
   const {data,error:insertError}=await client.from('contact_messages')
    .insert({...payload,user_id:user.id})
    .select('id')
    .single();
   if(insertError)throw insertError;
   if(!data?.id)throw new Error('O banco não confirmou o registro da solicitação.');
   sessionStorage.setItem('almora_contact_last_sent',String(Date.now()));
   showContactSuccessModal();
   form.reset();
   showFeedback('');
  }catch(error){
   console.error('ALMORA contact submit:',error);
   showFeedback('Não foi possível enviar a solicitação: '+(error.message||'erro desconhecido')+'. Tente novamente.','error');
   if(button){button.disabled=false;button.textContent='Tentar novamente';}
  }
 });
};
if(document.readyState==='loading'){
 document.addEventListener('DOMContentLoaded',()=>{if((location.hash.slice(1)||'')==='contato')window.almoraInitContactForm();});
}else if((location.hash.slice(1)||'')==='contato'){window.almoraInitContactForm();}
const style=document.createElement('style');
style.textContent='.almora-contact-modal-overlay{position:fixed;inset:0;z-index:100000;background:rgba(8,10,18,.72);backdrop-filter:blur(3px);display:grid;place-items:center;padding:20px;box-sizing:border-box;animation:almoraContactFade .16s ease-out}.almora-contact-modal{width:min(100%,430px);box-sizing:border-box;padding:30px 26px 24px;border:1px solid var(--bd);border-radius:22px;background:var(--sf,var(--bg));color:var(--tx);box-shadow:0 24px 80px #0006;text-align:center;animation:almoraContactPop .2s ease-out}.almora-contact-modal-icon{width:62px;height:62px;margin:0 auto 17px;border-radius:50%;display:grid;place-items:center;background:#159b6520;color:#159b65}.almora-contact-modal-icon svg{width:34px;height:34px}.almora-contact-modal h2{margin:0 0 12px;border:0;padding:0;font-size:22px;color:var(--tx)}.almora-contact-modal p{margin:0;color:var(--tx);line-height:1.55}.almora-contact-modal .almora-contact-modal-detail{margin-top:9px;color:var(--mu);font-size:14px}.almora-contact-modal-confirm{width:100%;margin-top:23px;padding:12px 18px;border-radius:12px;background:var(--ac2);color:#fff;font-weight:700}.almora-contact-modal-overlay[hidden]{display:none}@keyframes almoraContactFade{from{opacity:0}to{opacity:1}}@keyframes almoraContactPop{from{opacity:0;transform:translateY(8px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}.almora-contact-form #almora-contact-feedback[data-state=error]{color:#ef6b7d!important}.almora-contact-form #almora-contact-feedback[data-state=info]{color:var(--mu)!important}';
document.head.appendChild(style);
})();