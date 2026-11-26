# Changelog

Il formato segue [Keep a Changelog](https://keepachangelog.com/it/1.1.0/)
e il progetto usa il [versionamento semantico](https://semver.org/lang/it/).

## [1.1.0] — 2026-11-26

Prima release pubblica. L'estensione cambia nome e interfaccia; il comportamento
di raggruppamento resta quello della 1.0.0.

### Aggiunto

- Interfaccia in **inglese** (lingua predefinita) e **italiano**, scelta
  automaticamente in base alla lingua di Chrome (#1).
- [`PRIVACY.md`](PRIVACY.md): elenco esatto dei dati trattati, dove sono
  conservati e per quanto tempo (#3).
- Licenza [MIT](LICENSE) e riferimenti all'autore (#4).
- Integrazione continua: test, lint e controllo del manifest a ogni modifica (#9).
- ESLint con configurazione per estensioni Chrome (#10).
- Test della logica della pagina impostazioni: prova di un indirizzo,
  importazione e riordino delle regole (#11).

### Modificato

- **Nome: da "Host Groups" a "Tab by Host"** (#17). Le regole già salvate
  vengono mantenute: le chiavi di archiviazione non sono state rinominate.
- Palette più calda e testi più descrittivi, icone comprese (#2).
- Il controllo di recupero non risveglia più l'estensione ogni minuto quando
  l'automazione è sospesa o non ci sono regole attive (#7).
- Il file esportato si chiama ora `tab-by-host-rules.json`.

### Corretto

- Il popup mostrava una versione scritta a mano, diversa da quella del
  manifest; ora la legge dal manifest (#5). Stessa correzione nel footer
  delle impostazioni.
- Dopo un errore, lo stato dell'ultima esecuzione riuscita non viene più
  cancellato: `paused`, `matched` e `changed` sopravvivono alla segnalazione (#6).
- `normalizeConfig` non perde più l'eccezione originale di `parseHost`.
- Il riordino delle regole non modifica più l'elenco di partenza e gestisce
  esplicitamente i bordi.

### Documentato

- L'importazione sostituisce soltanto le regole: il campo `enabled` del file
  viene ignorato, così che importare non riattivi un'automazione sospesa (#12).
- La scrittura ripetuta su `storage.session` durante la riconciliazione è stata
  misurata e lasciata invariata: garantisce la ripristinabilità del service
  worker e nello scenario reale incide per meno di 1 KB (#8).

## [1.0.0]

Versione iniziale, non pubblicata.
