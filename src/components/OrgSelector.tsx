import { useState, useMemo } from "react";
import { useOrganization, Organization } from "@/contexts/OrganizationContext";
import { Building2, ChevronDown, Check, Plus, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function formatDoc(type: string, number: string) {
  if (!number) return "";
  if (type === "CPF") {
    return number.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  return number.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

interface OrgSelectorProps {
  collapsed?: boolean;
}

export default function OrgSelector({ collapsed }: OrgSelectorProps) {
  const { organizations, currentOrg, setCurrentOrg } = useOrganization();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return organizations;
    return organizations.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        (o.document_number ?? "").toLowerCase().includes(q),
    );
  }, [organizations, search]);

  if (!currentOrg) {
    return (
      <Button
        variant="ghost"
        className="w-full justify-start px-3 h-auto py-2 text-sm text-muted-foreground"
        onClick={() => navigate("/nova-empresa")}
      >
        <Plus size={16} className="mr-2 shrink-0" />
        {!collapsed && "Cadastrar Empresa"}
      </Button>
    );
  }

  const renderList = () => (
    <>
      {organizations.length > 6 && (
        <div className="p-2 sticky top-0 bg-popover z-10 border-b border-border">
          <div className="relative">
            <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder="Buscar empresa..."
              className="h-8 pl-7 text-xs"
            />
          </div>
        </div>
      )}
      <div className="max-h-72 overflow-y-auto overflow-x-hidden">
        {filtered.length === 0 ? (
          <div className="px-3 py-4 text-xs text-muted-foreground text-center">
            Nenhuma empresa encontrada
          </div>
        ) : (
          filtered.map((org) => (
            <DropdownMenuItem
              key={org.id}
              onClick={() => {
                setCurrentOrg(org);
                setSearch("");
              }}
              className={cn(
                "flex items-center justify-between gap-2",
                org.id === currentOrg.id && "bg-secondary/50",
              )}
            >
              <div className="min-w-0">
                <div className="font-medium text-sm truncate">{org.name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {org.document_type}: {formatDoc(org.document_type, org.document_number)}
                </div>
              </div>
              {org.id === currentOrg.id && <Check size={14} className="text-primary shrink-0" />}
            </DropdownMenuItem>
          ))
        )}
      </div>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={() => navigate("/nova-empresa")}>
        <Plus size={14} className="mr-2" /> Nova Empresa
      </DropdownMenuItem>
    </>
  );

  if (collapsed) {
    return (
      <DropdownMenu onOpenChange={(o) => !o && setSearch("")}>
        <DropdownMenuTrigger asChild>
          <button className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-secondary/50 transition-colors">
            <Building2 size={18} className="text-primary" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start" className="w-72 p-0">
          {renderList()}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu onOpenChange={(o) => !o && setSearch("")}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="w-full justify-between px-3 h-auto py-2">
          <div className="flex items-center gap-2 min-w-0">
            <Building2 size={16} className="text-primary shrink-0" />
            <div className="text-left min-w-0">
              <div className="text-sm font-medium truncate text-primary">{currentOrg.name}</div>
              <div className="text-[10px] text-muted-foreground truncate">
                {currentOrg.document_type}: {formatDoc(currentOrg.document_type, currentOrg.document_number)}
              </div>
            </div>
          </div>
          <ChevronDown size={14} className="text-muted-foreground shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72 p-0">
        {renderList()}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
