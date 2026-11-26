# Host Groups

Estensione Chrome per raggruppare automaticamente le schede in base all’host.
Puoi gestire tutte le regole dalle impostazioni: **host, nome del gruppo e colore**.
Nessun dominio è preconfigurato.

## Installazione da GitHub

Clona la repository oppure scaricala con **Code → Download ZIP**:

```sh
git clone https://github.com/alesiestu/tab-by-host.git
cd tab-by-host
```

Apri `chrome://extensions`, attiva **Modalità sviluppatore**, premi
**Carica estensione non pacchettizzata** e seleziona la cartella della repository
che contiene `manifest.json`. Non sono necessari `npm install` o una compilazione.
Apri **Host Groups → Gestisci regole** per aggiungere gli host.

## Installazione dal pacchetto ZIP

1. Estrai `host-groups-chrome.zip` in una cartella stabile del computer.
2. Apri `chrome://extensions` in Chrome.
3. Attiva **Modalità sviluppatore**, in alto a destra.
4. Premi **Carica estensione non pacchettizzata**.
5. Seleziona la cartella **host-groups** che contiene `manifest.json`.
6. Dal menu delle estensioni (puzzle), fissa **Host Groups** alla barra.
7. Apri l’estensione e premi **Gestisci regole**.

La cartella deve rimanere sul computer: Chrome carica l’estensione da lì.
L’estensione non deve essere caricata sul Chrome Web Store per usarla localmente.
Durante la prova, disattiva altre estensioni che raggruppano automaticamente le schede, così le regole non interferiscono tra loro.

## Aggiungi la prima regola

Nel modulo a destra:

- **Host:** `staging.example.com`
- **Nome del gruppo:** `Console · STAGING`
- **Colore:** Arancione
- **Includi anche i sottodomini:** disattivato, per una corrispondenza esatta

Premi **Salva regola**: la regola viene salvata e applicata anche alle schede aperte.
Aggiungi un’altra regola per l’host di produzione, con nome e colore differenti.
Questi indirizzi sono soltanto esempi: sostituiscili con gli host reali.

| Esempio di host | Gruppo | Colore |
| --- | --- | --- |
| `console.example.com` | Console · PRODUZIONE | Rosso |
| `staging.example.com` | Console · STAGING | Arancione |
| `localhost:3000` | Sviluppo locale | Verde |

Le regole si possono **modificare, sospendere, eliminare e riordinare**.
Se più regole corrispondono, vince la **prima regola attiva dall’alto**.
Per riunire più host nello stesso gruppo usa lo **stesso nome e colore** nelle rispettive regole.

## Cosa significa “host”

- `console.example.com` corrisponde soltanto a questo hostname, su HTTP o HTTPS e su qualsiasi porta.
- `staging.console.example.com` rimane separato, finché non attivi **Includi anche i sottodomini** sulla regola `console.example.com`.
- Abilitare i sottodomini include sia l’host stesso sia tutti i suoi sottodomini.
- `localhost:3000` corrisponde soltanto alla porta 3000; `localhost` corrisponde a tutte le sue porte.
- Sono supportati IP, host interni, IPv6 tra parentesi quadre e nomi internazionali.
- Puoi incollare un URL completo: vengono conservati soltanto host ed eventuale porta esplicita.
- Path, query string e titolo della pagina non sono usati per la corrispondenza.
- `example.com` non corrisponde a `notexample.com` o `example.com.altro-dominio.test`.
- Le maiuscole e il punto DNS finale vengono normalizzati. `www` è un sottodominio distinto.

Usa **Prova un indirizzo** nelle impostazioni per controllare una regola senza aprire il sito.
Per evitare che una regola ampia includa anche staging, usa host esatti oppure porta la regola più specifica sopra quella generale.

## Comportamento

