import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { TrendingUp } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { SectorOnboardingBar } from "@/components/sector-onboarding/SectorOnboardingBar";
import DPDashboard from "@/components/dp/DPDashboard";
import DPColaboradores from "@/components/dp/DPColaboradores";
import DPFolha from "@/components/dp/DPFolha";
import DPFerias from "@/components/dp/DPFerias";
import DPRescisoes from "@/components/dp/DPRescisoes";
import DPEncargos from "@/components/dp/DPEncargos";
import DPCargos from "@/components/dp/DPCargos";
import DPBeneficios from "@/components/dp/DPBeneficios";
import DPConfig from "@/components/dp/DPConfig";

const ALL_TABS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "colaboradores", label: "Colaboradores" },
  { key: "folha", label: "Folha" },
  { key: "ferias", label: "Férias / 13º" },
  { key: "rescisoes", label: "Rescisões" },
  { key: "encargos", label: "Encargos" },
  { key: "cargos", label: "Cargos & Rotinas" },
  { key: "beneficios", label: "Benefícios" },
  { key: "config", label: "Configurações" },
];

const TAB_COMPONENTS: Record<string, React.ReactNode> = {
  dashboard: <DPDashboard />,
  colaboradores: <DPColaboradores />,
  folha: <DPFolha />,
  ferias: <DPFerias />,
  rescisoes: <DPRescisoes />,
  encargos: <DPEncargos />,
  cargos: <DPCargos />,
  beneficios: <DPBeneficios />,
  config: <DPConfig />,
};

export default function DepartamentoPessoal() {
  const { getAllowedTabs } = useUserPermissions();
  const allowedTabs = getAllowedTabs("dp", ALL_TABS);
  const [tab, setTab] = useState(allowedTabs[0]?.key || "dashboard");

  if (allowedTabs.length === 0) {
    return (
      <div className="animate-fade-in space-y-6">
        <PageHeader title="Departamento Pessoal" description="Você não possui permissão para acessar este módulo." />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Departamento Pessoal"
        description="Gestão de colaboradores, folha de pagamento, encargos e planejamento de RH"
      />

      <SectorOnboardingBar sector="dp" onTabChange={setTab} />

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="flex-wrap">
          {allowedTabs.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>
          ))}
        </TabsList>

        {allowedTabs.map((t) => (
          <TabsContent key={t.key} value={t.key}>
            {TAB_COMPONENTS[t.key]}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
