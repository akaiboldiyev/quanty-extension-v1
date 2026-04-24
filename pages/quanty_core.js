// quanty_core.js — embeddable panel (used in blocked.html)
// FIX: replaced localStorage with chrome.storage.local.
// localStorage is NOT shared between extension pages; chrome.storage.local is.

const STORAGE_KEY = "quanty_ext_core_state";

const state = {
  tasks: [],
  isActive: false,
  remainingTime: 0,
  totalTime: 3600,
  focusSessions: 0,
};

async function save() {
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: state });
  } catch {
    // ignore — may happen if called before chrome APIs ready
  }
}

async function load() {
  try {
    const got = await chrome.storage.local.get([STORAGE_KEY]);
    const parsed = got[STORAGE_KEY];
    if (!parsed || typeof parsed !== "object") return;
    if (Array.isArray(parsed.tasks)) state.tasks = parsed.tasks;
    if (typeof parsed.isActive === "boolean") state.isActive = parsed.isActive;
    if (typeof parsed.remainingTime === "number") state.remainingTime = parsed.remainingTime;
    if (typeof parsed.totalTime === "number") state.totalTime = parsed.totalTime;
    if (typeof parsed.focusSessions === "number") state.focusSessions = parsed.focusSessions;
  } catch {
    // ignore
  }
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = String(text);
  return div.innerHTML;
}

