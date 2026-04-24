// content_script.js — Quanty blocking engine
// Block levels:
//   easy   — overlay asking "is this helping your goal?" with Yes/No
//   medium — blocks distracting searches, hides YouTube recommendations/Shorts
//   hard   — immediately blocks tab, only YouTube search + Google allowed
//
// YouTube shorts/recommendations hiding: active on medium + hard

(function () {
  "use strict";

  // ── state ─────────────────────────────────────────────────────────────────
  let stage1ToastEl      = null;
  let stage2OverlayEl    = null;
  let stage2ContinueBtn  = null;
  let stage2TimerEl      = null;
  let stage2CoachEl      = null;
  let stage2Countdown    = null;
  let stage2AllowedUntil = 0;
  let prevOverflow       = "";
  let ytHideInterval     = null;
  let currentBlockLevel  = "medium"; // updated from heartbeat response

  function nowMs()   { return Date.now(); }
  function safeUrl() { try { return location.href; } catch { return ""; } }

  function pauseVideos() {
    try { document.querySelectorAll("video").forEach(v => { try { v.pause(); } catch {} }); } catch {}
  }

  // ── YouTube clutter hiding ─────────────────────────────────────────────────
  // Hides Shorts shelf, recommendations feed, and non-search videos on YT home.
  // Active on medium + hard levels whenever we're on youtube.com.

  const YT_HIDE_CSS_ID = "quanty-yt-hide";

  function injectYouTubeHideCSS() {
    if (document.getElementById(YT_HIDE_CSS_ID)) return;
    const style = document.createElement("style");
    style.id = YT_HIDE_CSS_ID;
    style.textContent = `
      /* Hide Shorts shelf */
      ytd-rich-shelf-renderer[is-shorts],
      ytd-reel-shelf-renderer,
      ytd-shorts,
      ytd-mini-guide-entry-renderer[aria-label="Shorts"],
      tp-yt-paper-item[aria-label="Shorts"],
      a[title="Shorts"],
      yt-chip-cloud-chip-renderer:has([title="Shorts"]) { display: none !important; }

      /* Hide home feed videos (keep search results page intact) */
      ytd-browse[page-subtype="home"] ytd-rich-grid-renderer,
      ytd-browse[page-subtype="home"] ytd-rich-item-renderer { display: none !important; }

      /* Show a friendly message on home */
      ytd-browse[page-subtype="home"] #primary::before {
        content: "🎯 Use YouTube search to find study material";
        display: block;
        text-align: center;
        padding: 48px 24px;
        font-size: 18px;
        font-family: system-ui, sans-serif;
        color: #aaa;
      }

      /* Hide sidebar recommendations on watch page */
      ytd-watch-next-secondary-results-renderer { display: none !important; }

      /* Hide "Up next" autoplay */
      .ytp-autonav-endscreen-upnext-button-container { display: none !important; }

      /* Hide end screen recommendations */
      .ytp-endscreen-content { display: none !important; }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function removeYouTubeHideCSS() {
    document.getElementById(YT_HIDE_CSS_ID)?.remove();
  }

  function updateYouTubeHiding(level) {
    const isYT = location.hostname.includes("youtube.com");
    if (!isYT) return;
    if (level === "medium" || level === "hard") {
      injectYouTubeHideCSS();
    } else {
      removeYouTubeHideCSS();
    }
  }

  // ── Easy level overlay ─────────────────────────────────────────────────────
  // "Is this really helping your goal?" with Yes / No

  function ensureEasyOverlay(coach) {
    if (stage1ToastEl) return;
    const root = document.createElement("div");
    root.id = "quanty-stage1-toast";
    root.innerHTML = `
      <div class="qt-head">
        <div class="qt-brand"><span class="qt-dot"></span><span>Quanty</span></div>
      </div>
      <div class="qt-body">
        <div class="qt-text">${coach || "Will this really help you reach your goal?"}</div>
        <div class="qt-meta">Make a conscious choice.</div>
        <div class="qt-actions">
          <button class="qt-btn" data-act="no">No, go back</button>
          <button class="qt-btn primary" data-act="yes">Yes, continue</button>
        </div>
      </div>
    `;
    root.querySelector("[data-act='no']")?.addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "quanty:closeTab" });
    });
    root.querySelector("[data-act='yes']")?.addEventListener("click", () => {
      stage2AllowedUntil = nowMs() + 10 * 60 * 1000; // allow 10 min
      removeStage1();
    });
    document.documentElement.appendChild(root);
    stage1ToastEl = root;
  }

  // ── Stage 1 toast (medium/hard warning) ───────────────────────────────────

  function ensureStage1Toast({ coach, stageInfo }) {
    if (currentBlockLevel === "easy") {
      ensureEasyOverlay(coach);
      return;
    }
    if (stage1ToastEl) {
      const txt = stage1ToastEl.querySelector(".qt-text");
      const meta = stage1ToastEl.querySelector(".qt-meta");
      if (txt && coach) txt.textContent = coach;
      if (meta && stageInfo) {
        const until = typeof stageInfo.graceSeconds === "number"
          ? Math.max(0, stageInfo.graceSeconds - stageInfo.elapsedSec) : null;
        meta.textContent = until != null ? `Escalates in: ${until}s` : "Focus on your goal.";
      }
      return;
    }
    const root = document.createElement("div");
    root.id = "quanty-stage1-toast";
    root.innerHTML = `
      <div class="qt-head">
        <div class="qt-brand"><span class="qt-dot"></span><span>Quanty</span></div>
        <button class="qt-close" aria-label="Close">×</button>
      </div>
      <div class="qt-body">
        <div class="qt-text"></div>
        <div class="qt-meta"></div>
        <div class="qt-actions">
          <button class="qt-btn" data-act="close">Close tab</button>
          <button class="qt-btn primary" data-act="go">Back to work</button>
        </div>
      </div>
    `;
    root.querySelector(".qt-close")?.addEventListener("click", removeStage1);
    root.querySelector("[data-act='close']")?.addEventListener("click", async () => {
      try { await chrome.runtime.sendMessage({ type: "quanty:closeTab" }); } catch {}
    });
    root.querySelector("[data-act='go']")?.addEventListener("click", () => {
      location.href = chrome.runtime.getURL("pages/blocked.html");
    });
    document.documentElement.appendChild(root);
    stage1ToastEl = root;
    const txt = root.querySelector(".qt-text");
    const meta = root.querySelector(".qt-meta");
    if (txt) txt.textContent = coach || "Are you sure this helps your goal?";
    if (meta && stageInfo) {
      const until = typeof stageInfo.graceSeconds === "number"
        ? Math.max(0, stageInfo.graceSeconds - stageInfo.elapsedSec) : null;
      meta.textContent = until != null ? `Escalates in: ${until}s` : "Focus on your goal.";
    }
  }

  // ── Stage 2 overlay (medium = wait timer / hard = immediate) ──────────────

  function ensureStage2Overlay({ coach, waitSeconds }) {
    if (stage2OverlayEl) {
      if (stage2CoachEl && coach) stage2CoachEl.textContent = coach;
      return;
    }
    const root = document.createElement("div");
    root.id = "quanty-stage2-overlay";
    root.innerHTML = `
      <div class="q2-card" role="dialog" aria-modal="true">
        <div class="q2-top">
          <div class="q2-title">Focus check</div>
          <button class="qt-close" aria-label="Close">×</button>
        </div>
        <div class="q2-body">
          <div class="q2-coach"></div>
          <div class="q2-timer"></div>
          <div class="q2-sub">Don't waste your potential on cheap dopamine. Wait ${waitSeconds}s.</div>
          <div class="q2-actions">
            <button class="q2-btn" data-act="leave">Back to work</button>
            <button class="q2-btn primary" data-act="continue" disabled>Continue</button>
          </div>
        </div>
      </div>
    `;
    root.querySelector(".qt-close")?.addEventListener("click", removeStage2);
    root.querySelector("[data-act='leave']")?.addEventListener("click", () => {
      location.href = chrome.runtime.getURL("pages/blocked.html");
    });
    document.documentElement.appendChild(root);
    stage2OverlayEl   = root;
    stage2ContinueBtn = root.querySelector("[data-act='continue']");
    stage2TimerEl     = root.querySelector(".q2-timer");
    stage2CoachEl     = root.querySelector(".q2-coach");
    if (stage2CoachEl) stage2CoachEl.textContent = coach || "Don't waste your potential.";
    pauseVideos();
    try { prevOverflow = document.documentElement.style.overflow || ""; document.documentElement.style.overflow = "hidden"; } catch {}

    stage2AllowedUntil = 0;
    const until = nowMs() + waitSeconds * 1000;
    const tick = () => {
      const left = Math.max(0, Math.ceil((until - nowMs()) / 1000));
      if (stage2TimerEl) stage2TimerEl.textContent = `${left}s`;
      if (left <= 0) {
        if (stage2ContinueBtn) stage2ContinueBtn.disabled = false;
        if (stage2Countdown) clearInterval(stage2Countdown);
        stage2Countdown = null;
      }
    };
    tick();
    stage2Countdown = setInterval(tick, 250);
    stage2ContinueBtn?.addEventListener("click", () => {
      stage2AllowedUntil = nowMs() + 60 * 1000;
      removeStage2();
    });
  }

  // ── Hard mode: immediate full-page block ───────────────────────────────────

  function ensureHardBlock(coach) {
    if (stage2OverlayEl) return;
    const root = document.createElement("div");
    root.id = "quanty-stage2-overlay";
    root.innerHTML = `
      <div class="q2-card" role="dialog" aria-modal="true">
        <div class="q2-body">
          <div class="q2-title" style="text-align:center;font-size:18px;margin-bottom:8px;">🔒 Blocked</div>
          <div class="q2-coach">${coach || "Hard mode: complete your tasks first."}</div>
          <div class="q2-sub" style="margin-top:8px;">Allowed: YouTube search, Google, Quanty</div>
          <div class="q2-actions" style="margin-top:14px;">
            <button class="q2-btn primary" data-act="leave" style="width:100%;">Go to Quanty</button>
          </div>
        </div>
      </div>
    `;
    root.querySelector("[data-act='leave']")?.addEventListener("click", () => {
      location.href = chrome.runtime.getURL("pages/blocked.html");
    });
    document.documentElement.appendChild(root);
    stage2OverlayEl = root;
    pauseVideos();
    try { document.documentElement.style.overflow = "hidden"; } catch {}
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────

  function removeStage1() {
    if (stage1ToastEl) stage1ToastEl.remove();
    stage1ToastEl = null;
  }
  function removeStage2() {
    if (stage2OverlayEl) stage2OverlayEl.remove();
    stage2OverlayEl = null; stage2ContinueBtn = null;
    stage2TimerEl = null; stage2CoachEl = null;
    if (stage2Countdown) clearInterval(stage2Countdown);
    stage2Countdown = null;
    try { document.documentElement.style.overflow = prevOverflow || ""; } catch {}
  }

  // ── Heartbeat ──────────────────────────────────────────────────────────────

  async function heartbeat() {
    if (stage2AllowedUntil > 0) {
      if (nowMs() < stage2AllowedUntil) return;
      stage2AllowedUntil = 0;
    }

    const res = await chrome.runtime.sendMessage({
      type:    "quanty:heartbeat",
      url:     safeUrl(),
      visible: document.visibilityState === "visible",
    });

    if (!res || !res.ok) return;

    // Update block level from response
    if (res.blockLevel) {
      currentBlockLevel = res.blockLevel;
      updateYouTubeHiding(currentBlockLevel);
    }

    if (res.stage === 0) { removeStage1(); removeStage2(); return; }
    if (res.stage === 3) { removeStage1(); removeStage2(); return; }

    if (res.stage === 1) {
      removeStage2();
      if (currentBlockLevel === "hard") {
        removeStage1();
        ensureHardBlock(res.coach);
      } else {
        ensureStage1Toast({ coach: res.coach, stageInfo: res });
      }
      return;
    }
    if (res.stage === 2) {
      removeStage1();
      if (currentBlockLevel === "hard") {
        ensureHardBlock(res.coach);
      } else {
        ensureStage2Overlay({ coach: res.coach, waitSeconds: res.stage2WaitSeconds || 10 });
      }
      return;
    }
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  // Apply YouTube hiding immediately based on stored level
  chrome.storage.local.get(["settings"]).then(got => {
    const level = got?.settings?.blockLevel || "medium";
    currentBlockLevel = level;
    updateYouTubeHiding(level);
  }).catch(() => {});

  setInterval(() => heartbeat().catch(() => {}), 1000);
  document.addEventListener("visibilitychange", () => heartbeat().catch(() => {}));
  heartbeat().catch(() => {});

  // Re-run YouTube hiding when YT navigates (SPA)
  const _pushState = history.pushState.bind(history);
  history.pushState = (...args) => {
    _pushState(...args);
    setTimeout(() => updateYouTubeHiding(currentBlockLevel), 500);
  };
  window.addEventListener("popstate", () => {
    setTimeout(() => updateYouTubeHiding(currentBlockLevel), 500);
  });
})();
