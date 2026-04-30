import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 }).format(v);

export interface CashPositionAccount {
  nome: string;
  banco: string | null;
  tipo_conta: string;
  saldo_atual: number;
  limite_credito: number;
  organization_id: string | null;
}

export interface CashPositionByOrg {
  orgId: string;
  orgName: string;
  accounts: CashPositionAccount[];
  saldo: number;
  limite: number;
  disponibilidade: number;
}

export interface CashPositionPdfInput {
  /** Title used in header — usually the holding/main org name */
  contextName: string;
  /** Whether report is consolidated (Holding) or single org */
  isConsolidated: boolean;
  /** Cash position grouped per organization */
  perOrg: CashPositionByOrg[];
  /** Aggregate AP/AR snapshot */
  totals: {
    saldo: number;
    limite: number;
    disponibilidade: number;
    apOverdue: number;
    apDue30: number;
    arNext30: number;
  };
  /** Issuer info */
  issuer: {
    name: string;
    email: string;
  };
}

export function generateCashPositionPdf(input: CashPositionPdfInput) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 14;
  const now = new Date();
  const ts = format(now, "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR });

  // ===== Header =====
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Posição de Caixa", marginX, 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90, 90, 90);
  doc.text(input.contextName, marginX, 25);
  doc.text(input.isConsolidated ? "Visão consolidada (Holding)" : "Visão individual", marginX, 30);

  // Issuer block (right side)
  const rightX = pageWidth - marginX;
  doc.text(`Emitido em: ${ts}`, rightX, 18, { align: "right" });
  doc.text(`Emissor: ${input.issuer.name}`, rightX, 25, { align: "right" });
  doc.text(input.issuer.email, rightX, 30, { align: "right" });

  doc.setDrawColor(220, 220, 220);
  doc.line(marginX, 34, pageWidth - marginX, 34);

  // ===== Summary KPI block =====
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Resumo Financeiro", marginX, 42);

  autoTable(doc, {
    startY: 45,
    margin: { left: marginX, right: marginX },
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 2 },
    body: [
      ["Saldo em Contas", fmt(input.totals.saldo)],
      ["Limite de Crédito Disponível", fmt(input.totals.limite)],
      [{ content: "Disponibilidade Total (Saldo + Limite)", styles: { fontStyle: "bold" } }, { content: fmt(input.totals.disponibilidade), styles: { fontStyle: "bold" } }],
      ["Contas a Pagar — Vencidas", fmt(input.totals.apOverdue)],
      ["Contas a Pagar — Próx. 30 dias", fmt(input.totals.apDue30)],
      ["Contas a Receber — Próx. 30 dias", fmt(input.totals.arNext30)],
    ],
    columnStyles: { 0: { cellWidth: 100 }, 1: { halign: "right" } },
  });

  // ===== Per-Org section =====
  let cursorY = (doc as any).lastAutoTable.finalY + 8;

  for (const org of input.perOrg) {
    if (cursorY > 240) {
      doc.addPage();
      cursorY = 20;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(org.orgName, marginX, cursorY);
    cursorY += 2;

    autoTable(doc, {
      startY: cursorY + 2,
      margin: { left: marginX, right: marginX },
      head: [["Conta", "Banco", "Tipo", "Saldo", "Limite", "Disponível"]],
      body: [
        ...org.accounts.map((a) => [
          a.nome,
          a.banco ?? "—",
          a.tipo_conta,
          fmt(a.saldo_atual),
          fmt(a.limite_credito),
          fmt(a.saldo_atual + a.limite_credito),
        ]),
        [
          { content: "Total", colSpan: 3, styles: { fontStyle: "bold", fillColor: [240, 240, 240] } },
          { content: fmt(org.saldo), styles: { fontStyle: "bold", halign: "right", fillColor: [240, 240, 240] } },
          { content: fmt(org.limite), styles: { fontStyle: "bold", halign: "right", fillColor: [240, 240, 240] } },
          { content: fmt(org.disponibilidade), styles: { fontStyle: "bold", halign: "right", fillColor: [240, 240, 240] } },
        ] as any,
      ],
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [36, 214, 196], textColor: 0 },
      columnStyles: {
        3: { halign: "right" },
        4: { halign: "right" },
        5: { halign: "right" },
      },
    });
    cursorY = (doc as any).lastAutoTable.finalY + 8;
  }

  // ===== Footer notes =====
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(
      `Página ${i} de ${pageCount} — Documento gerado automaticamente. Saldos refletem a última atualização manual de cada conta.`,
      pageWidth / 2,
      290,
      { align: "center" },
    );
  }

  const fileName = `posicao-caixa-${format(now, "yyyyMMdd-HHmm")}.pdf`;
  doc.save(fileName);
}
