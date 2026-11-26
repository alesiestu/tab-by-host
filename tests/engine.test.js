import assert from "node:assert/strict";
import { test } from "node:test";
import { CONFIG_KEY, SESSION_KEY, defaultConfig } from "../core.js";
import { reconcile } from "../engine.js";
import { chromeHarness } from "./chrome-harness.js";

const rule = (overrides = {}) => ({ id: "prod", host: "console.example.com", group: "Produzione", color: "red", enabled: true, includeSubdomains: false, ...overrides });
const staging = rule({ id: "stage", host: "staging.example.com", group: "Staging", color: "orange" });
async function configured(tabs, rules = [rule(), staging], groups = []) {
  const h = chromeHarness(tabs, groups);
  await h.api.storage.local.set({ [CONFIG_KEY]: { ...defaultConfig(), rules } });
  return h;
}

test("produzione e staging entrano automaticamente in gruppi distinti", async () => {
  const h = await configured([{ id: 1, url: "https://console.example.com" }, { id: 2, url: "https://console.example.com/vms" }, { id: 3, url: "https://staging.example.com" }, { id: 4, url: "https://unrelated.test" }]);
  const status = await reconcile(h.api);
  assert.equal(status.matched, 3); assert.equal(status.errors, 0);
  assert.equal(h.tabs.get(1).groupId, h.tabs.get(2).groupId);
  assert.notEqual(h.tabs.get(1).groupId, h.tabs.get(3).groupId);
  assert.equal(h.groups.get(h.tabs.get(1).groupId).title, "Produzione");
  assert.equal(h.groups.get(h.tabs.get(3).groupId).color, "orange");
  assert.equal(h.tabs.get(4).groupId, -1);
});

test("più finestre mantengono gruppi indipendenti", async () => {
  const h = await configured([{ id: 1, windowId: 11, url: "https://console.example.com" }, { id: 2, windowId: 22, url: "https://console.example.com" }]);
  await reconcile(h.api);
  assert.notEqual(h.tabs.get(1).groupId, h.tabs.get(2).groupId);
  assert.equal(h.tabs.get(1).windowId, 11); assert.equal(h.tabs.get(2).windowId, 22);
  assert.equal(h.groups.size, 2);
});

test("più regole con lo stesso nome condividono un unico gruppo", async () => {
  const h = await configured([{ id: 1, url: "https://console.example.com" }, { id: 2, url: "https://api.example.com" }], [rule(), rule({ id: "api", host: "api.example.com" })]);
  await reconcile(h.api); assert.equal(h.groups.size, 1); assert.equal(h.tabs.get(1).groupId, h.tabs.get(2).groupId);
});

test("il cambio di host trasferisce la scheda e l’uscita rimuove il gruppo gestito", async () => {
  const h = await configured([{ id: 1, url: "https://console.example.com" }]);
  await reconcile(h.api);
  h.navigate(1, "https://staging.example.com"); await reconcile(h.api);
  assert.equal(h.groups.get(h.tabs.get(1).groupId).title, "Staging");
  h.navigate(1, "https://unrelated.test"); await reconcile(h.api);
  assert.equal(h.tabs.get(1).groupId, -1); assert.equal(h.groups.size, 0);
});

test("gruppi manuali non corrispondenti e schede fissate rimangono intatti", async () => {
  const h = await configured([{ id: 1, url: "https://unrelated.test", groupId: 9 }, { id: 2, url: "https://console.example.com", pinned: true }], [rule()], [{ id: 9, windowId: 1, title: "Manuale", color: "blue" }]);
  await reconcile(h.api); assert.equal(h.tabs.get(1).groupId, 9); assert.equal(h.tabs.get(2).groupId, -1); assert.equal(h.operations.length, 0);
});

test("ripetere l’applicazione non crea duplicati e conserva il gruppo compresso", async () => {
  const h = await configured([{ id: 1, url: "https://console.example.com" }]);
  await reconcile(h.api); const id = h.tabs.get(1).groupId;
  h.groups.get(id).collapsed = true; const before = h.operations.length;
  const status = await reconcile(h.api);
  assert.equal(status.changed, 0); assert.equal(h.operations.length, before); assert.equal(h.groups.get(id).collapsed, true);
});

