(function () {
  let stage1ToastEl = null;
  let stage2OverlayEl = null;
  let stage2ContinueBtn = null;
  let stage2TimerEl = null;
  let stage2Countdown = null;
  let stage2AllowedUntil = 0;
  let proofOverlayEl = null;
  let proofTimerId = null;

  function nowMs() {
    return Date.now();
  }

  function safeUrl() {
    try {
      return location.href;
    } catch {
      return "";
    }
  }

  function pauseVideos() {
    document.querySelectorAll("video").forEach((v) => {
      try {
        v.pause();
      } catch {
        // ignore
      }
    });
  }

  function goToQuanty() {
    chrome.runtime.sendMessage({ type: "quanty:openSidePanel" });
    location.href = chrome.runtime.getURL("pages/blocked.html");
  }

  function removeStage1() {
    if (stage1ToastEl) stage1ToastEl.remove();
    stage1ToastEl = null;
  }

  function removeStage2() {
    if (stage2OverlayEl) stage2OverlayEl.remove();
    if (stage2Countdown) clearInterval(stage2Countdown);
    stage2OverlayEl = null;
    stage2ContinueBtn = null;
    stage2TimerEl = null;
    stage2Countdown = null;
  }

  function removeProofOverlay() {
    if (proofOverlayEl) proofOverlayEl.remove();
    proofOverlayEl = null;
    if (proofTimerId) clearInterval(proofTimerId);
    proofTimerId = null;
  }

  function ensureStage1Toast() {
    if (stage1ToastEl) return;
    const root = document.createElement("div");
    root.id = "quanty-stage1-toast";
    root.innerHTML = `
      <div class="qt-head">
        <div class="qt-brand"><span class="qt-dot"></span><span>Quanty</span></div>
        <button class="qt-close" aria-label="Close">×</button>
      </div>
      <div class="qt-body">
        <div class="qt-text">Пауза. Направь внимание на цель. Сейчас это важнее ленты.</div>
        <div class="qt-actions">
          <button class="qt-btn" data-act="close">Закрыть вкладку</button>
          <button class="qt-btn primary" data-act="go">Вернуться к Quanty</button>
        </div>
      </div>`;
    root.querySelector(".qt-close")?.addEventListener("click", removeStage1);
    root.querySelector("[data-act='close']")?.addEventListener("click", () => chrome.runtime.sendMessage({ type: "quanty:closeTab" }));
    root.querySelector("[data-act='go']")?.addEventListener("click", goToQuanty);
    document.documentElement.appendChild(root);
    stage1ToastEl = root;
  }

  function ensureStage2Overlay(waitSeconds) {
    if (stage2OverlayEl) return;
    const root = document.createElement("div");
    root.id = "quanty-stage2-overlay";
    root.innerHTML = `
      <div class="q2-card" role="dialog" aria-modal="true">
        <div class="q2-body">
          <div class="q2-timer"></div>
          <div class="q2-sub">Если хочешь продолжить — подожди ${waitSeconds} секунд</div>
          <div class="q2-sub">Ты уверен, что это помогает твоей цели?</div>
          <div class="q2-actions">
            <button class="q2-btn" data-act="leave">Вернуться к Quanty</button>
            <button class="q2-btn primary" data-act="continue" disabled>Продолжить</button>
          </div>
        </div>
      </div>`;
    document.documentElement.appendChild(root);
    stage2OverlayEl = root;
    stage2ContinueBtn = root.querySelector("[data-act='continue']");
    stage2TimerEl = root.querySelector(".q2-timer");
    root.querySelector("[data-act='leave']")?.addEventListener("click", goToQuanty);
    root.querySelector("[data-act='continue']")?.addEventListener("click", () => {
      stage2AllowedUntil = nowMs() + 60 * 1000;
      removeStage2();
    });
    pauseVideos();

    const until = nowMs() + waitSeconds * 1000;
    const tick = () => {
      const left = Math.max(0, Math.ceil((until - nowMs()) / 1000));
      if (stage2TimerEl) stage2TimerEl.textContent = `${left}s`;
      if (left <= 0 && stage2ContinueBtn) stage2ContinueBtn.disabled = false;
      if (left <= 0 && stage2Countdown) clearInterval(stage2Countdown);
    };
    tick();
    stage2Countdown = setInterval(tick, 250);
  }

  function ensureProofOverlay(res) {
    if (proofOverlayEl) return;
    const totalSec = typeof res.timerSec === "number" ? res.timerSec : 30;
    let timeLeft = totalSec;
    const root = document.createElement("div");
    root.id = "quanty-stage2-overlay";
    root.innerHTML = `
      <div class="q2-card" role="dialog" aria-modal="true">
        <div class="q2-body">
          <div class="q2-title">AI Proof of Work</div>
          <div class="q2-sub" style="text-align:left;">Задача: ${res.taskTitle || "Текущая задача"}</div>
          <div class="q2-sub" style="text-align:left;color:#0f1720;">${res.question || "Объясни тему своими словами."}</div>
          <div class="q2-timer" id="qProofTimer">${timeLeft}s</div>
          <textarea id="qProofAnswer" style="width:100%;min-height:120px;border:1px solid #dce6ec;border-radius:10px;padding:10px;font:inherit;" placeholder="Твой ответ..."></textarea>
          <div class="q2-actions">
            <button class="q2-btn primary" id="qProofSubmit">Ответить</button>
          </div>
          <div class="q2-sub" id="qProofFeedback">Пока проверка не пройдена, доступ к отвлекающим сайтам закрыт.</div>
        </div>
      </div>`;
    document.documentElement.appendChild(root);
    proofOverlayEl = root;
    pauseVideos();

    const timerEl = root.querySelector("#qProofTimer");
    const submitBtn = root.querySelector("#qProofSubmit");
    const answerEl = root.querySelector("#qProofAnswer");
    const feedbackEl = root.querySelector("#qProofFeedback");

    proofTimerId = setInterval(() => {
      timeLeft = Math.max(0, timeLeft - 1);
      if (timerEl) timerEl.textContent = `${timeLeft}s`;
      if (timeLeft <= 0 && submitBtn) submitBtn.disabled = true;
    }, 1000);

    submitBtn?.addEventListener("click", async () => {
      submitBtn.disabled = true;
      const answer = (answerEl?.value || "").trim();
      const out = await chrome.runtime.sendMessage({ type: "quanty:proofSubmit", answer });
      if (!out?.ok) {
        feedbackEl.textContent = "Ошибка проверки. Попробуй снова.";
        submitBtn.disabled = false;
        return;
      }
      if (out.passed) {
        feedbackEl.textContent = out.feedback || "Ответ принят. Доступ открыт на 15 минут.";
        setTimeout(() => removeProofOverlay(), 800);
        return;
      }
      feedbackEl.textContent = out.feedback || "Ты не понял тему. Попробуй еще раз позже.";
      setTimeout(() => {
        removeProofOverlay();
      }, 1200);
    });
  }

  function ensureProofCooldown(retryInSec) {
    if (proofOverlayEl) return;
    const root = document.createElement("div");
    root.id = "quanty-stage2-overlay";
    root.innerHTML = `
      <div class="q2-card" role="dialog" aria-modal="true">
        <div class="q2-body">
          <div class="q2-title">Доступ закрыт</div>
          <div class="q2-sub">Ты не прошел AI Proof of Work.</div>
          <div class="q2-timer">${Math.max(1, retryInSec || 0)}s</div>
          <div class="q2-sub">Новая попытка будет доступна позже. Возвращайся к задаче.</div>
        </div>
      </div>`;
    document.documentElement.appendChild(root);
    proofOverlayEl = root;
    pauseVideos();
  }

  async function heartbeat() {
    if (stage2AllowedUntil && nowMs() < stage2AllowedUntil) return;
    const res = await chrome.runtime.sendMessage({
      type: "quanty:heartbeat",
      url: safeUrl(),
      visible: document.visibilityState === "visible",
    });
    if (!res || !res.ok) return;
    if (res.stage === 0) {
      removeStage1();
      removeStage2();
      removeProofOverlay();
    } else if (res.stage === 1) {
      removeProofOverlay();
      removeStage2();
      ensureStage1Toast();
    } else if (res.stage === 2) {
      removeProofOverlay();
      removeStage1();
      ensureStage2Overlay(10);
    } else if (res.stage === "proof_required") {
      removeStage1();
      removeStage2();
      ensureProofOverlay(res);
    } else if (res.stage === "proof_cooldown") {
      removeStage1();
      removeStage2();
      ensureProofCooldown(res.retryInSec);
    } else {
      removeStage1();
      removeStage2();
      removeProofOverlay();
    }
  }

  setInterval(() => heartbeat().catch(() => {}), 1000);
  heartbeat().catch(() => {});
})();
