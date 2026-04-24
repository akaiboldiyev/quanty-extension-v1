const KEY = "quanty_learning_tasks";

export async function loadTasks() {
  const got = await chrome.storage.local.get([KEY]);
  return Array.isArray(got[KEY]) ? got[KEY] : [];
}

export async function saveTasks(tasks) {
  await chrome.storage.local.set({ [KEY]: tasks });
}

export async function setActiveTask(taskId) {
  const tasks = await loadTasks();
  for (const task of tasks) task.active = task.id === taskId;
  await saveTasks(tasks);
  return tasks;
}

export async function setTaskStatus(taskId, status) {
  const tasks = await loadTasks();
  const target = tasks.find((x) => x.id === taskId);
  if (target) target.status = status;
  await saveTasks(tasks);
  return { tasks, target };
}
