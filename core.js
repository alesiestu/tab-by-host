// Messages live in _locales. core.js also runs under Node in the test suite,
// where chrome.i18n does not exist: fall back to the key so logic stays testable.
export function t(key, ...substitutions) {
  const message = globalThis.chrome?.i18n?.getMessage?.(key, substitutions.map(String));
  return message || key;
}

// Storage keys keep their original names on purpose: renaming them would
// orphan the rules of anyone who already installed the extension.
export const CONFIG_KEY = "hostGroupsConfig";
export const SESSION_KEY = "hostGroupsSession";
export const STATUS_KEY = "hostGroupsStatus";
// Labels are resolved lazily: chrome.i18n is not ready at module evaluation time
// in every context, and the locale must not be baked into a constant.
export const COLORS = {
  grey: { get label() { return t("colorGrey"); }, hex: "#8290a6" },
  blue: { get label() { return t("colorBlue"); }, hex: "#699bff" },
  red: { get label() { return t("colorRed"); }, hex: "#f27c86" },
  yellow: { get label() { return t("colorYellow"); }, hex: "#efcc64" },
  green: { get label() { return t("colorGreen"); }, hex: "#64d4ac" },
  pink: { get label() { return t("colorPink"); }, hex: "#ee95ce" },
  purple: { get label() { return t("colorPurple"); }, hex: "#b69bff" },
  cyan: { get label() { return t("colorCyan"); }, hex: "#69d6e7" },
  orange: { get label() { return t("colorOrange"); }, hex: "#f5a76c" }
};

export function defaultConfig() {
  return { version: 1, enabled: true, rules: [] };
}

// Hostname comparisons use the URL parser, never a substring of the full URL.
// Keeping the port as a separate condition also supports localhost:3000.
export function parseHost(input) {
  if (typeof input !== "string" || !input.trim()) throw new Error(t("errHostEmpty"));
  const value = input.trim();
  const hasScheme = /^https?:\/\//i.test(value);
  if (/\s|[\\*@]/u.test(value)) throw new Error(t("errHostChars"));
  let url;
  try { url = new URL(hasScheme ? value : `http://${value}`); }
  catch { throw new Error(t("errHostParse")); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password ||
      (!hasScheme && (url.pathname !== "/" || url.search || url.hash))) {
    throw new Error(t("errHostOnly"));
  }
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!hostname || hostname.startsWith(".") || hostname.includes("..") ||
      !/^(?:[a-z0-9_.-]+|\[[0-9a-f:.]+\])$/i.test(hostname)) {
    throw new Error(t("errHostname"));
  }
  // Preserve an explicit default port too: http://example.com:80 is port-specific.
  const authority = (hasScheme ? value.replace(/^https?:\/\//i, "") : value).split(/[/?#]/, 1)[0];
  const explicitPort = authority.match(/:(\d+)$/)?.[1];
  const port = explicitPort ? String(Number(explicitPort)) : "";
  if (explicitPort && (!Number.isInteger(Number(explicitPort)) || Number(explicitPort) < 1 || Number(explicitPort) > 65535)) {
    throw new Error(t("errPortRange"));
  }
  if (authority.endsWith(":")) throw new Error(t("errPortMissing"));
  return { hostname, port, host: `${hostname}${port ? `:${port}` : ""}` };
}

export function normalizeConfig(input) {
  if (!input || typeof input !== "object" || Array.isArray(input) || input.version !== 1 || !Array.isArray(input.rules)) {
    throw new Error(t("errConfigShape"));
  }
  if (input.rules.length > 250) throw new Error(t("errTooManyRules"));
  if (typeof input.enabled !== "boolean") throw new Error(t("errEnabledFlag"));
  const ids = new Set();
  const groupColors = new Map();
  const rules = input.rules.map((rule, index) => {
    const prefix = t("errRulePrefix", index + 1);
    if (!rule || typeof rule !== "object") throw new Error(prefix + t("errRuleData"));
    let parsed;
    try { parsed = parseHost(rule.host); } catch (error) { throw new Error(prefix + error.message); }
    if (typeof rule.id !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(rule.id) || ids.has(rule.id)) {
      throw new Error(prefix + t("errRuleId"));
    }
    ids.add(rule.id);
    const group = typeof rule.group === "string" ? rule.group.trim() : "";
    if (!group || group.length > 60 || /[\u0000-\u001f\u007f]/.test(group)) {
      throw new Error(prefix + t("errRuleGroup"));
    }
    if (!Object.hasOwn(COLORS, rule.color)) throw new Error(prefix + t("errRuleColor"));
    if (typeof rule.enabled !== "boolean" || typeof rule.includeSubdomains !== "boolean") {
      throw new Error(prefix + t("errRuleOptions"));
    }
    if (groupColors.has(group) && groupColors.get(group) !== rule.color) {
      throw new Error(t("errGroupColor", group));
    }
    groupColors.set(group, rule.color);
    return { id: rule.id, host: parsed.host, group, color: rule.color, includeSubdomains: rule.includeSubdomains, enabled: rule.enabled };
  });
  return { version: 1, enabled: input.enabled, rules };
}

export function compileRules(rules) {
  return rules.filter(rule => rule.enabled).map(rule => ({ ...rule, ...parseHost(rule.host) }));
}

export function matchRule(urlValue, compiledRules) {
  let url;
  try { url = new URL(urlValue); } catch { return null; }
  if (!["http:", "https:"].includes(url.protocol)) return null;
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  const port = url.port || (url.protocol === "https:" ? "443" : "80");
  return compiledRules.find(rule =>
    (host === rule.hostname || (rule.includeSubdomains && host.endsWith(`.${rule.hostname}`))) &&
    (!rule.port || rule.port === port)
  ) || null;
}

export function matchingTab(tab, rules) {
  if (tab.pinned || tab.incognito) return null;
  return matchRule(tab.pendingUrl || tab.url, rules);
}
