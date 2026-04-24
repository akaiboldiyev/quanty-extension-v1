// service_worker.js — Quanty background worker (English-only)

import {
  getDefaultSettings,
  normalizeDomain,
  isDomainBlockedBySettings,
  todayKey,
} from "../shared/settings.js";
import { ensureRedirectRules, clearRedirectRules } from "./dnr.js";
import { buildCoachMessage } from "./coach.js";

const PROXY = "https://quanty-proxy-production.up.railway.app";

const STORAGE_KEYS = {
  settings: "settings",
  runtime:  "runtime",
  proof:    "proof",
};

// ── storage helpers ──────────────────────────────────────────
async function storageGet(keys) { return await chrome.storage.local.get(keys); }
async function storageSet(obj)  { await chrome.storage.local.set(obj); }

async function getSettings() {
  const { settings } = await storageGet([STORAGE_KEYS.settings]);
  return { ...getDefaultSettings(), ...(settings || {}) };
}

async function getRuntime() {
  const { runtime } = await storageGet([STORAGE_KEYS.runtime]);
  return {
    usageByDay: {},
    lastHeartbeatByTab: {},
    stageStartByTab: {},
    stageByTab: {},
    dnrActive: false,
    ...(runtime || {}),
  };
}

async function setRuntime(next) { await storageSet({ [STORAGE_KEYS.runtime]: next }); }

async function getProof() {
  const { proof } = await storageGet([STORAGE_KEYS.proof]);
  return {
    required: false,
    taskId: null,
    taskTitle: "",
    question: "",
    questionCreatedAt: 0,
    unlockUntilMs: 0,
    nextAttemptAfterMs: 0,
    nextAttemptDay: "",
    ...(proof || {}),
  };
}

async function setProof(next) { await storageSet({ [STORAGE_KEYS.proof]: next }); }

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

// ── usage tracking ───────────────────────────────────────────
async function addUsageSeconds(deltaSeconds) {
  const d = todayKey();
  const rt = await getRuntime();
  rt.usageByDay[d] = (rt.usageByDay[d] || 0) + Math.max(0, deltaSeconds);
  await setRuntime(rt);
  return rt.usageByDay[d];
}

// ── DNR helpers ──────────────────────────────────────────────
async function setDnrState(rt, wantActive, settings) {
  if (rt.dnrActive === wantActive) return;
  if (wantActive) { await ensureRedirectRules(settings); }
  else            { await clearRedirectRules(); }
  rt.dnrActive = wantActive;
}

// ── proof daily reset ────────────────────────────────────────
async function maybeResetProofCooldown(proof) {
  const today = todayKey();
  if (proof.nextAttemptAfterMs > 0 && proof.nextAttemptDay && proof.nextAttemptDay !== today) {
    const updated = { ...proof, nextAttemptAfterMs: 0, nextAttemptDay: "" };
    await setProof(updated);
    return updated;
  }
  return proof;
}

// ── stage computation ────────────────────────────────────────
async function computeStageForTab({ tabId, url, nowMs }) {
  const settings = await getSettings();
  const rt       = await getRuntime();
  let proof      = await getProof();

  proof = await maybeResetProofCooldown(proof);

  const domain  = normalizeDomain(url);
  const blocked = isDomainBlockedBySettings(domain, settings);

  if (!blocked) {
    delete rt.stageByTab[String(tabId)];
    delete rt.stageStartByTab[String(tabId)];
    await setRuntime(rt);
    return { stage: 0, blocked: false };
  }

  if (proof.unlockUntilMs && nowMs < proof.unlockUntilMs) {
    return { stage: 0, blocked: false, temporaryAccess: true, unlockUntilMs: proof.unlockUntilMs };
  }

  if (proof.required) {
    if (proof.nextAttemptAfterMs && nowMs < proof.nextAttemptAfterMs) {
      return { stage: "proof_cooldown", blocked: true, retryInSec: Math.ceil((proof.nextAttemptAfterMs - nowMs) / 1000) };
    }
    return { stage: "proof_required", blocked: true, question: proof.question, questionCreatedAt: proof.questionCreatedAt, taskTitle: proof.taskTitle, timerSec: 30 };
  }

  const day     = todayKey();
  const usedSec = rt.usageByDay[day] || 0;
  const limitSec = clamp((settings.dailyLimitMinutes || 0) * 60, 0, 24 * 60 * 60);

  if (limitSec > 0 && usedSec >= limitSec) {
    rt.stageByTab[String(tabId)] = 3;
    await setRuntime(rt);
    return { stage: 3, blocked: true, remainingUntilLimitSec: 0 };
  }

  let stageStart = rt.stageStartByTab[String(tabId)];
  if (!stageStart) {
    stageStart = nowMs;
    rt.stageStartByTab[String(tabId)] = stageStart;
  }

  const grace      = clamp(settings.stage1GraceSeconds || 0, 0, 300);
  const elapsedSec = Math.floor((nowMs - stageStart) / 1000);
  const stage      = elapsedSec < grace ? 1 : 2;

  rt.stageByTab[String(tabId)] = stage;
  await setRuntime(rt);

  const remainingUntilLimitSec = limitSec > 0 ? Math.max(0, limitSec - usedSec) : null;
  return { stage, blocked: true, graceSeconds: grace, elapsedSec, remainingUntilLimitSec };
}

