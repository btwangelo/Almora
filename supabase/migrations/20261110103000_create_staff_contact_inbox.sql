create table if not exists public.contact_messages (
 id uuid primary key default gen_random_uuid(),
 name text not null check (char_length(btrim(name)) between 2 and 80),
 email text not null check (char_length(btrim(email)) between 5 and 254),
 category text not null check (category in ('suporte','denuncia','sugestao','parceria','privacidade','outro')),
 subject text not null check (char_length(btrim(subject)) between 3 and 120),
 message text not null check (char_length(btrim(message)) between 10 and 5000),
 user_id uuid references auth.users(id) on delete set null,
 status text not null default 'pending' check (status in ('pending','in_progress','resolved','archived')),
 staff_notes text,
 assigned_to uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint contact_messages_email_format check (email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$')
);
create index if not exists contact_messages_status_created_idx on public.contact_messages(status,created_at desc);
alter table public.contact_messages enable row level security;
revoke all on public.contact_messages from anon,authenticated;
grant insert (name,email,category,subject,message,user_id) on public.contact_messages to anon,authenticated;
grant select,update on public.contact_messages to authenticated;
drop policy if exists contact_messages_public_submit on public.contact_messages;
create policy contact_messages_public_submit on public.contact_messages for insert to anon,authenticated
with check(status='pending' and staff_notes is null and assigned_to is null and (user_id is null or user_id=(select auth.uid())));
drop policy if exists contact_messages_staff_read on public.contact_messages;
create policy contact_messages_staff_read on public.contact_messages for select to authenticated
using((select public.current_user_role()) in ('superadmin','admin','moderator'));
drop policy if exists contact_messages_staff_update on public.contact_messages;
create policy contact_messages_staff_update on public.contact_messages for update to authenticated
using((select public.current_user_role()) in ('superadmin','admin','moderator'))
with check((select public.current_user_role()) in ('superadmin','admin','moderator'));
comment on table public.contact_messages is 'Mensagens do formulário público; leitura restrita à equipe staff.';