# Informativa sulla privacy

**Tab by Host** funziona interamente nel browser. Non raccoglie, non trasmette e non vende alcun dato.

Ultimo aggiornamento: 26 novembre 2026 · Versione estensione: 1.0.0

## In breve

| Domanda | Risposta |
| --- | --- |
| I dati lasciano il dispositivo? | No. Nessuna connessione di rete |
| Serve un account? | No |
| C'è telemetria o analytics? | No |
| I dati sono sincronizzati sul cloud? | No. Solo `storage.local`, mai `storage.sync` |
| Vengono letti i contenuti delle pagine? | No. Nessun content script |
| Chi può vedere i dati? | Solo tu, nel profilo Chrome di questo computer |

## Dati trattati

L'estensione tratta due insiemi di dati, entrambi locali.

### 1. Le regole che configuri — `chrome.storage.local`

Persistono finché non le elimini o non disinstalli l'estensione.

| Campo | Contenuto |
| --- | --- |
| `host` | L'host che hai inserito, es. `staging.example.com` |
| `group` | Il nome del gruppo scelto da te |
| `color` | Il colore scelto da te |
| `includeSubdomains`, `enabled` | Due interruttori |
| `id` | Identificativo casuale della regola |

Sono esattamente i dati che hai digitato tu. Nessun altro campo viene aggiunto.

### 2. Stato operativo — `chrome.storage.session`

Cancellato automaticamente da Chrome alla chiusura del browser.

| Campo | Contenuto |
| --- | --- |
| Associazione scheda → gruppo | ID numerici di scheda, gruppo e finestra |
| Nome del gruppo | Serve a ritrovare il gruppo giusto in ogni finestra |
| Contatori | Quante schede corrispondono, quante aggiornate, se ci sono errori |

Questo serve a sopravvivere alla sospensione del service worker, che Chrome può interrompere in qualsiasi momento.

## Cosa NON viene fatto

**Gli URL visitati non vengono memorizzati.** L'estensione legge l'indirizzo di una scheda, ne estrae l'host, lo confronta con le regole e scarta l'URL. Path, query string, titolo della pagina e cronologia non vengono mai salvati né usati per la corrispondenza.

**Nessun contenuto delle pagine viene letto.** Il manifest non dichiara `content_scripts` né `host_permissions`: l'estensione non ha tecnicamente accesso a password, cookie, moduli o testo dei siti.

**Nessuna connessione di rete.** La Content Security Policy del manifest include `connect-src 'none'`, che impedisce a livello di browser qualunque richiesta in uscita — anche in caso di bug o di codice malevolo introdotto per errore.

**Le finestre in incognito sono escluse** (`"incognito": "not_allowed"`).

## Permessi e perché servono

| Permesso | Utilizzo | Cosa NON comporta |
| --- | --- | --- |
| `tabs` | Leggere l'indirizzo per riconoscere l'host | Non legge il contenuto delle pagine |
| `tabGroups` | Creare, nominare e colorare i gruppi | — |
| `storage` | Conservare le regole localmente | Nessuna sincronizzazione cloud |
| `alarms` | Riprovare operazioni interrotte | Nessuna attività di rete |

Non sono richiesti `host_permissions`, `scripting`, `cookies`, `history` o `webRequest`.

## Dati che esci tu

**Esporta JSON** crea un file contenente i nomi degli host che hai configurato. Il file viene salvato dove scegli tu, l'estensione non lo trasmette da nessuna parte. Trattalo come gli altri file di configurazione: se contiene host interni aziendali, conservalo di conseguenza.

## Cancellazione

Disinstallare l'estensione da `chrome://extensions` elimina regole e stato. I gruppi di schede già creati restano in Chrome, perché appartengono al browser e non all'estensione.

## Verificabilità

Non devi fidarti sulla parola. Il codice è pubblico e leggibile:

- **Rete:** nessuna occorrenza di `fetch`, `XMLHttpRequest`, `WebSocket` o `sendBeacon` nei sorgenti.
- **Cloud:** nessuna occorrenza di `chrome.storage.sync` o `chrome.identity`.
- **Dipendenze:** nessuna. `package.json` non ha `dependencies`, quindi non viene caricato codice di terze parti.

Un controllo automatico in `scripts/check-manifest.js` verifica a ogni push e pull request che i permessi restino quelli dichiarati, che non compaiano `host_permissions` o `content_scripts`, che `incognito` resti `not_allowed` e che le direttive CSP non vengano rimosse. Se qualcuno violasse una di queste promesse, la CI fallirebbe.

```sh
npm run check:manifest
```

## Contatti

Per segnalazioni: [issue su GitHub](https://github.com/alesiestu/tab-by-host/issues).