// ── heartbeat ────────────────────────────────────────────────
async function handleHeartbeat({ tabId, url, visible }) {
  const nowMs    = Date.now();
  const settings = await getSettings();
  const domain   = normalizeDomain(url);
  const rt       = await getRuntime();

  if (!isDomainBlockedBySettings(domain, settings)) {
    delete rt.lastHeartbeatByTab[String(tabId)];
    delete rt.stageStartByTab[String(tabId)];
    delete rt.stageByTab[String(tabId)];
    if (!settings.redirectAlwaysOn) await setDnrState(rt, false, settings);
    await setRuntime(rt);
    return { ok: true, stage: 0, domain, blocked: false };
  }

  const last = rt.lastHeartbeatByTab[String(tabId)] || nowMs;
  rt.lastHeartbeatByTab[String(tabId)] = nowMs;
  await setRuntime(rt);

  const deltaSec = visible ? clamp(Math.floor((nowMs - last) / 1000), 0, 10) : 0;
  const usedSec  = deltaSec > 0
    ? await addUsageSeconds(deltaSec)
    : (await getRuntime()).usageByDay[todayKey()] || 0;

  const stageInfo = await computeStageForTab({ tabId, url, nowMs });
  const rt2 = await getRuntime();

  if (stageInfo.stage === 3) {
    await setDnrState(rt2, true, settings);
    await setRuntime(rt2);
    try { await chrome.tabs.reload(tabId); } catch { /* ignore */ }
  } else {
    await setDnrState(rt2, !!settings.redirectAlwaysOn, settings);
    await setRuntime(rt2);
  }

  // Hard mode: close ALL other blocked tabs immediately when stage >= 1
  if (settings.blockLevel === "hard" && stageInfo.blocked && stageInfo.stage !== 0) {
    closeBlockedTabsHard(settings, tabId).catch(() => {});
  }

  const openTabCount = await getOpenTabCount();
  return { ok: true, domain, usedSec, openTabCount, ...stageInfo };
}

// ── Tab helpers ───────────────────────────────────────────────
async function getOpenTabCount() {
  try { return (await chrome.tabs.query({})).length; } catch { return 0; }
}

async function closeBlockedTabsHard(settings, exceptTabId) {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (!tab.url || tab.id === exceptTabId) continue;
      if (tab.url.startsWith("chrome://") || tab.url.startsWith("chrome-extension://")) continue;
      const domain = normalizeDomain(tab.url);
      if (isDomainBlockedBySettings(domain, settings)) {
        try { await chrome.tabs.remove(tab.id); } catch { /* already closed */ }
      }
    }
  } catch { /* ignore */ }
}

// ── AI: Proof question ───────────────────────────────────────
async function generateProofQuestion(taskTitle) {
  const fallback = `Explain "${taskTitle}" in your own words and give a practical example or code snippet showing how you'd actually use it.`;
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 22000);
    const r = await fetch(`${PROXY}/api/proof-question`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ taskTitle }),
      signal:  ctrl.signal,
    });
    if (!r.ok) throw new Error("q_http");
    const data = await r.json();
    return data?.question || fallback;
  } catch {
    return fallback;
  }
}

// ── AI: Evaluate proof answer ────────────────────────────────
async function evaluateProofAnswer({ question, answer, taskTitle }) {
  const fallbackFail = {
    passed:   false,
    feedback: "Answer too weak — include a practical example or code snippet showing real usage.",
  };
  if (!answer || answer.trim().length < 30) return fallbackFail;
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 22000);
    const r = await fetch(`${PROXY}/api/check-answer`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ question, answer, taskTitle }),
      signal:  ctrl.signal,
    });
    if (!r.ok) throw new Error("eval_http");
    const data = await r.json();
    return {
      passed:   !!data.passed,
      feedback: data.feedback || (data.passed ? "Answer accepted. Keep going!" : fallbackFail.feedback),
    };
  } catch {
    // Local fallback: basic length check
    const passed = answer.trim().length > 80;
    return { passed, feedback: passed ? "Looks good. Keep going!" : fallbackFail.feedback };
  }
}

