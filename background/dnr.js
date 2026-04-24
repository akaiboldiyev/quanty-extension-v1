// dnr.js — background only
import { normalizeDomain } from "../shared/settings.js";

const RULE_BASE = 32000;
const RULE_MAX = 32100;

function makeRuleId(i) {
  return RULE_BASE + i;
}

function extensionBlockedUrl() {
  return chrome.runtime.getURL("pages/blocked.html");
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toRegexFilter(domain) {
  const d = normalizeDomain(domain);
  if (!d) return null;
  
 // YouTube: разреши только поиск
  if (d === "youtube.com") {
  return `^https?://([a-z0-9-]+\\.)*youtube\\.com/(?!results|search)`;
  }
 // Google: разреши только поиск
  if (d === "google.com") {
  return `^https?://([a-z0-9-]+\\.)*google\\.com/(?!search|results)`;
  }
  
  return `^https?://([a-z0-9-]+\\.)*${escapeRegex(d)}/`;
}

export async function clearRedirectRules() {
  const ids = [];
  for (let i = RULE_BASE; i <= RULE_MAX; i += 1) ids.push(i);
  try {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: ids,
      addRules: [],
    });
  } catch (error) {
    console.error("Error clearing redirect rules:", error.message);
  }
}

export async function ensureRedirectRules(settings) {
  const domains = Array.isArray(settings.blocklistDomains)
    ? settings.blocklistDomains
    : [];
  const addRules = [];
  let idx = 0;
  for (const dom of domains) {
    const f = toRegexFilter(dom);
    if (!f) continue;
    if (RULE_BASE + idx > RULE_MAX) break;
    addRules.push({
      id: makeRuleId(idx),
      priority: 1,
      action: {
        type: "redirect",
        redirect: {
          url: `${extensionBlockedUrl()}?from=${encodeURIComponent(dom)}`,
        },
      },
      condition: {
        regexFilter: f,
        resourceTypes: ["main_frame"],
      },
    });
    idx += 1;
  }

  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existingRules
    .filter(rule => rule.id >= RULE_BASE && rule.id <= RULE_MAX)
    .map(rule => rule.id);

  try {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds,
      addRules,
    });
  } catch (error) {
    console.error("Error updating redirect rules:", error.message);
  }
}