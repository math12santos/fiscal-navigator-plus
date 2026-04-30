import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const fmt = (v: number) => {
  const n = Number(v) || 0;
  const abs = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 }).format(Math.abs(n));
  return n < 0 ? `(${abs})` : abs;
};

/** didParseCell hook: paints accounting-format negatives "(xxx)" in red. */
const colorNegatives = (data: any) => {
  if (data.section === "head") return;
  const raw = data.cell.raw;
  const text = typeof raw === "string" ? raw : raw && typeof raw === "object" ? raw.content : "";
  if (typeof text === "string" && /^\(.*\)$/.test(text.trim())) {
    data.cell.styles.textColor = [200, 40, 40];
  }
};

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

export interface AuditDivergenceRow {
  orgName: string;
  accountName: string;
  saldoAtual: number;
  reconciledImpact: number;
  divergence: number;
}

export interface WeekPaymentRow {
  date: string; // ISO
  payee: string;
  orgName: string;
  amount: number;
}

export interface CashPositionPdfInput {
  contextName: string;
  isConsolidated: boolean;
  perOrg: CashPositionByOrg[];
  totals: {
    saldo: number;
    limite: number;
    disponibilidade: number;
    apOverdue: number;
    apDue30: number;
    arNext30: number;
  };
  issuer: {
    name: string;
    email: string;
    id?: string;
  };
  /** Audit comparing saldo_atual vs reconciled cashflow per org/account */
  audit?: AuditDivergenceRow[];
  /** Realized payments in current week */
  weekPayments?: WeekPaymentRow[];
}

