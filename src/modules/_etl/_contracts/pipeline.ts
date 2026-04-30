// Contratos de handler — implementados em cada módulo (financeiro, dp, ti, etc.)
import type { EtlJobItem } from "./etl";

export interface PipelineContext {
  organizationId: string;
  jobId: string;
}

export type HandlerResult =
  | { status: "succeeded"; targetTable?: string; targetId?: string; mapped?: Record<string, unknown> }
  | { status: "skipped"; reason: string }
  | { status: "failed"; error: string };

export type PipelineHandler = (item: EtlJobItem, ctx: PipelineContext) => Promise<HandlerResult>;
