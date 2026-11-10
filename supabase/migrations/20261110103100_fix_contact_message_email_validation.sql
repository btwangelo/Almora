alter table public.contact_messages drop constraint if exists contact_messages_email_format;
alter table public.contact_messages add constraint contact_messages_email_format
check (position('@' in email) > 1 and position('.' in split_part(email,'@',2)) > 1 and email not like '% %');