// ── AI: Smart tab closing (alarm-based, via Railway) ─────────
async function closeDistractingTabs() {
  const settings = await getSettings();
  let tabs = [];
  try { tabs = await chrome.tabs.query({}); } catch { return; }

  const filtered = tabs.filter(t =>
    t.url &&
    !t.url.startsWith("chrome://") &&
    !t.url.startsWith("chrome-extension://") &&
    !t.url.startsWith("about:")
  ).map(t => ({ id: t.id, title: (t.title || "").slice(0, 80), url: (t.url || "").slice(0, 120) }));

  if (!filtered.length) return;

  const currentTask = settings.currentTask || "focused work";
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 22000);
    const r = await fetch(`${PROXY}/api/close-tabs`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ currentTask, tabs: filtered }),
      signal:  ctrl.signal,
    });
    if (!r.ok) return;
    const data = await r.json();
    const ids = Array.isArray(data.closeIds) ? data.closeIds : [];
    for (const id of ids) {
      if (typeof id === "number") {
        try { await chrome.tabs.remove(id); } catch { /* already closed */ }
      }
    }
  } catch { /* ignore */ }
}

// ── AI: Chat reply ───────────────────────────────────────────
// ── AI: Chat reply ───────────────────────────────────────────
async function aiChatReply({ text, tasks }) {
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 22000);

    const r = await fetch(`${PROXY}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        // lang: "en" ← УДАЛИЛИ
        tasks: tasks.slice(0, 8).map(t => t.title || t.text || ""),
      }),
      signal: ctrl.signal,
    });

    if (r.ok) {
      const data = await r.json();
      if (data.reply) return data.reply;
    }
  } catch {
    /* fall through */
  }
  return "Focus on your current task. Small consistent steps beat big plans.";
}

// ── message handler ──────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (!msg || typeof msg !== "object") return;

    if (msg.type === "quanty:getSettings") {
      sendResponse({ ok: true, settings: await getSettings() });
      return; 
    }

    if (msg.type === "quanty:setSettings") {
      const current  = await getSettings();
      const settings = { ...getDefaultSettings(), ...current, ...(msg.settings || {}) };
      await storageSet({ [STORAGE_KEYS.settings]: settings });
      const rt = await getRuntime();
      await setDnrState(rt, !!settings.redirectAlwaysOn, settings);
      await setRuntime(rt);
      sendResponse({ ok: true });
      return;
    }

    if (msg.type === "quanty:heartbeat") {
      const tabId = sender?.tab?.id ?? msg.tabId;
      if (typeof tabId !== "number") { sendResponse({ ok: false, error: "missing_tab_id" }); return; }
      const out = await handleHeartbeat({ tabId, url: msg.url || sender?.tab?.url || "", visible: !!msg.visible });
      if (out.stage === 1 || out.stage === 2) {
        const settings = await getSettings();
        out.coach             = await buildCoachMessage({ stage: out.stage, settings, domain: out.domain, remainingUntilLimitSec: out.remainingUntilLimitSec });
        out.stage2WaitSeconds = settings.stage2WaitSeconds || 10;
        out.blockLevel        = settings.blockLevel || "medium";
      }
      // Always include tab count for UI display
      if (!out.openTabCount) out.openTabCount = await getOpenTabCount();
      sendResponse(out);
      return;
    }

    if (msg.type === "quanty:proofStart") {
      const question = await generateProofQuestion(msg.taskTitle || "Current task");
      await setProof({
        required:           true,
        taskId:             msg.taskId || null,
        taskTitle:          msg.taskTitle || "Current task",
        question,
        questionCreatedAt:  Date.now(),
        unlockUntilMs:      0,
        nextAttemptAfterMs: 0,
        nextAttemptDay:     "",
      });
      sendResponse({ ok: true, question });
      return;
    }

    if (msg.type === "quanty:proofSubmit") {
      let proof = await getProof();
      proof     = await maybeResetProofCooldown(proof);

      if (!proof.required) { sendResponse({ ok: false, error: "proof_not_required" }); return; }

      const verdict = await evaluateProofAnswer({
        question:  proof.question,
        answer:    msg.answer || "",
        taskTitle: proof.taskTitle,
      });

      if (verdict.passed) {
        const unlockUntilMs = Date.now() + 15 * 60 * 1000;
        const learning      = await storageGet(["quanty_learning_tasks"]);
        const tasks         = Array.isArray(learning.quanty_learning_tasks) ? learning.quanty_learning_tasks : [];
        const nextTasks     = tasks.map(t => t.id === proof.taskId ? { ...t, status: "done", active: false } : t);
        const firstTodo     = nextTasks.find(t => t.status !== "done");
        if (firstTodo) nextTasks.forEach(t => (t.active = t.id === firstTodo.id));
        await setProof({ ...proof, required: false, unlockUntilMs, nextAttemptAfterMs: 0, nextAttemptDay: "" });
        await storageSet({ quanty_learning_tasks: nextTasks });
        sendResponse({ ok: true, passed: true, feedback: verdict.feedback, unlockUntilMs });
        return;
      }

      const nextAttemptAfterMs = Date.now() + 15 * 60 * 1000;
      await setProof({ ...proof, required: true, unlockUntilMs: 0, nextAttemptAfterMs, nextAttemptDay: todayKey() });
      sendResponse({ ok: true, passed: false, feedback: verdict.feedback || "No practical example found. Show actual usage with code or a concrete scenario.", nextAttemptAfterMs });
      return;
    }

    if (msg.type === "quanty:aiChat") {
      try {
        const reply = await aiChatReply({
          text:  String(msg.text || ""),
          tasks: msg.tasks || [],
        });
        sendResponse({ ok: true, reply });
      } catch {
        sendResponse({ ok: false, error: "chat_failed" });
      }
      return;
    }

    // Focus session tracking for smart tab closing alarm
    if (msg.type === "quanty:focusStart") {
      await storageSet({ quanty_focus_active: true });
      try { await chrome.alarms.create("quanty_smart_close", { periodInMinutes: 5 }); } catch { /* ignore */ }
      sendResponse({ ok: true });
      return;
    }

    if (msg.type === "quanty:focusStop") {
      await storageSet({ quanty_focus_active: false });
      try { await chrome.alarms.clear("quanty_smart_close"); } catch { /* ignore */ }
      sendResponse({ ok: true });
      return;
    }

    if (msg.type === "quanty:closeTab") {
      const tabId = sender?.tab?.id ?? msg.tabId;
      if (typeof tabId === "number") {
        try { await chrome.tabs.remove(tabId); sendResponse({ ok: true }); return; } catch { /* ignore */ }
      }
      sendResponse({ ok: false });
      return;
    }

    if (msg.type === "quanty:resetToday") {
      const rt = await getRuntime();
      rt.usageByDay[todayKey()] = 0;
      await setRuntime(rt);
      sendResponse({ ok: true });
      return;
    }

    if (msg.type === "quanty:openSidePanel") {
      const windowId = sender?.tab?.windowId;
      try {
        if (typeof windowId === "number") {
          await chrome.sidePanel.open({ windowId });
          sendResponse({ ok: true });
          return;
        }
      } catch { /* ignore */ }
      sendResponse({ ok: false });
      return;
    }

    sendResponse({ ok: false, error: "unknown_message" });
  })();
  return true;
});

// ── Alarm handler (smart tab closing) ───────────────────────
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "quanty_smart_close") return;
  try {
    const got = await storageGet(["quanty_focus_active"]);
    if (got.quanty_focus_active) await closeDistractingTabs();
  } catch { /* ignore */ }
});

// ── install / startup ────────────────────────────────────────
// ── install / startup ────────────────────────────────────────
chrome.runtime.onInstalled.addListener(async (details) => {
  // Инициализация настроек
  const { settings, proof } = await storageGet([STORAGE_KEYS.settings, STORAGE_KEYS.proof]);
  if (!settings) await storageSet({ [STORAGE_KEYS.settings]: getDefaultSettings() });
  if (!proof) {
    await setProof({ required: false, taskId: null, taskTitle: "", question: "", questionCreatedAt: 0, unlockUntilMs: 0, nextAttemptAfterMs: 0, nextAttemptDay: "" });
  }

  // Открываем sidepanel сразу после установки + запускаем онбординг
  try {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    
    // Открываем sidepanel новому пользователю
    if (details.reason === 'install') {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]) {
        await chrome.sidePanel.open({ windowId: tabs[0].windowId });
      }
    }
  } catch (e) { /* ignore */ }

  fetch(`${PROXY}/api/health`, { method: "GET" }).catch(() => {});
});