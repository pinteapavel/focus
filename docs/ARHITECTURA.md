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
| 3 | `js/features/navigation.js` | tab-urile Home / To do / Calendar / Stats / Settings și animațiile (Focus a devenit widgetul cronometrului) |
| 4 | `js/features/appearance.js` | teme (Classic: Animated, Dark, Light, Graphite, Paper — System a ieșit, cine îl avea salvat trece pe Dark; Colors: Blush, Vanilla, Olive, Forest, Deep Sea, culorile fiecărei teme o singură dată în `--th-*` din app.css; „wine” și „electric-blue” salvate sunt mutate pe `blush` și `deep-sea` prin `migrateTheme()`, folosit și de sync.js; fundalul vine doar din temă, `ui.bg` e păstrat și sincronizat, dar nu mai e folosit), fonturi, grosimi, accent, animații; Glow (`ui.glow`: off / soft / strong, implicit strong): lumina în culoarea accentului jos pe Home și Focus, doar cu Dark, Light, Graphite și Paper; la celelalte teme rândul e estompat și dezactivat, alegerea se păstrează (`data-glow` pe `<html>`, stratul `.glow-bg`) |
| 5 | `js/features/clock.js` | ceasul și data de pe Home (aplică și aspectul salvat la pornire) |
| 6 | `js/features/timer.js` | cronometrul Pomodoro: focus, pauză scurtă și lungă (după 4 sesiuni), pornirea automată a pauzelor, duratele |
| 7 | `js/features/focus-log.js` | contorizarea timpului de focus, jurnalul sesiunilor de focus, restaurarea cronometrului |
| 8 | `js/features/stats.js` | statistici, serie de zile, grafic, harta anului |
| 9 | `js/features/tasks.js` | lista de sarcini (inclusiv ziua fiecărei sarcini) |
| 10 | `js/features/task-reorder.js` | reordonarea sarcinilor prin tragere |
| 11 | `js/features/calendar.js` | tab-ul Calendar, varianta simplă: luna și panoul zilei selectate (sarcinile zilei, întârziate, „Pick from your To do list”, o linie cu timpul de focus) |
| 12 | `js/features/date-picker.js` | fereastra de dată din To do: alegerea zilei (fără oră), sau „No date” |
| 12b | `js/features/calendar-list.js` | vederea List („Upcoming”) a Calendarului: sarcinile grupate pe date (Overdue, Today, Tomorrow, apoi fiecare zi cu sarcini), „Show done” și caseta care citește ziua din cuvinte („Email Ana friday”) |
| 12c | `js/features/calendar-move.js` | mutarea sarcinilor pe altă zi: tragerea de mâner (pe o zi din lună sau pe un grup din listă), foaia „Move to…” (Today, Tomorrow, Pick a date) și toast-ul cu Undo; `moveTasks()` |
| 13 | `js/features/goals.js` | obiective zilnice și săptămânale: secțiunea din Stats, editorul, linia de sub cronometru |
| 14 | `js/features/settings.js` | tab-ul Settings: categoriile, vederea de telefon, exportul și resetarea datelor |
| 14b | `js/features/reminders.js` | memento-ul pentru sarcina prioritară: cardul din stânga sus, sunetul scurt și Settings › Notifications; apare doar cât e deschis un tab Clockus; opțiunile sunt doar pe dispozitiv (cheile `reminders`, `reminderLast`) |
| 14b2 | `js/features/coming-up.js` | notificarea „Coming up” (dimineața: sarcinile de azi; seara: cele de mâine; întârziate), în același loc și cu același inel ca memento-ul prioritar, niciodată amândouă deodată; așteaptă cât rulează o sesiune de focus; setările din Settings › Notifications sunt doar pe dispozitiv (cheile `comingUp`, `comingUpLast`) |
| 14c | `js/features/timer-alerts.js` | Timer alerts: titlul și iconița tabului pe fiecare stare, finalul de sesiune (sunetul, titlul care clipește până revii în tab, cardul „Session 2 complete” din widget, notificarea opțională a browserului) și secțiunea din Settings; opțiunile sunt doar pe dispozitiv (cheia `timerAlerts`). Folosește `playChime()` din `reminders.js`; `timer.js` îl apelează prin `renderTabTitle()` și `onSessionEnd()` |
| 15 | `js/features/clean-mode.js` | modul „clean” (tasta F): ascunde bara și foile, păstrează widgetul |
| 15b | `js/features/aesthetic-mode.js` | aspectul principal: fundalul animat din spatele tuturor tab-urilor, widgetul cronometrului stânga jos și panoul lui cu setările de timp, „Center: Clock / Timer” pe Home, ascunderea după 5 s de inactivitate pe Home; opțiunile lui sunt doar pe dispozitiv (cheia `aesthetic`) |
| 15b2 | `js/features/animated-theme.js` | tema Animated (`ui.theme = 'animated'`): video-ul ales în spatele întregului site, sub un strat întunecat, cu culorile din Dark; rândul „Animated background” din Settings › Appearance (estompat cu altă temă; o atingere alege fundalul și trece pe Animated). Fundalul ales e același cu al Aesthetic mode (`aesthetic.scene`). Cu Animations oprit sau cu economisire de date: imagine fixă. Video-ul se oprește cât tabul e ascuns și cât e deschis Aesthetic mode. Butonul „Aesthetic mode” de pe Focus (și tasta A) merge doar cu tema Animated; dacă tema se schimbă cât Aesthetic mode e deschis, se trece în Clean mode. Selectorul de fundaluri e doar în Appearance, sub teme: rândul Animated background (5 fundaluri + cardul dezactivat „Coming soon”) și rândul Christmas Specials (6 carduri, lista `AES_XMAS` din aesthetic-mode.js). Un fundal de Crăciun e dezactivat până îi pui `backgrounds/<nume>.mp4` și `.jpg` în site/ și numele în `AES_XMAS_READY`. `applyUi()`, `renderAestheticSettings()` și `setAesthetic()` îl anunță prin `syncThemeBg()` |
| 15c | `js/features/goal-reached.js` | animația „Goal reached” (fără confetti): lumina care trece o dată pe bara Today, eticheta „goal reached ✓” și strălucirea care se stinge; același efect pe panoul săptămânii din Goals („Week goal reached ✓”) și un halou în jurul widgetului din Aesthetic mode. O singură dată pe obiectiv (cheia `goalAnimSeen`), doar când obiectivul e trecut în timpul unei sesiuni; setările din Settings › Notifications sunt doar pe dispozitiv (cheia `goalAnim`). `goals.js` și `aesthetic-mode.js` îl apelează prin `goalFxCheck()`, `goalFxWeek()` și `goalFxWidgetLabel()` |
| 15c2 | `js/features/home.js` | tab-ul Home (fost Clock; în cod tot `'clock'`): data sub ceas, capsula „Up next” (prioritatea de top, apoi prima sarcină de azi, apoi prima deschisă; Start cu sarcina aleasă și durata 25/50/60/custom, salvată în `settings.focus`; „Focusing now” cât rulează cronometrul; „No task yet”; „All done for today”) și chip-urile (obiectiv, serie, sarcini rămase, următoarea sarcină cu dată). Doar citește datele din To do, Calendar, Goals și Stats. Fundalul video apare pe Home doar cu tema Animated (atunci Home folosește video-ul site-ului și adaugă suprafețele de sticlă); la orice altă temă, Home are culoarea temei. Câmpul `home` din cheia `aesthetic` (scris prin `homeRememberLook()`) nu mai decide nimic. `showTab()` îl anunță prin `onHomeTab()` |
| 15d | `js/features/task-notes.js` | notițele sarcinilor și căutarea din To do: câmpul de căutare (titluri și notițe, cu potrivirile evidențiate, `/` îl selectează, Enter deschide primul rezultat), filtrele All / Open / Done / With notes, linia de notiță sub sarcini, panoul lateral cu notița (pe telefon, pe tot ecranul), insigna și notița de sub cronometru în Focus și panoul de sticlă din Aesthetic mode. Salvare automată după o secundă. `tasks.js` îl apelează prin `filterTodo()`, `fillMatch()`, `noteLineEl()`, `afterTodoFilter()` |
| 16 | `js/features/shortcuts.js` | scurtăturile de tastatură |
| 17 | `js/services/sync.js` | sincronizarea cu Supabase |
| 18 | `js/services/auth.js` | login Google / logout |
| 19 | `js/main.js` | pornirea aplicației (**întotdeauna ultimul**) |

