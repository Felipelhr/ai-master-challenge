"use server";

import { csvDealsRepository } from "@/repositories/deals/csv-deals-repository";
import { createEmailRepository } from "@/repositories/email/sqlite-email-repository";
import { getCrmSnapshot, withCrmStore } from "@/services/crm/crm-service";
import { priorityDigest } from "@/services/email/priority-digest";
import { ResendEmailAdapter, resendConfigured } from "@/services/email/resend-adapter";
import { saveEmailSchedule, sendManualDigest, setEmailScheduleEnabled } from "@/services/email/email-service";
import type { ScheduleInput } from "@/services/email/email-types";
import type { PriorityFilters } from "@/services/priorities/rank-top-five";

async function currentSnapshot() {
  const deals = await csvDealsRepository.list();
  return withCrmStore((store) => getCrmSnapshot(deals, store));
}

export async function previewPriorityEmail(scope: PriorityFilters) {
  const digest = priorityDigest(await currentSnapshot(), scope);
  return { subject: digest.subject, text: digest.text, ids: digest.items.map((item) => item.id) };
}

export async function sendPriorityEmail(recipient: string, scope: PriorityFilters) {
  if (!resendConfigured()) throw new Error("Envio indisponível: configure as credenciais Resend.");
  const repo = createEmailRepository();
  try { return await sendManualDigest(repo, new ResendEmailAdapter(), await currentSnapshot(), recipient, scope); }
  finally { repo.close(); }
}

export async function savePriorityEmailSchedule(input: ScheduleInput, id?: string) {
  const repo = createEmailRepository();
  try { saveEmailSchedule(repo, input, id); return repo.schedules(); }
  finally { repo.close(); }
}

export async function togglePriorityEmailSchedule(id: string, enabled: boolean) {
  const repo = createEmailRepository();
  try { setEmailScheduleEnabled(repo, id, enabled); return repo.schedules(); }
  finally { repo.close(); }
}

export async function deletePriorityEmailSchedule(id: string) {
  const repo = createEmailRepository();
  try { repo.deleteSchedule(id); return repo.schedules(); }
  finally { repo.close(); }
}
