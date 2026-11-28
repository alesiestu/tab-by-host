import assert from "node:assert/strict";
import { test } from "node:test";
import { COLORS, compileRules, defaultConfig, matchRule, matchingTab, normalizeConfig, parseHost } from "../core.js";

const rule = (values = {}) => ({ id: "test-rule", host: "console.example.com", group: "Produzione", color: "red", enabled: true, includeSubdomains: false, ...values });
const compiled = (...rules) => compileRules(normalizeConfig({ ...defaultConfig(), rules }).rules);

test("normalizza host, maiuscole, punto DNS finale e IDN", () => {
  assert.equal(parseHost(" Console.Example.COM. ").host, "console.example.com");
  assert.equal(parseHost("https://console.example.com/dashboard?a=1#part").host, "console.example.com");
  assert.equal(parseHost("münchen.example").host, "xn--mnchen-3ya.example");
});

test("supporta IP, IPv6, intranet e porta locale", () => {
  for (const host of ["192.168.1.20", "[::1]:3000", "localhost:3000", "console-interna", "service_internal.local"]) {
    assert.equal(parseHost(host).host, host);
  }
});

test("rifiuta input ambiguo e URL con credenziali", () => {
  for (const value of ["", " ", "*.example.com", "https://user:pass@example.com", "example.com/path", "example.com?host=staging", "example.com#hash", "https://", "bad host", "bad!host", "example..com", "https://example.com:65536", "localhost:0", "localhost:", "ftp://example.com", "example.com\\staging"]) {
    assert.throws(() => parseHost(value), undefined, value);
  }
});

test("la corrispondenza è sull’host, non su path, query o credenziali", () => {
  const rules = compiled(rule());
  for (const url of ["https://console.example.com/dashboard", "http://CONSOLE.EXAMPLE.COM/", "https://console.example.com.:8443/"]) {
    assert.equal(matchRule(url, rules)?.group, "Produzione");
  }
  for (const url of ["https://console.example.com.evil.test", "https://evil.test/?redirect=https://console.example.com", "https://evil.test/console.example.com", "https://console.example.com@evil.test/", "https://myconsole.example.com", "https://staging.console.example.com"]) {
    assert.equal(matchRule(url, rules), null, url);
  }
});

test("i sottodomini sono opzionali e rispettano i confini delle etichette DNS", () => {
  const rules = compiled(rule({ host: "example.com", includeSubdomains: true }));
  assert.ok(matchRule("https://example.com", rules));
  assert.ok(matchRule("https://a.b.example.com", rules));
  assert.equal(matchRule("https://notexample.com", rules), null);
  assert.equal(matchRule("https://example.com.evil.test", rules), null);
});

test("se una porta è specificata viene rispettata, compresa quella predefinita", () => {
  const rules = compiled(rule({ host: "localhost:3000" }));
  assert.ok(matchRule("http://localhost:3000", rules));
  assert.equal(matchRule("http://localhost:3001", rules), null);
  assert.equal(matchRule("https://localhost", rules), null);
  const secure = compiled(rule({ host: "https://console.example.com:443" }));
  assert.ok(matchRule("https://console.example.com", secure));
  assert.equal(matchRule("http://console.example.com", secure), null);
  const plain = compiled(rule({ host: "console.example.com:80" }));
  assert.ok(matchRule("http://console.example.com", plain));
  assert.equal(matchRule("https://console.example.com", plain), null);
});

// A service such as cPanel (2083) or WHM (2087) answers on a fixed port across
// many hostnames: the port alone must be expressible as a condition.
test("una regola di sola porta vale per qualsiasi host su quella porta", () => {
  assert.deepEqual(parseHost(":2083"), { hostname: "", port: "2083", host: ":2083" });
  assert.equal(parseHost(" :02083 ").host, ":2083");
  const rules = compiled(rule({ host: ":2083", group: "cPanel", color: "orange" }));
  for (const url of ["https://server1.example.com:2083/", "http://192.168.1.20:2083/login", "https://altro.test:2083"]) {
    assert.equal(matchRule(url, rules)?.group, "cPanel", url);
  }
  for (const url of ["https://server1.example.com", "https://server1.example.com:2087", "http://server1.example.com:20830"]) {
    assert.equal(matchRule(url, rules), null, url);
  }
});

