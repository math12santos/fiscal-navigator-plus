// Tipos públicos do núcleo ETL
export type EtlJobStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "partial"
  | "cancelled";

export type EtlItemStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "skipped"
  | "dead";

export type EtlSource = "upload" | "webhook" | "api" | "cron" | "manual";

export interface EtlPipeline {
  key: string;
  module: string;
  label: string;
  description: string | null;
  worker: "edge" | "rpc";
  target_handler: string | null;
  cron_expr: string | null;
  active: boolean;
  max_attempts: number;
  batch_size: number;
}

export interface EtlJob {
  id: string;
  organization_id: string;
  pipeline_key: string;
  module: string;
  source: EtlSource;
  idempotency_key: string;
  status: EtlJobStatus;
  total_count: number;
  ok_count: number;
  failed_count: number;
  skipped_count: number;
  params: Record<string, unknown>;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface EtlJobItem {
  id: string;
  job_id: string;
  organization_id: string;
  seq: number;
  external_ref: string | null;
  idempotency_key: string;
  status: EtlItemStatus;
  attempts: number;
  max_attempts: number;
  next_attempt_at: string;
  raw: Record<string, unknown>;
  mapped: Record<string, unknown> | null;
  target_table: string | null;
  target_id: string | null;
  last_error: string | null;
  processed_at: string | null;
  created_at: string;
}

export interface CreateJobInput {
  organizationId: string;
  pipelineKey: string;
  module: string;
  source: EtlSource;
  idempotencyKey: string;
  params?: Record<string, unknown>;
  items: Array<{
    externalRef?: string;
    idempotencyKey: string;
    raw: Record<string, unknown>;
  }>;
}
