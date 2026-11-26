# Scheda Chrome Web Store — Tab by Host

Testi e risorse pronti da incollare nella Developer Dashboard.
Tutte le immagini sono in questa cartella e rispettano le specifiche ufficiali.

---

## Dettagli del prodotto

**Nome** (max 75 caratteri)

```
Tab by Host
```

**Descrizione breve** — campo `description` del manifest, max 132 caratteri.
Già presente in `_locales/*/messages.json`, non va reinserita a mano.

- EN (109): `Groups tabs into Chrome tab groups based on the site host, using rules you define.`
- IT (111): `Raggruppa le schede nei gruppi di Chrome in base all'host del sito, con regole che definisci tu.`

**Categoria:** Strumenti (Workflow & Planning)
**Lingua principale:** Inglese · con italiano come lingua aggiuntiva

---

## Descrizione dettagliata — Inglese

```
Tab by Host puts your tabs into Chrome tab groups automatically, based on the host of the site you are on.

You define the rules: a host, a group name, a colour. When you open a tab on that host, it joins the right group. When you navigate elsewhere, it moves or leaves the group. No manual sorting.

WHAT IT IS FOR

If you work with the same application across several environments — production, staging, local — tabs look identical and are easy to mix up. Tab by Host separates them visually, with a name and a colour you choose.

It also works for keeping documentation, internal tools, dashboards or clients apart.

HOW RULES WORK

• A rule matches an exact host, such as app.example.com
• Optionally include subdomains as well
• A port can be specified: localhost:3000 matches only that port
• IP addresses, intranet hosts, IPv6 and international domain names are supported
• You can paste a full URL: only the host and any explicit port are kept
• When several rules match, the first active one from the top wins
• Rules sharing the same name and colour end up in the same group

Paths, query strings and page titles are never used for matching.

FEATURES

• Handles tabs that are already open, new tabs and address changes
• Creates independent groups in every window, never moves tabs across windows
• Pause button: keeps current groups, suspends further updates
• "Apply now" runs the rules once even while paused
• "Check an address" shows which rule matches, without opening a tab
• Reorder, suspend, edit or delete rules at any time
• Export and import your rules as JSON
• Interface in English and Italian
• Pinned tabs, app windows and internal Chrome pages are excluded
• Incognito windows are excluded

PRIVACY

Tab by Host runs entirely in your browser. No server, no account, no telemetry, no remote libraries, no third-party code.

It does not run scripts in pages and cannot read passwords, cookies, forms or site content. Tab addresses are not stored: the host is extracted, compared with your rules, then discarded.

Your rules stay in your Chrome profile on this computer and are not synced between devices.

The source code is public and the privacy guarantees are verified automatically on every change: a check fails if network calls, cloud sync or third-party dependencies ever appear.

OPEN SOURCE

MIT licensed. Source code, issue tracker and full privacy policy:
https://github.com/alesiestu/tab-by-host
```

---

## Descrizione dettagliata — Italiano

```
Tab by Host mette le schede nei gruppi di Chrome automaticamente, in base all'host del sito che stai visitando.

Le regole le definisci tu: un host, un nome del gruppo, un colore. Quando apri una scheda su quell'host, entra nel gruppo giusto. Quando navighi altrove, cambia gruppo o ne esce. Senza ordinare nulla a mano.

A COSA SERVE

Se lavori sulla stessa applicazione in piu ambienti — produzione, staging, locale — le schede sembrano identiche ed e facile confonderle. Tab by Host le separa visivamente, con un nome e un colore scelti da te.

Funziona anche per tenere distinti documentazione, strumenti interni, dashboard o clienti diversi.

COME FUNZIONANO LE REGOLE

• Una regola corrisponde a un host esatto, per esempio app.example.com
• Puoi includere anche i sottodomini
• Si puo indicare una porta: localhost:3000 corrisponde solo a quella porta
• Sono supportati indirizzi IP, host intranet, IPv6 e nomi internazionali
• Puoi incollare un URL completo: vengono conservati solo host e porta esplicita
• Se piu regole corrispondono, vince la prima attiva dall'alto
• Le regole con lo stesso nome e colore finiscono nello stesso gruppo

Percorsi, query string e titolo della pagina non sono mai usati per la corrispondenza.

FUNZIONALITA

• Gestisce le schede gia aperte, quelle nuove e i cambi di indirizzo
• Crea gruppi indipendenti in ogni finestra, non sposta schede tra finestre
• Pulsante di pausa: lascia i gruppi attuali e sospende gli aggiornamenti
• "Applica ora" esegue le regole una volta anche con l'automazione sospesa
• "Controlla un indirizzo" mostra quale regola corrisponde, senza aprire una scheda
• Riordina, sospendi, modifica o elimina le regole quando vuoi
• Esporta e importa le regole in formato JSON
• Interfaccia in inglese e italiano
• Schede fissate, finestre delle app e pagine interne di Chrome sono escluse
• Le finestre in incognito sono escluse

PRIVACY

Tab by Host funziona interamente nel browser. Nessun server, account, telemetria, libreria remota o codice di terze parti.

Non esegue script nelle pagine e non puo leggere password, cookie, moduli o contenuti dei siti. Gli indirizzi delle schede non vengono memorizzati: viene estratto l'host, confrontato con le regole e scartato.

Le regole restano nel profilo di Chrome su questo computer e non vengono sincronizzate tra dispositivi.

Il codice sorgente e pubblico e le garanzie di privacy sono verificate automaticamente a ogni modifica: un controllo fallisce se compaiono chiamate di rete, sincronizzazione cloud o dipendenze di terze parti.

OPEN SOURCE

Licenza MIT. Codice sorgente, segnalazioni e informativa completa:
https://github.com/alesiestu/tab-by-host
```

