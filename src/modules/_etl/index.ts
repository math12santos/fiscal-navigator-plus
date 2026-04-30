// Núcleo do pipeline ETL/ELT do FinCore.
// Camadas: _contracts (tipos), services (Supabase), hooks (React Query).
// Handlers vivem em src/modules/<modulo>/etl/handlers/.

export * from "./_contracts/etl";
export * from "./_contracts/pipeline";

export {
  listPipelines,
  listJobs,
  getJob,
  createJob,
  cancelJob,
  retryFailed,
  runWorkerNow,
} from "./services/jobsService";

export { listJobItems, listDeadLetter, retryItem } from "./services/itemsService";

export {
  useEtlPipelines,
  useEtlJobs,
  useEtlJob,
  useEtlActions,
} from "./hooks/useEtlJobs";

export {
  useEtlJobItems,
  useEtlDeadLetter,
  useEtlItemActions,
} from "./hooks/useEtlJobItems";
