import { PageHeader } from "@/components/PageHeader";
import { cn } from "@/lib/utils";
import { Database, Building2, CreditCard, Cloud, ArrowRight } from "lucide-react";

const integrations = [
  { name: "SAP ERP", desc: "Importação de dados contábeis e financeiros", icon: Database, status: "Conectado", color: "text-success" },
  { name: "Banco do Brasil", desc: "Extratos e conciliação automática", icon: Building2, status: "Conectado", color: "text-success" },
  { name: "Itaú Empresas", desc: "Extratos e conciliação automática", icon: CreditCard, status: "Pendente", color: "text-warning" },
  { name: "TOTVS Protheus", desc: "Integração de contratos e NFs", icon: Database, status: "Disponível", color: "text-muted-foreground" },
  { name: "AWS S3", desc: "Armazenamento de documentos e relatórios", icon: Cloud, status: "Conectado", color: "text-success" },
];

export default function Integracoes() {
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Integrações" description="Gerencie conexões com ERPs, bancos e sistemas financeiros" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {integrations.map((int) => (
          <div key={int.name} className="glass-card p-5 flex items-center gap-4 hover:bg-secondary/20 transition-colors cursor-pointer group">
            <div className="rounded-lg bg-primary/10 p-3 text-primary">
              <int.icon size={22} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">{int.name}</p>
              <p className="text-xs text-muted-foreground">{int.desc}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn("text-xs font-medium", int.color)}>{int.status}</span>
              <ArrowRight size={14} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
