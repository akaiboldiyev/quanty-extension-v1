// coach.js — background only (imported by service_worker.js)

function formatSeconds(s) {
  if (s == null) return "";
  const sec = Math.max(0, Math.floor(s));
  const m   = Math.floor(sec / 60);
  const r   = sec % 60;
  if (m <= 0) return `${r}s`;
  return `${m}m ${String(r).padStart(2, "0")}s`;
}

function fallbackLines(stage) {
  if (stage === 1) {
    return [
      "Do you really want to give your attention to a feed?",
      "Your growth right now is worth more than any content.",
      "Close the tab yourself — that trains discipline.",
    ];
  }
  return [
    "Okay. If you really want to continue — wait and choose consciously.",
    "Every minute here is a minute away from your goal.",
    "Are you sure this will make you stronger?",
  ];
}

async function geminiCoach({ apiKey, goal, currentTask, stage, domain, remainingUntilLimitSec }) {
  const endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
  const prompt   = [
    "You are a strict, caring productivity coach. Write in English.",
    "Response: 2-3 short sentences + 1 question + 1 specific next step.",
    "No lists, no markdown, no emojis. Max 320 characters.",
    `Block stage: ${stage}.`,
    `Site: ${domain}.`,
    `User goal: ${goal || "not set"}.`,
    `Current task: ${currentTask || "not set"}.`,
    remainingUntilLimitSec != null
      ? `Until hard block: ${formatSeconds(remainingUntilLimitSec)}.`
      : "",
  ].filter(Boolean).join("\n");

  const url = `${endpoint}?key=${encodeURIComponent(apiKey)}`;
  const r   = await fetch(url, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({
      contents:         [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 120 },
    }),
  });
  if (!r.ok) throw new Error(`gemini_http_${r.status}`);
  const data = await r.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim?.() || "";
}

export async function buildCoachMessage({ stage, settings, domain, remainingUntilLimitSec }) {
  const goal = settings.goal || "";
  const currentTask = settings.currentTask || "";
  const apiKey = settings.geminiApiKey || "";
  
  if (settings.aiEnabled && apiKey) {
  try {
  const txt = await geminiCoach({ apiKey, goal, currentTask, stage, domain, remainingUntilLimitSec });
  if (txt && txt.length > 10) return txt.slice(0, 500);
  } catch (e) { 
  console.error("Coach AI failed:", e.message);
 // fall through to fallback
  }
  }

  // FALLBACK (всегда возвращает что-то)
  const lines = fallbackLines(stage);
  const until = remainingUntilLimitSec != null
  ? ` Until block: ${formatSeconds(remainingUntilLimitSec)}.`
  : "";
  const tail = goal ? ` Your goal: ${goal}.` : "";
  return `${lines[0]}${until}${tail} ${lines[1]} ${lines[2]}`;
}