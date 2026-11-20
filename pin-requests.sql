-- منظّم المعلم: طلبات «نسيت الرقم السري» من صفحة الدخول تصل للمطور
-- يُشغَّل مرة وحدة في Supabase ← SQL Editor ← Run

create table if not exists public.pin_requests (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 2 and 80),
  phone text default '' check (char_length(phone) <= 20),
  created_at timestamptz not null default now()
);

alter table public.pin_requests enable row level security;

drop policy if exists "anyone can send a request" on public.pin_requests;
create policy "anyone can send a request" on public.pin_requests
  for insert to anon, authenticated with check (true);

drop policy if exists "admin reads requests" on public.pin_requests;
create policy "admin reads requests" on public.pin_requests
  for select to authenticated using (public.is_admin());

drop policy if exists "admin deletes requests" on public.pin_requests;
create policy "admin deletes requests" on public.pin_requests
  for delete to authenticated using (public.is_admin());

grant insert on public.pin_requests to anon, authenticated;
grant select, delete on public.pin_requests to authenticated;
