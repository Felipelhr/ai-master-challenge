"use server";

import { csvDealsRepository } from "@/repositories/deals/csv-deals-repository";
import { performCrmOperation, withCrmStore, type CrmOperation } from "@/services/crm/crm-service";

export async function runCrmOperation(operation: CrmOperation) {
  const baseDeals = await csvDealsRepository.list();
  return withCrmStore((store) => performCrmOperation(baseDeals, store, operation));
}