- Gestisce le schede già aperte, quelle nuove e i cambi di indirizzo.
- Crea **gruppi indipendenti in ogni finestra**: non sposta schede tra finestre.
- Quando passi da un host di produzione a uno di staging, aggiorna il gruppo.
- Quando una scheda gestita esce da tutti gli host configurati, la toglie dal gruppo.
- I gruppi manuali delle schede che non corrispondono a regole rimangono invariati.
- Le regole hanno precedenza sui gruppi manuali per le schede con host corrispondenti.
- Le schede fissate, le finestre delle app e le pagine interne come `chrome://settings` sono escluse.
- La modalità in incognito è esclusa.
- Lo stato compresso/espanso di un gruppo esistente viene conservato.
- Il pulsante di pausa lascia i gruppi attuali e sospende i successivi aggiornamenti automatici.
- **Applica ora** applica le regole una volta anche se l’automazione è sospesa.
- Se Chrome sta trascinando una scheda o ripristinando una sessione, un controllo di recupero ogni minuto ritenta il raggruppamento.
- I gruppi vuoti spariscono secondo il comportamento normale di Chrome.

## Backup e dati

**Esporta JSON** salva tutte le regole in un file. **Importa JSON** mostra un riepilogo prima di sostituire le regole attuali.
Le impostazioni sono conservate localmente nel profilo di Chrome. Non vengono sincronizzate tra dispositivi.
Il file esportato contiene i nomi degli host: conservalo come gli altri file di configurazione.

L’estensione funziona interamente nel browser: nessun server, account, libreria remota o telemetria.
Non esegue script nelle pagine e non legge password, cookie, moduli o contenuti dei siti.
Richiede questi permessi Chrome:

| Permesso | Utilizzo |
| --- | --- |
| `tabs` | Leggere gli indirizzi delle schede per riconoscere l’host |
| `tabGroups` | Creare, nominare e colorare i gruppi |
| `storage` | Conservare regole e stato del raggruppamento |
| `alarms` | Recuperare operazioni interrotte o temporaneamente bloccate |

## Aggiornare o rimuovere

Per aggiornare i sorgenti, sostituisci i file nella stessa cartella e premi **Ricarica** nella scheda dell’estensione su `chrome://extensions`.
Per una copia di sicurezza delle regole, esportale prima dell’aggiornamento.
Disattivare o rimuovere l’estensione interrompe l’automazione. I gruppi di Chrome già creati rimangono disponibili.

Se Chrome è gestito dall’azienda e blocca le estensioni non pacchettizzate, l’installazione richiede la distribuzione tramite le policy aziendali.

## Verifiche e sviluppo

Richiede Chrome 120 o successivo. Nessuna compilazione o dipendenza è necessaria per l’installazione.
I sorgenti sono JavaScript standard e Manifest V3.

Per eseguire i test con Node.js 20 o successivo:

```sh
cd tab-by-host
npm test
```

La suite controlla parsing e corrispondenza degli host, precedenza, raggruppamento in più finestre, navigazione tra ambienti, pause, aggiornamenti delle regole, errori temporanei ed eventi del service worker.
I test del motore e del worker usano un simulatore delle API Chrome: la suite non sostituisce una prova dell’estensione dentro Chrome.

Verifica iniziale consigliata nel browser:

1. Aggiungi due regole per due host di prova distinti, con nomi e colori differenti.
2. Apri due schede per il primo host e una per il secondo: devono apparire due gruppi.
3. Naviga una delle schede dal primo host al secondo: deve cambiare gruppo.
4. Apri lo stesso host in una seconda finestra: deve comparire un gruppo in quella finestra, senza trasferimenti.
5. Sospendi l’automazione e apri un’altra scheda: deve rimanere dov’è; riattivando l’automazione deve raggrupparsi.

API ufficiali: [Tabs](https://developer.chrome.com/docs/extensions/reference/api/tabs), [Tab Groups](https://developer.chrome.com/docs/extensions/reference/api/tabGroups), [Storage](https://developer.chrome.com/docs/extensions/reference/api/storage).
