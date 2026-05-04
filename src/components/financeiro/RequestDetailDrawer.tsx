import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Paperclip, ExternalLink, FileText, MessageSquare, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseRequestDescription } from "@/lib/requestDescription";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  request: any | null;
}

const fmt = (v: number | null) =>
  v == null ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const moduleColors: Record<string, string> = {
  dp: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  juridico: "bg-purple-500/10 text-purple-700 dark:text-purple-300",
  ti: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  crm: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  financeiro: "bg-primary/10 text-primary",
  cadastros: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
};

export function RequestDetailDrawer({ open, onOpenChange, request }: Props) {
  const [attachments, setAttachments] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);

  useEffect(() => {
    if (!open || !request?.id) return;
    (async () => {
      const [{ data: att }, { data: com }] = await Promise.all([
        supabase.from("request_attachments" as any).select("*").eq("request_id", request.id).order("created_at"),
        supabase.from("request_comments" as any).select("*").eq("request_id", request.id).order("created_at"),
      ]);
      setAttachments(att ?? []);
      setComments(com ?? []);
    })();
  }, [open, request?.id]);

  if (!request) return null;
  const parsed = parseRequestDescription(request.description);

  const downloadAttachment = async (path: string, name: string) => {
    const { data, error } = await supabase.storage.from("request-attachments").createSignedUrl(path, 60);
    if (error) return;
    const link = document.createElement("a");
    link.href = data.signedUrl;
    link.download = name;
    link.click();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {request.title}
            <Badge variant="secondary">{parsed.subtype === "reimbursement" ? "Reembolso" : "Despesa"}</Badge>
          </SheetTitle>
          <SheetDescription>
            <Badge className={moduleColors[request.reference_module] ?? ""} variant="outline">
              {request.reference_module ?? "—"}
            </Badge>
            <span className="ml-2">Status: {request.status}</span>
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Field label="Valor estimado" value={fmt(parsed.estimated_value)} />
            <Field label="Prioridade" value={request.priority} />
            <Field label="Vencimento" value={request.data_vencimento ?? "—"} />
            <Field label="Competência" value={request.competencia ?? "—"} />
            {parsed.subtype === "reimbursement" && (
              <>
                <Field label="Data do gasto" value={parsed.data_gasto ?? "—"} />
                <Field label="Pagamento pessoal" value={parsed.forma_pagamento_pessoal ?? "—"} />
              </>
            )}
            <Field label="Criada em" value={format(new Date(request.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })} />
            {request.classified_at && (
              <Field label="Aprovada em" value={format(new Date(request.classified_at), "dd/MM/yyyy HH:mm", { locale: ptBR })} />
            )}
          </div>

          {parsed.text && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1">Justificativa</h4>
              <p className="text-sm">{parsed.text}</p>
            </div>
          )}

          {request.cashflow_entry_id && (
            <div className="rounded-md border bg-primary/5 p-3 text-sm flex items-center justify-between">
              <span className="flex items-center gap-2"><ExternalLink className="h-4 w-4" /> Entrada provisionada no fluxo de caixa</span>
              <Badge variant="outline">{request.cashflow_entry_id.slice(0, 8)}</Badge>
            </div>
          )}

          <Separator />

          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1">
              <Paperclip className="h-3.5 w-3.5" /> Anexos ({attachments.length})
            </h4>
            <div className="space-y-1">
              {attachments.length === 0 && <p className="text-xs text-muted-foreground">Nenhum anexo.</p>}
              {attachments.map((a) => (
                <button
                  key={a.id}
                  onClick={() => downloadAttachment(a.file_path, a.file_name)}
                  className="w-full flex items-center gap-2 text-sm rounded-md border bg-muted/30 px-2 py-1.5 hover:bg-muted/50"
                >
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="truncate flex-1 text-left">{a.file_name}</span>
                  <span className="text-xs text-muted-foreground">{(a.file_size / 1024).toFixed(0)} KB</span>
                </button>
              ))}
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1">
              <MessageSquare className="h-3.5 w-3.5" /> Histórico ({comments.length})
            </h4>
            <div className="space-y-2">
              {comments.map((c) => (
                <div key={c.id} className="text-xs border-l-2 border-primary/30 pl-2 py-1">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {format(new Date(c.created_at), "dd/MM HH:mm", { locale: ptBR })}
                  </div>
                  <p>{c.content}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] text-muted-foreground uppercase">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
