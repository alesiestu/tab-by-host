// Validates manifest.json without loading the extension in Chrome.
// Catches the mistakes that otherwise surface only at "Carica estensione non pacchettizzata".
import { readFile, access } from "node:fs/promises";
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

if (errors.length) {
  console.error(`manifest.json: ${errors.length} problem${errors.length === 1 ? "a" : "i"}\n`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log("manifest.json: ok");