test("la porta di default è esplicita anche per le regole di sola porta", () => {
  const https = compiled(rule({ host: ":443" }));
  assert.ok(matchRule("https://qualsiasi.example.com/path", https));
  assert.equal(matchRule("http://qualsiasi.example.com", https), null);
  const http = compiled(rule({ host: ":80" }));
  assert.ok(matchRule("http://qualsiasi.example.com", http));
  assert.equal(matchRule("https://qualsiasi.example.com", http), null);
});

test("una regola di sola porta rifiuta valori non numerici o fuori intervallo", () => {
  for (const value of [":", ":0", ":65536", ":abc", ":80a", ": 80", ":-1", ":8.0", "::1"]) {
    assert.throws(() => parseHost(value), undefined, value);
  }
});

// includeSubdomains has no meaning without a hostname: it must be stored as
// false, otherwise export/import would carry a flag the UI never shows.
test("una regola di sola porta non conserva il flag dei sottodomini", () => {
  const [stored] = normalizeConfig({ ...defaultConfig(), rules: [rule({ host: ":2087", includeSubdomains: true })] }).rules;
  assert.equal(stored.includeSubdomains, false);
  assert.equal(stored.host, ":2087");
});

test("una regola sull’host specifico batte quella di sola porta se viene prima", () => {
  const port = rule({ id: "port", host: ":2083", group: "cPanel", color: "orange" });
  const host = rule({ id: "host", host: "cliente.example.com:2083", group: "Cliente", color: "blue" });
  assert.equal(matchRule("https://cliente.example.com:2083", compiled(host, port))?.id, "host");
  assert.equal(matchRule("https://cliente.example.com:2083", compiled(port, host))?.id, "port");
  assert.equal(matchRule("https://altro.example.com:2083", compiled(host, port))?.id, "port");
});

test("vince la prima regola attiva e l’ordine è deterministico", () => {
  const staging = rule({ id: "staging", host: "staging.example.com", group: "Staging", color: "orange" });
  const production = rule({ id: "prod", host: "example.com", includeSubdomains: true });
  assert.equal(matchRule("https://staging.example.com", compiled(staging, production))?.id, "staging");
  assert.equal(matchRule("https://staging.example.com", compiled(production, staging))?.id, "prod");
  assert.equal(matchRule("https://staging.example.com", compiled({ ...production, enabled: false }, staging))?.id, "staging");
});

test("schede fissate, incognito e pagine interne sono escluse", () => {
  const rules = compiled(rule());
  assert.equal(matchingTab({ url: "https://console.example.com", pinned: true }, rules), null);
  assert.equal(matchingTab({ url: "https://console.example.com", incognito: true }, rules), null);
  for (const url of ["chrome://settings", "about:blank", "file:///console.example.com", "data:text/html,console.example.com", "not a URL"]) {
    assert.equal(matchRule(url, rules), null);
  }
  assert.ok(matchingTab({ url: "about:blank", pendingUrl: "https://console.example.com" }, rules));
});

test("la configurazione richiede dati validi e identificativi unici", () => {
  assert.deepEqual(normalizeConfig(defaultConfig()), defaultConfig());
  assert.throws(() => normalizeConfig({ version: 2, rules: [], enabled: true }));
  assert.throws(() => normalizeConfig({ ...defaultConfig(), enabled: "yes" }));
  assert.throws(() => normalizeConfig({ ...defaultConfig(), rules: [rule(), rule()] }));
  for (const override of [{ group: "" }, { color: "black" }, { group: "x".repeat(61) }, { group: "test\nfoo" }, { enabled: "true" }, { includeSubdomains: "false" }, { id: "<script>" }]) {
    assert.throws(() => normalizeConfig({ ...defaultConfig(), rules: [rule(override)] }));
  }
});

test("più host possono condividere lo stesso gruppo e colore", () => {
  const rules = [rule(), rule({ id: "api", host: "api.example.com" })];
  assert.equal(normalizeConfig({ ...defaultConfig(), rules }).rules.length, 2);
  assert.throws(() => normalizeConfig({ ...defaultConfig(), rules: [rules[0], { ...rules[1], color: "green" }] }));
});

test("il set di colori coincide con quelli dei gruppi Chrome", () => {
  assert.deepEqual(Object.keys(COLORS).sort(), ["grey", "blue", "red", "yellow", "green", "pink", "purple", "cyan", "orange"].sort());
});
