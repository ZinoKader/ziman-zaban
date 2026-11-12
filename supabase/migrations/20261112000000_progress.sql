create type public.target_lang as enum ('ckb', 'fa');
create type public.skill as enum ('recognition', 'recall', 'construction', 'response');

create table public.profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  settings jsonb not null default '{}',
  settings_updated_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.cards (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  lang public.target_lang not null,
  skill public.skill not null,
  item_id text not null,
  state smallint not null check (state between 0 and 3),
  due timestamptz not null,
  stability double precision not null,
  difficulty double precision not null,
  elapsed_days integer not null,
  scheduled_days integer not null,
  learning_steps integer not null,
  reps integer not null,
  lapses integer not null,
  last_review timestamptz,
  created_at timestamptz not null,
  primary key (user_id, lang, skill, item_id)
);

create index cards_due on public.cards (user_id, lang, due);

create table public.reviews (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  lang public.target_lang not null,
  skill public.skill not null,
  item_id text not null,
  grade smallint not null check (grade between 1 and 4),
  kind text not null,
  ms integer not null check (ms >= 0),
  reviewed_at timestamptz not null,
  day date not null,
  is_new boolean not null,
  unique (user_id, lang, skill, item_id, reviewed_at)
);

create index reviews_recent on public.reviews (user_id, reviewed_at desc);

create table public.daily_totals (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  lang public.target_lang not null,
  day date not null,
  reviews integer not null default 0,
  correct integer not null default 0,
  new_items integer not null default 0,
  ms bigint not null default 0,
  primary key (user_id, lang, day)
);

create table public.medals (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  lang public.target_lang not null,
  words integer not null check (words > 0),
  earned_at timestamptz not null,
  primary key (user_id, lang, words)
);

create table public.content_reports (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_key text not null,
  message text not null check (length(message) <= 2000),
  created_at timestamptz not null,
  unique (user_id, item_key, created_at)
);

alter table public.profiles enable row level security;
alter table public.cards enable row level security;
alter table public.reviews enable row level security;
alter table public.daily_totals enable row level security;
alter table public.medals enable row level security;
alter table public.content_reports enable row level security;

create policy "Own profile" on public.profiles for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Own cards" on public.cards for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Own reviews" on public.reviews for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Own daily totals" on public.daily_totals for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Own medals" on public.medals for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Own reports" on public.content_reports for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.cards to authenticated;
grant select, insert, delete on public.reviews to authenticated;
grant select, insert, update, delete on public.daily_totals to authenticated;
grant select, insert, update, delete on public.medals to authenticated;
grant select, insert on public.content_reports to authenticated;

create function public.count_review_day() returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  insert into public.daily_totals as d (user_id, lang, day, reviews, correct, new_items, ms)
  values (new.user_id, new.lang, new.day, 1, (new.grade > 1)::int, new.is_new::int, least(new.ms, 120000))
  on conflict (user_id, lang, day) do update set
    reviews = d.reviews + 1,
    correct = d.correct + excluded.correct,
    new_items = d.new_items + excluded.new_items,
    ms = d.ms + excluded.ms;
  return null;
end;
$$;

create trigger count_review_day
  after insert on public.reviews
  for each row execute function public.count_review_day();

create function public.save_progress(data jsonb) returns void
  language plpgsql
  set search_path = ''
