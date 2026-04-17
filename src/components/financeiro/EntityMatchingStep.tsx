import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  CheckCircle2,
  HelpCircle,
  PlusCircle,
  EyeOff,
  Sparkles,
  Loader2,
} from "lucide-react";
import { useEntities } from "@/hooks/useEntities";
import type { EntityMatch } from "@/hooks/useFinanceiroImport";
import { cn } from "@/lib/utils";

interface Props {
  matches: EntityMatch[];
  tipo: "saida" | "entrada";
  onConfirmPossible: (name: string) => void;
  onSelectEntity: (name: string, entityId: string | null) => void;
  onIgnore: (name: string) => void;
  onCreateAllNew: () => Promise<number>;
}

export function EntityMatchingStep({
  matches,
  tipo,
  onConfirmPossible,
  onSelectEntity,
  onIgnore,
  onCreateAllNew,
}: Props) {
  const { entities } = useEntities();
  const [filter, setFilter] = useState<"all" | "found" | "possible" | "new" | "ignored">("all");
  const [creating, setCreating] = useState(false);

  const counts = useMemo(() => {
    return {
      found: matches.filter((m) => m.status === "found").length,
      possible: matches.filter((m) => m.status === "possible").length,
      new: matches.filter((m) => m.status === "new").length,
      ignored: matches.filter((m) => m.status === "ignored").length,
    };
  }, [matches]);

  const allowedType = tipo === "saida" ? ["fornecedor", "ambos"] : ["cliente", "ambos"];
  const entityOptions = useMemo(
    () =>
      entities
        .filter((e) => allowedType.includes(e.type) && e.active)
        .map((e) => ({
          value: e.id,
          label: e.document_number ? `${e.name} — ${e.document_number}` : e.name,
        })),
    [entities, allowedType]
  );

  const filtered = matches.filter((m) => filter === "all" || m.status === filter);

  const handleCreateAll = async () => {
    setCreating(true);
    try {
      await onCreateAllNew();
    } finally {
      setCreating(false);
    }
  };

  const tipoLabel = tipo === "saida" ? "fornecedores" : "clientes";

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-muted-foreground">
          Reconcilie os {tipoLabel} encontrados nos dados importados com o cadastro existente.
          Vínculos garantem rastreabilidade e evitam duplicidades.
        </p>
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-2 text-xs">
        <FilterChip
          active={filter === "all"}
          onClick={() => setFilter("all")}
          label={`${matches.length} totais`}
        />
        <FilterChip
          active={filter === "found"}
          onClick={() => setFilter("found")}
          label={`${counts.found} vinculados`}
          icon={<CheckCircle2 className="h-3 w-3 mr-1" />}
          color="success"
        />
        {counts.possible > 0 && (
          <FilterChip
            active={filter === "possible"}
            onClick={() => setFilter("possible")}
            label={`${counts.possible} para revisar`}
            icon={<HelpCircle className="h-3 w-3 mr-1" />}
            color="warning"
          />
        )}
        {counts.new > 0 && (
          <FilterChip
            active={filter === "new"}
            onClick={() => setFilter("new")}
            label={`${counts.new} não cadastrados`}
            icon={<PlusCircle className="h-3 w-3 mr-1" />}
            color="info"
          />
        )}
        {counts.ignored > 0 && (
          <FilterChip
            active={filter === "ignored"}
            onClick={() => setFilter("ignored")}
            label={`${counts.ignored} ignorados`}
            icon={<EyeOff className="h-3 w-3 mr-1" />}
          />
        )}

        {counts.new > 0 && (
          <Button
            size="sm"
            variant="default"
            className="h-7 ml-auto"
            onClick={handleCreateAll}
            disabled={creating}
          >
            {creating ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3 mr-1" />
            )}
            Cadastrar {counts.new} novos {tipoLabel}
          </Button>
        )}
      </div>

      <div className="border rounded-md overflow-auto max-h-[calc(92vh-300px)]">
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow>
              <TableHead className="w-[28%]">Nome importado</TableHead>
              <TableHead className="w-[14%]">Status</TableHead>
              <TableHead className="w-[10%] text-right">Ocorrências</TableHead>
              <TableHead className="w-[36%]">Cadastro vinculado</TableHead>
              <TableHead className="w-[12%] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-8">
                  Nenhum item nesta categoria.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((m) => {
              const suggestedEntity = m.suggestedEntityId
                ? entities.find((e) => e.id === m.suggestedEntityId)
                : null;
              return (
                <TableRow
                  key={m.importedName}
                  className={cn(
                    m.status === "ignored" && "opacity-50",
                    m.status === "possible" && "bg-amber-50/50 dark:bg-amber-950/10"
                  )}
                >
                  <TableCell className="text-xs font-medium">
                    {m.importedName}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={m.status} confidence={m.confidence} />
                  </TableCell>
                  <TableCell className="text-xs text-right tabular-nums text-muted-foreground">
                    {m.occurrences}
                  </TableCell>
                  <TableCell>
                    {m.status === "ignored" ? (
                      <span className="text-xs text-muted-foreground italic">— sem vínculo —</span>
                    ) : (
                      <div className="space-y-1">
                        <SearchableSelect
                          options={entityOptions}
                          value={m.matchedEntityId ?? ""}
                          onValueChange={(v) => onSelectEntity(m.importedName, v || null)}
                          placeholder="— selecionar cadastro —"
                          searchPlaceholder="Buscar cadastro..."
                          emptyMessage="Nenhum cadastro encontrado"
                          className="h-8 text-xs"
                        />
                        {m.status === "possible" && suggestedEntity && !m.matchedEntityId && (
                          <p className="text-[10px] text-amber-700 dark:text-amber-400">
                            Sugestão: <strong>{suggestedEntity.name}</strong>
                            {" "}({Math.round(m.confidence * 100)}% similar)
                          </p>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {m.status === "possible" && m.suggestedEntityId && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[10px] px-2"
                          onClick={() => onConfirmPossible(m.importedName)}
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Confirmar
                        </Button>
                      )}
                      {m.status !== "ignored" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-[10px] px-2 text-muted-foreground"
                          onClick={() => onIgnore(m.importedName)}
                        >
                          <EyeOff className="h-3 w-3 mr-1" />
                          Ignorar
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        Lançamentos com cadastro <strong>vinculado</strong> serão importados com o <code>entity_id</code> correto.
        Lançamentos <strong>ignorados</strong> ou sem vínculo serão importados apenas com o nome textual.
      </p>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  icon,
  color,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: React.ReactNode;
  color?: "success" | "warning" | "info";
}) {
  const colorMap: Record<string, string> = {
    success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25",
    warning: "bg-amber-500/15 text-amber-700 dark:text-amber-300 hover:bg-amber-500/25",
    info: "bg-sky-500/15 text-sky-700 dark:text-sky-300 hover:bg-sky-500/25",
  };
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors cursor-pointer",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : color
          ? colorMap[color]
          : "bg-muted text-muted-foreground hover:bg-accent"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function StatusBadge({ status, confidence }: { status: EntityMatch["status"]; confidence: number }) {
  if (status === "found") {
    return (
      <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px]">
        <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
        Vinculado
      </Badge>
    );
  }
  if (status === "possible") {
    return (
      <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[10px]">
        <HelpCircle className="h-2.5 w-2.5 mr-0.5" />
        Revisar ({Math.round(confidence * 100)}%)
      </Badge>
    );
  }
  if (status === "new") {
    return (
      <Badge className="bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30 text-[10px]">
        <PlusCircle className="h-2.5 w-2.5 mr-0.5" />
        Não cadastrado
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] text-muted-foreground">
      <EyeOff className="h-2.5 w-2.5 mr-0.5" />
      Ignorado
    </Badge>
  );
}
