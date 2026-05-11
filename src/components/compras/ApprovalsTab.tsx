import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { SectionCard } from "@/components/SectionCard";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { usePurchaseApprovals, STATUS_REQUEST } from "@/hooks/useCompras";

const fmtBRL = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function ApprovalsTab() {
  const { myPending, approvals, isLoading, decide } = usePurchaseApprovals();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<any>(null);
  const [action, setAction] = useState<string>("");
  const [comment, setComment] = useState("");

  const openAction = (a: any, act: string) => {
    setTarget(a); setAction(act); setComment(""); setOpen(true);
  };

  const submit = () => {
    decide.mutate(
      { id: target.id, status: action, comentario: comment || undefined },
      { onSuccess: () => setOpen(false) },
    );
  };

  return (
    <div className="space-y-4">
      <SectionCard title="Minhas pendências" description="Aprovações aguardando sua decisão.">
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status req.</TableHead>
                <TableHead className="w-72">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Carregando...</TableCell></TableRow>
              ) : myPending.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Sem pendências.</TableCell></TableRow>
              ) : (
                myPending.map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono text-xs">{a.request?.codigo}</TableCell>
                    <TableCell>
                      <div className="font-medium">{a.request?.descricao || "—"}</div>
                      {a.request?.fora_orcamento && <Badge variant="destructive" className="mt-1">Fora do orçamento</Badge>}
                    </TableCell>
                    <TableCell className="text-right">{fmtBRL(Number(a.request?.valor_estimado) || 0)}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_REQUEST[a.request?.status]?.variant || "outline"}>
                        {STATUS_REQUEST[a.request?.status]?.label || a.request?.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Button size="sm" variant="default" onClick={() => openAction(a, "aprovado")}>Aprovar</Button>
                        <Button size="sm" variant="destructive" onClick={() => openAction(a, "reprovado")}>Reprovar</Button>
                        <Button size="sm" variant="outline" onClick={() => openAction(a, "ajuste_solicitado")}>Solicitar ajuste</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </SectionCard>

      <SectionCard title="Histórico de aprovações" description="Decisões registradas no módulo.">
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Solicitação</TableHead>
                <TableHead>Aprovador</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Decidido em</TableHead>
                <TableHead>Comentário</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {approvals.filter((a: any) => a.status !== "pendente").length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Sem histórico.</TableCell></TableRow>
              ) : (
                approvals.filter((a: any) => a.status !== "pendente").map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono text-xs">{a.request?.codigo}</TableCell>
                    <TableCell className="text-xs">{a.approver_role || a.approver_user_id || "—"}</TableCell>
                    <TableCell><Badge variant="outline">{a.status}</Badge></TableCell>
                    <TableCell className="text-xs">{a.decided_at ? new Date(a.decided_at).toLocaleString("pt-BR") : "—"}</TableCell>
                    <TableCell className="text-xs">{a.comentario || "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </SectionCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action === "aprovado" ? "Aprovar solicitação" : action === "reprovado" ? "Reprovar solicitação" : "Solicitar ajuste"}
            </DialogTitle>
          </DialogHeader>
          <div>
            <Textarea
              placeholder="Comentário (opcional)"
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={decide.isPending}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
