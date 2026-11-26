// Applies _locales strings to static markup.
// Keep the HTML free of user-facing text: data-i18n is the single source.
import { t } from "./core.js";

export function localizeDocument(root = document) {
  for (const node of root.querySelectorAll("[data-i18n]")) node.textContent = t(node.dataset.i18n);
  for (const node of root.querySelectorAll("[data-i18n-title]")) node.title = t(node.dataset.i18nTitle);
  for (const node of root.querySelectorAll("[data-i18n-aria]")) node.setAttribute("aria-label", t(node.dataset.i18nAria));
  for (const node of root.querySelectorAll("[data-i18n-placeholder]")) node.placeholder = t(node.dataset.i18nPlaceholder);
  const title = root.querySelector("title[data-i18n-title-text]");
  if (title) title.textContent = t(title.dataset.i18nTitleText);
  root.documentElement.lang = chrome.i18n.getUILanguage().split("-")[0];
}
