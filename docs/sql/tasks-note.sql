-- Clockus: notițele sarcinilor. Text simplu, până la 2000 de caractere, opțional.
-- De rulat o singură dată în Supabase › SQL Editor. Se poate rula din nou fără probleme.
-- Sarcinile existente primesc NULL (fără notiță); notițele scrise înainte se trimit singure la următoarea sincronizare.

alter table public.tasks add column if not exists note text;

-- Limita de 2000 de caractere, verificată și de baza de date (aplicația o respectă deja)
do $$
begin
    if not exists (select 1 from pg_constraint where conname = 'tasks_note_length') then
        alter table public.tasks add constraint tasks_note_length check (note is null or char_length(note) <= 2000);
    end if;
end $$;
