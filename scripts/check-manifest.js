// Validates manifest.json without loading the extension in Chrome, and enforces
// the privacy promises in PRIVACY.md: no network, no cloud sync, no third-party code.
// Catches the mistakes that otherwise surface only at "Carica estensione non pacchettizzata".
import { readFile, access, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const fail = message => errors.push(message);

async function readJson(name) {
  try {
    return JSON.parse(await readFile(resolve(root, name), "utf8"));
  } catch (error) {
    fail(`${name}: non leggibile o JSON non valido (${error.message}).`);
    return null;
  }
}

async function expectFile(path, origin) {
  try {
    await access(resolve(root, path));
  } catch {
    fail(`${origin} punta a "${path}", che non esiste.`);
  }
}

const manifest = await readJson("manifest.json");
const pkg = await readJson("package.json");

if (manifest) {
  if (manifest.manifest_version !== 3) fail("manifest_version deve essere 3.");

  // Chrome accepts 1-4 dot-separated integers, each 0-65535, no leading zeros.
  if (!/^(?:0|[1-9]\d*)(?:\.(?:0|[1-9]\d*)){0,3}$/.test(manifest.version ?? "")) {
    fail(`version "${manifest.version}" non è un numero di versione valido per Chrome.`);
  }

  if (pkg && manifest.version !== pkg.version) {
    fail(`version disallineata: manifest.json ${manifest.version}, package.json ${pkg.version}.`);
  }

  const referenced = [
    [manifest.background?.service_worker, "background.service_worker"],
    [manifest.action?.default_popup, "action.default_popup"],
    [manifest.options_ui?.page, "options_ui.page"],
    ...Object.entries(manifest.icons ?? {}).map(([size, path]) => [path, `icons.${size}`]),
    ...Object.entries(manifest.action?.default_icon ?? {}).map(([size, path]) => [path, `action.default_icon.${size}`])
  ];
  for (const [path, origin] of referenced) if (path) await expectFile(path, origin);

  // The README promises a browser-only extension: no host access, no remote code.
  const allowed = new Set(["tabs", "tabGroups", "storage", "alarms"]);
  for (const permission of manifest.permissions ?? []) {
    if (!allowed.has(permission)) fail(`permesso inatteso "${permission}": aggiorna README e questo controllo se è voluto.`);
  }
  if (manifest.host_permissions?.length) fail("host_permissions non deve essere usato.");
  if (manifest.content_scripts?.length) fail("content_scripts non deve essere usato.");
  if (manifest.incognito !== "not_allowed") fail('incognito deve restare "not_allowed".');

  const csp = manifest.content_security_policy?.extension_pages ?? "";
  for (const directive of ["script-src 'self'", "object-src 'none'", "connect-src 'none'"]) {
    if (!csp.includes(directive)) fail(`content_security_policy.extension_pages deve contenere "${directive}".`);
  }
}

// PRIVACY.md promises these never appear. Enforce it instead of trusting a review.
const sources = (await readdir(root)).filter(name => name.endsWith(".js"));
const banned = [
  [/\bfetch\s*\(/, "fetch()"],
  [/\bXMLHttpRequest\b/, "XMLHttpRequest"],
  [/\bWebSocket\b/, "WebSocket"],
  [/\bsendBeacon\b/, "navigator.sendBeacon"],
  [/\bEventSource\b/, "EventSource"],
  [/chrome\.storage\.sync\b/, "chrome.storage.sync (sincronizzazione cloud)"],
  [/chrome\.identity\b/, "chrome.identity"],
  [/chrome\.(history|cookies|webRequest|scripting)\b/, "API non dichiarata nei permessi"]
];
for (const name of sources) {
  const source = await readFile(resolve(root, name), "utf8");
  for (const [pattern, label] of banned) {
    if (pattern.test(source)) fail(`${name}: usa ${label}, in contrasto con PRIVACY.md.`);
  }
}

// Locales must stay in sync: a missing key silently falls back to the default locale.
const locales = await readdir(resolve(root, "_locales")).catch(() => []);
if (manifest && !locales.includes(manifest.default_locale)) {
  fail(`default_locale "${manifest.default_locale}" non ha una cartella in _locales/.`);
}
const catalogs = new Map();
for (const locale of locales) {
  const catalog = await readJson(`_locales/${locale}/messages.json`);
  if (catalog) catalogs.set(locale, catalog);
}
const reference = catalogs.get(manifest?.default_locale);
if (reference) {
  for (const [locale, catalog] of catalogs) {
    if (locale === manifest.default_locale) continue;
    for (const key of Object.keys(reference)) {
      if (!(key in catalog)) fail(`_locales/${locale}: manca la chiave "${key}".`);
    }
    for (const key of Object.keys(catalog)) {
      if (!(key in reference)) fail(`_locales/${locale}: chiave "${key}" assente dal locale di default.`);
    }
    // A placeholder missing from a translation renders as a literal $NAME$ in the UI.
    for (const [key, entry] of Object.entries(catalog)) {
      if (!reference[key]) continue;
      const expected = Object.keys(reference[key].placeholders ?? {}).sort().join(",");
      const actual = Object.keys(entry.placeholders ?? {}).sort().join(",");
      if (expected !== actual) fail(`_locales/${locale}: "${key}" ha placeholder [${actual}], attesi [${expected}].`);
    }
  }

  // Every data-i18n marker in the markup must resolve to a real message.
  for (const page of ["options.html", "popup.html"]) {
    const html = await readFile(resolve(root, page), "utf8").catch(() => "");
    for (const match of html.matchAll(/data-i18n(?:-title-text|-title|-aria|-placeholder)?="([^"]+)"/g)) {
      if (!(match[1] in reference)) fail(`${page}: data-i18n "${match[1]}" non esiste in _locales/${manifest.default_locale}.`);
    }
  }
}

if (pkg && Object.keys(pkg.dependencies ?? {}).length) {
  fail("package.json: dependencies non vuote. L'estensione deve restare senza codice di terze parti.");
}

if (errors.length) {
  console.error(`manifest.json: ${errors.length} problem${errors.length === 1 ? "a" : "i"}\n`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log("manifest.json: ok");
