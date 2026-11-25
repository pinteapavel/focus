-- Clockus: the "Send feedback" box (landing page footer, 404 page, Settings › Help)
-- Run this once in Supabase › SQL Editor.
--
-- Anyone may ADD a message (signed in or not). Nobody can read, change or delete messages from the page:
-- there is no select / update / delete policy, so Row Level Security refuses them.
-- You read the messages in Supabase › Table Editor › feedback (the dashboard is not limited by these rules).
-- No service key is used in the page.

create table if not exists public.feedback (
    id          bigint generated always as identity primary key,
    created_at  timestamptz not null default now(),
    type        text not null check (type in ('bug', 'idea', 'other')),
    message     text not null check (char_length(btrim(message)) between 1 and 1000),
    email       text check (email is null or char_length(email) <= 254),
    user_id     uuid,   -- optional: filled only when a signed in person sends from the app
    page        text check (page is null or char_length(page) <= 200)   -- where it was sent from, e.g. /app or a broken link
);

alter table public.feedback enable row level security;

-- Insert only. A signed in person may attach only their own id; everyone else sends without one.
drop policy if exists "feedback: anyone can add" on public.feedback;
create policy "feedback: anyone can add"
    on public.feedback
    for insert
    to anon, authenticated
    with check (user_id is null or user_id = auth.uid());

-- Only adding is allowed from the page
revoke all on public.feedback from anon, authenticated;
grant insert (type, message, email, user_id, page) on public.feedback to anon, authenticated;
