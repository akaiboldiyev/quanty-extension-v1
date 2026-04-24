// options.js — language settings removed (English-only)

function normalizeDomain(urlOrDomain) {
  const raw = String(urlOrDomain || "").trim().toLowerCase();
  if (!raw) return "";
  try {
    const u = raw.includes("://") ? new URL(raw) : new URL(`https://${raw}`);
    return (u.hostname || "").toLowerCase().replace(/^www\./, "");
  } catch {
    return raw
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0]
      .split("?")[0]
      .replace(/:\d+$/, "");
  }
}

function getDefaultSettings() {
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
    blockLevel: "medium",
  };
}

const els = {
  saveBtn:            document.getElementById("saveBtn"),
  resetTodayBtn:      document.getElementById("resetTodayBtn"),
  domainInput:        document.getElementById("domainInput"),
  addDomainBtn:       document.getElementById("addDomainBtn"),
  domains:            document.getElementById("domains"),
  stage1GraceSeconds: document.getElementById("stage1GraceSeconds"),
  stage2WaitSeconds:  document.getElementById("stage2WaitSeconds"),
  dailyLimitMinutes:  document.getElementById("dailyLimitMinutes"),
  redirectAlwaysOn:   document.getElementById("redirectAlwaysOn"),
  goal:               document.getElementById("goal"),
  currentTask:        document.getElementById("currentTask"),
  apiKeyInput:        document.getElementById("apiKeyInput"),
};

let settings = getDefaultSettings();

async function load() {
  try {
    const res = await chrome.runtime.sendMessage({ type: "quanty:getSettings" });
    settings = { ...getDefaultSettings(), ...(res?.settings || {}) };
  } catch {
    settings = getDefaultSettings();
  }

  els.stage1GraceSeconds.value = String(settings.stage1GraceSeconds ?? 20);
  els.stage2WaitSeconds.value  = String(settings.stage2WaitSeconds ?? 10);
  els.dailyLimitMinutes.value  = String(settings.dailyLimitMinutes ?? 30);
  els.redirectAlwaysOn.checked = !!settings.redirectAlwaysOn;
  els.goal.value               = settings.goal || "";
  els.currentTask.value        = settings.currentTask || "";
  if (els.apiKeyInput) els.apiKeyInput.value = settings.geminiApiKey || "";

  renderDomains();
  highlightActiveLevel();
}

function renderDomains() {
  const list = Array.isArray(settings.blocklistDomains) ? settings.blocklistDomains : [];
  els.domains.innerHTML = list
    .map((d, i) => `<span class="chip">${escapeHtml(d)}<button type="button" data-i="${i}">×</button></span>`)
    .join("");
  els.domains.querySelectorAll("button[data-i]").forEach((b) => {
    b.addEventListener("click", () => {
      settings.blocklistDomains.splice(Number(b.getAttribute("data-i")), 1);
      renderDomains();
    });
  });
}

function escapeHtml(t) {
  const div = document.createElement("div");
  div.textContent = String(t);
  return div.innerHTML;
}

function addDomain() {
  const v = normalizeDomain(els.domainInput.value);
  if (!v) return;
  if (!settings.blocklistDomains.some((x) => normalizeDomain(x) === v)) {
    settings.blocklistDomains.push(v);
  }
  els.domainInput.value = "";
  renderDomains();
}

async function save() {
  settings.stage1GraceSeconds = Math.max(0, Math.min(300, parseInt(els.stage1GraceSeconds.value, 10) || 0));
  settings.stage2WaitSeconds  = Math.max(0, Math.min(60,  parseInt(els.stage2WaitSeconds.value,  10) || 0));
  settings.dailyLimitMinutes  = Math.max(0, Math.min(1440,parseInt(els.dailyLimitMinutes.value,  10) || 0));
  settings.redirectAlwaysOn   = !!els.redirectAlwaysOn.checked;
  settings.goal               = (els.goal.value || "").trim();
  settings.currentTask        = (els.currentTask.value || "").trim();
  if (els.apiKeyInput) settings.geminiApiKey = (els.apiKeyInput.value || "").trim();

  const activeLvl = document.querySelector(".btn[data-level].active-level");
  if (activeLvl) settings.blockLevel = activeLvl.dataset.level;

  await chrome.runtime.sendMessage({ type: "quanty:setSettings", settings });
  alert("Saved!");
}

els.addDomainBtn.addEventListener("click", addDomain);
els.domainInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); addDomain(); }
});
els.saveBtn.addEventListener("click", save);
els.resetTodayBtn.addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "quanty:resetToday" });
  alert("Reset.");
});

// ── Block level buttons ────────────────────────────────────
const LVL_DESC = {
  easy:   "Easy: gentle overlay — you decide if the site is OK",
  medium: "Medium: wait timer + YouTube cleanup (default)",
  hard:   "Hard: immediate block, only Google & YouTube search allowed",
};

function highlightActiveLevel() {
  const lvl = settings.blockLevel || "medium";
  document.querySelectorAll(".btn[data-level]").forEach(b =>
    b.classList.toggle("active-level", b.dataset.level === lvl)
  );
  const desc = document.getElementById("lvlDesc");
  if (desc) desc.textContent = LVL_DESC[lvl] || "";
}

document.querySelectorAll(".btn[data-level]").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".btn[data-level]").forEach(b => b.classList.remove("active-level"));
    btn.classList.add("active-level");
    const desc = document.getElementById("lvlDesc");
    if (desc) desc.textContent = LVL_DESC[btn.dataset.level] || "";
  });
});

load().catch(() => {});