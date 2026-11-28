import assert from "node:assert/strict";
import { test } from "node:test";
import { applyImport, compileRules, defaultConfig, matchRule, normalizeConfig, reorderRules, resolveTestUrl } from "../core.js";

const rule = (values = {}) => ({ id: "prod", host: "console.example.com", group: "Produzione", color: "red", enabled: true, includeSubdomains: false, ...values });
const config = (...rules) => normalizeConfig({ ...defaultConfig(), rules });

// "Prova un indirizzo" is how the user verifies a rule without opening the site:
// a wrong answer here makes them trust a rule that does not actually apply.
test("la prova di un indirizzo accetta host nudo, URL completo e porta", () => {
  assert.equal(resolveTestUrl("console.example.com").url, "http://console.example.com");
  assert.equal(resolveTestUrl("  console.example.com  ").url, "http://console.example.com");
  assert.equal(resolveTestUrl("localhost:3000").url, "http://localhost:3000");
  // A full URL is preserved: scheme and path matter for what the user pasted.
  assert.equal(resolveTestUrl("https://console.example.com/dashboard").url, "https://console.example.com/dashboard");
  assert.equal(resolveTestUrl("HTTPS://Console.Example.COM").url, "HTTPS://Console.Example.COM");
  assert.equal(resolveTestUrl("https://console.example.com/x").parsed.host, "console.example.com");
});

test("la prova di un indirizzo dà lo stesso esito del raggruppamento reale", () => {
  const rules = compileRules(config(rule(), rule({ id: "stage", host: "staging.example.com", group: "Staging", color: "orange" })).rules);
  for (const [input, expected] of [
    ["console.example.com", "Produzione"],
    ["https://console.example.com/vms?a=1", "Produzione"],
    ["staging.example.com", "Staging"],
    ["altro.example.com", undefined]
  ]) {
    const { url } = resolveTestUrl(input);
    assert.equal(matchRule(url, rules)?.group, expected, input);
  }
});

test("la prova di un indirizzo rifiuta input non validi", () => {
  for (const input of ["", "   ", "non valido", "http://user:pw@example.com", "*.example.com", "example.com:0"]) {
    assert.throws(() => resolveTestUrl(input), undefined, JSON.stringify(input));
  }
});

// A bare host must not be matched by https-only reasoning: the default port
// differs between schemes, and a port-specific rule must keep working.
test("la prova distingue le porte come il raggruppamento", () => {
  const rules = compileRules(config(rule({ host: "localhost:3000", group: "Locale", color: "green" })).rules);
  assert.equal(matchRule(resolveTestUrl("localhost:3000").url, rules)?.group, "Locale");
  assert.equal(matchRule(resolveTestUrl("localhost:4000").url, rules), null);
});

// ":2083" is a valid rule but not something the user can visit: the tester must
// refuse it instead of inventing a host and reporting a misleading match.
test("la prova rifiuta la sola porta ma applica le regole di sola porta", () => {
  assert.throws(() => resolveTestUrl(":2083"));
  const rules = compileRules(config(rule({ host: ":2083", group: "cPanel", color: "orange" })).rules);
  assert.equal(matchRule(resolveTestUrl("server.example.com:2083").url, rules)?.group, "cPanel");
  assert.equal(matchRule(resolveTestUrl("https://altro.test:2083/login").url, rules)?.group, "cPanel");
  assert.equal(matchRule(resolveTestUrl("server.example.com:2087").url, rules), null);
});

test("l’importazione sostituisce le regole e conserva lo stato dell’automazione", () => {
  const current = config(rule());
  const imported = { ...config(rule({ id: "imported", host: "altro.example.com", group: "Altro", color: "blue" })), enabled: true };

  const ontoPaused = applyImport({ ...current, enabled: false }, imported);
  assert.equal(ontoPaused.enabled, false, "l’importazione non deve riattivare l’automazione");
  assert.deepEqual(ontoPaused.rules, imported.rules);

  const ontoActive = applyImport({ ...current, enabled: true }, { ...imported, enabled: false });
  assert.equal(ontoActive.enabled, true, "l’importazione non deve sospendere l’automazione");

  // The result must stay a valid configuration, not just a merged object.
  assert.doesNotThrow(() => normalizeConfig(ontoPaused));
});

test("il riordino scambia le regole adiacenti e rifiuta i bordi", () => {
  const rules = [rule({ id: "a" }), rule({ id: "b", host: "b.example.com" }), rule({ id: "c", host: "c.example.com" })];
  assert.deepEqual(reorderRules(rules, 0, 1).map(item => item.id), ["b", "a", "c"]);
  assert.deepEqual(reorderRules(rules, 2, -1).map(item => item.id), ["a", "c", "b"]);
  // Edges return null so the UI can disable the button instead of corrupting the order.
  assert.equal(reorderRules(rules, 0, -1), null);
  assert.equal(reorderRules(rules, 2, 1), null);
  assert.equal(reorderRules(rules, 5, 1), null);
  // The original array must not be mutated: render() reads config.rules afterwards.
  assert.deepEqual(rules.map(item => item.id), ["a", "b", "c"]);
});

test("il riordino cambia la regola che vince, non solo l’ordine visivo", () => {
  const broad = rule({ id: "broad", host: "example.com", group: "Generale", color: "grey", includeSubdomains: true });
  const exact = rule({ id: "exact", host: "staging.example.com", group: "Staging", color: "orange" });

  const before = compileRules(config(broad, exact).rules);
  assert.equal(matchRule("https://staging.example.com", before)?.group, "Generale");

  const after = compileRules(config(...reorderRules([broad, exact], 1, -1)).rules);
  assert.equal(matchRule("https://staging.example.com", after)?.group, "Staging");
});
