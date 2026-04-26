// Regras puras da Matriz 9 Box (testáveis).
// Faixas conforme spec: nota 1-2 = baixo, 3 = médio, 4-5 = alto.
// Quadrantes (linha = potencial: baixo/médio/alto, col = desempenho: baixo/médio/alto):
//   1=baixo+baixo (risco crítico)            2=médio+baixo            3=alto+baixo (especialista)
//   4=baixo+médio (precisa dev)              5=médio+médio (consist.) 6=alto+médio (alto desemp.)
//   7=baixo+alto  (aposta)                   8=médio+alto (talento)   9=alto+alto (talento estratégico)

export type NineBoxLevel = "baixo" | "medio" | "alto";

export function levelFromScore(score: number): NineBoxLevel {
  if (score < 3) return "baixo";
  if (score < 4) return "medio";
  return "alto";
}

const LEVEL_INDEX: Record<NineBoxLevel, number> = { baixo: 0, medio: 1, alto: 2 };

export function quadrantFrom(notaDesempenho: number, notaPotencial: number): number {
  const d = LEVEL_INDEX[levelFromScore(notaDesempenho)];
  const p = LEVEL_INDEX[levelFromScore(notaPotencial)];
  return p * 3 + d + 1;
}

export const QUADRANT_META: Record<number, {
  label: string;
  short: string;
  // Tom semântico — usar apenas via classes Tailwind, sem cor "raw".
  tone: "destructive" | "warning" | "neutral" | "info" | "success" | "primary";
  description: string;
}> = {
  1: { label: "Risco crítico", short: "Risco", tone: "destructive",
       description: "Baixo desempenho e baixo potencial — avaliar realocação ou desligamento." },
  2: { label: "Contribuidor limitado", short: "Limitado", tone: "warning",
       description: "Desempenho mediano com baixo potencial — manter ou redirecionar." },
  3: { label: "Especialista confiável", short: "Especialista", tone: "info",
       description: "Alto desempenho com baixo potencial — manter no escopo técnico." },
  4: { label: "Precisa de desenvolvimento", short: "Dev.", tone: "warning",
       description: "Baixo desempenho com potencial médio — investir em PDI." },
  5: { label: "Desempenho consistente", short: "Consistente", tone: "neutral",
       description: "Mediano em ambos — manter consistência." },
  6: { label: "Alto desempenho", short: "Alto desemp.", tone: "success",
       description: "Alto desempenho com potencial médio — manter e reconhecer." },
  7: { label: "Aposta em desenvolvimento", short: "Aposta", tone: "info",
       description: "Baixo desempenho com alto potencial — PDI agressivo + acompanhamento." },
  8: { label: "Talento em crescimento", short: "Crescendo", tone: "primary",
       description: "Médio desempenho com alto potencial — preparar para promoção." },
  9: { label: "Talento estratégico", short: "Estratégico", tone: "primary",
       description: "Alto desempenho e alto potencial — sucessão e retenção." },
};

export const QUADRANT_TONE_CLASS: Record<string, string> = {
  destructive: "bg-destructive/10 text-destructive border-destructive/30",
  warning: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  neutral: "bg-muted/40 text-foreground border-border",
  info: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  success: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  primary: "bg-primary/10 text-primary border-primary/30",
};
