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

// A leading colon (":2083") means "any host on this port". A service such as
// cPanel or WHM answers on a fixed port across many different hostnames, so the
// port alone is the useful condition. Returned with an empty hostname, which is
// what matchRule reads to skip the host comparison.
function parsePortOnly(value) {
  const digits = value.slice(1);
  if (!digits) throw new Error(t("errPortMissing"));
  if (!/^\d+$/.test(digits)) throw new Error(t("errPortOnly"));
  const port = Number(digits);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(t("errPortRange"));
  return { hostname: "", port: String(port), host: `:${port}` };
}

// Hostname comparisons use the URL parser, never a substring of the full URL.
// Keeping the port as a separate condition also supports localhost:3000.
export function parseHost(input) {
  if (typeof input !== "string" || !input.trim()) throw new Error(t("errHostEmpty"));
  const value = input.trim();
  const hasScheme = /^https?:\/\//i.test(value);
  if (/\s|[\\*@]/u.test(value)) throw new Error(t("errHostChars"));
  if (value.startsWith(":")) return parsePortOnly(value);
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
    try { parsed = parseHost(rule.host); } catch (error) { throw new Error(prefix + error.message, { cause: error }); }
    if (typeof rule.id !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(rule.id) || ids.has(rule.id)) {
      throw new Error(prefix + t("errRuleId"));
    }
    ids.add(rule.id);
    const group = typeof rule.group === "string" ? rule.group.trim() : "";
    // Control characters would corrupt the group title: rejected on purpose.
    // eslint-disable-next-line no-control-regex
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
    // Subdomains are meaningless without a hostname: stored as false so the
    // rule round-trips through export/import unchanged.
    const includeSubdomains = parsed.hostname === "" ? false : rule.includeSubdomains;
    return { id: rule.id, host: parsed.host, group, color: rule.color, includeSubdomains, enabled: rule.enabled };
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
    // An empty hostname is a port-only rule: the port is the whole condition.
    (rule.hostname === "" ||
      host === rule.hostname ||
      (rule.includeSubdomains && host.endsWith(`.${rule.hostname}`))) &&
    (!rule.port || rule.port === port)
  ) || null;
}

// Pure half of the "check an address" box, so it can be tested without a DOM.
// Rebuilding the URL from the parsed host is what makes a bare host testable:
// matchRule needs an absolute URL, but the user may type just "example.com".
export function resolveTestUrl(input) {
  const parsed = parseHost(input);
  // ":2083" is a valid rule but not an address anyone can visit: without a host
  // there is nothing to build a URL from, so the tester must say so.
  if (parsed.hostname === "") throw new Error(t("errTestPortOnly"));
  return { parsed, url: /^https?:\/\//i.test(input.trim()) ? input.trim() : `http://${parsed.host}` };
}

// Import replaces the rules but keeps the current automation state: see options.js.
export function applyImport(current, imported) {
  return { ...imported, enabled: current.enabled };
}

// Swaps a rule with its neighbour. Returns null at the edges so callers can
// treat "cannot move" explicitly instead of silently producing a bad order.
export function reorderRules(rules, index, delta) {
  const target = index + delta;
  if (index < 0 || index >= rules.length || target < 0 || target >= rules.length) return null;
  const next = [...rules];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function matchingTab(tab, rules) {
  if (tab.pinned || tab.incognito) return null;
  return matchRule(tab.pendingUrl || tab.url, rules);
}
