revoke all privileges on table public.follow_notifications from anon, authenticated;
revoke all privileges (id, user_id, follower_id, created_at, read_at) on table public.follow_notifications from authenticated;
grant select, delete on table public.follow_notifications to authenticated;
grant update (read_at) on table public.follow_notifications to authenticated;
