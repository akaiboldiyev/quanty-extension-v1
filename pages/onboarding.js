// onboarding.js — guided tour for home page
// Highlights each UI element with animated #00C47A border.

import { HighlightBox } from "./highlight.js";

const KEY = "quanty_onboarding_done";

const STEPS = [
  {
    selector: "#currentTaskTitle",
    text: "Your current task. This shows exactly what to do right now. The AI has broken your goal into focused 30-minute steps.",
  },
  {
    selector: "#taskList",
    text: "Task list. Click any task name to see a simple explanation of what to do and why.",
  },
  {
    selector: "#goalInput",
    text: "Goal field. Write what you want to achieve — 'learn React' or 'improve English' — and press Generate. The AI creates everything automatically.",
  },
  {
    selector: "#startFocusBtn",
    text: "Focus button. Press it — the screen flashes and a session begins. Until tasks are complete, distracting sites are blocked.",
  },
  {
    selector: "#statusBadge",
    text: "Block status. Locked means sites are closed. When all tasks are done and verified by AI, the status switches to Unlocked.",
  },
];

function createModal() {
  const wrap = document.createElement("div");
  wrap.style.cssText = "position:fixed;inset:0;z-index:10001;display:flex;align-items:center;justify-content:center;pointer-events:none;";

  const card = document.createElement("div");
  card.style.cssText = [
    "pointer-events:all",
    "width:min(400px,calc(100vw - 32px))",
    "background:linear-gradient(145deg,#13161c,#1a1e27)",
    "border:1px solid rgba(0,242,255,0.3)",
    "border-radius:18px",
    "padding:24px 22px 20px",
    "box-shadow:0 24px 80px rgba(0,0,0,0.8),0 0 0 1px rgba(0,242,255,0.08)",
  ].join(";");

  card.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
      <div style="width:30px;height:30px;border-radius:8px;background:linear-gradient(130deg,#05d6c4,#00de80);display:grid;place-items:center;font-weight:900;color:#000;font-size:14px;">Q</div>
      <strong style="color:#dde2ec;font-size:15px;letter-spacing:-0.3px;">Quanty</strong>
    </div>
    <div id="obText" style="font-size:13.5px;line-height:1.6;color:#868ea0;margin-bottom:18px;"></div>
    <div style="display:flex;justify-content:flex-end;">
      <button id="obNext" style="background:linear-gradient(130deg,#05d6c4,#00de80);border:none;border-radius:10px;padding:8px 18px;font-weight:800;font-size:13px;color:#000;cursor:pointer;">Next →</button>
    </div>
  `;

  wrap.appendChild(card);
  return { wrap, card, textEl: card.querySelector("#obText"), nextBtn: card.querySelector("#obNext") };
}

export async function runOnboarding() {
  try {
    const got = await chrome.storage.local.get([KEY]);
    if (got[KEY]) return;
  } catch {
    if (localStorage.getItem(KEY)) return;
  }

  const { wrap, textEl, nextBtn } = createModal();
  document.body.appendChild(wrap);

  // ── Welcome screen ──────────────────────────────────────
  textEl.innerHTML = `
    <span style="color:#dde2ec;font-weight:700;font-size:14px;display:block;margin-bottom:8px;">
      Welcome to Quanty.
    </span>
    Our goal: get you to real results without burning out.<br><br>
    <span style="color:#05d6c4;">AI builds your plan</span>, explains every step, and blocks distractions until you finish today's task.
  `;
  await new Promise((resolve) => nextBtn.addEventListener("click", resolve, { once: true }));

  // ── Highlight tour ──────────────────────────────────────
  const hl = new HighlightBox();
  hl.mount();

  for (let i = 0; i < STEPS.length; i++) {
    const step = STEPS[i];
    const el = document.querySelector(step.selector);

    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      await new Promise((r) => setTimeout(r, 180));
      hl.moveTo(el);
      hl.box.style.opacity = "1";
    } else {
      hl.box.style.opacity = "0";
    }

    textEl.innerHTML = `<span style="color:#dde2ec;">${step.text}</span>`;
    nextBtn.textContent = i === STEPS.length - 1 ? "Let's go! 🚀" : "Next →";

    await new Promise((resolve) => { nextBtn.onclick = () => resolve(); });
  }

  hl.unmount();
  wrap.remove();

  try {
    await chrome.storage.local.set({ [KEY]: true });
  } catch {
    localStorage.setItem(KEY, "1");
  }
}