// Deterministic in-memory Chrome API for lifecycle and browser-state scenarios.
// It enforces Chrome constraints: normal windows, pinned tabs and group lifetimes.
const copy = value => structuredClone(value);
function event() {
  const listeners = new Set();
  return { addListener: fn => listeners.add(fn), removeListener: fn => listeners.delete(fn), emit: (...args) => { for (const fn of listeners) fn(...args); } };
}
export function chromeHarness(initialTabs = [], initialGroups = []) {
  const tabs = new Map(initialTabs.map(tab => [tab.id, { groupId: -1, windowId: 1, pinned: false, incognito: false, windowType: "normal", ...copy(tab) }]));
  const groups = new Map(initialGroups.map(group => [group.id, { collapsed: false, ...copy(group) }]));
  const operations = [];
  let nextGroupId = 1000;
  const failures = { group: 0, ungroup: 0 };
  const onChanged = event();
  const storageArea = area => {
    const data = {};
    return {
      data,
      async get(key) { return key ? { [key]: copy(data[key]) } : copy(data); },
      async set(values) {
        const changes = {};
        for (const [key, value] of Object.entries(values)) {
          if (JSON.stringify(data[key]) === JSON.stringify(value)) continue;
          changes[key] = { oldValue: copy(data[key]), newValue: copy(value) }; data[key] = copy(value);
        }
        if (Object.keys(changes).length) onChanged.emit(changes, area);
      }
    };
  };
  const api = {
    runtime: { id: "test-extension", onMessage: event(), onInstalled: event(), onStartup: event() },
    storage: { local: storageArea("local"), session: storageArea("session"), onChanged },
    tabs: { onCreated: event(), onUpdated: event(), onAttached: event(), onDetached: event(), onRemoved: event(), onReplaced: event() },
    tabGroups: { onRemoved: event(), onUpdated: event() },
    alarms: { onAlarm: event() },
    action: { async setBadgeText() {}, async setBadgeBackgroundColor() {} }
  };
  const cleanGroups = () => {
    for (const [id, group] of groups) if (![...tabs.values()].some(tab => tab.groupId === id)) {
      groups.delete(id); api.tabGroups.onRemoved.emit(group);
    }
  };
  api.tabs.query = async query => copy([...tabs.values()].filter(tab => Object.entries(query).every(([key, value]) => tab[key] === value)));
  api.tabs.get = async id => { if (!tabs.has(id)) throw new Error("No tab with id"); return copy(tabs.get(id)); };
  api.tabGroups.query = async query => copy([...groups.values()].filter(group => Object.entries(query).every(([key, value]) => group[key] === value)));
  api.tabGroups.get = async id => { if (!groups.has(id)) throw new Error("No group with id"); return copy(groups.get(id)); };
  api.tabGroups.update = async (id, update) => {
    if (!groups.has(id)) throw new Error("No group with id");
    Object.assign(groups.get(id), update); operations.push(["update", id, copy(update)]); api.tabGroups.onUpdated.emit(groups.get(id));
    return copy(groups.get(id));
  };
  api.tabs.group = async options => {
    if (failures.group > 0) { failures.group--; throw new Error("Tabs cannot be edited right now (user may be dragging a tab)."); }
    const ids = Array.isArray(options.tabIds) ? options.tabIds : [options.tabIds];
    const moving = ids.map(id => tabs.get(id));
    if (moving.some(tab => !tab || tab.pinned || tab.windowType !== "normal")) throw new Error("Cannot group this tab");
    let groupId = options.groupId;
    const windowId = options.createProperties?.windowId ?? groups.get(groupId)?.windowId;
    if (moving.some(tab => tab.windowId !== windowId)) throw new Error("Cross-window move attempted");
    if (groupId === undefined) { groupId = nextGroupId++; groups.set(groupId, { id: groupId, windowId, title: "", color: "grey", collapsed: false }); }
    if (!groups.has(groupId)) throw new Error("No group with id");
    for (const tab of moving) { tab.groupId = groupId; api.tabs.onUpdated.emit(tab.id, { groupId }, tab); }
    operations.push(["group", copy(ids), groupId]); cleanGroups(); return groupId;
  };
  api.tabs.ungroup = async id => {
    if (failures.ungroup > 0) { failures.ungroup--; throw new Error("Tab strip busy"); }
    if (!tabs.has(id)) throw new Error("No tab with id");
    const tab = tabs.get(id); tab.groupId = -1; operations.push(["ungroup", id]); api.tabs.onUpdated.emit(id, { groupId: -1 }, tab); cleanGroups();
  };
  const alarmMap = new Map();
  api.alarms.get = async name => copy(alarmMap.get(name));
  api.alarms.create = async (name, info) => { alarmMap.set(name, { name, ...copy(info) }); };
  return {
    api, tabs, groups, operations, failures,
    add(tab) { tabs.set(tab.id, { groupId: -1, windowId: 1, pinned: false, incognito: false, windowType: "normal", ...copy(tab) }); api.tabs.onCreated.emit(tabs.get(tab.id)); },
    navigate(id, url) { const tab = tabs.get(id); tab.url = url; delete tab.pendingUrl; api.tabs.onUpdated.emit(id, { url, status: "complete" }, tab); },
    close(id) { tabs.delete(id); cleanGroups(); api.tabs.onRemoved.emit(id, { windowId: 1 }); },
    message(message) {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Message response timed out")), 3000);
        api.runtime.onMessage.emit(message, { id: api.runtime.id }, response => { clearTimeout(timeout); resolve(response); });
      });
    }
  };
}
