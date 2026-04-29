/**
 * Catálogo de erros de importação financeira com causa, solução e ações rápidas.
 * Cada erro mapeia uma string de erro técnica para um objeto com explicação acessível.
 */

export type ImportErrorCode =
  | "DESC_MISSING"
  | "VALUE_MISSING"
  | "VALUE_INVALID"
  | "DATE_MISSING"
  | "DATE_INVALID_BR"
  | "DATE_INVALID_US"
  | "REQUIRED_MAPPING_MISSING"
  | "DB_DUPLICATE"
  | "DB_PERMISSION"
  | "DB_CONSTRAINT"
  | "UNKNOWN";

export interface ImportErrorInfo {
  code: ImportErrorCode;
  title: string;
  cause: string;
  solution: string;
  /** ID de ação rápida que a UI pode interpretar (opcional) */
  quickFix?:
    | "switch_date_to_us"
    | "switch_date_to_br"
    | "switch_number_to_us"
    | "switch_number_to_br"
    | "open_mapping"
    | "exclude_row"
    | null;
  quickFixLabel?: string;
}

/**
 * Identifica o código de erro a partir da mensagem original (linha-a-linha ou banco).
 */
export function classifyImportError(rawMessage: string): ImportErrorInfo {
  const msg = (rawMessage || "").toLowerCase();

  if (msg.includes("descrição ausente") || msg.includes("descricao ausente")) {
    return {
      code: "DESC_MISSING",
      title: "Descrição ausente",
      cause: "Esta linha não tem texto na coluna mapeada como Descrição.",
      solution: "Verifique no arquivo se a célula está vazia, ou mapeie outra coluna como Descrição.",
      quickFix: "open_mapping",
      quickFixLabel: "Revisar mapeamento",
    };
  }
  if (msg.includes("valor ausente")) {
    return {
      code: "VALUE_MISSING",
      title: "Valor ausente",
      cause: "Esta linha não tem número na coluna mapeada como Valor.",
      solution: "Confira se a célula está em branco no arquivo. Se for um lançamento sem valor, exclua a linha da importação.",
      quickFix: "exclude_row",
      quickFixLabel: "Excluir linha",
    };
  }
  if (msg.includes("valor inválido") || msg.includes("valor invalido")) {
    return {
      code: "VALUE_INVALID",
      title: "Formato de valor não reconhecido",
      cause: "O número está em formato diferente do detectado (ex.: '1,234.56' interpretado como '1.234,56' ou vice-versa).",
      solution: "Troque o formato de números no painel de Mapeamento (BR ↔ US) e refaça o preview.",
      quickFix: "switch_number_to_us",
      quickFixLabel: "Trocar para formato US (1,234.56)",
    };
  }
  if (msg.includes("data ausente")) {
    return {
      code: "DATE_MISSING",
      title: "Data de vencimento ausente",
      cause: "Esta linha não tem data na coluna mapeada como Data Vencimento.",
      solution: "Confira o arquivo ou exclua a linha. Importação exige data de vencimento.",
      quickFix: "exclude_row",
      quickFixLabel: "Excluir linha",
    };
  }
  if (msg.includes("data inválida") || msg.includes("data invalida")) {
    // Tenta inferir formato a partir da string
    const isLikelyUS = /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(rawMessage) && parseInt(rawMessage.split("/")[0]?.replace(/\D/g, "") || "0") > 12;
    if (isLikelyUS) {
      return {
        code: "DATE_INVALID_US",
        title: "Data parece estar em formato US (MM/DD/YYYY)",
        cause: "O sistema detectou formato BR (DD/MM/YYYY) mas a célula tem mês > 12.",
        solution: "Troque o formato de data no Mapeamento para MM/DD/YYYY.",
        quickFix: "switch_date_to_us",
        quickFixLabel: "Trocar para MM/DD/YYYY",
      };
    }
    return {
      code: "DATE_INVALID_BR",
      title: "Formato de data não reconhecido",
      cause: "A data não está em DD/MM/YYYY nem em YYYY-MM-DD.",
      solution: "Padronize as datas no arquivo ou troque o formato no Mapeamento (BR ↔ US).",
      quickFix: "switch_date_to_br",
      quickFixLabel: "Trocar formato de data",
    };
  }
  if (msg.includes("duplicate key") || msg.includes("23505") || msg.includes("uq") || msg.includes("unique")) {
    return {
      code: "DB_DUPLICATE",
      title: "Registro duplicado no banco",
      cause: "Outro lançamento com mesma origem e referência já existe (proteção contra importação repetida).",
      solution: "Verifique se você já importou este arquivo antes. As linhas duplicadas foram automaticamente puladas.",
      quickFix: null,
    };
  }
  if (msg.includes("permission") || msg.includes("rls") || msg.includes("42501")) {
    return {
      code: "DB_PERMISSION",
      title: "Sem permissão para gravar",
      cause: "Seu usuário não tem permissão de escrita no módulo financeiro desta organização.",
      solution: "Solicite ao administrador acesso de escrita em Financeiro.",
      quickFix: null,
    };
  }
  if (msg.includes("violates") || msg.includes("constraint") || msg.includes("check")) {
    return {
      code: "DB_CONSTRAINT",
      title: "Dados violam regra do banco",
      cause: "Alguma coluna recebeu um valor incompatível (ex.: valor negativo onde é exigido positivo).",
      solution: "Revise as linhas marcadas como erro e ajuste no arquivo de origem.",
      quickFix: null,
    };
  }

  return {
    code: "UNKNOWN",
    title: "Erro não reconhecido",
    cause: rawMessage || "Causa desconhecida.",
    solution: "Verifique a linha no arquivo original e tente novamente. Se persistir, contate o suporte.",
    quickFix: null,
  };
}

/**
 * Agrupa erros de várias linhas por código para exibir resumo com contagem.
 */
export function summarizeRowErrors(
  rows: { errors: string[] }[]
): { info: ImportErrorInfo; count: number; sampleRows: number[] }[] {
  const buckets = new Map<ImportErrorCode, { info: ImportErrorInfo; count: number; sampleRows: number[] }>();
  rows.forEach((r, idx) => {
    r.errors.forEach((err) => {
      const info = classifyImportError(err);
      const bucket = buckets.get(info.code);
      if (bucket) {
        bucket.count++;
        if (bucket.sampleRows.length < 3) bucket.sampleRows.push(idx + 1);
      } else {
        buckets.set(info.code, { info, count: 1, sampleRows: [idx + 1] });
      }
    });
  });
  return Array.from(buckets.values()).sort((a, b) => b.count - a.count);
}
