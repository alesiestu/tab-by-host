import assert from "node:assert/strict";
import { test } from "node:test";
import { CONFIG_KEY, defaultConfig } from "../core.js";
import { chromeHarness } from "./chrome-harness.js";

const rule = (overrides = {}) => ({ id: "prod", host: "console.example.com", group: "Produzione", color: "red", enabled: true, includeSubdomains: false, ...overrides });
async function eventually(condition, message) {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    if (condition()) return;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  assert.fail(message);
}

test("worker: installazione, eventi automatici, configurazione, pausa e recupero", async t => {
  const h = chromeHarness();
  globalThis.chrome = h.api;
  await import("../background.js");

  await t.test("inizializza lo storage e risponde alla pagina impostazioni", async () => {
    h.api.runtime.onInstalled.emit({ reason: "install" });
    await eventually(() => Boolean(h.api.storage.local.data[CONFIG_KEY]), "configurazione iniziale mancante");
    const state = await h.message({ type: "GET_STATE" });
    assert.equal(state.ok, true); assert.deepEqual(state.config, defaultConfig());
    assert.ok(await h.api.alarms.get("host-groups-recovery"));
  });

  await t.test("salvare una regola applica anche alle schede già aperte", async () => {
    h.add({ id: 1, url: "https://console.example.com" });
    const response = await h.message({ type: "SAVE_CONFIG", config: { ...defaultConfig(), rules: [rule()] } });
    assert.equal(response.ok, true); assert.equal(h.groups.get(h.tabs.get(1).groupId).title, "Produzione");
  });

  await t.test("raggruppa una nuova scheda solo tramite l’evento del browser", async () => {
    h.add({ id: 2, url: "https://console.example.com/vms" });
    await eventually(() => h.tabs.get(2).groupId === h.tabs.get(1).groupId, "la nuova scheda non è stata raggruppata");
  });

  await t.test("gli eventi prodotti dal raggruppamento si stabilizzano", async () => {
    await new Promise(resolve => setTimeout(resolve, 500));
    const before = h.operations.length;
    await new Promise(resolve => setTimeout(resolve, 500));
    assert.equal(h.operations.length, before, "ciclo di raggruppamento rilevato");
  });

  await t.test("cambiare URL aggiorna il gruppo senza comandi manuali", async () => {
    const staging = rule({ id: "stage", host: "staging.example.com", group: "Staging", color: "orange" });
    await h.message({ type: "SAVE_CONFIG", config: { ...defaultConfig(), rules: [rule(), staging] } });
    h.navigate(2, "https://staging.example.com");
    await eventually(() => h.groups.get(h.tabs.get(2).groupId)?.title === "Staging", "cambio ambiente non applicato");
  });

  await t.test("il pulsante di pausa sospende i nuovi raggruppamenti", async () => {
    const response = await h.message({ type: "SET_ENABLED", enabled: false });
    assert.equal(response.ok, true);
    h.add({ id: 3, windowId: 2, url: "https://console.example.com" });
    await new Promise(resolve => setTimeout(resolve, 350));
    assert.equal(h.tabs.get(3).groupId, -1);
    await h.message({ type: "SET_ENABLED", enabled: true });
    assert.notEqual(h.tabs.get(3).groupId, -1);
    assert.equal(h.tabs.get(3).windowId, 2);
  });

  await t.test("rifiuta una configurazione non valida senza sovrascrivere le regole", async () => {
    const before = structuredClone(h.api.storage.local.data[CONFIG_KEY]);
    const response = await h.message({ type: "SAVE_CONFIG", config: { version: 99, rules: [] } });
    assert.equal(response.ok, false);
    assert.deepEqual(h.api.storage.local.data[CONFIG_KEY], before);
  });

  await t.test("l’allarme recupera un’operazione rimasta in sospeso", async () => {
    // Simulate a missed creation event while Chrome was shutting down its worker.
    h.tabs.set(4, { id: 4, windowId: 1, windowType: "normal", pinned: false, incognito: false, groupId: -1, url: "https://console.example.com" });
    h.api.alarms.onAlarm.emit({ name: "host-groups-recovery" });
    await eventually(() => h.tabs.get(4).groupId !== -1, "recupero non eseguito");
  });
  await new Promise(resolve => setTimeout(resolve, 350));
  delete globalThis.chrome;
});
