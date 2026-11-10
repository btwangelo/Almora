-- Require authenticated ALMORA accounts for contact requests.
alter table public.contact_messages alter column name drop not null, alter column email drop not null, alter column user_id set not null, add column if not exists staff_response text, add column if not exists responded_at timestamptz;
alter table public.contact_messages drop constraint if exists contact_messages_email_format;
alter table public.contact_messages drop constraint if exists contact_messages_user_id_fkey;
alter table public.contact_messages add constraint contact_messages_user_id_fkey foreign key(user_id) references auth.users(id) on delete cascade;
drop policy if exists contact_messages_public_submit on public.contact_messages;
drop policy if exists contact_messages_staff_read on public.contact_messages;
drop policy if exists contact_messages_staff_update on public.contact_messages;
revoke all on public.contact_messages from anon;
revoke insert, update on public.contact_messages from authenticated;
grant select on public.contact_messages to authenticated;
grant insert (category,subject,message,user_id) on public.contact_messages to authenticated;
grant update (status,staff_response,responded_at,updated_at,staff_notes,assigned_to) on public.contact_messages to authenticated;
create policy contact_messages_member_submit on public.contact_messages for insert to authenticated
with check(user_id=(select auth.uid()) and status='pending' and staff_notes is null and assigned_to is null and staff_response is null and responded_at is null);
create policy contact_messages_owner_read on public.contact_messages for select to authenticated using(user_id=(select auth.uid()));
create policy contact_messages_staff_read on public.contact_messages for select to authenticated using((select public.current_user_role()) in ('superadmin','admin','moderator'));
create policy contact_messages_staff_update on public.contact_messages for update to authenticated
using((select public.current_user_role()) in ('superadmin','admin','moderator')) with check((select public.current_user_role()) in ('superadmin','admin','moderator'));

create table if not exists public.contact_staff_notifications(id uuid primary key default gen_random_uuid(),staff_user_id uuid not null references auth.users(id) on delete cascade,contact_message_id uuid not null references public.contact_messages(id) on delete cascade,created_at timestamptz not null default now(),read_at timestamptz,unique(staff_user_id,contact_message_id));
alter table public.contact_staff_notifications enable row level security;
revoke all on public.contact_staff_notifications from anon,authenticated;
grant select on public.contact_staff_notifications to authenticated;
grant update(read_at) on public.contact_staff_notifications to authenticated;
drop policy if exists contact_staff_notifications_read_own on public.contact_staff_notifications;
create policy contact_staff_notifications_read_own on public.contact_staff_notifications for select to authenticated using(staff_user_id=(select auth.uid()) and (select public.current_user_role()) in ('superadmin','admin','moderator'));
drop policy if exists contact_staff_notifications_update_own on public.contact_staff_notifications;
create policy contact_staff_notifications_update_own on public.contact_staff_notifications for update to authenticated using(staff_user_id=(select auth.uid()) and (select public.current_user_role()) in ('superadmin','admin','moderator')) with check(staff_user_id=(select auth.uid()) and (select public.current_user_role()) in ('superadmin','admin','moderator'));
create or replace function public.notify_staff_of_contact_message() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into public.contact_staff_notifications(staff_user_id,contact_message_id) select sr.user_id,new.id from public.staff_roles sr where sr.role_key in ('owner','admin','moderator') on conflict(staff_user_id,contact_message_id) do nothing; return new; end; $$;
revoke all on function public.notify_staff_of_contact_message() from public,anon,authenticated;
drop trigger if exists contact_message_notify_staff on public.contact_messages;
create trigger contact_message_notify_staff after insert on public.contact_messages for each row execute function public.notify_staff_of_contact_message();

create table if not exists public.contact_user_notifications(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,contact_message_id uuid not null references public.contact_messages(id) on delete cascade,created_at timestamptz not null default now(),read_at timestamptz,unique(contact_message_id));
alter table public.contact_user_notifications enable row level security;
revoke all on public.contact_user_notifications from anon,authenticated;
grant select on public.contact_user_notifications to authenticated;
grant update(read_at) on public.contact_user_notifications to authenticated;
drop policy if exists contact_user_notifications_read_own on public.contact_user_notifications;
create policy contact_user_notifications_read_own on public.contact_user_notifications for select to authenticated using(user_id=(select auth.uid()));
drop policy if exists contact_user_notifications_update_own on public.contact_user_notifications;
create policy contact_user_notifications_update_own on public.contact_user_notifications for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create or replace function public.notify_member_of_staff_response() returns trigger language plpgsql security definer set search_path=public as $$
begin if new.staff_response is not null and btrim(new.staff_response)<>'' and old.staff_response is distinct from new.staff_response then insert into public.contact_user_notifications(user_id,contact_message_id) values(new.user_id,new.id) on conflict(contact_message_id) do update set created_at=now(),read_at=null,user_id=excluded.user_id; end if; return new; end; $$;
revoke all on function public.notify_member_of_staff_response() from public,anon,authenticated;
drop trigger if exists contact_message_notify_member on public.contact_messages;
create trigger contact_message_notify_member after update of staff_response on public.contact_messages for each row execute function public.notify_member_of_staff_response();
comment on table public.contact_staff_notifications is 'Notificações privadas para staff sobre novas solicitações de usuários.';
comment on table public.contact_user_notifications is 'Notificações privadas para usuários sobre respostas da equipe.';
