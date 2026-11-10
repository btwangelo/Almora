(() => {
'use strict';
window.almoraInitContactForm = async () => {
 const form=document.getElementById('almora-contact-form');
 if(!form||form.dataset.ready==='1')return;
 form.dataset.ready='1';
 const feedback=document.getElementById('almora-contact-feedback');
 const button=document.getElementById('almora-contact-submit');
 const client=window.almoraDB;
 if(!client){feedback.textContent='O serviço de contato está indisponível no momento.';button.disabled=true;return;}
 const {data:{user},error}=await client.auth.getUser();
 if(error||!user){
  feedback.textContent='Entre na sua conta ALMORA para enviar uma solicitação e acompanhar a resposta nas notificações.';
  button.disabled=true;
  return;
 }
 form.addEventListener('submit',async event=>{
  event.preventDefault();
  const value=id=>String(document.getElementById(id)?.value||'').trim();
  if(value('almora-contact-website'))return;
  const payload={category:value('almora-contact-category'),subject:value('almora-contact-subject'),message:value('almora-contact-message')};
  if(payload.subject.length<3||payload.message.length<10){
   feedback.textContent='Informe um título e uma mensagem com pelo menos 10 caracteres.';return;
  }
  const last=Number(sessionStorage.getItem('almora_contact_last_sent')||0);
  if(Date.now()-last<30000){feedback.textContent='Aguarde um pouco antes de enviar outra solicitação.';return;}
  button.disabled=true;button.textContent='Enviando…';feedback.textContent='Enviando sua solicitação à equipe…';
  try{
   const {error:insertError}=await client.from('contact_messages').insert({...payload,user_id:user.id});
   if(insertError)throw insertError;
   sessionStorage.setItem('almora_contact_last_sent',String(Date.now()));form.reset();
   feedback.textContent='Solicitação enviada! Você poderá acompanhar a resposta na área Notificações da sua conta.';
  }catch(error){
   console.error('ALMORA contact submit:',error);
   feedback.textContent='Não foi possível enviar agora. Tente novamente em alguns instantes.';
  }finally{button.disabled=false;button.textContent='Enviar solicitação';}
 });
};
if(document.readyState==='loading'){
 document.addEventListener('DOMContentLoaded',()=>{if((location.hash.slice(1)||'')==='contato')window.almoraInitContactForm();});
}else if((location.hash.slice(1)||'')==='contato'){window.almoraInitContactForm();}
})();