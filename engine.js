import { CONFIG_KEY, SESSION_KEY, STATUS_KEY, compileRules, defaultConfig, matchingTab, normalizeConfig } from "./core.js";

export async function getConfig(api) {
  const stored = await api.storage.local.get(CONFIG_KEY);
  return normalizeConfig(stored[CONFIG_KEY] ?? defaultConfig());
}

// One reconciliation at a time is enforced by the background worker.
// Group IDs and ownership survive worker suspension through storage.session.
export async function reconcile(api, { force = false } = {}) {
  const config = await getConfig(api);
  if (!config.enabled && !force) return { paused: true, matched: 0, changed: 0, errors: 0 };
  const rules = compileRules(config.rules);
  const [tabs, groups, stored] = await Promise.all([
    api.tabs.query({ windowType: "normal" }),
    api.tabGroups.query({}),
    api.storage.session.get(SESSION_KEY)
  ]);
  const previous = stored[SESSION_KEY] || { groups: [], tabs: {} };
  const liveGroups = new Map(groups.map(group => [group.id, group]));
  const registry = previous.groups.filter(entry => liveGroups.get(entry.id)?.windowId === entry.windowId);
  const ownedTabs = {};
  const buckets = new Map();
  const release = [];
  let matched = 0;
  let changed = 0;
  let errors = 0;

  for (const tab of tabs) {
    const old = previous.tabs[tab.id];
    if (old && old.groupId === tab.groupId && liveGroups.has(tab.groupId)) ownedTabs[tab.id] = old;
    const rule = matchingTab(tab, rules);
    if (!rule) {
      if (ownedTabs[tab.id] && tab.groupId !== -1 && !tab.pinned) release.push(tab.id);
      else delete ownedTabs[tab.id];
      continue;
    }
    matched++;
    const key = JSON.stringify([tab.windowId, rule.group]);
    if (!buckets.has(key)) buckets.set(key, { windowId: tab.windowId, group: rule.group, color: rule.color, tabs: [] });
    buckets.get(key).tabs.push(tab);
  }

  for (const tabId of release) {
    try {
      const fresh = await api.tabs.get(tabId);
      if (fresh.groupId === ownedTabs[tabId].groupId && !matchingTab(fresh, rules) && !fresh.pinned) {
        await api.tabs.ungroup(tabId); changed++;
      }
      delete ownedTabs[tabId];
    }
    catch { errors++; }
  }

  const nextRegistry = [];
  for (const bucket of buckets.values()) {
    let groupId = registry.find(entry => entry.windowId === bucket.windowId && entry.name === bucket.group)?.id;
    let group = null;
    if (groupId !== undefined) {
      try { group = await api.tabGroups.get(groupId); } catch { groupId = undefined; }
      if (group && group.windowId !== bucket.windowId) { group = null; groupId = undefined; }
    }
    try {
      // Re-read before moving: a user may have closed, pinned or moved a tab.
      const freshTabs = await api.tabs.query({ windowId: bucket.windowId });
      const eligible = bucket.tabs.map(tab => freshTabs.find(fresh => fresh.id === tab.id)).filter(tab => {
        if (!tab) return false;
        return matchingTab(tab, rules)?.group === bucket.group;
      });
      if (!eligible.length) continue;
      const moving = eligible.filter(tab => tab.groupId !== groupId);
      if (groupId === undefined) {
        groupId = await api.tabs.group({ tabIds: eligible.map(tab => tab.id), createProperties: { windowId: bucket.windowId } });
        // Persist ownership before the next API call, so interruption is recoverable.
        group = null;
        changed += eligible.length;
      } else if (moving.length) {
        await api.tabs.group({ tabIds: moving.map(tab => tab.id), groupId });
        changed += moving.length;
      }
      for (const tab of eligible) ownedTabs[tab.id] = { groupId };
      const entry = { id: groupId, windowId: bucket.windowId, name: bucket.group };
      nextRegistry.push(entry);
      await api.storage.session.set({ [SESSION_KEY]: { groups: [...registry.filter(item => item.id !== groupId), ...nextRegistry], tabs: ownedTabs } });
      if (!group || group.title !== bucket.group || group.color !== bucket.color) {
        await api.tabGroups.update(groupId, { title: bucket.group, color: bucket.color });
      }
    } catch {
      // A tab being dragged cannot be edited. The next event / recovery alarm retries.
      errors++;
      if (groupId !== undefined && !nextRegistry.some(entry => entry.id === groupId)) {
        nextRegistry.push({ id: groupId, windowId: bucket.windowId, name: bucket.group });
      }
    }
  }
  // Retain still-live ownership even after a temporary group operation error.
  const registryById = new Map(registry.map(entry => [entry.id, entry]));
  for (const entry of nextRegistry) registryById.set(entry.id, entry);
  const liveOwnedIds = new Set(Object.values(ownedTabs).map(entry => entry.groupId));
  const finalRegistry = [...registryById.values()].filter(entry => liveOwnedIds.has(entry.id) || nextRegistry.some(item => item.id === entry.id));
  await api.storage.session.set({ [SESSION_KEY]: { groups: finalRegistry, tabs: ownedTabs } });
  const status = { paused: !config.enabled, matched, changed, errors, at: Date.now() };
  await api.storage.session.set({ [STATUS_KEY]: status });
  return status;
}
