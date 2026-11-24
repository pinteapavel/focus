# Cum publici Clockus pe clockus.live

Site-ul e găzduit pe **GitHub Pages**. Ce se urcă este **conținutul folderului `site/`**, nu folderul însuși.

## Pași

1. Intră în repository-ul de pe GitHub → **Add file** → **Upload files**.
2. Deschide folderul `site/` pe calculator și selectează **tot ce e în el**:
   fișierele și cele trei foldere: `css`, `js` și `backgrounds`.
   Fără `backgrounds`, fundalurile animate nu merg pe site.
3. Trage-le în fereastra GitHub. Folderele se păstrează (merge în Chrome și Edge).
   Fișierele cu același nume se înlocuiesc singure.
4. Apasă **Commit changes**.
5. Așteaptă ~1 minut, apoi deschide clockus.live/app cu **Ctrl+Shift+R**.

**Verificare:** în setări (piulița), jos, trebuie să scrie versiunea nouă (acum: **Version 33**).

## ⚠️ Reguli

- **NU șterge și NU modifica fișierul `CNAME` de pe GitHub.** El ține domeniul clockus.live.
- La fiecare versiune nouă, mărește numărul `?v=33` din `app.html` (sau `?v=5` din `index.html`)
  și textul `Version 33`. Altfel unii utilizatori rămân cu fișierele vechi din memoria browserului.

## Prima publicare după reorganizare (versiunea 21)

Pe GitHub rămân atunci, în rădăcină, trei fișiere vechi care nu mai sunt folosite:
`script.js`, `styles.css`, `welcome.css`. Codul și stilurile lor sunt acum în `js/` și `css/`.

După ce ai verificat că apare **Version 21** și că totul merge, le poți șterge de pe GitHub.
Dacă rămân, nu strică nimic. Dacă există și un `CITESTE-MA.txt` urcat anterior, și acela poate fi șters.

## Imaginea de partajare

`og-image.png` este ținută în memorie de WhatsApp, Facebook etc. După ce o schimbi,
previzualizarea veche poate rămâne o vreme.
