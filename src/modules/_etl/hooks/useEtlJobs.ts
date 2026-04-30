import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listJobs,
  getJob,
  cancelJob,
  retryFailed,
  runWorkerNow,
  createJob,
  listPipelines,
} from "../services/jobsService";
import type { CreateJobInput } from "../_contracts/etl";

export function useEtlPipelines() {
  return useQuery({ queryKey: ["etl", "pipelines"], queryFn: listPipelines });
}

export function useEtlJobs(organizationId: string | undefined) {
  return useQuery({
    queryKey: ["etl", "jobs", organizationId],
    queryFn: () => listJobs(organizationId!),
    enabled: !!organizationId,
    refetchInterval: 5000,
  });
}

export function useEtlJob(jobId: string | undefined) {
  return useQuery({
    queryKey: ["etl", "job", jobId],
    queryFn: () => getJob(jobId!),
    enabled: !!jobId,
    refetchInterval: 3000,
  });
}

export function useEtlActions() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["etl"] });
  };
  return {
    cancelJob: useMutation({ mutationFn: cancelJob, onSuccess: invalidate }),
    retryFailed: useMutation({ mutationFn: retryFailed, onSuccess: invalidate }),
    runWorker: useMutation({ mutationFn: runWorkerNow, onSuccess: invalidate }),
    createJob: useMutation({
      mutationFn: (input: CreateJobInput) => createJob(input),
      onSuccess: invalidate,
    }),
  };
}
