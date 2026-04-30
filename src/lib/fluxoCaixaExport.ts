import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { CashFlowEntry } from "@/hooks/useCashFlow";

const fmtBRL = (v: number) => {
  const n = Number(v) || 0;
  const abs = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(Math.abs(n));
  return n < 0 ? `(${abs})` : abs;
};

const colorNegatives = (data: any) => {
  if (data.section === "head") return;
  const raw = data.cell.raw;
  const text =
    typeof raw === "string" ? raw : raw && typeof raw === "object" ? raw.content : "";
  if (typeof text === "string" && /^\(.*\)$/.test(text.trim())) {
    data.cell.styles.textColor = [200, 40, 40];
  }
};

function statusLabel(s: string) {
  switch (s) {
    case "pago":
      return "Pago";
    case "recebido":
      return "Recebido";
    case "previsto":
      return "Previsto";
    case "confirmado":
      return "Confirmado";
    case "cancelado":
      return "Cancelado";
    default:
      return s;
  }
}

/** CSV (Excel-friendly: BOM + ; separator) */
export function exportFluxoCaixaCSV(entries: CashFlowEntry[], filenameSuffix = "") {
  const header = [
    "Data",
    "Competencia",
    "Tipo",
    "Descricao",
    "Categoria",
    "Origem",
    "Status",
    "Valor Previsto",
    "Valor Realizado",
  ];
  const rows = entries.map((e) => [
    e.data_prevista,
    e.competencia ?? e.reference_month ?? "",
    e.tipo,
    (e.descricao ?? "").replace(/[\r\n;]+/g, " "),
    e.categoria ?? "",
    e.source ?? "",
    e.status,
    Number(e.valor_previsto || 0).toFixed(2).replace(".", ","),
    e.valor_realizado != null
      ? Number(e.valor_realizado).toFixed(2).replace(".", ",")
      : "",
  ]);
  const csv = [header, ...rows]
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
    .join("\r\n");
  // BOM for Excel UTF-8 detection
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `fluxo-caixa${filenameSuffix ? "-" + filenameSuffix : ""}-${format(
    new Date(),
    "yyyyMMdd-HHmm",
  )}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** PDF: summary + per-entry table (with running balance column). */
export interface FluxoCaixaPdfInput {
  contextName: string;
  periodLabel: string;
  entries: CashFlowEntry[];
  totals: { entradas: number; saidas: number; saldo: number };
  openingBalance?: number;
  issuer: { name: string; email: string };
}

export function exportFluxoCaixaPDF(input: FluxoCaixaPdfInput) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 14;
  const ts = format(new Date(), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR });

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Fluxo de Caixa", marginX, 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  doc.text(input.contextName, marginX, 22);
  doc.text(`Período: ${input.periodLabel}`, marginX, 27);

  doc.text(`Emitido em: ${ts}`, pageWidth - marginX, 16, { align: "right" });
  doc.text(`Emissor: ${input.issuer.name}`, pageWidth - marginX, 22, { align: "right" });
  doc.text(input.issuer.email, pageWidth - marginX, 27, { align: "right" });

  doc.setDrawColor(220, 220, 220);
  doc.line(marginX, 31, pageWidth - marginX, 31);

  // Summary
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Resumo", marginX, 38);

  autoTable(doc, {
    startY: 41,
    margin: { left: marginX, right: marginX },
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 1.5 },
    body: [
      ["Saldo de Abertura", fmtBRL(input.openingBalance ?? 0)],
      ["Total de Entradas", fmtBRL(input.totals.entradas)],
      ["Total de Saídas", fmtBRL(input.totals.saidas)],
      [
        { content: "Saldo do Período", styles: { fontStyle: "bold" } },
        { content: fmtBRL(input.totals.saldo), styles: { fontStyle: "bold" } },
      ],
      [
        { content: "Saldo Final Projetado", styles: { fontStyle: "bold" } },
        {
          content: fmtBRL((input.openingBalance ?? 0) + input.totals.saldo),
          styles: { fontStyle: "bold" },
        },
      ],
    ],
    columnStyles: { 0: { cellWidth: 80 }, 1: { halign: "right" } },
    didParseCell: colorNegatives,
  });

  // Entries with running balance
  let running = input.openingBalance ?? 0;
  const body = input.entries.map((e) => {
    const valor =
      e.valor_realizado != null ? Number(e.valor_realizado) : Number(e.valor_previsto);
    const signed = e.tipo === "entrada" ? valor : -valor;
    running += signed;
    return [
      format(new Date(e.data_prevista), "dd/MM/yyyy"),
      e.descricao,
      e.tipo === "entrada" ? "Entrada" : "Saída",
      statusLabel(e.status),
      fmtBRL(Number(e.valor_previsto || 0)),
      e.valor_realizado != null ? fmtBRL(Number(e.valor_realizado)) : "—",
      fmtBRL(running),
    ];
  });

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 6,
    margin: { left: marginX, right: marginX },
    head: [["Data", "Descrição", "Tipo", "Status", "Previsto", "Realizado", "Saldo Acum."]],
    body,
    styles: { fontSize: 7.5, cellPadding: 1.5, overflow: "linebreak" },
    headStyles: { fillColor: [36, 214, 196], textColor: 0 },
    columnStyles: {
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
    },
    didParseCell: colorNegatives,
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(140, 140, 140);
    doc.text(
      `Página ${i} de ${pageCount} — Saldo acumulado considera saldo de abertura informado.`,
      marginX,
      pageHeight - 6,
    );
  }

  const fileName = `fluxo-caixa-${format(new Date(), "yyyyMMdd-HHmm")}.pdf`;
  doc.save(fileName);
  return { fileName };
}
