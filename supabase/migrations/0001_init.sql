-- GapFinder AI — initial schema
-- Every user-owned table carries user_id and is protected by row-level security.

create extension if not exists vector;
create extension if not exists pgcrypto;

-- ---------- Documents ----------
create table public.documents (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title         text not null check (char_length(title) between 1 and 200),
  kind          text not null check (kind in ('syllabus','notes','textbook','past_paper')),
  file_name     text not null,
  mime_type     text not null,
  size_bytes    integer not null check (size_bytes > 0 and size_bytes <= 10485760),
  content_hash  text not null,
  status        text not null default 'processing' check (status in ('processing','ready','failed')),
  error         text,
  page_count    integer,
  is_demo       boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (user_id, content_hash)
);

-- ---------- Chunks (RAG) ----------
create table public.chunks (
  id            uuid primary key default gen_random_uuid(),
  document_id   uuid not null references public.documents(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade default auth.uid(),
  ordinal       integer not null,
  page          integer,
  section       text,
  content       text not null,
  embedding     vector(768),
  unique (document_id, ordinal)
);
create index chunks_user_idx on public.chunks(user_id);
create index chunks_embedding_idx on public.chunks using hnsw (embedding vector_cosine_ops);

-- ---------- Topics ----------
create table public.topics (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  parent_id   uuid references public.topics(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 160),
  description text,
  origin      text not null check (origin in ('syllabus','inferred','manual')),
  prerequisite_ids uuid[] not null default '{}',
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);
create index topics_user_idx on public.topics(user_id);

create table public.topic_sources (
  topic_id  uuid not null references public.topics(id) on delete cascade,
  chunk_id  uuid not null references public.chunks(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade default auth.uid(),
  primary key (topic_id, chunk_id)
);

-- ---------- Quiz ----------
create table public.quiz_sessions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade default auth.uid(),
  status          text not null default 'in_progress' check (status in ('in_progress','submitted')),
  topic_ids       uuid[] not null,
  idempotency_key text not null,
  created_at      timestamptz not null default now(),
  submitted_at    timestamptz,
  unique (user_id, idempotency_key)
);

create table public.questions (
  id                uuid primary key default gen_random_uuid(),
  session_id        uuid not null references public.quiz_sessions(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade default auth.uid(),
  topic_id          uuid not null references public.topics(id) on delete cascade,
  position          integer not null,
  type              text not null check (type in ('mcq','short')),
  difficulty        text not null check (difficulty in ('easy','medium','hard')),
  prompt            text not null,
  options           jsonb,
  correct_option    integer,
  expected_answer   text not null,
  evidence_chunk_id uuid not null references public.chunks(id) on delete cascade,
  evidence_quote    text not null,
  check ((type = 'mcq' and options is not null and correct_option is not null) or type = 'short')
);
create index questions_session_idx on public.questions(session_id);

create table public.answers (
  id            uuid primary key default gen_random_uuid(),
  question_id   uuid not null unique references public.questions(id) on delete cascade,
  session_id    uuid not null references public.quiz_sessions(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade default auth.uid(),
  response      text,
  selected_option integer,
  verdict       text not null check (verdict in ('correct','partial','incorrect','unanswered','ambiguous')),
  score         numeric(3,2) not null check (score between 0 and 1),
  method        text not null check (method in ('objective','ai_semantic','none')),
  feedback      text not null,
  missing_points jsonb not null default '[]',
  created_at    timestamptz not null default now()
);

-- ---------- Gap assessments (one snapshot per topic per submitted quiz = progress history) ----------
create table public.topic_assessments (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade default auth.uid(),
  topic_id      uuid not null references public.topics(id) on delete cascade,
  session_id    uuid not null references public.quiz_sessions(id) on delete cascade,
  status        text not null check (status in ('weak','developing','strong','insufficient')),
  mastery       numeric(4,3),
  answered      integer not null,
  correct       integer not null,
  partial       integer not null,
  incorrect     integer not null,
  unanswered    integer not null,
  reasons       jsonb not null default '[]',
  computed_at   timestamptz not null default now(),
  unique (topic_id, session_id)
);

-- ---------- Revision planning ----------
create table public.revision_plans (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade default auth.uid(),
  exam_date     date not null,
  daily_minutes integer not null check (daily_minutes between 15 and 600),
  status        text not null default 'active' check (status in ('active','archived')),
  based_on_session_id uuid references public.quiz_sessions(id) on delete set null,
  created_at    timestamptz not null default now()
);

create table public.revision_sessions (
  id              uuid primary key default gen_random_uuid(),
  plan_id         uuid not null references public.revision_plans(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade default auth.uid(),
  topic_id        uuid not null references public.topics(id) on delete cascade,
  scheduled_date  date not null,
  minutes         integer not null check (minutes > 0),
  objectives      jsonb not null default '[]',
  chunk_ids       uuid[] not null default '{}',
  priority_reason text not null,
  completed_at    timestamptz
);

-- ---------- Row-level security ----------
do $$
declare t text;
begin
  foreach t in array array['documents','chunks','topics','topic_sources','quiz_sessions','questions',
                           'answers','topic_assessments','revision_plans','revision_sessions']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%1$s_owner_select" on public.%1$I for select using (user_id = auth.uid())', t);
    execute format('create policy "%1$s_owner_insert" on public.%1$I for insert with check (user_id = auth.uid())', t);
    execute format('create policy "%1$s_owner_update" on public.%1$I for update using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format('create policy "%1$s_owner_delete" on public.%1$I for delete using (user_id = auth.uid())', t);
  end loop;
end $$;

-- ---------- Vector search (runs as the caller, so RLS still applies) ----------
create or replace function public.match_chunks(
  query_embedding vector(768),
  match_count int default 6,
  min_similarity float default 0.55,
  filter_document_ids uuid[] default null
)
returns table (id uuid, document_id uuid, content text, page int, section text, similarity float)
language sql stable security invoker
as $$
  select c.id, c.document_id, c.content, c.page, c.section,
         1 - (c.embedding <=> query_embedding) as similarity
  from public.chunks c
  where c.user_id = auth.uid()
    and c.embedding is not null
    and (filter_document_ids is null or c.document_id = any(filter_document_ids))
    and 1 - (c.embedding <=> query_embedding) >= min_similarity
  order by c.embedding <=> query_embedding
  limit least(match_count, 20);
$$;
