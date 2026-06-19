# EmiFotoOttica — sito web

Sito vetrina di **EmiFotoOttica** (Via Francesco Merlini 23/25, Roma).
Sito **statico**: solo HTML, CSS e JavaScript lato browser. Nessun backend, nessun database, nessuna chiave API.

## Pagine

| File            | Pagina                                            |
|-----------------|---------------------------------------------------|
| `index.html`    | Home                                              |
| `occhiali.html` | Occhiali + virtual try-on (face-api.js via CDN)   |
| `foto.html`     | Servizi fotografici                               |
| `gadget.html`   | Gadget / stampe                                   |
| `contatti.html` | Contatti + mappa + form                           |
| `style.css`     | Stili globali                                     |
| `robots.txt`    | Indicizzazione                                    |
| `sitemap.xml`   | Mappa del sito                                    |

## Sicurezza / segreti

Questo repo **non contiene chiavi né credenziali**: il sito non chiama nessuna API privata,
non gestisce pagamenti né login. Quindi **non serve mettere nulla su Railway** per sicurezza.
Il `.gitignore` esclude comunque `.env` e simili, così se in futuro aggiungi un backend
i segreti restano fuori dal repo.

## Da completare prima della messa online

- **Form contatti (`contatti.html`)**: l'`action` del form punta ancora al placeholder
  `https://formspree.io/f/YOUR_FORM_ID`. Sostituisci `YOUR_FORM_ID` con l'ID reale del tuo
  account Formspree, altrimenti il form non invia. L'ID Formspree è pubblico (sta nell'HTML
  per design): va committato qui, **non** su Railway.
- **`sitemap.xml`**: aggiorna `lastmod` quando modifichi le pagine.

## Deploy

Essendo statico puoi servirlo da qualsiasi host di file statici:

- **Cloudflare Pages / GitHub Pages / Netlify**: collega il repo, build command vuoto,
  output directory = root. Pronto.
- **Railway** (se preferisci restare lì): aggiungi un piccolo server statico, es.
  `package.json` con `{"scripts":{"start":"npx serve -s . -l $PORT"}}` e Railway serve la cartella.

> Nota: la pagina occhiali è stata ripulita dall'offuscamento email di Cloudflare
> (`__cf_email__` / `/cdn-cgi/...`), che funzionava solo dietro Cloudflare. Ora l'indirizzo
> `info@emifotoottica.it` è in chiaro e funziona ovunque.
