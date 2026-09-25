import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { csvDealsRepository } from "../src/repositories/deals/csv-deals-repository";
import { createEmailRepository } from "../src/repositories/email/sqlite-email-repository";
import { getCrmSnapshot, withCrmStore } from "../src/services/crm/crm-service";
import { runDueEmailSchedules } from "../src/services/email/email-service";
import { ResendEmailAdapter, resendConfigured } from "../src/services/email/resend-adapter";

if (existsSync(".env.local")) loadEnvFile(".env.local");

async function tick() {
  if (!resendConfigured()) { console.log("[email-worker] Credenciais Resend ausentes; agendamentos aguardam configuração."); return; }
  const repo = createEmailRepository();
  try {
    const result = await runDueEmailSchedules(repo, new ResendEmailAdapter(), async () => {
      const deals = await csvDealsRepository.list();
      return withCrmStore((store) => getCrmSnapshot(deals, store));
    });
    if (result.due) console.log("[email-worker]", result);
  } finally { repo.close(); }
}

await tick().catch((error) => console.error("[email-worker]", error));
if (!process.argv.includes("--once")) setInterval(() => { tick().catch((error) => console.error("[email-worker]", error)); }, 60_000);
