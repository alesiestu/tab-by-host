import { CONFIG_KEY, STATUS_KEY, defaultConfig, normalizeConfig } from "./core.js";
import { getConfig, reconcile } from "./engine.js";

const RECOVERY_ALARM = "host-groups-recovery";
let queue = Promise.resolve();
let timer = null;

async function badge(config, errors = 0) {
  await chrome.action.setBadgeText({ text: errors ? "!" : config.enabled ? "" : "OFF" });
  await chrome.action.setBadgeBackgroundColor({ color: errors ? "#b45309" : "#526176" });
}

async function reportError(error) {
  console.error("Host Groups:", error);
  await chrome.storage.session.set({ [STATUS_KEY]: { errors: 1, at: Date.now(), message: "Operazione non riuscita. Riprova con Applica ora." } });
  await chrome.action.setBadgeText({ text: "!" });
}

function enqueue(task) {
  const pending = queue.then(task);
  queue = pending.catch(error => reportError(error).catch(() => {}));
  return pending;
}

async function run(options) {
  const result = await reconcile(chrome, options);
  await badge(await getConfig(chrome), result.errors);
  return result;
}

function schedule() {
  if (timer !== null) return;
  timer = setTimeout(() => {
    timer = null;
    void enqueue(() => run()).catch(() => {});
  }, 200);
}

async function initialize() {
  const stored = await chrome.storage.local.get(CONFIG_KEY);
  if (!stored[CONFIG_KEY]) await chrome.storage.local.set({ [CONFIG_KEY]: defaultConfig() });
  if (!await chrome.alarms.get(RECOVERY_ALARM)) await chrome.alarms.create(RECOVERY_ALARM, { periodInMinutes: 1 });
  await run();
}

chrome.runtime.onInstalled.addListener(() => { void enqueue(initialize).catch(() => {}); });
chrome.runtime.onStartup.addListener(() => { void enqueue(initialize).catch(() => {}); });
chrome.tabs.onCreated.addListener(schedule);
chrome.tabs.onUpdated.addListener((_id, change) => {
  if (change.url !== undefined || change.pinned !== undefined || change.groupId !== undefined || change.status === "complete") schedule();
});
chrome.tabs.onAttached.addListener(schedule);
chrome.tabs.onDetached.addListener(schedule);
chrome.tabs.onRemoved.addListener(schedule);
chrome.tabs.onReplaced.addListener(schedule);
chrome.tabGroups.onRemoved.addListener(schedule);
chrome.tabGroups.onUpdated.addListener(schedule);
chrome.storage.onChanged.addListener((changes, area) => { if (area === "local" && changes[CONFIG_KEY]) schedule(); });
chrome.alarms.onAlarm.addListener(alarm => { if (alarm.name === RECOVERY_ALARM) schedule(); });

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id) return false;
  const handler = async () => {
    switch (message?.type) {
      case "GET_STATE": {
        const config = await getConfig(chrome);
        const stored = await chrome.storage.session.get(STATUS_KEY);
        return { config, status: stored[STATUS_KEY] || null };
      }
      case "SAVE_CONFIG": {
        const config = normalizeConfig(message.config);
        await chrome.storage.local.set({ [CONFIG_KEY]: config });
        const result = await run();
        return { config, result };
      }
      case "SET_ENABLED": {
        if (typeof message.enabled !== "boolean") throw new Error("Stato non valido.");
        const config = await getConfig(chrome);
        config.enabled = message.enabled;
        await chrome.storage.local.set({ [CONFIG_KEY]: config });
        const result = await run();
        return { config, result };
      }
      case "RECONCILE": return { result: await run({ force: true }) };
      default: throw new Error("Richiesta non riconosciuta.");
    }
  };
  // Reading state is cheap and must not wait for a long reconciliation.
  const request = message?.type === "GET_STATE" ? handler() : enqueue(handler);
  request.then(result => respond({ ok: true, ...result }), error => respond({ ok: false, error: error.message }));
  return true;
});

// Check alarm state whenever Chrome revives this worker (also after an update).
void chrome.alarms.get(RECOVERY_ALARM).then(alarm => {
  if (!alarm) return chrome.alarms.create(RECOVERY_ALARM, { periodInMinutes: 1 });
}).catch(error => reportError(error).catch(() => {}));
