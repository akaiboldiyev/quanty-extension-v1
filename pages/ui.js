export function renderTasks({ tasks, taskCardsEl, detailEl, onOpen, onDone }) {
  if (!tasks.length) {
    taskCardsEl.innerHTML = '<div class="task-meta">No tasks yet. Enter a goal below.</div>';
    detailEl.textContent = "Select a task card to see a simple explanation of what to do and why.";
    return;
  }

  const active = tasks.find((t) => t.active) || tasks[0];
  detailEl.textContent = active.explanation;
  taskCardsEl.innerHTML = tasks
    .map((task) => {
      const status = task.status === "done" ? "Verified" : task.status === "pending_proof" ? "Awaiting AI check" : "In progress";
      return `
        <article class="task-card ${task.active ? "active" : ""}" data-id="${task.id}">
          <div class="task-title">${task.title}</div>
          <div class="task-meta">Day ${task.day || "?"} · ${task.minutes || 30} min · ${status}</div>
          <div class="task-actions">
            <button data-open="${task.id}">Open</button>
            <button class="done-btn" data-done="${task.id}">I'm done</button>
          </div>
        </article>
      `;
    })
    .join("");

  taskCardsEl.querySelectorAll("[data-open]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      onOpen(Number(btn.getAttribute("data-open")));
    });
  });
  taskCardsEl.querySelectorAll("[data-done]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      onDone(Number(btn.getAttribute("data-done")));
    });
  });
  taskCardsEl.querySelectorAll(".task-card").forEach((card) => {
    card.addEventListener("click", () => onOpen(Number(card.getAttribute("data-id"))));
  });
}