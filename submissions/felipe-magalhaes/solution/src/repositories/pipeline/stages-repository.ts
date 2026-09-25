import type { PipelineStage } from "@/domain/pipeline/stage";

export interface PipelineStagesRepository {
  list(): PipelineStage[];
  find(id: string): PipelineStage | null;
  save(stage: PipelineStage): void;
  delete(id: string): void;
}
