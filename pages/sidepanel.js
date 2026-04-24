// ═══════════════════════════════════════════════════════════
//  QUANTY — SIDEPANEL
// ═══════════════════════════════════════════════════════════

const PROXY_URL    = "https://quanty-proxy-production.up.railway.app";
const TK           = "quanty_learning_tasks";
const SK           = "quanty_sp_state";
const SETTINGS_KEY = "settings";
const THEME_KEY    = "quanty_theme";

const state = {
  tasks: [], isActive: false,
  remainingTime: 0, totalTime: 1800,
  focusSessions: 0, blockLevel: "medium",
  dailyLimit: 30, goal: "",
  lang: "en", currentDay: 1,
};

let timerInterval = null;
const isDone = t => t.status === "done" || t.completed === true;
const $      = id => document.getElementById(id);

function esc(t) {
  const d = document.createElement("div");
  d.textContent = String(t); return d.innerHTML;
}
function fmt(sec) {
  const s = Math.max(0, Math.floor(sec));
  return `${String(Math.floor(s/3600)).padStart(2,"0")}:${String(Math.floor((s%3600)/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
}

// ── STORAGE ───────────────────────────────────────────────────
async function loadState() {
  const got = await chrome.storage.local.get([SK, TK, SETTINGS_KEY]);
  const s   = got[SK] || {};
  if (s.isActive      !== undefined) state.isActive      = s.isActive;
  if (s.remainingTime !== undefined) state.remainingTime  = s.remainingTime;
  if (s.totalTime     !== undefined) state.totalTime      = s.totalTime;
  if (s.focusSessions !== undefined) state.focusSessions  = s.focusSessions;
  if (s.blockLevel)                  state.blockLevel     = s.blockLevel;
  if (s.dailyLimit)                  state.dailyLimit     = s.dailyLimit;
  if (s.lang)                        state.lang           = s.lang;
  if (Array.isArray(got[TK]))        state.tasks          = got[TK];
  const cfg = got[SETTINGS_KEY] || {};
  if (cfg.goal) state.goal = cfg.goal;
  state.currentDay = state.tasks.find(t => !isDone(t))?.day || 1;
}

async function saveState() {
  const { tasks, goal, ...rest } = state;
  await chrome.storage.local.set({ [SK]: rest });
  // language setting removed
}

async function saveTasks() {
  await chrome.storage.local.set({ [TK]: state.tasks });
  const a = state.tasks.find(t => t.active && !isDone(t)) || state.tasks.find(t => !isDone(t));
  if (a || state.goal) chrome.runtime.sendMessage({ type:"quanty:setSettings", settings:{ goal: state.goal, currentTask: a?.title||"" } }).catch(() => {});
}

async function syncExtension() {
  const a   = state.tasks.find(t => t.active && !isDone(t)) || state.tasks.find(t => !isDone(t));
  const lvl = { easy:{stage1GraceSeconds:40,stage2WaitSeconds:30,redirectAlwaysOn:false}, medium:{stage1GraceSeconds:15,stage2WaitSeconds:10,redirectAlwaysOn:false}, hard:{stage1GraceSeconds:0,stage2WaitSeconds:0,redirectAlwaysOn:true} };
  chrome.runtime.sendMessage({ type:"quanty:setSettings", settings:{ ...(lvl[state.blockLevel]||lvl.medium), blockLevel:state.blockLevel, dailyLimitMinutes:state.dailyLimit, goal:state.goal, currentTask:a?.title||"" } }).catch(() => {});
}

// ── THEME ─────────────────────────────────────────────────────
async function loadTheme() {
  try {
    const got = await chrome.storage.local.get([THEME_KEY]);
    if (got[THEME_KEY] === "light") setTheme("light");
  } catch { /* ignore */ }
}

function setTheme(t) {
  document.body.classList.toggle("theme-light", t === "light");
  // dark theme = show sun icon (click to switch to light)
  // light theme = show moon icon (click to switch to dark)
  $("themeBtn").textContent = t === "light" ? "🌙" : "☀️";
}

$("themeBtn").addEventListener("click", async () => {
  const isLight = document.body.classList.contains("theme-light");
  const next    = isLight ? "dark" : "light";
  setTheme(next);
  try { await chrome.storage.local.set({ [THEME_KEY]: next }); } catch { /* ignore */ }
});

// ── HEADER ────────────────────────────────────────────────────
$("homeBtn").addEventListener("click", () => chrome.tabs.create({ url: chrome.runtime.getURL("pages/home.html") }));

// Chat panel — slide down/up
$("chatBtn").addEventListener("click", () => {
  const panel = $("spChatPanel");
  const btn   = $("chatBtn");
  const isOpen = panel.classList.toggle("is-open");
  btn.classList.toggle("active", isOpen);
  if (isOpen) requestAnimationFrame(() => {
    $("spChatList").scrollTo({ top: $("spChatList").scrollHeight, behavior: "smooth" });
  });
});

// ── SETTINGS OVERLAY (centered modal) ─────────────────────────
function openSettings() {
  const overlay = $("spSettingsOverlay");
  // populate fields
  $("spDailyLimit").value = state.dailyLimit;
  document.querySelectorAll(".seg-btn[data-level]").forEach(b =>
    b.classList.toggle("active", b.dataset.level === state.blockLevel)
  );
  // language buttons removed
  overlay.classList.add("is-open");
}

function closeSettings() {
  $("spSettingsOverlay").classList.remove("is-open");
}

$("settingsBtn").addEventListener("click", openSettings);
$("spSettingsClose").addEventListener("click", closeSettings);

// Close on backdrop click
$("spSettingsOverlay").addEventListener("click", e => {
  if (e.target === $("spSettingsOverlay")) closeSettings();
});

// Close on Escape
document.addEventListener("keydown", e => {
  if (e.key === "Escape") closeSettings();
});

document.querySelectorAll(".seg-btn[data-level]").forEach(b => b.addEventListener("click", () => {
  state.blockLevel = b.dataset.level;
  document.querySelectorAll(".seg-btn[data-level]").forEach(x => x.classList.remove("active"));
  b.classList.add("active");
}));
// language buttons removed

$("spSaveSettings").addEventListener("click", async () => {
  state.dailyLimit = parseInt($("spDailyLimit").value, 10) || 30;
  await saveState(); await syncExtension();
  closeSettings();
});

$("spResetBtn").addEventListener("click", () =>
  chrome.runtime.sendMessage({ type:"quanty:resetToday" }).catch(() => {})
);

// ── TIMER (timestamp-based, synced via chrome.storage) ──────────
const FOCUS_KEY = "quanty_focus_end";

function updateTimer() { $("spTimer").textContent = fmt(state.remainingTime); }

function startTimerLoop() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(async () => {
    if (!state.isActive) return;
    try {
      const got = await chrome.storage.local.get([FOCUS_KEY]);
      const foc = got[FOCUS_KEY];
      if (foc && foc.active && foc.focusEndTime > 0) {
        const remaining = Math.max(0, Math.round((foc.focusEndTime - Date.now()) / 1000));
        state.remainingTime = remaining;
        if (remaining <= 0) {
          state.isActive = false; state.focusSessions++;
          await chrome.storage.local.set({ [FOCUS_KEY]: { focusEndTime: 0, totalTime: state.totalTime, active: false } });
          saveState(); render(); return;
        }
      } else if (foc && !foc.active && state.isActive) {
        state.isActive = false;
        render();
      }
    } catch {
      if (state.remainingTime > 0) { state.remainingTime--; saveState(); }
      else { state.isActive = false; state.focusSessions++; saveState(); render(); return; }
    }
    updateTimer();
  }, 1000);
}

$("spFocusBtn").addEventListener("click", async () => {
  if (!state.tasks.length) return;
  state.isActive = !state.isActive;
  if (state.isActive) {
    const a = state.tasks.find(t => t.active && !isDone(t)) || state.tasks.find(t => !isDone(t));
    state.totalTime = (a?.minutes||30) * 60;
    state.remainingTime = state.totalTime;
    const focusEndTime = Date.now() + state.totalTime * 1000;
    await chrome.storage.local.set({ [FOCUS_KEY]: { focusEndTime, totalTime: state.totalTime, active: true } });
    try { chrome.runtime.sendMessage({ type: "quanty:focusStart" }); } catch {}
    syncExtension();
  } else {
    await chrome.storage.local.set({ [FOCUS_KEY]: { focusEndTime: 0, totalTime: state.totalTime, active: false } });
    try { chrome.runtime.sendMessage({ type: "quanty:focusStop" }); } catch {}
  }
  saveState(); render(); updateTimer();
});

// ── DAY NAV ───────────────────────────────────────────────────
const maxDay = () => state.tasks.length ? Math.max(...state.tasks.map(t => t.day||1)) : 1;

function updateDayNav() {
  $("spDayNavLabel").textContent = `Day ${state.currentDay}`;
  $("spDayPrev").style.opacity   = state.currentDay <= 1 ? "0.3" : "1";
  $("spDayNext").style.opacity   = state.currentDay >= maxDay() ? "0.3" : "1";
}

$("spDayPrev").addEventListener("click", () => { if (state.currentDay > 1) { state.currentDay--; renderTasks(); updateDayNav(); } });
$("spDayNext").addEventListener("click", () => { if (state.currentDay < maxDay()) { state.currentDay++; renderTasks(); updateDayNav(); } });

// ── ADD TASK ──────────────────────────────────────────────────
$("spAddTaskToggle").addEventListener("click", () => $("spAddRow").classList.toggle("hidden"));
$("spAddTaskBtn").addEventListener("click", addTask);
$("spNewTask").addEventListener("keydown", e => { if (e.key === "Enter") addTask(); });

async function addTask() {
  const text = ($("spNewTask").value || "").trim();
  if (!text) return;
  state.tasks.push({ id: Date.now(), day: state.currentDay, minutes: 30, title: text, text, explanation:"", status:"todo", active: !state.tasks.length, completed: false });
  $("spNewTask").value = "";
  await saveTasks(); render();
}

// ── RENDER TASKS ──────────────────────────────────────────────
function renderTasks() {
  const list = $("spTasks");
  const sol  = $("spSolutionWrap");
  list.innerHTML = ""; sol.innerHTML = "";

  const day = state.tasks.filter(t => (t.day||1) === state.currentDay);
  if (!day.length) {
    list.innerHTML = `<p style="font-size:12px;color:var(--muted);padding:8px 0;">No tasks for Day ${state.currentDay}.</p>`;
    return;
  }

  day.forEach((task, idx) => {
    const done = isDone(task);
    const row  = document.createElement("div");
    row.className = "task-row" + (task.active ? " is-active" : "") + (done ? " is-done" : "");

    const span = document.createElement("span");
    span.className   = "task-row-text";
    span.textContent = task.title || task.text || "";
    row.appendChild(span);

    if (!done) {
      const btn = document.createElement("button");
      btn.className   = "task-row-done-btn";
      btn.textContent = "✓ Done";
      btn.addEventListener("click", e => { e.stopPropagation(); startProof(task); });
      row.appendChild(btn);
    }

    row.addEventListener("click", e => {
      if (e.target.tagName === "BUTTON") return;
      state.tasks.forEach(t => (t.active = t.id === task.id));
      saveTasks(); render();
    });
    list.appendChild(row);

    if (idx === day.length - 1 && !done) {
      const sbtn = document.createElement("button");
      sbtn.className   = "btn-solution";
      sbtn.textContent = "Solution";
      sbtn.addEventListener("click", () => showSolution(task));
      sol.appendChild(sbtn);
    }
  });
}

// ── SOLUTION ─────────────────────────────────────────────────
function renderSolutionHtml(text) {
  const sections = [
    { key: "WHAT IT IS:",        color: "#05d6c4", icon: "📖" },
    { key: "WHY IT MATTERS:",    color: "#00de80", icon: "⚡" },
    { key: "WHAT TO DO TODAY:",  color: "#00de80", icon: "✅" },
    { key: "THEORY (15 min):",   color: "#868ea0", icon: "📚" },
    { key: "PRACTICE (15 min):", color: "#05d6c4", icon: "💻" },
    { key: "PRACTICAL TASKS:",   color: "#f59e0b", icon: "🎯" },
  ];
  let html = text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  for (const s of sections) {
    html = html.replace(
      new RegExp(s.key.replace(/[()]/g,"\\$&"), "g"),
      `<span style="display:block;margin-top:14px;margin-bottom:4px;font-weight:800;font-size:11px;letter-spacing:0.09em;text-transform:uppercase;color:${s.color};">${s.icon} ${s.key}</span>`
    );
  }
  html = html.replace(/^(\d+\.\s)/gm, `<span style="color:#05d6c4;font-weight:700;">$1</span>`);
  html = html.replace(/\n/g, "<br>");
  return html;
}

async function showSolution(task) {
  let m = $("spSolutionModal");
  if (!m) {
    m = document.createElement("div");
    m.id = "spSolutionModal"; m.className = "modal";
    m.innerHTML = `
      <div class="modal-card" style="max-height:85vh;overflow-y:auto;">
        <div class="modal-header">
          <span class="modal-badge">💡 Solution</span>
          <button class="icon-btn" id="spSolutionClose">✕</button>
        </div>
        <p id="spSolutionTitle" style="font-size:15px;font-weight:800;margin:4px 0 8px;color:var(--text);"></p>
        <div id="spSolutionBody" style="font-size:13px;line-height:1.7;color:var(--text-dim);border-top:1px solid var(--border);padding-top:10px;"></div>
      </div>`;
    document.body.appendChild(m);
    $("spSolutionClose").addEventListener("click", () => m.classList.add("hidden"));
    m.addEventListener("click", e => { if (e.target === m) m.classList.add("hidden"); });
  }
  m.classList.remove("hidden");
  $("spSolutionTitle").textContent = task.title || task.text;
  $("spSolutionBody").innerHTML = `<span style="color:var(--text-dim);">⏳ AI is building your plan…</span>`;

  const taskTitle = task.title || task.text;
  const goal = state.goal || "";

  let solutionText = null;

  // Railway proxy (only source)
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 22000);
    const r = await fetch(`${PROXY_URL}/api/solution`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskTitle, goal }),
      signal: ctrl.signal,
    });
    if (r.ok) { const d = await r.json(); solutionText = d.solution || null; }
  } catch { /* fall through */ }

  // Static fallback if proxy unavailable
  if (!solutionText) {
    solutionText = [
      `WHAT IT IS:\n"${taskTitle}" is a key step toward: ${goal || "your goal"}.`,
      "\nWHAT TO DO TODAY:\n1. Find the official documentation or a top tutorial\n2. Write a minimal working example from scratch\n3. Break it intentionally — understand what fails and why",
      "\nPRACTICAL TASKS:\n1. Find one real-world example of this concept online\n2. Rewrite it without looking at the original\n3. Explain it out loud as if you're teaching a friend",
    ].join("\n");
  }

  $("spSolutionBody").innerHTML = renderSolutionHtml(solutionText);
}

// ── GENERATE PLAN ─────────────────────────────────────────────
$("spGenerateBtn").addEventListener("click", generatePlan);
$("spGoalInput").addEventListener("keydown", e => { if (e.key === "Enter") generatePlan(); });

const PLANS = {
  javascript: ["Set up DevTools and editor","Learn variables and data types","Functions and scope","Arrays and objects","DOM: querySelector and events","Async: fetch and async/await","ES6 modules and npm","Mini-project: interactive page","Deploy to GitHub Pages"],
  python:     ["Install Python and VS Code","Variables, types, print()","Conditions and loops","Functions and arguments","Lists, dicts, sets","Files and exceptions","Modules and pip","Mini-project: automate a task","Push to GitHub"],
  react:      ["Install Node.js, create Vite","JSX fundamentals","Components and props","useState","useEffect","React Router","Forms","Mini-project: task list","Deploy to Vercel"],
  guitar:     ["Hold guitar and tune","Finger positioning","Chords: Am, Dm, Em","Chords: C, G, F","Daily chord transitions","First simple song","Strumming patterns","Record and review","Learn a full song"],
  english:    ["Level test A1–C2","10 words with Anki","Podcast 15 min","Present Tenses","Write 5 sentences","Watch with EN subs","Record 2 min","Read article","Past Simple summary"],
  default:    ["Define measurable outcome","Break into daily steps","Remove main distraction","Build minimum version","Get first feedback","Fix 3 main weaknesses","Explain to someone","Review and adjust","Set next goal"],
};
function getLocalPlan(g) {
  const s = g.toLowerCase();
  const m = { javascript:["javascript","js"], python:["python"], react:["react"], guitar:["guitar","гитар"], english:["english","английск"] };
  for (const [k,w] of Object.entries(m)) if (w.some(x => s.includes(x))) return PLANS[k];
  return PLANS.default;
}
function makeTasks(titles) {
  return titles.map((t,i) => ({ id:Date.now()+i, day:i+1, minutes:30, title:String(t).trim(), text:String(t).trim(), explanation:"", status:"todo", active:i===0, completed:false }));
}

async function generatePlan() {
  const goal = ($("spGoalInput").value||"").trim();
  if (!goal) return;
  $("spGenerateBtn").disabled = true;
  $("spPlanStatus").textContent = "⏳ Building plan…";
  $("spPlanStatusBadge").textContent = "";
  let titles = null;
  try {
    const ctrl = new AbortController(); setTimeout(() => ctrl.abort(), 22000);
    const r = await fetch(`${PROXY_URL}/api/generate-plan`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ goal, deadlineHours:0, deadlineMinutes:30 }), signal: ctrl.signal });
    if (r.ok) { const d = await r.json(); if (Array.isArray(d.tasks) && d.tasks.length) titles = d.tasks.map(String); }
  } catch { /* fallback */ }
  if (!titles) { $("spPlanStatus").textContent = "📋 Using local plan…"; titles = getLocalPlan(goal); }
  state.tasks = makeTasks(titles); state.goal = goal; state.currentDay = 1;
  $("spGoalText").textContent = goal; $("spGoalInput").value = "";
  $("spPlanStatus").textContent = `✓ ${state.tasks.length} tasks ready`;
  $("spPlanStatusBadge").textContent = "ACTIVE";
  await saveTasks();
  chrome.runtime.sendMessage({ type:"quanty:setSettings", settings:{ goal, currentTask: state.tasks[0]?.title||"" } }).catch(() => {});
  render(); $("spGenerateBtn").disabled = false;
}

// ── PROOF ─────────────────────────────────────────────────────
let proofCountdown = null;
async function startProof(task) {
  $("spProofTask").textContent     = `Task: ${task.title||task.text}`;
  $("spProofQ").textContent        = "Generating question…";
  $("spProofArea").value           = "";
  $("spProofFeedback").textContent = "";
  $("spProofSubmit").disabled      = false;
  $("spProofModal").classList.remove("hidden");
  try {
    const res = await chrome.runtime.sendMessage({ type:"quanty:proofStart", taskId:task.id, taskTitle:task.title||task.text||"Current task" });
    $("spProofQ").textContent = res?.question || `Explain "${task.title||task.text}" in your own words.`;
  } catch { $("spProofQ").textContent = `Explain "${task.title||task.text}" in your own words.`; }
  let t = 60; $("spProofTimer").textContent = "60s"; $("spProofTimer").className = "modal-timer";
  if (proofCountdown) clearInterval(proofCountdown);
  proofCountdown = setInterval(() => {
    t--; $("spProofTimer").textContent = `${t}s`;
    if (t <= 15) $("spProofTimer").className = "modal-timer urgent";
    if (t <= 0) { clearInterval(proofCountdown); $("spProofSubmit").disabled = true; $("spProofFeedback").textContent = "Time's up."; }
  }, 1000);
}
$("spProofClose").addEventListener("click", () => { $("spProofModal").classList.add("hidden"); if (proofCountdown) clearInterval(proofCountdown); });
$("spProofSubmit").addEventListener("click", async () => {
  const answer = ($("spProofArea").value||"").trim();
  if (!answer) { $("spProofFeedback").textContent = "Please write an answer."; return; }
  $("spProofSubmit").disabled = true; $("spProofFeedback").textContent = "Checking…";
  try {
    const data = await chrome.runtime.sendMessage({ type:"quanty:proofSubmit", answer });
    $("spProofFeedback").textContent = data?.feedback || "";
    if (data?.passed) {
      if (proofCountdown) clearInterval(proofCountdown);
      const got = await chrome.storage.local.get([TK]);
      if (Array.isArray(got[TK])) state.tasks = got[TK];
      render(); setTimeout(() => $("spProofModal").classList.add("hidden"), 1500);
    } else { setTimeout(() => { $("spProofSubmit").disabled = false; }, 800); }
  } catch { $("spProofFeedback").textContent = "Error. Try again."; $("spProofSubmit").disabled = false; }
});

// ── CHAT ──────────────────────────────────────────────────────
$("spChatSend").addEventListener("click", sendChat);
$("spChatInput").addEventListener("keydown", e => { if (e.key === "Enter") sendChat(); });

function addMsg(role, text) {
  const div = document.createElement("div");
  div.className = role === "user" ? "chat-msg-user" : "chat-msg-ai";
  div.style.whiteSpace = "pre-wrap";
  div.textContent = text;

  // ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←
  const chatList = $("spChatList");
  if (chatList) {
    chatList.appendChild(div);
    chatList.scrollTo({
      top: chatList.scrollHeight,
      behavior: "smooth"
    });
  }
  // ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←
}

async function sendChat() {
  const text = ($("spChatInput").value || "").trim();
  if (!text) return;

  addMsg("user", text);
  $("spChatInput").value = "";

  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 22000);

    const r = await fetch(`${PROXY_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        // lang: "en" ← УДАЛИЛИ
        tasks: state.tasks.slice(0, 8).map(t => t.title || t.text)
      }),
      signal: ctrl.signal,
    });

    const d = await r.json();
    addMsg("ai", d.reply || "No response.");
  } catch {
    addMsg("ai", "Could not reach AI. Check your connection.");
  }
}

