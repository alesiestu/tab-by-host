export const CONFIG_KEY = "hostGroupsConfig";
export const SESSION_KEY = "hostGroupsSession";
export const STATUS_KEY = "hostGroupsStatus";
export const COLORS = {
  grey: { label: "Grigio", hex: "#8290a6" },
  blue: { label: "Blu", hex: "#699bff" },
  red: { label: "Rosso", hex: "#f27c86" },
  yellow: { label: "Giallo", hex: "#efcc64" },
  green: { label: "Verde", hex: "#64d4ac" },
  pink: { label: "Rosa", hex: "#ee95ce" },
  purple: { label: "Viola", hex: "#b69bff" },
  cyan: { label: "Ciano", hex: "#69d6e7" },
  orange: { label: "Arancione", hex: "#f5a76c" }
};

export function defaultConfig() {
  return { version: 1, enabled: true, rules: [] };
}

// Hostname comparisons use the URL parser, never a substring of the full URL.
// Keeping the port as a separate condition also supports localhost:3000.
export function parseHost(input) {
  if (typeof input !== "string" || !input.trim()) throw new Error("Inserisci un host.");
  const value = input.trim();
  const hasScheme = /^https?:\/\//i.test(value);
  if (/\s|[\\*@]/u.test(value)) throw new Error("Host non valido: usa un host senza spazi, wildcard o credenziali.");
  let url;
  try { url = new URL(hasScheme ? value : `http://${value}`); }
  catch { throw new Error("Host non valido. Esempio: staging.example.com oppure localhost:3000."); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password ||
      (!hasScheme && (url.pathname !== "/" || url.search || url.hash))) {
    throw new Error("Inserisci soltanto l’host oppure incolla un URL http/https completo.");
  }
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!hostname || hostname.startsWith(".") || hostname.includes("..") ||
      !/^(?:[a-z0-9_.-]+|\[[0-9a-f:.]+\])$/i.test(hostname)) {
    throw new Error("Hostname non valido.");
  }
  // Preserve an explicit default port too: http://example.com:80 is port-specific.
  const authority = (hasScheme ? value.replace(/^https?:\/\//i, "") : value).split(/[/?#]/, 1)[0];
  const explicitPort = authority.match(/:(\d+)$/)?.[1];
  const port = explicitPort ? String(Number(explicitPort)) : "";
  if (explicitPort && (!Number.isInteger(Number(explicitPort)) || Number(explicitPort) < 1 || Number(explicitPort) > 65535)) {
    throw new Error("La porta deve essere compresa tra 1 e 65535.");
  }
  if (authority.endsWith(":")) throw new Error("Indica una porta valida dopo i due punti.");
  return { hostname, port, host: `${hostname}${port ? `:${port}` : ""}` };
}

export function normalizeConfig(input) {
  if (!input || typeof input !== "object" || Array.isArray(input) || input.version !== 1 || !Array.isArray(input.rules)) {
    throw new Error("Configurazione non valida: formato o versione non supportati.");
  }
  if (input.rules.length > 250) throw new Error("Puoi configurare al massimo 250 regole.");
  if (typeof input.enabled !== "boolean") throw new Error("Lo stato del raggruppamento deve essere attivo o sospeso.");
  const ids = new Set();
  const groupColors = new Map();
  const rules = input.rules.map((rule, index) => {
    const prefix = `Regola ${index + 1}: `;
    if (!rule || typeof rule !== "object") throw new Error(prefix + "dati non validi.");
    let parsed;
    try { parsed = parseHost(rule.host); } catch (error) { throw new Error(prefix + error.message); }
    if (typeof rule.id !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(rule.id) || ids.has(rule.id)) {
      throw new Error(prefix + "identificativo mancante o duplicato.");
    }
    ids.add(rule.id);
    const group = typeof rule.group === "string" ? rule.group.trim() : "";
    if (!group || group.length > 60 || /[\u0000-\u001f\u007f]/.test(group)) {
      throw new Error(prefix + "il nome del gruppo deve avere da 1 a 60 caratteri.");
    }
    if (!Object.hasOwn(COLORS, rule.color)) throw new Error(prefix + "colore non valido.");
    if (typeof rule.enabled !== "boolean" || typeof rule.includeSubdomains !== "boolean") {
      throw new Error(prefix + "opzioni non valide.");
    }
    if (groupColors.has(group) && groupColors.get(group) !== rule.color) {
      throw new Error(`Il gruppo “${group}” deve avere lo stesso colore in tutte le regole.`);
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
