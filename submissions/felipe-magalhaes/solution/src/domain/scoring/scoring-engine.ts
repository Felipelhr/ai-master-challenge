import type { Deal } from "@/domain/deals/deal";

export type ScoreBasis =
  | "MODEL_FULL"
  | "AGE_ONLY_FALLBACK"
  | "OUT_OF_COVERAGE_VALUE"
  | "PROSPECTING_VALUE";

export type ScoreConfidence = "MEDIUM" | "LOW";

export type ActionCode =
  | "ACTION_WORK_NOW"
  | "ACTION_ENRICH_ACCOUNT"
  | "ACTION_LAST_CONTACT_BEFORE_FREEZE"
  | "ACTION_QUALIFY_PROSPECTING";

export type SystemSignal =
  | "MODEL_FULL"
  | "ACCOUNT_MISSING"
  | "AGE_ONLY_FALLBACK"
  | "OUT_OF_COVERAGE_AGE"
  | "PROSPECTING_NO_ENGAGE_DATE"
  | "LOW_SUPPORT_AGE_121_138";

export interface PriorityResult {
  priorityScore: number;
  scoreBasis: ScoreBasis;
  confidence: ScoreConfidence;
  action: ActionCode;
  reason: string;
  nextAction: string;
  limitation: string;
  propensity30d?: number;
  priorityValue?: number;
  systemSignals: SystemSignal[];
  ageDays?: number;
}

export interface ScoringEngine {
  score(deal: Deal, mode?: "snapshot" | "reference"): PriorityResult | null;
}
