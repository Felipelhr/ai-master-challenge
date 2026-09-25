import type { Funnel } from "@/domain/pipeline/stage";
export interface FunnelsRepository {
  list(): Funnel[];
  find(id: string): Funnel | null;
  save(funnel: Funnel): void;
  delete(id: string): void;
}
