import type { Task } from "@/domain/tasks/task";

export interface TasksRepository {
  list(): Task[];
  save(task: Task): void;
  delete(id: string): void;
  find(id: string): Task | null;
}
