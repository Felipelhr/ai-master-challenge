export interface Task {
  id: string;
  dealId: string;
  title: string;
  description: string | null;
  dueAt: string | null;
  status: "PENDING" | "COMPLETED";
  source: "USER" | "SYSTEM_ACTION";
  actionCode: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
