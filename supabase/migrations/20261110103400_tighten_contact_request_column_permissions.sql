revoke insert, update on public.contact_messages from authenticated;
grant insert (category,subject,message,user_id) on public.contact_messages to authenticated;
grant update (status,staff_response,responded_at,updated_at,staff_notes,assigned_to) on public.contact_messages to authenticated;