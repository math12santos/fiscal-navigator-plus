import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { calculateAvailability, type LimitType } from "@/lib/overdraftCalculations";

const fmt = (v: number | null | undefined) => {
  const n = Number(v) || 0;
  const abs = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 }).format(Math.abs(n));
  return n < 0 ? `(${abs})` : abs;
};

const colorNegatives = (data: any) => {
  if (data.section === "head") return;
  const raw = data.cell.raw;
  const text = typeof raw === "string" ? raw : raw && typeof raw === "object" ? raw.content : "";
  if (typeof text === "string" && /^\(.*\)$/.test(text.trim())) {
    data.cell.styles.textColor = [200, 40, 40];
  }
};

async function sha256Hex(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface BankBalancesAccountRow {
  orgName: string;
  nome: string;
  banco: string | null;
  tipo_conta: string;
  saldo_manual: number;
  saldo_manual_em: string | null;
  saldo_ofx: number | null;
  saldo_ofx_data: string | null;
  /** Limite total aprovado (cheque especial, capital de giro, etc.) */
  limite_credito?: number | null;
  /** Limite já utilizado (em linhas onde o uso é independente do saldo) */
  limite_utilizado?: number | null;
  /** Tipo da linha de crédito */
  limite_tipo?: LimitType | null;
}

export interface BankBalancesPdfInput {
  contextName: string;
  isConsolidated: boolean;
  accounts: BankBalancesAccountRow[];
  issuer: { name: string; email: string; id?: string };
}

interface ComputedRow extends BankBalancesAccountRow {
  limiteDisp: number;
  liquidez: number; // capital de giro disponível, clampado em zero (MECE)
}

function computeRow(a: BankBalancesAccountRow): ComputedRow {
  const limiteTotal = Number(a.limite_credito) || 0;
  const limiteUtil = Number(a.limite_utilizado) || 0;
  const limiteTipo: LimitType = (a.limite_tipo as LimitType) || "outros";
  const calc = calculateAvailability({
    saldoAtual: a.saldo_manual || 0,
    limiteTotal,
    limiteUtilizado: limiteUtil,
    limiteTipo,
  });
  return {
    ...a,
    limiteDisp: calc.limiteDisponivel,
    // MECE: contas negativas não reduzem liquidez do consolidado
    liquidez: Math.max(0, calc.capitalGiroDisponivel),
  };
}

export async function generateBankBalancesPdf(input: BankBalancesPdfInput) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 14;
  const now = new Date();
  const ts = format(now, "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR });

  const computed = input.accounts.map(computeRow);

  // ===== Header =====
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Posição de Caixa — Contas Bancárias", marginX, 18);

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

  // ===== Resumo Financeiro (MECE) =====
  const totalSaldo = computed.reduce((s, a) => s + (a.saldo_manual || 0), 0);
  const totalLimiteDisp = computed.reduce((s, a) => s + a.limiteDisp, 0);
  const totalLiquidez = computed.reduce((s, a) => s + a.liquidez, 0);

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
      [
        { content: "Liquidez Total (Capital de Giro Disponível)", styles: { fontStyle: "bold", textColor: [36, 140, 130] } },
        { content: fmt(totalLiquidez), styles: { fontStyle: "bold", halign: "right", textColor: [36, 140, 130] } },
      ],
      ["Saldo Total em Conta", fmt(totalSaldo)],
      ["Limite Total Disponível", fmt(totalLimiteDisp)],
      [`Contas`, String(computed.length)],
    ],
    columnStyles: { 0: { cellWidth: 110 }, 1: { halign: "right" } },
    didParseCell: colorNegatives,
  });

  let cursorY = (doc as any).lastAutoTable.finalY + 4;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(110, 110, 110);
  doc.text(
    "Liquidez = max(0, saldo + limite disponível) por conta. Contas negativas não reduzem o caixa do consolidado.",
    marginX, cursorY, { maxWidth: pageWidth - marginX * 2 },
  );
  cursorY += 6;

  // ===== Posição por Empresa =====
  const orgs = Array.from(new Set(computed.map((a) => a.orgName)));
  const groups = input.isConsolidated || orgs.length > 1
    ? orgs.map((o) => ({ orgName: o, rows: computed.filter((a) => a.orgName === o) }))
    : [{ orgName: input.contextName, rows: computed }];

  for (const g of groups) {
    if (cursorY > pageHeight - 50) { doc.addPage(); cursorY = 20; }

    if (input.isConsolidated || orgs.length > 1) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      doc.text(g.orgName, marginX, cursorY);
      cursorY += 2;
    }

    const subSaldo = g.rows.reduce((s, a) => s + (a.saldo_manual || 0), 0);
    const subLimite = g.rows.reduce((s, a) => s + a.limiteDisp, 0);
    const subLiquidez = g.rows.reduce((s, a) => s + a.liquidez, 0);

    autoTable(doc, {
      startY: cursorY + 2,
      margin: { left: marginX, right: marginX },
      head: [["Conta", "Banco", "Tipo", "Saldo", "Limite Disp.", "Liquidez", "Atualizado em"]],
      body: [
        ...g.rows.map((a) => [
          a.nome,
          a.banco ?? "—",
          a.tipo_conta,
          fmt(a.saldo_manual),
          fmt(a.limiteDisp),
          { content: fmt(a.liquidez), styles: { textColor: [36, 140, 130], fontStyle: "bold" } },
          a.saldo_manual_em
            ? format(new Date(a.saldo_manual_em), "dd/MM/yyyy HH:mm")
            : "—",
        ]),
        [
          { content: "Subtotal", colSpan: 3, styles: { fontStyle: "bold", fillColor: [240, 240, 240] } },
          { content: fmt(subSaldo), styles: { fontStyle: "bold", halign: "right", fillColor: [240, 240, 240] } },
          { content: fmt(subLimite), styles: { fontStyle: "bold", halign: "right", fillColor: [240, 240, 240] } },
          { content: fmt(subLiquidez), styles: { fontStyle: "bold", halign: "right", fillColor: [220, 245, 240], textColor: [36, 140, 130] } },
          { content: "", styles: { fillColor: [240, 240, 240] } },
        ] as any,
      ],
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [36, 214, 196], textColor: 0 },
      columnStyles: {
        3: { halign: "right" },
        4: { halign: "right" },
        5: { halign: "right" },
        6: { halign: "right" },
      },
      didParseCell: colorNegatives,
    });
    cursorY = (doc as any).lastAutoTable.finalY + 8;
  }

  // ===== Auditoria OFX (opcional, apenas se há OFX importado) =====
  const accountsWithOfx = computed.filter((a) => a.saldo_ofx != null);
  if (accountsWithOfx.length > 0) {
    if (cursorY > pageHeight - 60) { doc.addPage(); cursorY = 20; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text("Auditoria — Saldo Manual × OFX", marginX, cursorY);
    cursorY += 2;

    autoTable(doc, {
      startY: cursorY + 2,
      margin: { left: marginX, right: marginX },
      head: [["Empresa", "Conta", "Manual", "OFX", "Δ", "OFX em"]],
      body: accountsWithOfx.map((a) => {
        const delta = (a.saldo_ofx ?? 0) - a.saldo_manual;
        const deltaCell = Math.abs(delta) < 0.01 ? "✓" : fmt(delta);
        return [
          a.orgName,
          a.nome,
          fmt(a.saldo_manual),
          fmt(a.saldo_ofx ?? 0),
          deltaCell,
          a.saldo_ofx_data ? format(new Date(a.saldo_ofx_data + "T00:00:00"), "dd/MM/yyyy") : "—",
        ];
      }),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [36, 214, 196], textColor: 0 },
      columnStyles: { 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
      didParseCell: colorNegatives,
    });
    cursorY = (doc as any).lastAutoTable.finalY + 8;
  }

  // ===== Carimbo de rastreabilidade =====
  const stampPayload = JSON.stringify({
    contextName: input.contextName,
    isConsolidated: input.isConsolidated,
    generatedAt: now.toISOString(),
    issuer: input.issuer,
    totals: { saldo: totalSaldo, limiteDisp: totalLimiteDisp, liquidez: totalLiquidez },
    accounts: computed,
  });
  const fullHash = await sha256Hex(stampPayload);
  const shortHash = fullHash.slice(0, 16);
  const issuerId = (input.issuer.id ?? "").slice(0, 8) || "anon";

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
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

    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(
      `Página ${i} de ${pageCount} — Liquidez = capital de giro disponível (saldos negativos não reduzem o consolidado).`,
      marginX, pageHeight - 8,
    );
  }

  doc.setPage(pageCount);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(170, 170, 170);
  doc.text(`Hash íntegro (SHA-256): ${fullHash}`, marginX, pageHeight - 4);

  const fileName = `posicao-contas-bancarias-${format(now, "yyyyMMdd-HHmm")}.pdf`;
  doc.save(fileName);
  return { fileName, hash: fullHash };
}
