(() => {
'use strict';
window.almoraInitContactForm = () => {
 const form=document.getElementById('almora-contact-form');
 if(!form||form.dataset.ready==='1')return;
 form.dataset.ready='1';
 form.addEventListener('submit',async event=>{
  event.preventDefault();
  const feedback=document.getElementById('almora-contact-feedback');
  const button=document.getElementById('almora-contact-submit');
  const value=id=>String(document.getElementById(id)?.value||'').trim();
  if(value('almora-contact-website'))return;
  const payload={name:value('almora-contact-name'),email:value('almora-contact-email'),category:value('almora-contact-category'),subject:value('almora-contact-subject'),message:value('almora-contact-message')};
  if(payload.name.length<2||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)||payload.subject.length<3||payload.message.length<10){feedback.textContent='Confira os campos e informe um e-mail válido. A mensagem deve ter ao menos 10 caracteres.';return;}
  const last=Number(sessionStorage.getItem('almora_contact_last_sent')||0);
  if(Date.now()-last<30000){feedback.textContent='Aguarde um pouco antes de enviar outra mensagem.';return;}
  button.disabled=true;button.textContent='Enviando…';feedback.textContent='Encaminhando sua mensagem à equipe…';
  try{
   const client=window.almoraDB;if(!client)throw new Error('Serviço indisponível');
   const {data:{user}}=await client.auth.getUser();
   const {error}=await client.from('contact_messages').insert({...payload,user_id:user?.id||null});
   if(error)throw error;
   sessionStorage.setItem('almora_contact_last_sent',String(Date.now()));form.reset();
   feedback.textContent='Mensagem enviada! A equipe ALMORA recebeu seu contato.';
  }catch(error){console.error('ALMORA contact submit:',error);feedback.textContent='Não foi possível enviar agora. Tente novamente em alguns instantes.';}
  finally{button.disabled=false;button.textContent='Enviar mensagem à equipe';}
 });
};
})();
if (document.readyState === 'loading') {
 document.addEventListener('DOMContentLoaded', () => {
  if ((location.hash.slice(1) || '') === 'contato') window.almoraInitContactForm();
 });
} else if ((location.hash.slice(1) || '') === 'contato') {
 window.almoraInitContactForm();
}