test("rinominare e ricolorare una regola aggiorna il risultato", async () => {
  const h = await configured([{ id: 1, url: "https://console.example.com" }]); await reconcile(h.api);
  await h.api.storage.local.set({ [CONFIG_KEY]: { ...defaultConfig(), rules: [rule({ group: "Prod Console", color: "purple" })] } });
  await reconcile(h.api); assert.equal(h.groups.size, 1);
  assert.equal(h.groups.get(h.tabs.get(1).groupId).title, "Prod Console"); assert.equal(h.groups.get(h.tabs.get(1).groupId).color, "purple");
});

test("sospendere l’automazione conserva i gruppi, Applica ora funziona anche in pausa", async () => {
  const h = await configured([{ id: 1, url: "https://console.example.com" }]); await reconcile(h.api);
  const id = h.tabs.get(1).groupId;
  await h.api.storage.local.set({ [CONFIG_KEY]: { ...defaultConfig(), enabled: false, rules: [rule(), staging] } });
  h.navigate(1, "https://staging.example.com");
  assert.equal((await reconcile(h.api)).paused, true); assert.equal(h.tabs.get(1).groupId, id);
  await reconcile(h.api, { force: true }); assert.equal(h.groups.get(h.tabs.get(1).groupId).title, "Staging");
});

test("disabilitare o eliminare una regola libera solo le schede gestite", async () => {
  const h = await configured([{ id: 1, url: "https://console.example.com" }, { id: 2, url: "https://unrelated.test", groupId: 9 }], [rule()], [{ id: 9, windowId: 1, title: "Manuale", color: "blue" }]);
  await reconcile(h.api);
  await h.api.storage.local.set({ [CONFIG_KEY]: { ...defaultConfig(), rules: [{ ...rule(), enabled: false }] } });
  await reconcile(h.api); assert.equal(h.tabs.get(1).groupId, -1); assert.equal(h.tabs.get(2).groupId, 9);
});

test("lo stato persistito recupera il gruppo dopo la sospensione del worker", async () => {
  const h = await configured([{ id: 1, url: "https://console.example.com" }]); await reconcile(h.api); const id = h.tabs.get(1).groupId;
  h.add({ id: 2, url: "https://console.example.com/new" });
  await reconcile(h.api); assert.equal(h.tabs.get(2).groupId, id); assert.equal(h.groups.size, 1);
  assert.equal((await h.api.storage.session.get(SESSION_KEY))[SESSION_KEY].tabs[2].groupId, id);
});

test("un errore temporaneo mentre si trascina una scheda viene recuperato", async () => {
  const h = await configured([{ id: 1, url: "https://console.example.com" }]); h.failures.group = 1;
  assert.equal((await reconcile(h.api)).errors, 1); assert.equal(h.tabs.get(1).groupId, -1);
  assert.equal((await reconcile(h.api)).errors, 0); assert.notEqual(h.tabs.get(1).groupId, -1);
  h.navigate(1, "https://unrelated.test"); h.failures.ungroup = 1;
  assert.equal((await reconcile(h.api)).errors, 1); assert.notEqual(h.tabs.get(1).groupId, -1);
  await reconcile(h.api); assert.equal(h.tabs.get(1).groupId, -1);
});

test("schede chiuse e gruppi eliminati non lasciano riferimenti obsoleti", async () => {
  const h = await configured([{ id: 1, url: "https://console.example.com" }]); await reconcile(h.api); h.close(1);
  await reconcile(h.api); const state = (await h.api.storage.session.get(SESSION_KEY))[SESSION_KEY];
  assert.deepEqual(state, { groups: [], tabs: {} });
});

test("spostare manualmente una scheda in un’altra finestra la raggruppa nella destinazione", async () => {
  const h = await configured([{ id: 1, url: "https://console.example.com" }, { id: 2, windowId: 2, url: "https://console.example.com" }]); await reconcile(h.api);
  h.tabs.get(1).windowId = 2; h.tabs.get(1).groupId = -1;
  await reconcile(h.api); assert.equal(h.tabs.get(1).groupId, h.tabs.get(2).groupId); assert.equal(h.tabs.get(1).windowId, 2);
});
