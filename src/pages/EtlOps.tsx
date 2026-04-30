import { useEffect, useMemo, useState } from "react";
import { useOrganization } from "@/contexts/OrganizationContext";
import {
  useEtlJobs,
  useEtlPipelines,
  useEtlActions,
  useEtlJobItems,
  useEtlDeadLetter,
  useEtlItemActions,
  type EtlJob,
  type EtlJobStatus,
} from "@/modules/_etl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Play, RefreshCw, X, AlertCircle } from "lucide-react";

import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_VARIANT: Record<EtlJobStatus, "default" | "secondary" | "destructive" | "outline"> = {
  queued: "outline",
  running: "secondary",
  succeeded: "default",
  partial: "secondary",
  failed: "destructive",
  cancelled: "outline",
};

const STATUS_LABEL: Record<EtlJobStatus, string> = {
  queued: "Na fila",
  running: "Processando",
  succeeded: "OK",
  partial: "Parcial",
  failed: "Falhou",
  cancelled: "Cancelado",
};

function JobRow({ job, onOpen }: { job: EtlJob; onOpen: (id: string) => void }) {
  return (
    <TableRow className="cursor-pointer hover:bg-muted/40" onClick={() => onOpen(job.id)}>
      <TableCell>
        <Badge variant={STATUS_VARIANT[job.status]}>{STATUS_LABEL[job.status]}</Badge>
      </TableCell>
      <TableCell className="font-mono text-xs">{job.pipeline_key}</TableCell>
      <TableCell>{job.module}</TableCell>
      <TableCell>{job.source}</TableCell>
      <TableCell className="text-right">
        <span className="text-success">{job.ok_count}</span>
        {" / "}
        <span className="text-destructive">{job.failed_count}</span>
        {" / "}
        <span className="text-muted-foreground">{job.skipped_count}</span>
        {" de "}
        {job.total_count}
      </TableCell>
      <TableCell className="text-muted-foreground text-sm">
        {formatDistanceToNow(new Date(job.created_at), { addSuffix: true, locale: ptBR })}
      </TableCell>
    </TableRow>
  );
}

function JobDetail({ jobId, onClose }: { jobId: string; onClose: () => void }) {
  const { data: items, isLoading } = useEtlJobItems(jobId);
  const { retryItem } = useEtlItemActions();
  const { retryFailed, cancelJob } = useEtlActions();

  return (
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhes do job</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2 mb-4">
          <Button size="sm" variant="outline" onClick={() => retryFailed.mutate(jobId)}>
            <RefreshCw className="h-3 w-3 mr-1" /> Reprocessar falhas
          </Button>
          <Button size="sm" variant="outline" onClick={() => cancelJob.mutate(jobId)}>
            <X className="h-3 w-3 mr-1" /> Cancelar
          </Button>
        </div>
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tentativas</TableHead>
                <TableHead>Erro</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(items ?? []).map((it) => (
                <TableRow key={it.id}>
                  <TableCell>{it.seq}</TableCell>
                  <TableCell>
                    <Badge variant={it.status === "succeeded" ? "default" : it.status === "failed" || it.status === "dead" ? "destructive" : "outline"}>
                      {it.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{it.attempts}/{it.max_attempts}</TableCell>
                  <TableCell className="text-xs text-destructive max-w-md truncate">{it.last_error}</TableCell>
                  <TableCell>
                    {(it.status === "failed" || it.status === "dead") && (
                      <Button size="sm" variant="ghost" onClick={() => retryItem.mutate(it.id)}>
                        <RefreshCw className="h-3 w-3" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function EtlOps() {
  const { currentOrg } = useOrganization();
  const { data: jobs = [], isLoading } = useEtlJobs(currentOrg?.id);
  const { data: pipelines = [] } = useEtlPipelines();
  const { data: dlq = [] } = useEtlDeadLetter(currentOrg?.id);
  const { runWorker } = useEtlActions();
  const { retryItem } = useEtlItemActions();
  const [openJob, setOpenJob] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c = { queued: 0, running: 0, failed: 0, succeeded: 0 } as Record<string, number>;
    for (const j of jobs) c[j.status] = (c[j.status] ?? 0) + 1;
    return c;
  }, [jobs]);

  useEffect(() => {
    document.title = "ETL Ops — Pipelines de dados | FinCore";
  }, []);

  if (!currentOrg) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Selecione uma empresa para visualizar os jobs.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">

      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">ETL Ops</h1>
          <p className="text-sm text-muted-foreground">
            Pipelines de importação, integração e jobs agendados.
          </p>
        </div>
        <Button onClick={() => runWorker.mutate()} disabled={runWorker.isPending}>
          {runWorker.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
          Drenar fila agora
        </Button>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Na fila</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{counts.queued ?? 0}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Processando</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{counts.running ?? 0}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Sucesso</CardTitle></CardHeader><CardContent className="text-2xl font-semibold text-success">{counts.succeeded ?? 0}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">DLQ</CardTitle></CardHeader><CardContent className="text-2xl font-semibold text-destructive">{dlq.length}</CardContent></Card>
      </div>

      <Tabs defaultValue="jobs">
        <TabsList>
          <TabsTrigger value="jobs">Jobs recentes</TabsTrigger>
          <TabsTrigger value="dlq">Dead-letter ({dlq.length})</TabsTrigger>
          <TabsTrigger value="pipelines">Pipelines ({pipelines.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="jobs">
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-6"><Loader2 className="h-4 w-4 animate-spin" /></div>
              ) : jobs.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">Nenhum job ainda. Use o botão "Drenar fila" para testar.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Pipeline</TableHead>
                      <TableHead>Módulo</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead className="text-right">OK / Erro / Skip</TableHead>
                      <TableHead>Quando</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.map((j) => <JobRow key={j.id} job={j} onOpen={setOpenJob} />)}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dlq">
          <Card>
            <CardContent className="p-0">
              {dlq.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">Nenhum item na fila morta. 🎉</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job</TableHead>
                      <TableHead>Erro</TableHead>
                      <TableHead>Tentativas</TableHead>
                      <TableHead>Quando</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dlq.map((it) => (
                      <TableRow key={it.id}>
                        <TableCell className="font-mono text-xs">{it.job_id.slice(0, 8)}</TableCell>
                        <TableCell className="text-destructive text-xs max-w-md">
                          <AlertCircle className="h-3 w-3 inline mr-1" />
                          {it.last_error}
                        </TableCell>
                        <TableCell>{it.attempts}</TableCell>
                        <TableCell className="text-xs">
                          {it.processed_at && formatDistanceToNow(new Date(it.processed_at), { addSuffix: true, locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" onClick={() => retryItem.mutate(it.id)}>
                            <RefreshCw className="h-3 w-3 mr-1" /> Reprocessar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pipelines">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Chave</TableHead>
                    <TableHead>Módulo</TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead>Cron</TableHead>
                    <TableHead>Tentativas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pipelines.map((p) => (
                    <TableRow key={p.key}>
                      <TableCell className="font-mono text-xs">{p.key}</TableCell>
                      <TableCell>{p.module}</TableCell>
                      <TableCell>{p.label}</TableCell>
                      <TableCell className="font-mono text-xs">{p.cron_expr ?? "—"}</TableCell>
                      <TableCell>{p.max_attempts}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {openJob && <JobDetail jobId={openJob} onClose={() => setOpenJob(null)} />}
    </div>
  );
}
