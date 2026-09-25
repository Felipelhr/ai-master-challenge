import { ArenaApp } from "@/components/arena-shell/arena-app";
import { csvDealsRepository } from "@/repositories/deals/csv-deals-repository";
import { connection } from "next/server";
import { getCrmSnapshot, withCrmStore } from "@/services/crm/crm-service";
import { createEmailRepository } from "@/repositories/email/sqlite-email-repository";
import { resendConfigured } from "@/services/email/resend-adapter";

export default async function Home() {
  await connection();
  const deals = await csvDealsRepository.list();
  const snapshot = await withCrmStore((store) => getCrmSnapshot(deals, store));
  const emailRepository = createEmailRepository();
  const schedules = emailRepository.schedules();
  emailRepository.close();
  return <ArenaApp initialSnapshot={snapshot} initialSchedules={schedules} emailAvailable={resendConfigured()} />;
}
