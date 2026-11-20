-- منظّم المعلم: تمكين المطور من حذف مستخدمة نهائيًا من لوحة المطور
-- يُشغَّل مرة وحدة في Supabase ← SQL Editor ← Run

create or replace function public.admin_delete_user(target uuid)
returns void
language plpgsql
security definer
set search_path = public, auth, storage
as $$
begin
  if not public.is_admin() then
    raise exception 'غير مسموح';
  end if;
  if target = auth.uid() then
    raise exception 'لا يمكن حذف حساب المطور';
  end if;

  delete from public.items    where user_id = target;
  delete from public.profiles where user_id = target;

  begin
    delete from public.ai_usage where user_id = target;
  exception when others then null;
  end;

  begin
    delete from storage.objects where bucket_id = 'files' and name like target::text || '/%';
  exception when others then null;
  end;

  delete from auth.users where id = target;
end;
$$;

revoke all on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_delete_user(uuid) to authenticated;