`tasks.js` folosește câteva funcții din `calendar.js` (de ex. `dueLabel`, `planTask`, `refreshCalendar`).
Merge, pentru că le apelează doar după pornire, nu în timp ce fișierele se încarcă.

### Calendarul pe scurt

- **O listă, două vederi:** To do arată toate sarcinile, fiecare cu un chip de dată („Today”, „Fri 20”)
  sau „+ Set date”. O dată pune sarcina și în Calendar; bifată oriunde, e bifată peste tot. Ce adaugi în
  To do nu are dată până nu îi pui una. Ce adaugi dintr-o zi a calendarului primește ziua aceea.
- **Doar date, fără ore:** o sarcină are cel mult o zi, `date` („2026-11-13”). Ora și durata (`time`, `dur`)
  puse de versiunile vechi sunt păstrate și sincronizate, dar nu mai sunt afișate.
- Calendarul are doar luna și ziua selectată. Pe ziua de azi apar și sarcinile întârziate, cu „Move to today”.
- Cheia `todoIsToday` (o singură dată, la versiunea cu „To do = azi”) și regula pentru datele din cloud
  fără `planV: 2` au rămas, ca datele vechi să fie citite la fel.
- Sarcinile bifate **care au o zi** nu mai sunt șterse a doua zi: rămân ascunse în To do, ca să apară în
  calendar ca făcute, și sunt șterse după un an. Cele fără zi dispar a doua zi, ca înainte.
