/**
 * Projection Registry — chaves canônicas MECE para deduplicação
 * entre projeções virtuais e lançamentos materializados em `cashflow_entries`.
 *
 * Este arquivo é o ponto canônico. `src/lib/projectionRegistry.ts`
 * agora reexporta deste local para manter compatibilidade durante a migração.
 */

export type {
  ProjectionSource,
} from "@/lib/projectionRegistry";

export {
  projectionKey,
  extractSourceRef,
  buildMaterializedRefs,
  dedupAgainstMaterialized,
} from "@/lib/projectionRegistry";
