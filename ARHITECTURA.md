# Arhitectura Clockus

## Pe scurt

- **Frontend:** HTML, CSS și JavaScript simplu, fără framework și fără pas de build.
- **Backend:** Supabase (bază de date + autentificare Google), apelat direct din browser.
- **Găzduire:** GitHub Pages, domeniul clockus.live.
- **Fonturi:** Google Fonts (Sora, JetBrains Mono, Inter, DM Sans).

## Cum se încarcă codul aplicației

`app.html` încarcă fișierele JavaScript **unul după altul, într-o ordine fixă**. Toate împart aceleași
variabile globale (de exemplu `tasks`, `running`, `ui`, `user`).

**Ordinea contează:** un fișier poate folosi la pornire doar ce a fost încărcat înaintea lui.
Fișierele adăugate pe viitor se trec în `app.html` la locul potrivit.

| # | Fișier | Rol |
|---|---|---|
| 1 | `js/core/helpers.js` | `$()`, `store` (salvare în localStorage), `clamp`, `today` |
| 2 | `js/core/dom.js` | elementele paginii folosite de mai multe funcții |
| 3 | `js/features/navigation.js` | tab-urile Clock / Focus / To do / Calendar / Stats / Settings și animațiile |
| 4 | `js/features/appearance.js` | temă (Dark, Light, System, Graphite, Paper), fundal, fonturi, grosimi, accent, animații |
| 5 | `js/features/clock.js` | ceasul (aplică și aspectul salvat la pornire) |
| 6 | `js/features/timer.js` | cronometrul Pomodoro și duratele personalizate |
| 7 | `js/features/focus-log.js` | contorizarea timpului de focus, jurnalul sesiunilor de focus, restaurarea cronometrului |
| 8 | `js/features/stats.js` | statistici, serie de zile, grafic, harta anului |
| 9 | `js/features/tasks.js` | lista de sarcini (inclusiv ziua fiecărei sarcini) |
| 10 | `js/features/task-reorder.js` | reordonarea sarcinilor prin tragere |
| 11 | `js/features/calendar.js` | tab-ul Calendar: luna, ziua selectată, planificatorul pe săptămână, export .ics |
| 12 | `js/features/date-picker.js` | fereastra „când”: alegerea zilei, orei și duratei (folosită în To do și Calendar) |
| 13 | `js/features/goals.js` | obiective zilnice și săptămânale: secțiunea din Stats, editorul, linia de sub cronometru, punctele din Calendar |
| 14 | `js/features/settings.js` | tab-ul Settings: categoriile, vederea de telefon, exportul și resetarea datelor |
| 15 | `js/features/clean-mode.js` | modul „clean” (tasta F) |
| 16 | `js/features/shortcuts.js` | scurtăturile de tastatură |
| 17 | `js/services/sync.js` | sincronizarea cu Supabase |
| 18 | `js/services/auth.js` | login Google / logout |
| 19 | `js/main.js` | pornirea aplicației (**întotdeauna ultimul**) |

`tasks.js` folosește câteva funcții din `calendar.js` (de ex. `dueLabel`, `planTask`, `refreshCalendar`).
Merge, pentru că le apelează doar după pornire, nu în timp ce fișierele se încarcă.

### Calendarul pe scurt

- **To do este lista de azi:** arată sarcinile cu ziua de azi plus cele nefăcute din zilele trecute (marcate
  „Late”). Ce adaugi în To do primește automat ziua de azi. Sarcinile pentru alte zile și cele fără zi
  („Not scheduled”) se văd doar în Calendar și apar singure în To do în ziua lor.
- La prima pornire după acest update, sarcinile deschise fără zi primesc ziua de azi (o singură dată, cheia
  `todoIsToday`), ca să nu dispară din To do. La fel și cele venite din cloud de la o versiune mai veche
  (cele salvate fără `planV: 2` în `user_settings.data`).
- O sarcină poate avea o zi și, opțional, o oră și o durată: `date` („2026-11-13”), `time` („09:00”), `dur` (minute).
- Sarcinile bifate **care au o zi** nu mai sunt șterse a doua zi: rămân ascunse în To do, ca să apară în
  calendar ca făcute, și sunt șterse după un an. Cele fără zi dispar a doua zi, ca înainte.
- Fiecare sesiune de focus se salvează singură (început, sfârșit, sarcina curentă). O pauză mai scurtă de
  2 minute continuă aceeași sesiune. Se păstrează ultimele 120 de zile.

Pe lângă acestea, două scripturi mici rămân direct în `app.html`, intenționat:
- primul aplică tema și fontul **înainte** de afișare, ca să nu apară o pâlpâire;
- al doilea afișează erorile în setări, lângă numărul versiunii.

## Ce NU trebuie schimbat fără grijă

- **Numele cheilor din localStorage:** `ui`, `settings`, `tasks`, `focus`, `timer`, `deviceId`,
  `currentTask`, `bestStreak`, `synced:<id>`, `sessions`, `calView`, `todoIsToday`, `goals`, `goalsOffAt`, `dirtyUp`, `dirtyDel`, `bgPhoto` (fotografia de fundal, doar pe dispozitivul respectiv). Dacă se schimbă, utilizatorii își pierd datele locale.
- **Numele tabelelor și coloanelor din Supabase** (vezi [BAZA-DE-DATE.md](BAZA-DE-DATE.md)).
- **Ruta `/app`, redirecționarea după login din `index.html`, fișierul `CNAME` de pe GitHub.**
- **Locul iconițelor și al manifestului**, direct în `site/`.

## Pasul următor posibil

Când adăugăm abonamentele, merită trecut la **module JavaScript** plus un instrument de build (Vite).
Așa fiecare fișier își declară singur de ce are nevoie, în loc să depindă de ordinea din `app.html`.
