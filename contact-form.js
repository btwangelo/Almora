(() => {
'use strict';
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
   const panel=form.closest('.box')||form.parentElement;
   if(panel){
    panel.innerHTML='<div class="almora-contact-success" role="status" aria-live="polite"><div class="almora-contact-success-mark" aria-hidden="true">✓</div><span class="almora-studio-eyebrow">MENSAGEM REGISTRADA</span><h1>Solicitação enviada!</h1><p>Sua mensagem chegou à equipe ALMORA. Você poderá acompanhar a resposta diretamente nas notificações da sua conta, sem precisar de e-mail.</p><a class="almora-contact-success-link" href="#notificacoes">Ir para Notificações</a><button class="g" type="button" id="almora-contact-back">Voltar ao início</button></div>';
    panel.querySelector('#almora-contact-back')?.addEventListener('click',()=>{location.hash='#home';});
   }
   window.toast?.('Solicitação enviada à equipe ALMORA!');
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
style.textContent='.almora-contact-success{display:grid;justify-items:start;gap:10px;padding:clamp(20px,5vw,36px);border:1px solid #269d6b66;border-radius:16px;background:color-mix(in srgb,#159b65 9%,var(--sf))}.almora-contact-success-mark{width:48px;height:48px;border-radius:50%;display:grid;place-items:center;background:#159b65;color:#fff;font-size:27px;font-weight:800}.almora-contact-success h1{margin:0}.almora-contact-success p{margin:0 0 8px;color:var(--mu);max-width:560px}.almora-contact-success-link{display:inline-flex;align-items:center;justify-content:center;padding:10px 16px;border-radius:10px;background:var(--ac2);color:#fff;font-weight:700}.almora-contact-success button{margin-top:2px}.almora-contact-form #almora-contact-feedback[data-state=error]{color:#ef6b7d!important}.almora-contact-form #almora-contact-feedback[data-state=info]{color:var(--mu)!important}';
document.head.appendChild(style);
})();