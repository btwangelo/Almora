alter table public.contact_messages add column if not exists username_snapshot text, add column if not exists display_name_snapshot text;
create or replace function public.snapshot_contact_request_identity() returns trigger language plpgsql security definer set search_path=public as $$
begin select p.username,p.display_name into new.username_snapshot,new.display_name_snapshot from public.profiles p where p.id=new.user_id; return new; end; $$;
revoke all on function public.snapshot_contact_request_identity() from public,anon,authenticated;
drop trigger if exists contact_message_snapshot_identity on public.contact_messages;
create trigger contact_message_snapshot_identity before insert on public.contact_messages for each row execute function public.snapshot_contact_request_identity();