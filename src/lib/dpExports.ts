/**
 * Utilitário central para exportação de relatórios do módulo DP.
 * - PDF executivo: jsPDF + jspdf-autotable, com cabeçalho/rodapé padronizado.
 * - Excel detalhado: xlsx (SheetJS) com headers em negrito.
 *
 * Padrão visual PDF:
 *   - Cabeçalho: nome da empresa (esq), título do relatório (centro), período (dir).
 *   - Resumo executivo (totais) em bloco separado quando aplicável.
 *   - Tabela com zebra striping e cabeçalho em primary.
 *   - Rodapé: "Gerado por Colli FinCore — DD/MM/AAAA HH:mm" + paginação.
 */
import jsPDF from "jspdf";
import autoTable, { type RowInput, type UserOptions } from "jspdf-autotable";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const fmtBRL = (v: number | null | undefined) =>
  Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtNum = (v: number | null | undefined) => Number(v ?? 0).toLocaleString("pt-BR");

export const dpFmt = { brl: fmtBRL, num: fmtNum };

// ---------- PDF ----------

interface PdfReportOptions {
  title: string;
  period?: string;
  orgName?: string;
  summary?: { label: string; value: string }[];
  columns: string[];
  rows: RowInput[];
  /** texto adicional após resumo, antes da tabela */
  notes?: string;
  orientation?: "portrait" | "landscape";
}

export function generateDPPdfReport(opts: PdfReportOptions) {
  const doc = new jsPDF({ orientation: opts.orientation ?? "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Cabeçalho
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(opts.orgName || "—", 14, 12);

  doc.setFontSize(14);
  doc.setTextColor(20);
  doc.text(opts.title, pageWidth / 2, 14, { align: "center" });

  if (opts.period) {
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(opts.period, pageWidth - 14, 12, { align: "right" });
  }

  // Linha separadora
  doc.setDrawColor(220);
  doc.line(14, 18, pageWidth - 14, 18);

  let cursorY = 24;

  // Resumo executivo
  if (opts.summary && opts.summary.length > 0) {
    doc.setFontSize(9);
    doc.setTextColor(60);
    const colWidth = (pageWidth - 28) / opts.summary.length;
    opts.summary.forEach((s, idx) => {
      const x = 14 + idx * colWidth;
      doc.setTextColor(120);
      doc.text(s.label.toUpperCase(), x, cursorY);
      doc.setTextColor(20);
      doc.setFont(undefined, "bold");
      doc.setFontSize(11);
      doc.text(s.value, x, cursorY + 5);
      doc.setFont(undefined, "normal");
      doc.setFontSize(9);
    });
    cursorY += 12;
  }

  if (opts.notes) {
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(opts.notes, 14, cursorY);
    cursorY += 5;
  }

  // Tabela
  autoTable(doc, {
    startY: cursorY,
    head: [opts.columns],
    body: opts.rows,
    theme: "striped",
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [36, 214, 196], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
  } as UserOptions);

  // Rodapé em todas as páginas
  const footer = `Gerado por Colli FinCore — ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`;
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(140);
    doc.text(footer, 14, pageHeight - 6);
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - 14, pageHeight - 6, { align: "right" });
  }

  const filename = `${slugify(opts.title)}_${format(new Date(), "yyyyMMdd_HHmm")}.pdf`;
  doc.save(filename);
}

// ---------- Excel ----------

interface ExcelSheet {
  name: string;
  /** primeira linha = cabeçalho */
  rows: (string | number | null | undefined)[][];
}

interface ExcelReportOptions {
  title: string;
  sheets: ExcelSheet[];
}

export function generateDPExcelReport(opts: ExcelReportOptions) {
  const wb = XLSX.utils.book_new();
  opts.sheets.forEach((s) => {
    const ws = XLSX.utils.aoa_to_sheet(s.rows);

    // Largura automática mínima por coluna
    const colWidths: { wch: number }[] = [];
    if (s.rows.length > 0) {
      const cols = s.rows[0].length;
      for (let c = 0; c < cols; c++) {
        let max = 8;
        for (let r = 0; r < s.rows.length; r++) {
          const v = s.rows[r][c];
          const len = v == null ? 0 : String(v).length;
          if (len > max) max = len;
        }
        colWidths.push({ wch: Math.min(max + 2, 40) });
      }
    }
    ws["!cols"] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  });

  const filename = `${slugify(opts.title)}_${format(new Date(), "yyyyMMdd_HHmm")}.xlsx`;
  XLSX.writeFile(wb, filename);
}

// ---------- Holerite individual ----------

interface PaystubEarning {
  label: string;
  ref?: string;
  value: number;
  type: "provento" | "desconto";
}

interface PaystubOptions {
  orgName: string;
  employeeName: string;
  employeeCpf?: string;
  position?: string;
  costCenter?: string;
  admissionDate?: string;
  referenceMonth: string; // formatado "Janeiro/2025"
  earnings: PaystubEarning[];
  totalBruto: number;
  totalDescontos: number;
  totalLiquido: number;
  baseInss?: number;
  baseFgts?: number;
  baseIrrf?: number;
  fgtsMes?: number;
}

