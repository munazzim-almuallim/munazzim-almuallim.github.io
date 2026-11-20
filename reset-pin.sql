-- منظّم المعلم: تمكين المطور من إعطاء معلمة رقمًا سريًا جديدًا من لوحة المطور
-- يُشغَّل مرة وحدة في Supabase ← SQL Editor ← Run

create or replace function public.admin_reset_pin(target uuid, pin text)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  em text;
  k text;
begin
  if not public.is_admin() then
    raise exception 'غير مسموح';
  end if;
  if pin !~ '^[0-9]{4}$' then
    raise exception 'الرقم السري 4 أرقام';
  end if;

  select email into em from auth.users where id = target;
  if em is null or em not like 'n%@teachers.teacherhub.app' then
    raise exception 'هذا الحساب ليس حساب معلمة';
  end if;

  k := substring(em from 2 for position('@' in em) - 2);

  update auth.users
     set encrypted_password = extensions.crypt('th-pin:' || pin || ':' || k, extensions.gen_salt('bf')),
         updated_at = now()
   where id = target;
end;
$$;

revoke all on function public.admin_reset_pin(uuid, text) from public, anon;
grant execute on function public.admin_reset_pin(uuid, text) to authenticated;
