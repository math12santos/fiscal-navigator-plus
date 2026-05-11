import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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
}

export interface BankBalancesPdfInput {
  contextName: string;
  isConsolidated: boolean;
  accounts: BankBalancesAccountRow[];
  issuer: { name: string; email: string; id?: string };
}

export async function generateBankBalancesPdf(input: BankBalancesPdfInput) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 14;
  const now = new Date();
  const ts = format(now, "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR });

  // ===== Header =====
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Relatório de Saldos Bancários", marginX, 18);

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
  const totalManual = input.accounts.reduce((s, a) => s + (a.saldo_manual || 0), 0);
  const accountsWithOfx = input.accounts.filter((a) => a.saldo_ofx != null);
  const totalOfx = accountsWithOfx.reduce((s, a) => s + (a.saldo_ofx || 0), 0);
  const totalManualWithOfx = accountsWithOfx.reduce((s, a) => s + (a.saldo_manual || 0), 0);
  const divergencia = totalOfx - totalManualWithOfx;
  const reconciled = accountsWithOfx.filter((a) => Math.abs((a.saldo_ofx ?? 0) - a.saldo_manual) < 0.01).length;
  const aReconciliar = accountsWithOfx.length - reconciled;
  const semOfx = input.accounts.length - accountsWithOfx.length;

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Resumo", marginX, 42);

  autoTable(doc, {
    startY: 45,
    margin: { left: marginX, right: marginX },
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 2 },
    body: [
      ["Saldo Total Manual", fmt(totalManual)],
      ["Saldo Total OFX (referência)", accountsWithOfx.length > 0 ? fmt(totalOfx) : "—"],
      [
        { content: "Divergência (OFX − Manual, contas com OFX)", styles: { fontStyle: "bold" } },
        { content: accountsWithOfx.length > 0 ? fmt(divergencia) : "—", styles: { fontStyle: "bold" } },
      ],
      [`Contas conciliadas`, `${reconciled} de ${accountsWithOfx.length}`],
      [`Contas a conciliar`, String(aReconciliar)],
      [`Contas sem OFX importado`, String(semOfx)],
    ],
    columnStyles: { 0: { cellWidth: 110 }, 1: { halign: "right" } },
    didParseCell: colorNegatives,
  });

  let cursorY = (doc as any).lastAutoTable.finalY + 8;

  // ===== Accounts table (grouped by org if multi) =====
  const orgs = Array.from(new Set(input.accounts.map((a) => a.orgName)));
  const groups = input.isConsolidated || orgs.length > 1
    ? orgs.map((o) => ({ orgName: o, rows: input.accounts.filter((a) => a.orgName === o) }))
    : [{ orgName: input.contextName, rows: input.accounts }];

  for (const g of groups) {
    if (cursorY > 235) { doc.addPage(); cursorY = 20; }

    if (input.isConsolidated || orgs.length > 1) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      doc.text(g.orgName, marginX, cursorY);
      cursorY += 2;
    }

    const subtotalManual = g.rows.reduce((s, a) => s + (a.saldo_manual || 0), 0);
    const subRowsWithOfx = g.rows.filter((a) => a.saldo_ofx != null);
    const subtotalOfx = subRowsWithOfx.reduce((s, a) => s + (a.saldo_ofx || 0), 0);
    const subtotalManualWithOfx = subRowsWithOfx.reduce((s, a) => s + (a.saldo_manual || 0), 0);
    const subDelta = subtotalOfx - subtotalManualWithOfx;

    autoTable(doc, {
      startY: cursorY + 2,
      margin: { left: marginX, right: marginX },
      head: [["Conta", "Banco", "Tipo", "Manual", "OFX", "Δ", "OFX em"]],
      body: [
        ...g.rows.map((a) => {
          const delta = a.saldo_ofx != null ? a.saldo_ofx - a.saldo_manual : null;
          const deltaCell = delta == null
            ? "—"
            : Math.abs(delta) < 0.01
              ? "✓"
              : fmt(delta);
          return [
            a.nome,
            a.banco ?? "—",
            a.tipo_conta,
            fmt(a.saldo_manual),
            a.saldo_ofx != null ? fmt(a.saldo_ofx) : "—",
            deltaCell,
            a.saldo_ofx_data
              ? format(new Date(a.saldo_ofx_data + "T00:00:00"), "dd/MM/yyyy")
              : "—",
          ];
        }),
        [
          { content: "Subtotal", colSpan: 3, styles: { fontStyle: "bold", fillColor: [240, 240, 240] } },
          { content: fmt(subtotalManual), styles: { fontStyle: "bold", halign: "right", fillColor: [240, 240, 240] } },
          { content: subRowsWithOfx.length > 0 ? fmt(subtotalOfx) : "—", styles: { fontStyle: "bold", halign: "right", fillColor: [240, 240, 240] } },
          { content: subRowsWithOfx.length > 0 ? fmt(subDelta) : "—", styles: { fontStyle: "bold", halign: "right", fillColor: [240, 240, 240] } },
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

  // Legenda
  if (cursorY > pageHeight - 40) { doc.addPage(); cursorY = 20; }
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(140, 140, 140);
  doc.text(
    "OFX = saldo de fechamento (LEDGERBAL) do último extrato importado — referência da conta. Manual = saldo informado pelo gestor. Δ ≠ 0 indica conciliação pendente. ✓ indica conta conciliada.",
    marginX, cursorY,
    { maxWidth: pageWidth - marginX * 2 },
  );

  // ===== Carimbo de rastreabilidade =====
  const stampPayload = JSON.stringify({
    contextName: input.contextName,
    isConsolidated: input.isConsolidated,
    generatedAt: now.toISOString(),
    issuer: input.issuer,
    accounts: input.accounts,
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
      `Página ${i} de ${pageCount} — Saldo OFX é a referência; saldo manual é declaração do gestor.`,
      marginX, pageHeight - 8,
    );
  }

  doc.setPage(pageCount);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(170, 170, 170);
  doc.text(`Hash íntegro (SHA-256): ${fullHash}`, marginX, pageHeight - 4);

  const fileName = `saldos-bancarios-${format(now, "yyyyMMdd-HHmm")}.pdf`;
  doc.save(fileName);
  return { fileName, hash: fullHash };
}
