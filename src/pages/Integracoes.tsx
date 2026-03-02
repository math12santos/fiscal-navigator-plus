import { PageHeader } from "@/components/PageHeader";
import { cn } from "@/lib/utils";
import { Database, Building2, CreditCard, Cloud, ArrowRight } from "lucide-react";
import { SlackChat } from "@/components/slack/SlackChat";

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
      <PageHeader title="Integrações" description="Gerencie conexões com ERPs, bancos e sistemas financeiros" showHoldingToggle={false} />

      {/* Slack Chat */}
      <div className="space-y-2">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
            <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
          </svg>
          Slack
        </h2>
        <SlackChat />
      </div>

      {/* Other integrations */}
      <div className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">Outras Integrações</h2>
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
    </div>
  );
}
