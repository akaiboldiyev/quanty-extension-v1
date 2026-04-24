export function getDefaultSettings() {
  return {
    blocklistDomains: ["youtube.com", "tiktok.com"],
    stage1GraceSeconds: 20,
    stage2WaitSeconds: 10,
    dailyLimitMinutes: 30,
    redirectAlwaysOn: false,
    goal: "",
    currentTask: "",
    aiEnabled: true,
    geminiApiKey: "",
    blockLevel: "medium",   // "easy" | "medium" | "hard"
    lang: "en",             // "en" | "ru"  — default English
  };
}

export function todayKey() {
  return new Date().toISOString().split("T")[0];
}

export function normalizeDomain(urlOrDomain) {
  const raw = String(urlOrDomain || "").trim().toLowerCase();
  if (!raw) return "";
  
  // Пропусти IP адреса
  if (/^\d+\.\d+\.\d+\.\d+/.test(raw)) return raw;
  
  try {
  const u = raw.includes("://") ? new URL(raw) : new URL(`https://${raw}`);
  const host = (u.hostname || "").toLowerCase();
  return host.replace(/^www\./, "");
  } catch {
  return raw
  .replace(/^https?:\/\//, "")
  .replace(/^www\./, "")
  .split("/")[0]
  .split("?")[0]
  .replace(/:\d+$/, "");
  }
}

export function isDomainBlockedBySettings(domain, settings) {
  const d = normalizeDomain(domain);
  if (!d) return false;
  const list = Array.isArray(settings.blocklistDomains) ? settings.blocklistDomains : [];
  for (const item of list) {
  const it = normalizeDomain(item);
    if (!it) continue;
 // Точное совпадение
    if (d === it) return true;
 // Поддомены: example.com блокирует *.example.com
    if (d.endsWith(`.${it}`) && !d.includes(`..`)) return true;
}
return false;
}
