-- Clockus: calendarul simplu. Ziua sarcinii (fără oră), opțională.
-- De rulat o singură dată în Supabase › SQL Editor. Se poate rula din nou fără probleme.
-- Sarcinile existente primesc NULL (fără dată); aplicația completează singură ziua lor la următoarea sincronizare.

alter table public.tasks add column if not exists due_date date;
