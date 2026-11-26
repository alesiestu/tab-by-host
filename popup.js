import { COLORS, compileRules, matchRule, t } from "./core.js";
import { localizeDocument } from "./i18n.js";
const $ = id => document.getElementById(id);
let config;
async function request(type, extra = {}) {
  const response = await chrome.runtime.sendMessage({ type, ...extra });
  if (!response?.ok) throw new Error(response?.error || t("reloadRetry"));
  return response;
}
async function render() {
  $("enabled").checked = config.enabled;
  $("state").textContent = t(config.enabled ? "popupActive" : "popupPaused");
  const count = config.rules.filter(rule => rule.enabled).length;
  $("rule-summary").textContent = count === 1 ? t("popupRuleCountOne") : t("popupRuleCount", count);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.pendingUrl || tab?.url;
  const rule = matchRule(url, compileRules(config.rules));
  let host = t("popupThisTab");
  try { host = new URL(url).host || host; } catch { /* Internal Chrome page. */ }
  $("active-host").textContent = `${host} → ${tab?.pinned ? t("popupPinned") : rule?.group || t("popupNoRule")}`;
  $("active-host").style.setProperty("--rule-color", rule ? COLORS[rule.color].hex : COLORS.grey.hex);
}
localizeDocument();
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
  try { const { result } = await request("RECONCILE"); $("status").textContent = t("resultApplied", result.matched, result.changed) + (result.errors ? t("resultBusy") : ""); }
  catch (error) { $("status").textContent = error.message; }
  finally { $("apply").disabled = false; }
});
try { config = (await request("GET_STATE")).config; await render(); }
catch (error) { $("status").textContent = error.message; }
