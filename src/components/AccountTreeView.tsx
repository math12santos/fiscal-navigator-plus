import { useState } from "react";
import { ChartAccount } from "@/hooks/useChartOfAccounts";
import { ChevronRight, ChevronDown, Edit2, Power } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TYPE_COLORS: Record<string, string> = {
  receita: "bg-success/15 text-success border-success/30",
  custo: "bg-destructive/15 text-destructive border-destructive/30",
  despesa: "bg-warning/15 text-warning border-warning/30",
  investimento: "bg-primary/15 text-primary border-primary/30",
  transferencia: "bg-muted text-muted-foreground border-border",
};

const NATURE_LABELS: Record<string, string> = {
  entrada: "Entrada",
  saida: "Saída",
  neutro: "Neutro",
};

const CLASS_LABELS: Record<string, string> = {
  ativo: "Ativo",
  passivo: "Passivo",
  pl: "PL",
  resultado: "Resultado",
};

interface AccountTreeViewProps {
  accounts: ChartAccount[];
  onEdit: (account: ChartAccount) => void;
  onToggleActive: (id: string, active: boolean) => void;
}

interface TreeNode extends ChartAccount {
  children: TreeNode[];
}

function buildTree(accounts: ChartAccount[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  accounts.forEach((a) => map.set(a.id, { ...a, children: [] }));
  accounts.forEach((a) => {
    const node = map.get(a.id)!;
    if (a.parent_id && map.has(a.parent_id)) {
      map.get(a.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

function TreeItem({
  node,
  onEdit,
  onToggleActive,
}: {
  node: TreeNode;
  onEdit: (a: ChartAccount) => void;
  onToggleActive: (id: string, active: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-2 py-2 px-3 rounded-lg group hover:bg-secondary/50 transition-colors",
          !node.active && "opacity-50"
        )}
        style={{ paddingLeft: `${(node.level - 1) * 24 + 12}px` }}
      >
        {/* Expand/Collapse */}
        <button
          onClick={() => setExpanded(!expanded)}
          className={cn("p-0.5 rounded", hasChildren ? "text-muted-foreground hover:text-foreground" : "invisible")}
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>

        {/* Code + Name */}
        <span className="font-mono text-xs text-muted-foreground w-20 shrink-0">{node.code}</span>
        <span className="text-sm font-medium truncate flex-1">{node.name}</span>

        {/* Badges */}
        <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", TYPE_COLORS[node.type])}>
          {node.type}
        </Badge>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
          {NATURE_LABELS[node.nature] ?? node.nature}
        </Badge>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
          {CLASS_LABELS[node.accounting_class] ?? node.accounting_class}
        </Badge>
        {node.is_synthetic && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-accent/10 text-accent border-accent/30">
            Sintética
          </Badge>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(node)}>
            <Edit2 size={13} />
          </Button>
          {!node.is_system_default && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onToggleActive(node.id, !node.active)}
            >
              <Power size={13} className={node.active ? "text-success" : "text-destructive"} />
            </Button>
          )}
        </div>
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <TreeItem key={child.id} node={child} onEdit={onEdit} onToggleActive={onToggleActive} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function AccountTreeView({ accounts, onEdit, onToggleActive }: AccountTreeViewProps) {
  const tree = buildTree(accounts);

  if (accounts.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Nenhuma conta cadastrada. Clique em "Nova Conta" para começar.
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {tree.map((node) => (
        <TreeItem key={node.id} node={node} onEdit={onEdit} onToggleActive={onToggleActive} />
      ))}
    </div>
  );
}
