# Baza de date (Supabase)

> ⚠️ **Dedus din cod, NEVERIFICAT în Supabase.** Structura reală și regulile de securitate (RLS)
> există doar în panoul Supabase și trebuie confirmate acolo, apoi salvate aici ca fișiere SQL.

## Tabelul `tasks`: câte un rând pentru fiecare sarcină

| Coloană | Ce trimite aplicația |
|---|---|
| `id` | număr: momentul creării, în milisecunde (`Date.now()`) |
| `text` | textul sarcinii (max. 120 caractere) |
| `done` | adevărat / fals |
| `done_on` | data bifării, ca text (ex. „Fri Nov 13 2026”) sau gol |
| `due_date` | **nou, opțional:** ziua sarcinii (tip `date`, fără oră) sau gol. Se adaugă cu [sql/tasks-due-date.sql](sql/tasks-due-date.sql) |
| `note` | **nou, opțional:** notița sarcinii, text simplu, max. 2000 de caractere, sau gol. Se adaugă cu [sql/tasks-note.sql](sql/tasks-note.sql) |
| *(proprietarul)* | **nu e trimis de aplicație**, deci trebuie completat automat de baza de date |

Codul: `site/js/services/sync.js` (citire, salvare, ștergere).

## Tabelul `user_settings`: un rând pentru fiecare utilizator

| Coloană | Conținut |
|---|---|
| `user_id` | id-ul contului |
| `data` | JSON: `timer` (durate), `ui` (aspect), `order` (ordinea sarcinilor), `focus` (tot istoricul de focus), `plan` (ziua, ora și durata sarcinilor), `planV` (2 = salvat de o versiune cu „To do = azi”), `sessions` (sesiunile de focus), `goals` (obiectivele: minute de focus pe zi, sarcini pe zi, zilele active, `at` = momentul salvării; sau `{ off: true, at }` când sunt oprite) |

**Calendarul nu a cerut nicio schimbare în tabele.** Ziua, ora și durata sarcinilor stau în `data.plan`,
ca `{ "<id sarcină>": ["2026-11-13", "09:00", 30, <momentul schimbării>] }` (`planV: 3`; sarcinile fără zi
apar și ele, cu ziua goală). Sesiunile stau în `data.sessions`, ca listă de
`{ id, s: început, e: sfârșit (milisecunde), t: id-ul sarcinii, x: textul sarcinii }`.

## Cum se sincronizează dispozitivele (`site/js/services/sync.js`)

- **Sarcinile** (tabelul `tasks`): ce nu s-a putut trimite (offline) e ținut minte local (`dirtyUp`, `dirtyDel`)
  și retrimis la următoarea sincronizare, ca să nu fie înlocuit de copia mai veche din cloud.
- **`user_settings.data`** se salvează „citește, îmbină, scrie”: înainte de fiecare salvare, aplicația citește
  copia din cloud și o îmbină cu a ei, ca un dispozitiv să nu șteargă ce a salvat altul între timp.
  Timpul de focus și sesiunile se adună pe dispozitive; ziua fiecărei sarcini, aspectul (`ui.at`),
  duratele cronometrului (`timer.at`) și obiectivele (`goals.at`) păstrează schimbarea cea mai nouă.
- **Tab-urile aceluiași browser** își trimit schimbările prin evenimentul `storage`, fără cloud.
- **La deconectare**, dispozitivul trimite ultimele schimbări, apoi își șterge copia contului.
- Ordinea „cea mai nouă” se bazează pe ceasul dispozitivelor; un ceas dat mult înapoi poate pierde o schimbare.

### Coloana `tasks.due_date` (calendarul simplu)

- **De rulat o dată**, în Supabase › SQL Editor: [sql/tasks-due-date.sql](sql/tasks-due-date.sql)
  (`alter table public.tasks add column if not exists due_date date;`). Coloana e opțională (`null` = fără dată),
  deci sarcinile vechi rămân valabile și nu se pierde nimic.
- **Sarcinile vechi își primesc ziua singure:** la următoarea sincronizare, aplicația completează `due_date`
  din ziua pe care o știe deja (din `data.plan`) pentru fiecare sarcină unde coloana e goală sau diferită.
- **Până rulezi SQL-ul, aplicația merge la fel:** dacă Supabase răspunde că nu are coloana, rândurile se
  trimit fără ea, iar ziua circulă în continuare doar prin `data.plan`.
- `data.plan` rămâne sursa pentru „cea mai nouă schimbare câștigă” între dispozitive (are momentul schimbării);
  `due_date` e copia ei în tabel, utilă pentru interogări sau notificări pe server.

### Coloana `tasks.note` (notițele sarcinilor)

- **De rulat o dată**, în Supabase › SQL Editor: [sql/tasks-note.sql](sql/tasks-note.sql)
  (`alter table public.tasks add column if not exists note text;` plus limita de 2000 de caractere).
  Coloana e opțională (`null` = fără notiță), deci sarcinile vechi rămân valabile.
- **Până rulezi SQL-ul, aplicația merge la fel:** dacă Supabase răspunde că nu are coloana, rândurile se
  trimit fără ea, iar notițele rămân doar pe dispozitivul pe care au fost scrise (nu se pierd la sincronizare).
- **După ce rulezi SQL-ul**, notițele scrise între timp se trimit singure la următoarea sincronizare
  (aplicația ține minte care nu au ajuns în cloud, în cheia locală `noteUnsent`).

## De verificat în Supabase

1. **RLS este activat pe ambele tabele** și fiecare utilizator vede și modifică doar rândurile lui.
   Aplicația nu filtrează singură după utilizator. Se bazează în întregime pe aceste reguli.
2. **Cum e completat proprietarul în `tasks`** (de obicei o valoare implicită `auth.uid()`).
3. **Dacă `tasks.id` e unic pentru toți utilizatorii.** Dacă da, doi utilizatori care creează o sarcină
   în aceeași milisecundă intră în conflict. Același lucru se poate întâmpla și pentru un singur utilizator
   care adaugă două sarcini foarte repede.
