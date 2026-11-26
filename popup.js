import { COLORS, compileRules, matchRule } from "./core.js";
const $ = id => document.getElementById(id);
let config;
async function request(type, extra = {}) {
  const response = await chrome.runtime.sendMessage({ type, ...extra });
  if (!response?.ok) throw new Error(response?.error || "Ricarica l’estensione e riprova.");
  return response;
}
async function render() {
  $("enabled").checked = config.enabled;
  $("state").textContent = config.enabled ? "Automazione attiva" : "Automazione sospesa";
  const count = config.rules.filter(rule => rule.enabled).length;
  $("rule-summary").textContent = `${count} ${count === 1 ? "regola attiva" : "regole attive"}`;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.pendingUrl || tab?.url;
  const rule = matchRule(url, compileRules(config.rules));
  let host = "Questa scheda";
  try { host = new URL(url).host || host; } catch { /* Internal Chrome page. */ }
  $("active-host").textContent = `${host} → ${tab?.pinned ? "scheda fissata, esclusa" : rule?.group || "nessuna regola"}`;
  $("active-host").style.setProperty("--rule-color", rule ? COLORS[rule.color].hex : COLORS.grey.hex);
}
// Read the version from the manifest: it must stay in one place only.
$("version").textContent = chrome.runtime.getManifest().version;
$("options").addEventListener("click", () => chrome.runtime.openOptionsPage());
$("enabled").addEventListener("change", async () => {
  $("enabled").disabled = true;
  try { config = (await request("SET_ENABLED", { enabled: $("enabled").checked })).config; await render(); }
  catch (error) { $("status").textContent = error.message; if (config) $("enabled").checked = config.enabled; }
  finally { $("enabled").disabled = false; }
});
$("apply").addEventListener("click", async () => {
  $("apply").disabled = true;
  try { const { result } = await request("RECONCILE"); $("status").textContent = `${result.matched} schede corrispondenti, ${result.changed} aggiornate.${result.errors ? " Alcune schede sono occupate: riprova tra poco." : ""}`; }
  catch (error) { $("status").textContent = error.message; }
  finally { $("apply").disabled = false; }
});
try { config = (await request("GET_STATE")).config; await render(); }
catch (error) { $("status").textContent = error.message; }
