-- Advanced, category-scoped settings for ALMORA Studio.
create table if not exists public.studio_settings (
  category text primary key
    check (category in (
      'personalization','platform','locale','staff','content',
      'community','notifications','storage','logs','security','about'
    )),
  settings jsonb not null default '{}'::jsonb
    check (jsonb_typeof(settings) = 'object'),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.studio_settings enable row level security;
grant select, insert, update on public.studio_settings to authenticated;

create policy studio_settings_staff_select
on public.studio_settings for select to authenticated
using (
  (
    (select public.current_user_role()) in ('admin','superadmin')
    and (
      (select public.current_user_role()) = 'superadmin'
      or category not in ('staff','security')
    )
  )
  or (
    (select public.current_user_role()) = 'moderator'
    and category in ('content','community','notifications')
  )
);

create policy studio_settings_staff_insert
on public.studio_settings for insert to authenticated
with check (
  updated_by = (select auth.uid())
  and (
    (
      (select public.current_user_role()) in ('admin','superadmin')
      and (
        (select public.current_user_role()) = 'superadmin'
        or category not in ('staff','security')
      )
    )
    or (
      (select public.current_user_role()) = 'moderator'
      and category in ('content','community','notifications')
    )
  )
);

create policy studio_settings_staff_update
on public.studio_settings for update to authenticated
using (
  (
    (select public.current_user_role()) in ('admin','superadmin')
    and (
      (select public.current_user_role()) = 'superadmin'
      or category not in ('staff','security')
    )
  )
  or (
    (select public.current_user_role()) = 'moderator'
    and category in ('content','community','notifications')
  )
)
with check (
  updated_by = (select auth.uid())
  and (
    (
      (select public.current_user_role()) in ('admin','superadmin')
      and (
        (select public.current_user_role()) = 'superadmin'
        or category not in ('staff','security')
      )
    )
    or (
      (select public.current_user_role()) = 'moderator'
      and category in ('content','community','notifications')
    )
  )
);
