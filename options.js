import { COLORS, compileRules, defaultConfig, matchRule, normalizeConfig, parseHost, t } from "./core.js";
import { localizeDocument } from "./i18n.js";

const $ = id => document.getElementById(id);
let config = defaultConfig();
let editingId = null;
let pendingImport = null;
let busy = false;
const deleteArmed = new Set();

async function request(type, extra = {}) {
  const response = await chrome.runtime.sendMessage({ type, ...extra });
  if (!response?.ok) throw new Error(response?.error || t("notResponding"));
  return response;
}

function message(text, error = false) {
  $("message").textContent = text;
  $("message").className = `message ${error ? "is-error" : "is-success"}`;
  $("message").hidden = false;
}

function setBusy(value) {
  busy = value;
  for (const button of document.querySelectorAll("button")) button.disabled = value || button.dataset.edge === "true";
  $("enabled").disabled = value;
  for (const input of document.querySelectorAll(".rule-card input")) input.disabled = value;
}

async function save(next, success = t("savedApplied")) {
  if (busy) return false;
  setBusy(true);
  try {
    const response = await request("SAVE_CONFIG", { config: normalizeConfig(next) });
    config = response.config;
    render();
    message(response.result?.errors ? t("savedBusy") : config.enabled ? success : t("savedPaused"));
    return true;
  } catch (error) { message(error.message, true); return false; }
  finally { setBusy(false); }
}

function makeButton(label, action, className = "text-button") {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.className = className;
  button.addEventListener("click", action);
  return button;
}

function render() {
  $("enabled").checked = config.enabled;
  $("automation-dot").classList.toggle("paused", !config.enabled);
  $("automation-hint").textContent = t(config.enabled ? "automationOn" : "automationOff");
  $("rule-count").textContent = String(config.rules.length);
  $("empty").hidden = config.rules.length > 0;
  $("rules-list").replaceChildren();
  config.rules.forEach((rule, index) => {
    const card = document.createElement("article");
    card.className = `rule-card panel${rule.enabled ? "" : " rule-disabled"}`;
    card.style.setProperty("--rule-color", COLORS[rule.color].hex);
    const header = document.createElement("div"); header.className = "rule-top";
    const identity = document.createElement("div"); identity.className = "rule-identity";
    const order = document.createElement("span"); order.className = "rule-order"; order.textContent = String(index + 1).padStart(2, "0");
    const name = document.createElement("strong"); name.textContent = rule.group;
    const mark = document.createElement("span"); mark.className = "dot";
    identity.append(order, mark, name);
    const stateLabel = document.createElement("label"); stateLabel.className = "check compact";
    const enabled = document.createElement("input"); enabled.type = "checkbox"; enabled.checked = rule.enabled; enabled.setAttribute("aria-label", t("ruleEnableAria", rule.host));
    enabled.addEventListener("change", async () => { await save({ ...config, rules: config.rules.map(item => item.id === rule.id ? { ...item, enabled: enabled.checked } : item) }); render(); });
    const stateText = document.createElement("span"); stateText.textContent = t(rule.enabled ? "ruleActive" : "rulePaused");
    stateLabel.append(enabled, stateText); header.append(identity, stateLabel);
    const host = document.createElement("code"); host.className = "rule-host"; host.textContent = rule.host;
    const detail = document.createElement("p"); detail.className = "rule-detail"; detail.textContent = t(rule.includeSubdomains ? "ruleWithSubdomains" : "ruleHostOnly");
    const actions = document.createElement("div"); actions.className = "rule-actions";
    actions.append(makeButton(t("ruleEdit"), () => edit(rule)), makeButton(t(deleteArmed.has(rule.id) ? "ruleDeleteConfirm" : "ruleDelete"), async () => {
      if (!deleteArmed.has(rule.id)) { deleteArmed.add(rule.id); render(); return; }
      if (await save({ ...config, rules: config.rules.filter(item => item.id !== rule.id) })) {
        deleteArmed.delete(rule.id); if (editingId === rule.id) resetEditor();
      }
    }, "text-button danger"));
    if (deleteArmed.has(rule.id)) actions.append(makeButton(t("cancel"), () => { deleteArmed.delete(rule.id); render(); }));
    const reorder = document.createElement("div"); reorder.className = "reorder";
    for (const [symbol, delta, label] of [["↑", -1, "rulePriorityUp"], ["↓", 1, "rulePriorityDown"]]) {
      const button = makeButton(symbol, async () => {
        const rules = [...config.rules]; [rules[index], rules[index + delta]] = [rules[index + delta], rules[index]];
        await save({ ...config, rules });
      }, "order-button");
      button.setAttribute("aria-label", t(label, rule.host));
      button.dataset.edge = String(index + delta < 0 || index + delta >= config.rules.length);
      button.disabled = button.dataset.edge === "true";
      reorder.append(button);
    }
    actions.append(reorder); card.append(header, host, detail, actions); $("rules-list").append(card);
  });
  updateTest();
}