/** Compute SHA-256 hash (hex) of a string — async for content traceability stamp */
async function sha256Hex(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function generateCashPositionPdf(input: CashPositionPdfInput) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
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

  const rightX = pageWidth - marginX;
  doc.text(`Emitido em: ${ts}`, rightX, 18, { align: "right" });
  doc.text(`Emissor: ${input.issuer.name}`, rightX, 25, { align: "right" });
  doc.text(input.issuer.email, rightX, 30, { align: "right" });

  doc.setDrawColor(220, 220, 220);
  doc.line(marginX, 34, pageWidth - marginX, 34);

  // ===== Summary =====
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
    didParseCell: colorNegatives,
  });

  let cursorY = (doc as any).lastAutoTable.finalY + 8;

  // ===== Per-Org section =====
  for (const org of input.perOrg) {
    if (cursorY > 240) { doc.addPage(); cursorY = 20; }

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
          a.nome, a.banco ?? "—", a.tipo_conta,
          fmt(a.saldo_atual), fmt(a.limite_credito), fmt(a.saldo_atual + a.limite_credito),
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
      columnStyles: { 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
      didParseCell: colorNegatives,
    });
    cursorY = (doc as any).lastAutoTable.finalY + 8;
  }

  // ===== Audit: Saldo vs Conciliado =====
  if (input.audit && input.audit.length > 0) {
    if (cursorY > 220) { doc.addPage(); cursorY = 20; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Auditoria — Saldo Atual × Lançamentos Conciliados", marginX, cursorY);
    cursorY += 2;

    const divergent = input.audit.filter((r) => Math.abs(r.divergence) >= 0.01);
    const totalDiv = divergent.reduce((s, r) => s + r.divergence, 0);

    autoTable(doc, {
      startY: cursorY + 2,
      margin: { left: marginX, right: marginX },
      head: [["Empresa", "Conta", "Saldo Atual", "Conciliado (Σ)", "Divergência"]],
      body: [
        ...input.audit.map((r) => {
          const flagged = Math.abs(r.divergence) >= 0.01;
          return [
            r.orgName,
            r.accountName,
            fmt(r.saldoAtual),
            fmt(r.reconciledImpact),
            {
              content: fmt(r.divergence),
              styles: flagged ? { textColor: [200, 40, 40], fontStyle: "bold" as const } : {},
            },
          ];
        }),
        [
          { content: `Total divergente (${divergent.length} contas)`, colSpan: 4, styles: { fontStyle: "bold", fillColor: [240, 240, 240] } },
          { content: fmt(totalDiv), styles: { fontStyle: "bold", halign: "right", fillColor: [240, 240, 240] } },
        ] as any,
      ],
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [36, 214, 196], textColor: 0 },
      columnStyles: { 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
      didParseCell: colorNegatives,
    });
    cursorY = (doc as any).lastAutoTable.finalY + 4;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(
      "Conciliado = soma dos lançamentos pagos/recebidos vinculados à conta. Divergência ≠ 0 indica saldo desatualizado ou lançamentos faltantes.",
      marginX, cursorY + 4, { maxWidth: pageWidth - marginX * 2 },
    );
    cursorY += 12;
  }

  // ===== Pagamentos da Semana =====
  if (input.weekPayments && input.weekPayments.length > 0) {
    if (cursorY > 220) { doc.addPage(); cursorY = 20; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text("Pagamentos Realizados — Semana Corrente", marginX, cursorY);
    cursorY += 2;

    const total = input.weekPayments.reduce((s, p) => s + p.amount, 0);

    autoTable(doc, {
      startY: cursorY + 2,
      margin: { left: marginX, right: marginX },
      head: [["Data", "Empresa", "Favorecido", "Valor"]],
      body: [
        ...input.weekPayments.map((p) => [
          format(new Date(p.date + "T00:00:00"), "dd/MM/yyyy"),
          p.orgName,
          p.payee,
          fmt(p.amount),
        ]),
        [
          { content: `Total (${input.weekPayments.length} pagamentos)`, colSpan: 3, styles: { fontStyle: "bold", fillColor: [240, 240, 240] } },
          { content: fmt(total), styles: { fontStyle: "bold", halign: "right", fillColor: [240, 240, 240] } },
        ] as any,
      ],
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [36, 214, 196], textColor: 0 },
      columnStyles: { 3: { halign: "right" } },
    });
    cursorY = (doc as any).lastAutoTable.finalY + 8;
  }

  // ===== Traceability stamp (hash + issuer ID) =====
  // Snapshot the meaningful payload for hashing — excludes the hash itself
  const stampPayload = JSON.stringify({
    contextName: input.contextName,
    isConsolidated: input.isConsolidated,
    generatedAt: now.toISOString(),
    issuer: input.issuer,
    totals: input.totals,
    perOrg: input.perOrg,
    audit: input.audit ?? [],
    weekPayments: input.weekPayments ?? [],
  });
  const fullHash = await sha256Hex(stampPayload);
  const shortHash = fullHash.slice(0, 16);
  const issuerId = (input.issuer.id ?? "").slice(0, 8) || "anon";

  // Footer + stamp on every page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    // Stamp box (bottom-right)
    const stampW = 78;
    const stampH = 20;
    const stampX = pageWidth - marginX - stampW;
    const stampY = pageHeight - 28;
    doc.setDrawColor(36, 214, 196);
    doc.setLineWidth(0.4);
    doc.roundedRect(stampX, stampY, stampW, stampH, 1.5, 1.5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(36, 140, 130);
    doc.text("CARIMBO DE RASTREABILIDADE", stampX + stampW / 2, stampY + 4, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(60, 60, 60);
    doc.text(`Emissor: ${input.issuer.name} (${issuerId})`, stampX + 2, stampY + 9);
    doc.text(`E-mail: ${input.issuer.email}`, stampX + 2, stampY + 13);
    doc.text(`SHA-256: ${shortHash}…`, stampX + 2, stampY + 17);

    // Footer
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(
      `Página ${i} de ${pageCount} — Saldos refletem a última atualização manual de cada conta.`,
      marginX, pageHeight - 8,
    );
  }

  // Last page: full hash for verification
  doc.setPage(pageCount);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(170, 170, 170);
  doc.text(`Hash íntegro (SHA-256): ${fullHash}`, marginX, pageHeight - 4);

  const fileName = `posicao-caixa-${format(now, "yyyyMMdd-HHmm")}.pdf`;
  doc.save(fileName);

  return { fileName, hash: fullHash };
}
