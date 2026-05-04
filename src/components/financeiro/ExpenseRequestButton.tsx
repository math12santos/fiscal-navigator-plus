// Re-export do componente unificado para retrocompatibilidade.
// Mantém a API antiga usada em ContasAPagar.
import { RequestExpenseButton } from "@/components/requests/RequestExpenseButton";

export function ExpenseRequestButton() {
  return <RequestExpenseButton sourceModule="financeiro" />;
}
