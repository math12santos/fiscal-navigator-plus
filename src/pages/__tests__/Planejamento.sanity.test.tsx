import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ============================================================================
// Sanity test: Planejamento page parses + mounts, and ExportPdfButton renders
// without syntax/runtime crashes. Heavy data hooks and child views are mocked
// so we exercise only the page shell + the inline ExportPdfButton component.
// ============================================================================

// --- Mocks de contextos (precisam vir antes do import do componente) -------
vi.mock("@/contexts/PlanningScenarioContext", () => ({
  PlanningScenarioProvider: ({ children }: any) => <>{children}</>,
  usePlanningScenarioContext: () => ({
    activeScenarioId: null,
    setActiveScenarioId: () => {},
    scenarios: [],
  }),
}));

vi.mock("@/contexts/HoldingContext", () => ({
  useHolding: () => ({
    isHolding: false,
    holdingMode: false,
    setHoldingMode: () => {},
    holdingView: "consolidated" as const,
    setHoldingView: () => {},
    subsidiaryIds: [],
    subsidiaryOrgs: [],
    activeOrgIds: ["org-1"],
    selectedSubsidiaryId: null,
    setSelectedSubsidiaryId: () => {},
    isLoading: false,
  }),
}));

// --- Mocks de hooks de dados ------------------------------------------------
vi.mock("@/hooks/useUserPermissions", () => ({
  useUserPermissions: () => ({
    getAllowedTabs: (_mod: string, tabs: any[]) => tabs,
  }),
}));

vi.mock("@/hooks/useCostCenters", () => ({
  useCostCenters: () => ({ costCenters: [], isLoading: false }),
}));

vi.mock("@/hooks/useBankAccounts", () => ({
  useBankAccounts: () => ({ bankAccounts: [], allBankAccounts: [], isLoading: false }),
}));

vi.mock("@/hooks/usePlanningPdfReport", () => ({
  usePlanningPdfReport: () => ({
    generatePdf: () => ({ id: "pdf-1", fileName: "test.pdf" }),
    isReady: true,
    hasFilteredData: true,
  }),
}));

vi.mock("@/hooks/usePlanningReportExports", () => ({
  usePlanningReportExports: () => ({
    record: { mutateAsync: vi.fn().mockResolvedValue(undefined) },
    history: [],
  }),
}));

// --- Mocks de subcomponentes pesados ---------------------------------------
vi.mock("@/components/planning/PlanningCockpit", () => ({
  default: () => <div data-testid="planning-cockpit">Cockpit</div>,
  PLANNING_NAV_EVENT: "planning-nav",
}));
vi.mock("@/components/planning/PlanningBudget", () => ({
  default: () => <div data-testid="planning-budget">Budget</div>,
}));
vi.mock("@/components/planning/PlanningScenariosRisk", () => ({
  default: () => <div data-testid="planning-scenarios">Scenarios</div>,
}));
vi.mock("@/components/planning/PlanningOperational", () => ({
  default: () => <div data-testid="planning-operational">Operational</div>,
}));
vi.mock("@/components/planning/PlanningSettingsDialog", () => ({
  default: () => null,
}));
vi.mock("@/components/planning/PlanningReportHistory", () => ({
  default: () => <div data-testid="planning-history">History</div>,
}));

// Importa DEPOIS dos mocks
import Planejamento from "../Planejamento";

const renderPage = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/planejamento"]}>
        <Planejamento />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe("Planejamento (sanity)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("parses and mounts the page without runtime errors", () => {
    expect(() => renderPage()).not.toThrow();
  });

  it("renders the ExportPdfButton in the page header toolbar", () => {
    renderPage();
    // ExportPdfButton renders a button containing the text "Exportar PDF"
    // (label vem do JSX interno do componente).
    const btn = screen.getByRole("button", { name: /exportar pdf/i });
    expect(btn).toBeInTheDocument();
    expect(btn).not.toBeDisabled();
  });
});