---

## Risorse grafiche

| Campo nella dashboard | File | Dimensioni |
| --- | --- | --- |
| Icona dello store | `icon-128.png` | 128 × 128, artwork 96 × 96 con padding trasparente |
| Screenshot 1 | `screenshot-1-rules.png` | 1280 × 800 |
| Screenshot 2 | `screenshot-2-editor.png` | 1280 × 800 |
| Screenshot 3 | `screenshot-3-popup.png` | 1280 × 800 |
| Screenshot 4 (italiano) | `screenshot-4-italiano.png` | 1280 × 800 |
| Riquadro promozionale piccolo | `promo-440x280.png` | 440 × 280 |
| Riquadro cornice intermittente | `promo-1400x560.png` | 1400 × 560 |

Lo screenshot 4 è in italiano: puoi caricarlo nella scheda localizzata italiana
oppure lasciarlo nella lista principale per mostrare il supporto multilingua.

---

## Campi aggiuntivi

| Campo | Valore |
| --- | --- |
| URL home page | `https://github.com/alesiestu/tab-by-host` |
| **URL assistenza** | `https://www.iannaconealessandro.it/contatti/` |
| **URL norme sulla privacy** | `https://alesiestu.github.io/tab-by-host/privacy.html` |
| Classificazione contenuti | Adatto a tutti, nessun contenuto sensibile |

---

## Pratiche sulla privacy

**Scopo unico** (campo obbligatorio):

```
Tab by Host reads the host of each open tab in order to place that tab into a
Chrome tab group according to rules defined by the user. This is its only purpose.
```

**Giustificazione dei permessi** — da incollare nei rispettivi campi:

| Permesso | Giustificazione |
| --- | --- |
| `tabs` | Required to read the address of each tab in order to extract its host and decide which tab group it belongs to. Only the host is used; the URL is discarded immediately and never stored. |
| `tabGroups` | Required to create tab groups and set their name and colour, which is the core function of the extension. |
| `storage` | Required to store the grouping rules defined by the user in the local Chrome profile, and to keep the tab-to-group mapping across service worker restarts. |
| `alarms` | Required to retry grouping operations that Chrome temporarily refuses, for example while the user is dragging a tab or while a session is being restored. |
| Codice remoto | **No**, l'estensione non usa codice remoto. Tutto il codice è nel pacchetto. |

**Certificazione sull'uso dei dati** — spunta tutte e tre le dichiarazioni:

- Non vendo né trasferisco i dati utente a terze parti, al di fuori dei casi d'uso approvati
- Non utilizzo né trasferisco i dati utente per scopi non correlati alla funzionalità principale
- Non utilizzo né trasferisco i dati utente per determinare la solvibilità o per concedere prestiti

**Tipi di dati raccolti:** nessuno. L'estensione non raccoglie né trasmette alcun dato.

---

## Nota sulla revisione

Il permesso `tabs` richiede in genere una revisione più attenta. Gioca a favore:

- nessun `host_permissions`
- nessun `content_scripts`
- CSP con `connect-src 'none'`, che blocca ogni richiesta in uscita
- zero dipendenze di runtime
- codice sorgente pubblico e verificabile