as $$
begin
  insert into public.reviews (lang, skill, item_id, grade, kind, ms, reviewed_at, day, is_new)
  select r.lang, r.skill, r.item_id, r.grade, r.kind, r.ms, r.reviewed_at, r.day, r.is_new
  from jsonb_populate_recordset(null::public.reviews, coalesce(data -> 'reviews', '[]')) r
  order by r.reviewed_at
  on conflict do nothing;

  insert into public.cards as c (
    lang, skill, item_id, state, due, stability, difficulty, elapsed_days, scheduled_days,
    learning_steps, reps, lapses, last_review, created_at
  )
  select distinct on (r.lang, r.skill, r.item_id)
    r.lang, r.skill, r.item_id, r.state, r.due, r.stability, r.difficulty, r.elapsed_days, r.scheduled_days,
    r.learning_steps, r.reps, r.lapses, r.last_review, r.created_at
  from jsonb_populate_recordset(null::public.cards, coalesce(data -> 'cards', '[]')) r
  order by r.lang, r.skill, r.item_id, r.last_review desc nulls last, r.reps desc
  on conflict (user_id, lang, skill, item_id) do update set
    state = excluded.state,
    due = excluded.due,
    stability = excluded.stability,
    difficulty = excluded.difficulty,
    elapsed_days = excluded.elapsed_days,
    scheduled_days = excluded.scheduled_days,
    learning_steps = excluded.learning_steps,
    reps = excluded.reps,
    lapses = excluded.lapses,
    last_review = excluded.last_review,
    created_at = least(c.created_at, excluded.created_at)
  where c.last_review is null or excluded.last_review >= c.last_review;

  insert into public.daily_totals as d (lang, day, reviews, correct, new_items, ms)
  select r.lang, r.day, max(r.reviews), max(r.correct), max(r.new_items), max(r.ms)
  from jsonb_populate_recordset(null::public.daily_totals, coalesce(data -> 'days', '[]')) r
  group by r.lang, r.day
  on conflict (user_id, lang, day) do update set
    reviews = greatest(d.reviews, excluded.reviews),
    correct = greatest(d.correct, excluded.correct),
    new_items = greatest(d.new_items, excluded.new_items),
    ms = greatest(d.ms, excluded.ms);

  insert into public.medals as m (lang, words, earned_at)
  select r.lang, r.words, min(r.earned_at)
  from jsonb_populate_recordset(null::public.medals, coalesce(data -> 'medals', '[]')) r
  group by r.lang, r.words
  on conflict (user_id, lang, words) do update set earned_at = least(m.earned_at, excluded.earned_at);

  insert into public.content_reports (item_key, message, created_at)
  select r.item_key, r.message, r.created_at
  from jsonb_populate_recordset(null::public.content_reports, coalesce(data -> 'reports', '[]')) r
  on conflict do nothing;
end;
$$;

create function public.save_settings(settings jsonb, changed_at timestamptz default null) returns void
  language sql
  set search_path = ''
as $$
  insert into public.profiles as p (settings, settings_updated_at)
  values (settings, changed_at)
  on conflict (user_id) do update set
    settings = excluded.settings,
    settings_updated_at = excluded.settings_updated_at
  where excluded.settings_updated_at is not null
    and (p.settings_updated_at is null or excluded.settings_updated_at >= p.settings_updated_at);
$$;

create function public.reset_language(target public.target_lang, reset_at timestamptz) returns void
  language plpgsql
  set search_path = ''
as $$
begin
  delete from public.cards
  where user_id = (select auth.uid()) and lang = target and coalesce(last_review, created_at) < reset_at;
  delete from public.reviews
  where user_id = (select auth.uid()) and lang = target and reviewed_at < reset_at;
  delete from public.medals
  where user_id = (select auth.uid()) and lang = target and earned_at < reset_at;
  delete from public.daily_totals
  where user_id = (select auth.uid()) and lang = target;
  insert into public.daily_totals (lang, day, reviews, correct, new_items, ms)
  select lang, day, count(*), count(*) filter (where grade > 1), count(*) filter (where is_new), sum(least(ms, 120000))
  from public.reviews
  where user_id = (select auth.uid()) and lang = target
  group by lang, day;
end;
$$;

revoke execute on function public.count_review_day() from public, anon, authenticated;
revoke execute on function public.save_progress(jsonb) from public, anon;
revoke execute on function public.save_settings(jsonb, timestamptz) from public, anon;
revoke execute on function public.reset_language(public.target_lang, timestamptz) from public, anon;
grant execute on function public.save_progress(jsonb) to authenticated;
grant execute on function public.save_settings(jsonb, timestamptz) to authenticated;
grant execute on function public.reset_language(public.target_lang, timestamptz) to authenticated;
