import { useOrganization, Organization } from "@/contexts/OrganizationContext";
import { Building2, ChevronDown, Check, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function formatDoc(type: string, number: string) {
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

  if (!currentOrg) return null;

  if (collapsed) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-secondary/50 transition-colors">
            <Building2 size={18} className="text-primary" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start" className="w-64">
          {organizations.map((org) => (
            <DropdownMenuItem
              key={org.id}
              onClick={() => setCurrentOrg(org)}
              className="flex items-center justify-between"
            >
              <div>
                <div className="font-medium text-sm">{org.name}</div>
                <div className="text-xs text-muted-foreground">{formatDoc(org.document_type, org.document_number)}</div>
              </div>
              {org.id === currentOrg.id && <Check size={14} className="text-primary" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate("/nova-empresa")}>
            <Plus size={14} className="mr-2" /> Nova Empresa
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="w-full justify-between px-3 h-auto py-2">
          <div className="flex items-center gap-2 min-w-0">
            <Building2 size={16} className="text-primary shrink-0" />
            <div className="text-left min-w-0">
              <div className="text-sm font-medium truncate">{currentOrg.name}</div>
              <div className="text-[10px] text-muted-foreground">
                {currentOrg.document_type}: {formatDoc(currentOrg.document_type, currentOrg.document_number)}
              </div>
            </div>
          </div>
          <ChevronDown size={14} className="text-muted-foreground shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {organizations.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onClick={() => setCurrentOrg(org)}
            className={cn("flex items-center justify-between", org.id === currentOrg.id && "bg-secondary/50")}
          >
            <div>
              <div className="font-medium text-sm">{org.name}</div>
              <div className="text-xs text-muted-foreground">
                {org.document_type}: {formatDoc(org.document_type, org.document_number)}
              </div>
            </div>
            {org.id === currentOrg.id && <Check size={14} className="text-primary" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("/nova-empresa")}>
          <Plus size={14} className="mr-2" /> Nova Empresa
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
