export interface ParsedRequestDescription {
  subtype: "expense" | "reimbursement";
  text: string;
  estimated_value: number | null;
  data_gasto?: string | null;
  forma_pagamento_pessoal?: string | null;
  [key: string]: any;
}

export function parseRequestDescription(desc: string | null | undefined): ParsedRequestDescription {
  if (!desc) return { subtype: "expense", text: "", estimated_value: null };
  try {
    const obj = JSON.parse(desc);
    return {
      subtype: obj.subtype === "reimbursement" ? "reimbursement" : "expense",
      text: obj.text ?? "",
      estimated_value: obj.estimated_value ?? null,
      data_gasto: obj.data_gasto ?? null,
      forma_pagamento_pessoal: obj.forma_pagamento_pessoal ?? null,
      ...obj,
    };
  } catch {
    return { subtype: "expense", text: desc, estimated_value: null };
  }
}
