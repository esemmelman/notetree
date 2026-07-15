-- NoteTree's cloud data model. Apply this through the Supabase CLI once a
-- project has been created. No service-role credential belongs in the app.

create table public.pages (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid,
  title text not null default 'Untitled',
  content text not null default '',
  sort_order integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, id),
  constraint pages_parent_owner_fk
    foreign key (user_id, parent_id)
    references public.pages(user_id, id)
    on delete cascade
    deferrable initially deferred
);

create table public.page_links (
  user_id uuid not null references auth.users(id) on delete cascade,
  source_page_id uuid not null,
  target_page_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, source_page_id, target_page_id),
  constraint page_links_source_owner_fk
    foreign key (user_id, source_page_id)
    references public.pages(user_id, id)
    on delete cascade,
  constraint page_links_target_owner_fk
    foreign key (user_id, target_page_id)
    references public.pages(user_id, id)
    on delete cascade,
  constraint page_links_no_self_link check (source_page_id <> target_page_id)
);

create index pages_user_parent_idx on public.pages(user_id, parent_id);
create index pages_user_updated_idx on public.pages(user_id, updated_at);
create index page_links_target_idx on public.page_links(user_id, target_page_id);

alter table public.pages enable row level security;
alter table public.page_links enable row level security;

create policy "Users can read their own pages"
  on public.pages for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own pages"
  on public.pages for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own pages"
  on public.pages for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own pages"
  on public.pages for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can read their own page links"
  on public.page_links for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own page links"
  on public.page_links for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own page links"
  on public.page_links for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.pages from anon;
revoke all on public.page_links from anon;
grant select, insert, update, delete on public.pages to authenticated;
grant select, insert, delete on public.page_links to authenticated;
