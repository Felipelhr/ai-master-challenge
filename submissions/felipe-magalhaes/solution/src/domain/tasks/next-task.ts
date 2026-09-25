import type { Task } from "./task";

export function nextTask(tasks: Task[]): Task | null {
  return tasks.filter((task) => task.status === "PENDING").sort((a, b) => {
    if (a.dueAt && b.dueAt) return a.dueAt.localeCompare(b.dueAt) || a.createdAt.localeCompare(b.createdAt);
    if (a.dueAt) return -1;
    if (b.dueAt) return 1;
    return a.createdAt.localeCompare(b.createdAt);
  })[0] ?? null;
}

export function nextTasksByDeal(tasks: Task[]): Record<string, Task> {
  const grouped = new Map<string, Task[]>();
  for (const task of tasks) {
    const group = grouped.get(task.dealId) ?? [];
    group.push(task);
    grouped.set(task.dealId, group);
  }
  const result: Record<string, Task> = {};
  for (const [dealId, group] of grouped) {
    const task = nextTask(group);
    if (task) result[dealId] = task;
  }
  return result;
}
