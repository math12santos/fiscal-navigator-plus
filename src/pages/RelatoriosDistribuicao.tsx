import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/PageHeader";
import { useChatBindings } from "@/hooks/useChatBindings";
import { useReportTemplates, useReportSchedules } from "@/hooks/useReportSchedules";
import { useReportDeliveries } from "@/hooks/useReportRecipients";
import { Send, Trash2, Play, Power } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function RelatoriosDistribuicao() {
  const [tab, setTab] = useState("dashboard");
  const { bindings, create: createBinding, toggle: toggleBinding, remove: removeBinding } = useChatBindings();
  const { data: templates = [] } = useReportTemplates();
  const { schedules, upsert: upsertSchedule, triggerNow } = useReportSchedules();
  const { data: deliveries = [] } = useReportDeliveries();

  const [newBinding, setNewBinding] = useState({ channel: "telegram" as "telegram" | "slack", chat_id: "", label: "" });

  const sentLast7 = deliveries.filter((d: any) => {
    const d7 = new Date(Date.now() - 7 * 86400000);
    return new Date(d.created_at) >= d7 && d.status === "sent";
  }).length;
  const failed7 = deliveries.filter((d: any) => {
    const d7 = new Date(Date.now() - 7 * 86400000);
    return new Date(d.created_at) >= d7 && d.status === "failed";
  }).length;
  const opened = deliveries.filter((d: any) => d.link_opened_at).length;

  async function handleCreateBinding() {
    if (!newBinding.chat_id || !newBinding.label) {
      toast({ title: "Preencha label e chat_id", variant: "destructive" });
      return;
    }
    try {
      await createBinding.mutateAsync(newBinding);
      setNewBinding({ channel: "telegram", chat_id: "", label: "" });
      toast({ title: "Canal cadastrado" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Distribuição de Relatórios"
        description="Envio agendado de relatórios financeiros para Telegram e Slack, com auditoria e escalonamento"
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="canais">Canais</TabsTrigger>
          <TabsTrigger value="agendamento">Agendamento</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Enviados (7d)</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{sentLast7}</CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Falhas (7d)</CardTitle></CardHeader><CardContent className="text-2xl font-bold text-destructive">{failed7}</CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Abertos</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{opened}</CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Canais ativos</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{bindings.filter((b) => b.active).length}</CardContent></Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Últimas entregas</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quando</TableHead>
                    <TableHead>Canal</TableHead>
                    <TableHead>Chat</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Feedback</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveries.slice(0, 20).map((d: any) => (
                    <TableRow key={d.id}>
                      <TableCell className="text-xs">{new Date(d.created_at).toLocaleString("pt-BR")}</TableCell>
                      <TableCell><Badge variant="outline">{d.channel}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{d.chat_id_masked}</TableCell>
                      <TableCell>
                        <Badge variant={d.status === "sent" || d.status === "read" ? "default" : d.status === "failed" ? "destructive" : "secondary"}>
                          {d.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{d.feedback_score ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="canais" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Cadastrar canal</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <div>
                <Label>Canal</Label>
                <Select value={newBinding.channel} onValueChange={(v: any) => setNewBinding({ ...newBinding, channel: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="telegram">Telegram</SelectItem>
                    <SelectItem value="slack">Slack</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Chat ID / Channel ID</Label>
                <Input value={newBinding.chat_id} onChange={(e) => setNewBinding({ ...newBinding, chat_id: e.target.value })} placeholder="-1001234... ou C123ABC" />
              </div>
              <div>
                <Label>Rótulo</Label>
                <Input value={newBinding.label} onChange={(e) => setNewBinding({ ...newBinding, label: e.target.value })} placeholder="Diretoria Financeira" />
              </div>
              <Button onClick={handleCreateBinding}><Send className="mr-2 h-4 w-4" />Adicionar</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Canais cadastrados</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rótulo</TableHead>
                    <TableHead>Canal</TableHead>
                    <TableHead>Chat ID</TableHead>
                    <TableHead>Ativo</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bindings.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell>{b.label}</TableCell>
                      <TableCell><Badge variant="outline">{b.channel}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{b.chat_id}</TableCell>
                      <TableCell>
                        <Switch checked={b.active} onCheckedChange={(v) => toggleBinding.mutate({ id: b.id, active: v })} />
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => removeBinding.mutate(b.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agendamento" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Templates disponíveis</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Template</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Cron padrão</TableHead>
                    <TableHead>Ativo</TableHead>
                    <TableHead>Mascarar valores</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((t) => {
                    const sched = schedules.find((s) => s.template_code === t.code);
                    return (
                      <TableRow key={t.code}>
                        <TableCell>
                          <div className="font-medium">{t.name}</div>
                          <div className="text-xs text-muted-foreground">{t.description}</div>
                        </TableCell>
                        <TableCell><Badge variant="outline">{t.category}</Badge></TableCell>
                        <TableCell className="font-mono text-xs">{sched?.cron ?? t.default_schedule_cron ?? "—"}</TableCell>
                        <TableCell>
                          <Switch
                            checked={sched?.enabled ?? false}
                            onCheckedChange={(v) =>
                              upsertSchedule.mutate({
                                template_code: t.code,
                                cron: sched?.cron ?? t.default_schedule_cron ?? undefined,
                                enabled: v,
                                mask_values: sched?.mask_values ?? false,
                              })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={sched?.mask_values ?? false}
                            onCheckedChange={(v) =>
                              upsertSchedule.mutate({
                                template_code: t.code,
                                cron: sched?.cron ?? t.default_schedule_cron ?? undefined,
                                enabled: sched?.enabled ?? false,
                                mask_values: v,
                              })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          {sched && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                triggerNow.mutate(sched.id, {
                                  onSuccess: () => toast({ title: "Disparo iniciado" }),
                                  onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
                                })
                              }
                            >
                              <Play className="h-3 w-3 mr-1" />Testar
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historico">
          <Card>
            <CardHeader><CardTitle>Histórico completo de entregas</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>Canal</TableHead>
                    <TableHead>Chat</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Aberto</TableHead>
                    <TableHead>Erro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveries.map((d: any) => (
                    <TableRow key={d.id}>
                      <TableCell className="text-xs">{new Date(d.created_at).toLocaleString("pt-BR")}</TableCell>
                      <TableCell>{d.report_runs?.template_code ?? "—"}</TableCell>
                      <TableCell><Badge variant="outline">{d.channel}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{d.chat_id_masked}</TableCell>
                      <TableCell>
                        <Badge variant={d.status === "sent" || d.status === "read" ? "default" : d.status === "failed" ? "destructive" : "secondary"}>
                          {d.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{d.link_opened_at ? "✅" : "—"}</TableCell>
                      <TableCell className="text-xs text-destructive max-w-xs truncate">{d.error ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
