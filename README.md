# Clockus

*Focus, without the noise.* Cronometru Pomodoro, ceas, listă de sarcini și statistici, într-o singură pagină.
Site: https://clockus.live

## Ce e în fiecare folder

| Folder | Ce conține | Se publică pe site? |
|---|---|---|
| `site/` | **Site-ul complet**, exact ce se urcă pe GitHub | ✅ Da, tot conținutul |
| `brand/` | Logo, iconițe, imaginea de partajare, regulile identității vizuale | ❌ Nu (sursă) |
| `backgrounds/` | Clipurile originale (4K) pentru fundalurile din Aesthetic mode; pe site merg doar versiunile comprimate din `site/backgrounds/` | ❌ Nu (sursă) |
| `docs/` | Cum publici, cum e construit codul, baza de date | ❌ Nu |
| `archive/` | Versiuni vechi și pachete zip, păstrate doar ca siguranță | ❌ Nu |

## Structura site-ului

```
site/
├── index.html              pagina de prezentare (clockus.live)
├── app.html                aplicația (clockus.live/app)
├── manifest.webmanifest    numele și iconițele pentru „Adaugă pe ecran”
├── favicon.svg, favicon.ico, apple-touch-icon.png, icon-192.png, icon-512.png
├── og-image.png            imaginea afișată când trimiți linkul
├── backgrounds/            fundalurile animate (.mp4) și imaginile lor de pornire (.jpg), comprimate
├── css/
│   ├── landing.css         stilul paginii de prezentare
│   └── app.css             stilul aplicației
└── js/
    ├── core/               unelte comune (salvare locală, elementele paginii)
    ├── features/           câte un fișier pentru fiecare funcție a aplicației
    ├── services/           conturi și sincronizare (Supabase)
    └── main.js             pornirea aplicației (se încarcă ultimul)
```

Iconițele și manifestul stau intenționat direct în `site/`: browserele și rețelele sociale le caută acolo.

## Documente utile

- [docs/PUBLICARE.md](docs/PUBLICARE.md): cum urci o versiune nouă pe clockus.live
- [docs/ARHITECTURA.md](docs/ARHITECTURA.md): cum e organizat codul și ce reguli trebuie respectate
- [docs/BAZA-DE-DATE.md](docs/BAZA-DE-DATE.md): ce tabele folosește aplicația în Supabase

## Probare locală

Deschide `site/app.html` cu dublu-click în browser. Totul funcționează, cu excepția autentificării Google: aceasta merge doar pe domeniul aprobat (clockus.live).
