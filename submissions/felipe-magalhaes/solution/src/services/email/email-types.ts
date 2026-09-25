import type { PriorityFilters } from "@/services/priorities/rank-top-five";

export type EmailFrequency = "daily" | "weekly" | "monthly";
export interface ScheduleInput {
  recipient: string; enabled: boolean; frequency: EmailFrequency; sendTime: string;
  weekday: number | null; dayOfMonth: number | null; scope: PriorityFilters;
}
export interface EmailSchedule extends ScheduleInput {
  id: string; timezone: "America/Sao_Paulo"; createdAt: string; updatedAt: string;
  lastSentAt: string | null; nextRunAt: string;
}
export interface EmailSendLog {
  id: string; scheduleId: string | null; scheduledFor: string; sentAt: string | null;
  recipient: string; status: "PROCESSING" | "SENT" | "FAILED";
  providerMessageId: string | null; error: string | null; type: "MANUAL" | "AUTOMATIC";
  payload: string; updatedAt: string;
}
