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

Dacă vrei mai târziu ca ziua să fie o coloană adevărată în `tasks` (de exemplu, pentru notificări pe server),
se poate adăuga atunci, cu mutarea datelor din `data.plan`.

## De verificat în Supabase

1. **RLS este activat pe ambele tabele** și fiecare utilizator vede și modifică doar rândurile lui.
   Aplicația nu filtrează singură după utilizator. Se bazează în întregime pe aceste reguli.
2. **Cum e completat proprietarul în `tasks`** (de obicei o valoare implicită `auth.uid()`).
3. **Dacă `tasks.id` e unic pentru toți utilizatorii.** Dacă da, doi utilizatori care creează o sarcină
   în aceeași milisecundă intră în conflict. Același lucru se poate întâmpla și pentru un singur utilizator
   care adaugă două sarcini foarte repede.