function resetEditor(focus = false) {
  editingId = null;
  $("rule-form").reset(); $("color").value = "orange";
  $("editor-heading").textContent = t("editorNewHeading");
  $("editor-eyebrow").textContent = t("editorNewEyebrow");
  $("save-rule").textContent = t("saveRule");
  $("cancel-edit").hidden = true; $("form-error").hidden = true;
  updatePreview(); if (focus) $("host").focus();
}

function edit(rule) {
  editingId = rule.id; $("host").value = rule.host; $("group").value = rule.group;
  $("color").value = rule.color; $("subdomains").checked = rule.includeSubdomains;
  $("editor-heading").textContent = t("editorEditHeading"); $("editor-eyebrow").textContent = t("editorEditEyebrow");
  $("save-rule").textContent = t("saveChanges"); $("cancel-edit").hidden = false; $("form-error").hidden = true;
  updatePreview(); $("host").focus();
}

function updatePreview() {
  $("preview-name").textContent = $("group").value.trim() || t("previewPlaceholder");
  $("preview").style.setProperty("--rule-color", COLORS[$("color").value]?.hex || COLORS.orange.hex);
}

function updateTest() {
  const input = $("test-url").value.trim();
  if (!input) { $("test-result").textContent = ""; return; }
  try {
    const parsed = parseHost(input);
    const url = /^https?:\/\//i.test(input) ? input : `http://${parsed.host}`;
    const rule = matchRule(url, compileRules(config.rules));
    $("test-result").textContent = rule
      ? t(config.enabled ? "testerMatch" : "testerMatchPaused", parsed.host, rule.group, COLORS[rule.color].label)
      : t("testerNoMatch", parsed.host);
    $("test-result").style.color = rule ? COLORS[rule.color].hex : "";
  } catch (error) { $("test-result").textContent = error.message; $("test-result").style.color = ""; }
}

for (const [value, color] of Object.entries(COLORS)) {
  const option = document.createElement("option"); option.value = value; option.textContent = color.label; $("color").append(option);
}
$("group").addEventListener("input", updatePreview); $("color").addEventListener("change", updatePreview);
$("add-rule").addEventListener("click", () => resetEditor(true)); $("first-rule").addEventListener("click", () => resetEditor(true));
$("cancel-edit").addEventListener("click", () => resetEditor());
$("rule-form").addEventListener("submit", async event => {
  event.preventDefault(); if (busy) return;
  $("form-error").hidden = true;
  try {
    const rule = { id: editingId || crypto.randomUUID(), host: parseHost($("host").value).host, group: $("group").value.trim(), color: $("color").value, includeSubdomains: $("subdomains").checked, enabled: config.rules.find(item => item.id === editingId)?.enabled ?? true };
    const rules = editingId ? config.rules.map(item => item.id === editingId ? rule : item) : [...config.rules, rule];
    const next = normalizeConfig({ ...config, rules });
    if (await save(next)) resetEditor();
  } catch (error) { $("form-error").textContent = error.message; $("form-error").hidden = false; }
});
$("enabled").addEventListener("change", async () => { await save({ ...config, enabled: $("enabled").checked }); render(); });
$("apply").addEventListener("click", async () => {
  if (busy) return; setBusy(true);
  try {
    const { result } = await request("RECONCILE");
    message(t("resultApplied", result.matched, result.changed) + (result.errors ? t("resultBusy") : ""));
  } catch (error) { message(error.message, true); } finally { setBusy(false); }
});
$("test-form").addEventListener("submit", event => { event.preventDefault(); updateTest(); });
$("test-url").addEventListener("input", updateTest);
$("export").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(config, null, 2) + "\n"], { type: "application/json" });
  const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
  anchor.href = url; anchor.download = "tab-by-host-rules.json"; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
$("import").addEventListener("click", () => $("import-file").click());
$("import-file").addEventListener("change", async () => {
  const file = $("import-file").files[0]; if (!file) return;
  try {
    if (file.size > 1024 * 1024) throw new Error(t("importTooLarge"));
    pendingImport = normalizeConfig(JSON.parse(await file.text()));
    $("import-summary").textContent = t("importSummary", pendingImport.rules.length, config.rules.length);
    $("import-review").hidden = false;
  } catch (error) { message(t("importFailed", error.message), true); }
  $("import-file").value = "";
});
$("cancel-import").addEventListener("click", () => { pendingImport = null; $("import-review").hidden = true; });
$("confirm-import").addEventListener("click", async () => {
  if (pendingImport && await save({ ...pendingImport, enabled: config.enabled })) {
    pendingImport = null; $("import-review").hidden = true; resetEditor();
  }
});

localizeDocument();
$("footer-version").textContent = chrome.runtime.getManifest().version;
resetEditor();
try { config = (await request("GET_STATE")).config; render(); }
catch (error) { message(error.message, true); }
