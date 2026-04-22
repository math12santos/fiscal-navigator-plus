import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import TerminationSimulatorDialog from "./TerminationSimulatorDialog";

// ============================================================================
// Mocks: isolamos o componente das dependências de Supabase / contextos.
// ============================================================================

const mockEmployees = [
  {
    id: "emp-clt-1",
    name: "Ana CLT",
    contract_type: "CLT",
    salary_base: 5000,
    admission_date: "2023-01-15",
    status: "ativo",
  },
  {
    id: "emp-pj-1",
    name: "Bruno PJ",
    contract_type: "PJ",
    salary_base: 10000,
    admission_date: "2023-06-01",
    status: "ativo",
  },
  {
    id: "emp-est-1",
    name: "Clara Estagiária",
    contract_type: "estagio",
    salary_base: 1500,
    admission_date: "2023-03-10",
    status: "ativo",
  },
];

vi.mock("@/hooks/useDP", () => ({
  useEmployees: () => ({ data: mockEmployees }),
  useDPConfig: () => ({ data: { fgts_pct: 8 } }),
  useMutateTermination: () => ({
    create: { mutate: vi.fn(), isPending: false },
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

// ============================================================================
// Helpers
// ============================================================================

function renderDialog() {
  return render(
    <TerminationSimulatorDialog open={true} onOpenChange={vi.fn()} />
  );
}

/** Seleciona um colaborador via Radix Select clicando no trigger e na opção. */
function selectEmployee(label: string) {
  // Trigger do Select de Colaborador é o primeiro combobox
  const triggers = screen.getAllByRole("combobox");
  fireEvent.click(triggers[0]);
  const option = screen.getByText(new RegExp(label, "i"));
  fireEvent.click(option);
}

function clickCalculate() {
  const btn = screen.getByRole("button", { name: /calcular/i });
  fireEvent.click(btn);
}

// ============================================================================
// Tests
// ============================================================================

describe("<TerminationSimulatorDialog /> — UI por regime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza o título e o botão Calcular desabilitado sem colaborador", () => {
    renderDialog();
    expect(screen.getByText(/Simulador de Desligamento/i)).toBeInTheDocument();
    const btn = screen.getByRole("button", { name: /calcular/i });
    expect(btn).toBeDisabled();
  });

  it("CLT: exibe regime 'CLT' e gera linhas de FGTS, 13º e Férias após calcular", () => {
    renderDialog();
    selectEmployee("Ana CLT");

    // Regime visível ao usuário
    expect(screen.getByText(/Regime:/i)).toBeInTheDocument();
    expect(screen.getByText("CLT")).toBeInTheDocument();

    clickCalculate();

    // Verbas trabalhistas devem aparecer para CLT sem justa causa (default)
    expect(screen.getByText(/Multa FGTS/i)).toBeInTheDocument();
    expect(screen.getByText(/13º Proporcional/i)).toBeInTheDocument();
    expect(screen.getByText(/Férias Proporcionais/i)).toBeInTheDocument();
    expect(screen.getByText(/1\/3 Férias/i)).toBeInTheDocument();
    // Aviso aparece como "Aviso Prévio" (não "Aviso Contratual")
    expect(screen.getByText(/Aviso Prévio/i)).toBeInTheDocument();
  });

  it("PJ: exibe regime 'PJ' + alerta cível e NÃO renderiza FGTS/13º/Férias", () => {
    renderDialog();
    selectEmployee("Bruno PJ");

    expect(screen.getByText("PJ")).toBeInTheDocument();
    // Alerta de regime cível
    expect(screen.getByText(/relação cível/i)).toBeInTheDocument();

    clickCalculate();

    // Verbas trabalhistas NUNCA aparecem para PJ
    expect(screen.queryByText(/Multa FGTS/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/13º Proporcional/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Férias Proporcionais/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/1\/3 Férias/i)).not.toBeInTheDocument();

    // Mensagem explicativa deve estar presente
    expect(
      screen.getByText(/PJ não gera FGTS, multa rescisória, 13º ou férias/i)
    ).toBeInTheDocument();
  });

  it("Estágio: exibe regime 'estagio' + alerta Lei 11.788 e NÃO renderiza FGTS/13º/multa", () => {
    renderDialog();
    selectEmployee("Clara Estagiária");

    expect(screen.getByText("estagio")).toBeInTheDocument();
    expect(screen.getByText(/Lei 11\.788/i)).toBeInTheDocument();

    clickCalculate();

    expect(screen.queryByText(/Multa FGTS/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/13º Proporcional/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/1\/3 Férias/i)).not.toBeInTheDocument();

    // Slot de "Férias Proporcionais" é reaproveitado como "Recesso Proporcional"
    expect(screen.getByText(/Recesso Proporcional/i)).toBeInTheDocument();

    // Mensagem específica do estágio
    expect(
      screen.getByText(/Estagiário não gera FGTS, 13º ou multa/i)
    ).toBeInTheDocument();
  });

  it("PJ: opções do Select de tipo são as PJ (distrato), nunca CLT", () => {
    renderDialog();
    selectEmployee("Bruno PJ");

    // Abre o Select de tipo (segundo combobox)
    const triggers = screen.getAllByRole("combobox");
    fireEvent.click(triggers[1]);

    // Deve listar opções PJ
    expect(screen.getByText(/Distrato com aviso prévio contratual/i)).toBeInTheDocument();
    expect(screen.getByText(/Fim natural do contrato/i)).toBeInTheDocument();

    // Não deve listar opções CLT
    expect(screen.queryByText(/Sem justa causa/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Acordo \(reforma\)/i)).not.toBeInTheDocument();
  });
});