export function generatePaystubPdf(opts: PaystubOptions) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Borda externa
  doc.setDrawColor(180);
  doc.rect(10, 10, pageWidth - 20, pageHeight - 20);

  // Cabeçalho
  doc.setFontSize(12);
  doc.setFont(undefined, "bold");
  doc.text(opts.orgName, 14, 18);
  doc.setFontSize(10);
  doc.setFont(undefined, "normal");
  doc.text("Recibo de Pagamento de Salário", 14, 24);
  doc.setFontSize(11);
  doc.setFont(undefined, "bold");
  doc.text(`Referência: ${opts.referenceMonth}`, pageWidth - 14, 18, { align: "right" });

  // Dados do colaborador
  doc.setDrawColor(220);
  doc.line(14, 28, pageWidth - 14, 28);

  doc.setFontSize(9);
  doc.setFont(undefined, "normal");
  let y = 34;
  doc.setTextColor(110);
  doc.text("COLABORADOR", 14, y);
  doc.setTextColor(20);
  doc.setFont(undefined, "bold");
  doc.text(opts.employeeName, 40, y);

  if (opts.employeeCpf) {
    doc.setFont(undefined, "normal");
    doc.setTextColor(110);
    doc.text("CPF", pageWidth - 60, y);
    doc.setTextColor(20);
    doc.setFont(undefined, "bold");
    doc.text(opts.employeeCpf, pageWidth - 50, y);
  }

  y += 5;
  if (opts.position) {
    doc.setFont(undefined, "normal");
    doc.setTextColor(110);
    doc.text("CARGO", 14, y);
    doc.setTextColor(20);
    doc.setFont(undefined, "bold");
    doc.text(opts.position, 40, y);
  }
  if (opts.costCenter) {
    doc.setFont(undefined, "normal");
    doc.setTextColor(110);
    doc.text("CC", pageWidth - 60, y);
    doc.setTextColor(20);
    doc.setFont(undefined, "bold");
    doc.text(opts.costCenter, pageWidth - 50, y);
  }

  y += 5;
  if (opts.admissionDate) {
    doc.setFont(undefined, "normal");
    doc.setTextColor(110);
    doc.text("ADMISSÃO", 14, y);
    doc.setTextColor(20);
    doc.setFont(undefined, "bold");
    doc.text(opts.admissionDate, 40, y);
  }

  y += 6;

  // Tabela proventos x descontos
  const rows: RowInput[] = opts.earnings.map((e) => [
    e.label,
    e.ref || "—",
    e.type === "provento" ? fmtBRL(e.value) : "",
    e.type === "desconto" ? fmtBRL(e.value) : "",
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Descrição", "Referência", "Vencimentos", "Descontos"]],
    body: rows,
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [36, 214, 196], textColor: 255 },
    columnStyles: {
      2: { halign: "right" },
      3: { halign: "right" },
    },
    margin: { left: 14, right: 14 },
  } as UserOptions);

  let afterTableY = (doc as any).lastAutoTable.finalY + 4;

  // Totais
  autoTable(doc, {
    startY: afterTableY,
    body: [
      [
        { content: "Total de Vencimentos", styles: { fontStyle: "bold" } },
        { content: fmtBRL(opts.totalBruto), styles: { halign: "right", fontStyle: "bold" } },
        { content: "Total de Descontos", styles: { fontStyle: "bold" } },
        { content: fmtBRL(opts.totalDescontos), styles: { halign: "right", fontStyle: "bold" } },
      ],
      [
        { content: "Líquido a Receber", styles: { fontStyle: "bold", fillColor: [240, 253, 250] } },
        { content: "", styles: { fillColor: [240, 253, 250] } },
        { content: "", styles: { fillColor: [240, 253, 250] } },
        {
          content: fmtBRL(opts.totalLiquido),
          styles: { halign: "right", fontStyle: "bold", fillColor: [240, 253, 250], textColor: [15, 118, 110] },
        },
      ],
    ],
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 2 },
    margin: { left: 14, right: 14 },
  } as UserOptions);

  afterTableY = (doc as any).lastAutoTable.finalY + 6;

  // Bases
  if (opts.baseInss != null || opts.baseFgts != null || opts.baseIrrf != null || opts.fgtsMes != null) {
    autoTable(doc, {
      startY: afterTableY,
      head: [["Base INSS", "Base FGTS", "FGTS do Mês", "Base IRRF"]],
      body: [[
        fmtBRL(opts.baseInss || 0),
        fmtBRL(opts.baseFgts || 0),
        fmtBRL(opts.fgtsMes || 0),
        fmtBRL(opts.baseIrrf || 0),
      ]],
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 2, halign: "center" },
      headStyles: { fillColor: [240, 240, 240], textColor: 60 },
      margin: { left: 14, right: 14 },
    } as UserOptions);
    afterTableY = (doc as any).lastAutoTable.finalY + 10;
  }

  // Assinatura
  doc.setFontSize(9);
  doc.setTextColor(60);
  doc.text("Declaro ter recebido a importância líquida discriminada acima.", 14, afterTableY);
  afterTableY += 14;
  doc.line(14, afterTableY, 90, afterTableY);
  doc.setFontSize(8);
  doc.text("Assinatura do colaborador", 14, afterTableY + 4);
  doc.line(pageWidth - 90, afterTableY, pageWidth - 14, afterTableY);
  doc.text("Data", pageWidth - 90, afterTableY + 4);

  // Rodapé
  doc.setFontSize(7);
  doc.setTextColor(140);
  doc.text(
    `Gerado por Colli FinCore — ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`,
    14,
    pageHeight - 14,
  );

  const filename = `holerite_${slugify(opts.employeeName)}_${slugify(opts.referenceMonth)}.pdf`;
  doc.save(filename);
}

// ---------- helpers ----------

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