// ── RENDER ────────────────────────────────────────────────────
function render() {
  const done  = state.tasks.filter(isDone).length;
  const total = state.tasks.length;
  $("spProgressFill").style.width = `${total ? (done/total)*100 : 0}%`;
  $("spDoneBadge").textContent    = `${done}/${total} Done`;
  if (state.goal) $("spGoalText").textContent = state.goal;

  const a = state.tasks.find(t => t.active && !isDone(t)) || state.tasks.find(t => !isDone(t));
  if (a) {
    $("spTaskDay").textContent   = `DAY ${a.day||1}`;
    $("spTaskTitle").textContent = a.title||a.text||"—";
    $("spTaskHint").textContent  = `${a.minutes||30} min · press "✓ Done" when finished`;
  } else if (total) {
    $("spTaskDay").textContent   = "🎉";
    $("spTaskTitle").textContent = "All tasks completed!";
    $("spTaskHint").textContent  = "Set your next goal";
  } else {
    $("spTaskDay").textContent   = "DAY 1";
    $("spTaskTitle").textContent = "No tasks";
    $("spTaskHint").textContent  = "Enter a goal below";
  }

  const btn = $("spFocusBtn");
  btn.textContent = state.isActive ? "⏹ Stop Focus" : "▶ Start Focus";
  btn.className   = "btn-focus" + (state.isActive ? " stop" : "");
  btn.disabled    = !state.tasks.length;

  updateDayNav(); renderTasks(); updateTimer();
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes[TK]?.newValue)                { state.tasks = changes[TK].newValue; render(); }
  if (changes[SETTINGS_KEY]?.newValue?.goal) { state.goal = changes[SETTINGS_KEY].newValue.goal; $("spGoalText").textContent = state.goal; }
  // Sync focus timer from home / other views
  const foc = changes["quanty_focus_end"]?.newValue;
  if (foc) {
    const wasActive = state.isActive;
    state.isActive = !!foc.active;
    if (foc.active && foc.focusEndTime > 0) {
      state.remainingTime = Math.max(0, Math.round((foc.focusEndTime - Date.now()) / 1000));
    } else if (!foc.active && wasActive) {
      state.remainingTime = foc.totalTime || state.totalTime;
    }
    render(); updateTimer();
  }
});

