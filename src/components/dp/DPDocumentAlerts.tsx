/**
 * Painel de alertas de documentos de colaboradores próximos do vencimento.
 * Lê de useExpiringDocuments (60 dias por padrão) e renderiza badges por urgência.
 *
 * Categorias:
 *  - Vencidos (expires_at < hoje)
 *  - Críticos (≤ 15 dias)
 *  - Próximos (16–60 dias)
 *
 * Uso: aparece no Dashboard do DP. Não bloqueia operação — é informacional.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, FileWarning, Clock } from "lucide-react";
import { useExpiringDocuments, DOC_TYPES } from "@/hooks/useEmployeeDocuments";
import { differenceInDays, format } from "date-fns";

export default function DPDocumentAlerts() {
  const { data: docs = [], isLoading } = useExpiringDocuments(60);

  if (isLoading) return null;
  if (docs.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileWarning size={14} className="text-muted-foreground" />
            Documentos &amp; Exames
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-xs text-muted-foreground">
            Nenhum documento com vencimento próximo nos próximos 60 dias.
          </p>
        </CardContent>
      </Card>
    );
  }

  const today = new Date();
  const buckets = { expired: [] as any[], critical: [] as any[], upcoming: [] as any[] };
  docs.forEach((d: any) => {
    const days = differenceInDays(new Date(d.expires_at), today);
    if (days < 0) buckets.expired.push({ ...d, days });
    else if (days <= 15) buckets.critical.push({ ...d, days });
    else buckets.upcoming.push({ ...d, days });
  });

  const docLabel = (v: string) => DOC_TYPES.find((d) => d.value === v)?.label || v;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <AlertTriangle size={14} className="text-warning" />
          Documentos &amp; Exames vencendo
          <Badge variant="outline" className="text-[10px] ml-auto">
            {docs.length} documento(s)
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {buckets.expired.length > 0 && (
          <Section
            title={`Vencidos (${buckets.expired.length})`}
            tone="destructive"
            items={buckets.expired}
            docLabel={docLabel}
          />
        )}
        {buckets.critical.length > 0 && (
          <Section
            title={`Críticos — até 15 dias (${buckets.critical.length})`}
            tone="warning"
            items={buckets.critical}
            docLabel={docLabel}
          />
        )}
        {buckets.upcoming.length > 0 && (
          <Section
            title={`Próximos — 16 a 60 dias (${buckets.upcoming.length})`}
            tone="muted"
            items={buckets.upcoming}
            docLabel={docLabel}
          />
        )}
      </CardContent>
    </Card>
  );
}

function Section({
  title,
  items,
  tone,
  docLabel,
}: {
  title: string;
  items: any[];
  tone: "destructive" | "warning" | "muted";
  docLabel: (v: string) => string;
}) {
  const toneClass =
    tone === "destructive"
      ? "text-destructive"
      : tone === "warning"
      ? "text-warning"
      : "text-muted-foreground";
  return (
    <div className="space-y-1">
      <p className={`text-xs font-semibold ${toneClass} flex items-center gap-1`}>
        <Clock size={11} />
        {title}
      </p>
      <ul className="space-y-0.5">
        {items.slice(0, 6).map((d) => (
          <li key={d.id} className="text-xs flex items-center justify-between gap-2">
            <span className="truncate text-foreground">
              {d.employees?.name || "—"} • {docLabel(d.doc_type)}
            </span>
            <span className={`shrink-0 font-mono ${toneClass}`}>
              {d.days < 0
                ? `vencido há ${Math.abs(d.days)}d`
                : d.days === 0
                ? "vence hoje"
                : `${d.days}d — ${format(new Date(d.expires_at), "dd/MM")}`}
            </span>
          </li>
        ))}
        {items.length > 6 && (
          <li className="text-[10px] text-muted-foreground">+ {items.length - 6} outro(s)</li>
        )}
      </ul>
    </div>
  );
}