function fmt(sec) {
  const t = Math.max(0, Math.floor(sec));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

let interval;
function startTick(onTick) {
  if (interval) clearInterval(interval);
  interval = setInterval(() => {
    if (state.isActive && state.remainingTime > 0) {
      state.remainingTime -= 1;
      save();
      onTick?.();
    } else if (state.isActive && state.remainingTime <= 0) {
      state.isActive = false;
      state.focusSessions += 1;
      save();
      onTick?.();
    }
  }, 1000);
}

function computeProgress() {
  const done = state.tasks.filter((t) => t.completed).length;
  const total = state.tasks.length;
  const pct = total > 0 ? (done / total) * 100 : 0;
  return { done, total, pct };
}

async function syncSettingsContext() {
  const got = await chrome.storage.local.get(["settings"]);
  // inline default to avoid import issues in blocked page context
  const defaults = {
    blocklistDomains: [],
    stage1GraceSeconds: 20,
    stage2WaitSeconds: 10,
    dailyLimitMinutes: 30,
    redirectAlwaysOn: false,
    goal: "",
    currentTask: "",
    aiEnabled: true,
    geminiApiKey: "",
  };
  return { ...defaults, ...(got.settings || {}) };
}

export async function mountQuantyPanel(rootEl, { onCurrentTask } = {}) {
  // Ensure CSS is loaded
  const cssUrl = chrome.runtime.getURL("pages/quanty_ui.css");
  if (!document.querySelector(`link[href="${cssUrl}"]`)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = cssUrl;
    document.head.appendChild(link);
  }

  await load();

  rootEl.innerHTML = `
    <div class="qpanel">
      <div class="qcard">
        <h3>Current task</h3>
        <div id="qCurrentTask" style="color:var(--q-a1);font-weight:900;margin-bottom:8px;">—</div>
        <button id="qToggleFocus" class="qbtn primary">Start focus</button>
      </div>

      <div class="qcard">
        <h3>Timer</h3>
        <div class="qtimer" id="qTimer">00:00:00</div>
        <div class="qprogress"><div id="qTimerFill"></div></div>
        <div style="margin-top:10px;">
          <span class="qstatus ready" id="qStatus">Ready</span>
        </div>
      </div>

      <div class="qcard">
        <h3>Progress</h3>
        <div class="qprogress"><div id="qProgFill"></div></div>
        <div style="margin-top:8px;color:var(--q-muted);font-size:13px;" id="qProgText">0 / 0</div>
      </div>

      <div class="qcard">
        <h3>Add task</h3>
        <div class="qrow">
          <input class="qinput" id="qNewTask" placeholder="New task…" />
          <button class="qbtn" id="qAddTask">Add</button>
        </div>
      </div>

      <div class="qcard">
        <h3>Tasks</h3>
        <div class="qtasks" id="qTasks"></div>
      </div>
    </div>
  `;

  const qTimer = rootEl.querySelector("#qTimer");
  const qTimerFill = rootEl.querySelector("#qTimerFill");
  const qToggle = rootEl.querySelector("#qToggleFocus");
  const qStatus = rootEl.querySelector("#qStatus");
  const qProgFill = rootEl.querySelector("#qProgFill");
  const qProgText = rootEl.querySelector("#qProgText");
  const qTasks = rootEl.querySelector("#qTasks");
  const qNewTask = rootEl.querySelector("#qNewTask");
  const qAddTask = rootEl.querySelector("#qAddTask");
  const qCurrentTask = rootEl.querySelector("#qCurrentTask");

  function currentTaskText() {
    const t = state.tasks.find((x) => !x.completed);
    return t ? t.text : state.tasks.length ? "All tasks completed" : "No task yet";
  }

  function render() {
    const { done, total, pct } = computeProgress();
    const cur = currentTaskText();
    qCurrentTask.textContent = cur;
    onCurrentTask?.(cur);

    qProgFill.style.width = `${pct}%`;
    qProgText.textContent = `${done} / ${total} completed`;

    qTimer.textContent = fmt(state.remainingTime);
    const timerPct =
      state.totalTime > 0 ? (state.remainingTime / state.totalTime) * 100 : 100;
    qTimerFill.style.width = `${timerPct}%`;

    qToggle.textContent = state.isActive ? "Stop focus" : "Start focus";

    qStatus.classList.remove("ready", "ok", "bad");
    if (total === 0) {
      qStatus.classList.add("ready");
      qStatus.textContent = "Ready";
    } else if (done === total) {
      qStatus.classList.add("ok");
      qStatus.textContent = "Unlocked";
    } else {
      qStatus.classList.add("bad");
      qStatus.textContent = `Locked · ${done}/${total}`;
    }

    if (state.tasks.length === 0) {
      qTasks.innerHTML = `<div style="color:var(--q-muted);font-size:13px;padding:10px 0;">No tasks yet.</div>`;
    } else {
      qTasks.innerHTML = state.tasks
        .map(
          (t) => `
          <div class="qtask ${t.completed ? "done" : ""}">
            <div class="qcheck ${t.completed ? "on" : ""}" data-tog="${t.id}">${t.completed ? "✓" : ""}</div>
            <div class="qtext">${escapeHtml(t.text)}</div>
            <button class="qdel" data-del="${t.id}" aria-label="Delete">×</button>
          </div>`
        )
        .join("");

      qTasks.querySelectorAll("[data-tog]").forEach((el) => {
        el.addEventListener("click", () => {
          const id = Number(el.getAttribute("data-tog"));
          const task = state.tasks.find((x) => x.id === id);
          if (!task) return;
          task.completed = !task.completed;
          save();
          render();
        });
      });
      qTasks.querySelectorAll("[data-del]").forEach((el) => {
        el.addEventListener("click", () => {
          const id = Number(el.getAttribute("data-del"));
          state.tasks = state.tasks.filter((x) => x.id !== id);
          save();
          render();
        });
      });
    }
  }

  qAddTask.addEventListener("click", () => {
    const text = (qNewTask.value || "").trim();
    if (!text) return;
    state.tasks.push({ id: Date.now(), text, completed: false });
    qNewTask.value = "";
    save();
    render();
  });
  qNewTask.addEventListener("keydown", (e) => {
    if (e.key === "Enter") qAddTask.click();
  });

  qToggle.addEventListener("click", () => {
    if (state.tasks.length === 0) return;
    state.isActive = !state.isActive;
    if (state.isActive) state.remainingTime = state.totalTime;
    save();
    render();
  });

  // Populate current task from extension settings if panel has no tasks
  try {
    const settings = await syncSettingsContext();
    if (settings.currentTask && (!state.tasks || state.tasks.length === 0)) {
      qCurrentTask.textContent = settings.currentTask;
      onCurrentTask?.(settings.currentTask);
    }
  } catch {
    // ignore
  }

  startTick(render);
  render();
}