// ── INIT ──────────────────────────────────────────────────────
async function init() {
  fetch(`${PROXY_URL}/api/health`).catch(() => {});
  await loadTheme();
  await loadState();
  // Restore timestamp-based focus state
  try {
    const got = await chrome.storage.local.get(["quanty_focus_end"]);
    const foc = got["quanty_focus_end"];
    if (foc && foc.active && foc.focusEndTime > Date.now()) {
      state.isActive = true;
      state.remainingTime = Math.max(0, Math.round((foc.focusEndTime - Date.now()) / 1000));
      if (foc.totalTime) state.totalTime = foc.totalTime;
    } else if (foc && !foc.active) {
      state.isActive = false;
    }
  } catch {}
  render();
  startTimerLoop();
  $("spLogo")?.addEventListener("error", e => { e.target.style.display = "none"; });
}

init().catch(console.error);

    checkOnboarding();   // ← добавь эту строку
// ====================== ONBOARDING (TabAI-style) ======================
const onboardingSteps = [
  { selector: "#spGoalText, #spGoalInput", title: "🎯 Your main goal", text: "Here you set the goal that Quanty will use to keep you focused." },
  { selector: "#spTasks", title: "📋 Daily tasks", text: "The AI automatically breaks your goal into small, manageable steps. Each day — one task." },
  { selector: "#spFocusBtn", title: "▶ Start Focus", text: "The heart of Quanty. Click to start the timer and activate all distractions blocking." },
  { selector: "#spProgressFill", title: "📊 Progress", text: "When you reach 100% — you've genuinely made progress toward your goal." }
];