- **La sfârșitul zilei, și sarcinile nebifate fără zi sunt șterse.** Cele nebifate cu o zi rămân în To do,
  cu chipul zilei („Yesterday”, „Fri 20”) și în Calendar la „Move to today”. O sarcină contează din ziua în care
  a fost adăugată sau și-a pierdut ziua (`pAt`). Cheia `todoDailySince` ține momentul în care regula a apărut
  pe dispozitiv: sarcinile care erau deja în listă atunci au primit o zi în plus, ca să nu dispară imediat.
- Fiecare sesiune de focus se salvează singură (început, sfârșit, sarcina curentă). O pauză mai scurtă de
  2 minute continuă aceeași sesiune. Se păstrează ultimele 120 de zile.

Pe lângă acestea, două scripturi mici rămân direct în `app.html`, intenționat:
- primul aplică tema și fontul **înainte** de afișare, ca să nu apară o pâlpâire;
- al doilea afișează erorile în setări, lângă numărul versiunii.

## Ce NU trebuie schimbat fără grijă

- **Numele cheilor din localStorage:** `ui`, `settings`, `tasks`, `focus`, `timer`, `deviceId`,
  `currentTask`, `bestStreak`, `synced:<id>`, `sessions`, `calView`, `todoIsToday`, `goals`, `goalsOffAt`, `dirtyUp`, `dirtyDel`, `bgPhoto` (fotografia de fundal de dinainte, doar pe dispozitivul respectiv; nu mai e folosită, dar nu se șterge), `aesthetic` (opțiunile widgetului și ale fundalului animat, doar pe dispozitiv; fundalul ales e în `ui.bg`), `reminders` și `reminderLast` (memento-ul, doar pe dispozitiv), `timerAlerts` (Timer alerts, doar pe dispozitiv), `todoDailySince` (vezi mai sus), `calView` (Month sau List, ultima vedere folosită), `calShowDone` („Show done” din List), `comingUp` și `comingUpLast` („Coming up”, doar pe dispozitiv), `goalAnim` și `goalAnimSeen` („Goal reached”, doar pe dispozitiv), `noteOpen` (notița deschisă sau nu în Focus, doar pe dispozitiv), `noteUnsent` (notițe trimise cât încă nu exista coloana `note`). Dacă se schimbă, utilizatorii își pierd datele locale.
- **Numele tabelelor și coloanelor din Supabase** (vezi [BAZA-DE-DATE.md](BAZA-DE-DATE.md)).
- **Ruta `/app`, redirecționarea după login din `index.html`, fișierul `CNAME` de pe GitHub.**
- **Locul iconițelor și al manifestului**, direct în `site/`.

## Pasul următor posibil

Când adăugăm abonamentele, merită trecut la **module JavaScript** plus un instrument de build (Vite).
Așa fiecare fișier își declară singur de ce are nevoie, în loc să depindă de ordinea din `app.html`.
