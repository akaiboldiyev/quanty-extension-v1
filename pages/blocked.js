// blocked.js
// FIX: removed `import { getDefaultSettings } from "../shared/settings.js"`.
// Extension pages CAN use ES module imports, but the path "../shared/settings.js"
// was outside web_accessible_resources. Settings are now fetched via message.
// quanty_core.js is in the same pages/ directory so its import works fine.

import { mountQuantyPanel } from "./quanty_core.js";

const returnTask = document.getElementById("returnTask");
const blockedReason = document.getElementById("blockedReason");
const openOptionsBtn = document.getElementById("openOptionsBtn");
const resetTodayBtn = document.getElementById("resetTodayBtn");
const quantyRoot = document.getElementById("quantyRoot");

async function loadSettings() {
  try {
    const res = await chrome.runtime.sendMessage({ type: "quanty:getSettings" });
    return res?.settings || {};
  } catch {
    return {};
  }
}

async function init() {
  const settings = await loadSettings();

  const task = settings.currentTask || "—";
  if (returnTask) returnTask.textContent = task;
  if (blockedReason)
    blockedReason.textContent = `Limit reached. Return to your task: ${task}`;

  openOptionsBtn?.addEventListener("click", () => chrome.runtime.openOptionsPage());
  resetTodayBtn?.addEventListener("click", async () => {
    await chrome.runtime.sendMessage({ type: "quanty:resetToday" });
    location.reload();
  });

  if (quantyRoot) {
    await mountQuantyPanel(quantyRoot, {
      onCurrentTask: (t) => {
        if (t && typeof t === "string" && t.length < 220) {
          chrome.runtime
            .sendMessage({
              type: "quanty:setSettings",
              settings: { ...settings, currentTask: t },
            })
            .catch(() => {});
        }
      },
    });
  }
}

init().catch(() => {});