let currentOnboardingStep = 0;
let highlightBox = null;
let tooltipEl = null;

function createOnboardingOverlay() {
  if (document.getElementById("quanty-onboarding-overlay")) return;
  const html = `
    <div id="quanty-onboarding-overlay"></div>
    <div id="highlight-box" class="highlight-box"></div>
    <div id="onboarding-tooltip"></div>
  `;
  document.body.insertAdjacentHTML("beforeend", html);
  highlightBox = document.getElementById("highlight-box");
  tooltipEl = document.getElementById("onboarding-tooltip");
}

function showOnboardingStep(index) {
  if (!highlightBox || !tooltipEl) return;
  const step = onboardingSteps[index];
  const el = document.querySelector(step.selector);
  if (!el) return finishOnboarding();

  const rect = el.getBoundingClientRect();
  const scrollTop = window.scrollY || document.documentElement.scrollTop;

  highlightBox.style.top = `${rect.top + scrollTop - 8}px`;
  highlightBox.style.left = `${rect.left - 8}px`;
  highlightBox.style.width = `${rect.width + 16}px`;
  highlightBox.style.height = `${rect.height + 16}px`;

  tooltipEl.innerHTML = `
    <div style="font-weight:800;margin-bottom:8px;color:#00C47A;">${step.title}</div>
    <div>${step.text}</div>
    <button id="onboarding-next-btn">${index === onboardingSteps.length-1 ? 'Done! Start Quanty' : 'Next →'}</button>
  `;

  const btn = tooltipEl.querySelector("#onboarding-next-btn");
  btn.onclick = () => index < onboardingSteps.length-1 ? showOnboardingStep(index+1) : finishOnboarding();

  tooltipEl.style.opacity = "0";
  setTimeout(() => {
    tooltipEl.style.top = `${rect.bottom + scrollTop + 20}px`;
    tooltipEl.style.left = `${Math.min(rect.left, window.innerWidth - 300)}px`;
    tooltipEl.style.opacity = "1";
  }, 50);
}

async function checkOnboarding() {
  const { onboarded } = await chrome.storage.local.get("onboarded");
  if (onboarded === true) return;

  createOnboardingOverlay();
  currentOnboardingStep = 0;
  showOnboardingStep(0);
}

async function finishOnboarding() {
  await chrome.storage.local.set({ onboarded: true });
  const overlay = document.getElementById("quanty-onboarding-overlay");
  const box = document.getElementById("highlight-box");
  const tooltip = document.getElementById("onboarding-tooltip");
  if (overlay) overlay.style.opacity = "0";
  if (box) box.style.opacity = "0";
  if (tooltip) tooltip.style.opacity = "0";
  setTimeout(() => {
    overlay?.remove(); box?.remove(); tooltip?.remove();
  }, 400);
}