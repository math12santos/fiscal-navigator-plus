// Geração de PDF do termômetro de maturidade — score, sub-barras e checklist completo.
// Usa jsPDF + jspdf-autotable (já instalados).

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  MATURITY_LABEL_META,
  MaturityCategory,
  SECTOR_META,
  SectorKey,
  SectorMaturityResult,
} from "./types";

const CATEGORY_LABEL: Record<MaturityCategory, string> = {
  completude: "Completude (estrutural)",
  atualizacao: "Atualização (frescor)",
  rotinas: "Cumprimento de rotinas",
};

const CATEGORY_MAX: Record<MaturityCategory, number> = {
  completude: 50,
  atualizacao: 25,
  rotinas: 25,
};

const LABEL_TEXT: Record<string, string> = {
  critico: "Crítico",
  desenvolvimento: "Em desenvolvimento",
  maduro: "Maduro",
  excelente: "Excelente",
};

interface ExportOptions {
  orgName: string;
  sector: SectorKey;
  result: SectorMaturityResult;
  generatedAt?: Date;
}

// Converte hsl(...) ou string CSS para [r,g,b]
function rgbFromLabel(label: string): [number, number, number] {
  switch (label) {
    case "critico": return [220, 53, 69];        // vermelho
    case "desenvolvimento": return [245, 158, 11]; // âmbar
    case "maduro": return [37, 99, 235];          // azul
    case "excelente": return [22, 163, 74];       // verde
    default: return [100, 116, 139];
  }
}

function drawBar(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  pct: number,
  color: [number, number, number]
) {
  // Fundo
  doc.setFillColor(229, 231, 235);
  doc.roundedRect(x, y, width, height, 1.5, 1.5, "F");
  // Preenchimento
  const filled = Math.max(0, Math.min(1, pct)) * width;
  if (filled > 0) {
    doc.setFillColor(...color);
    doc.roundedRect(x, y, filled, height, 1.5, 1.5, "F");
  }
}

export function exportMaturityPdf(opts: ExportOptions): jsPDF {
  const { orgName, sector, result, generatedAt = new Date() } = opts;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;

  const sectorLabel = SECTOR_META[sector].label;
  const labelMeta = MATURITY_LABEL_META[result.label];
  const labelColor = rgbFromLabel(result.label);

  // ===== Cabeçalho =====
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text("Termômetro de Maturidade", margin, 22);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(71, 85, 105);
  doc.text(`${sectorLabel} — ${orgName}`, margin, 30);
  doc.text(
    `Gerado em ${format(generatedAt, "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}`,
    margin,
    36
  );

  // ===== Score geral =====
  let y = 48;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, y, contentWidth, 32, 3, 3, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(36);
  doc.setTextColor(...labelColor);
  doc.text(`${Math.round(result.score)}`, margin + 8, y + 22);

  doc.setFontSize(12);
  doc.setTextColor(71, 85, 105);
  doc.text("/100", margin + 36, y + 22);

  // Faixa
  doc.setFontSize(10);
  doc.setTextColor(...labelColor);
  doc.setFont("helvetica", "bold");
  doc.text(`Faixa: ${LABEL_TEXT[result.label] || result.label}`, margin + 60, y + 14);

  // Barra grande
  drawBar(doc, margin + 60, y + 18, contentWidth - 70, 5, result.score / 100, labelColor);

  y += 40;

  // ===== Sub-barras =====
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text("Dimensões", margin, y);
  y += 6;

  const dims: { label: string; value: number; max: number }[] = [
    { label: CATEGORY_LABEL.completude, value: result.completeness, max: 50 },
    { label: CATEGORY_LABEL.atualizacao, value: result.freshness, max: 25 },
    { label: CATEGORY_LABEL.rotinas, value: result.routines, max: 25 },
  ];

  for (const dim of dims) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(dim.label, margin, y);
    doc.text(
      `${Math.round(dim.value * 10) / 10}/${dim.max}`,
      pageWidth - margin,
      y,
      { align: "right" }
    );
    drawBar(doc, margin, y + 2, contentWidth, 3.5, dim.value / dim.max, [37, 99, 235]);
    y += 10;
  }

  y += 4;

  // ===== Checklist por categoria =====
  const categories: MaturityCategory[] = ["completude", "atualizacao", "rotinas"];
  for (const cat of categories) {
    const items = result.checklist.filter((i) => i.category === cat);
    if (items.length === 0) continue;

    const earned = items.reduce((s, i) => s + i.earned, 0);
    autoTable(doc, {
      startY: y,
      head: [[
        `${CATEGORY_LABEL[cat]}  —  ${Math.round(earned * 10) / 10}/${CATEGORY_MAX[cat]} pts`,
        "Pontos",
        "Detalhe",
        "Status",
      ]],
      body: items.map((i) => {
        const ratio = i.weight > 0 ? i.earned / i.weight : 0;
        const status = ratio >= 1 ? "OK" : ratio > 0 ? "Parcial" : "Pendente";
        return [
          i.label,
          `${Math.round(i.earned * 10) / 10}/${i.weight}`,
          i.detail || "—",
          status,
        ];
      }),
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 2.2, textColor: [15, 23, 42] },
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: "bold" },
      columnStyles: {
        0: { cellWidth: contentWidth * 0.5 },
        1: { cellWidth: contentWidth * 0.13, halign: "center" },
        2: { cellWidth: contentWidth * 0.22 },
        3: { cellWidth: contentWidth * 0.15, halign: "center" },
      },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 3) {
          const v = String(data.cell.raw);
          if (v === "OK") data.cell.styles.textColor = [22, 163, 74];
          else if (v === "Parcial") data.cell.styles.textColor = [245, 158, 11];
          else data.cell.styles.textColor = [120, 113, 108];
        }
      },
      margin: { left: margin, right: margin },
    });
    // @ts-ignore — jspdf-autotable adiciona a propriedade lastAutoTable
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ===== Rodapé com legenda =====
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(120, 113, 108);
    doc.text(
      "Faixas: Crítico (0-39) · Em desenvolvimento (40-69) · Maduro (70-89) · Excelente (90-100)",
      margin,
      pageHeight - 10
    );
    doc.text(`Página ${p}/${totalPages}`, pageWidth - margin, pageHeight - 10, { align: "right" });
  }

  return doc;
}

export function downloadMaturityPdf(opts: ExportOptions) {
  const doc = exportMaturityPdf(opts);
  const slug = (opts.orgName || "org")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const date = format(opts.generatedAt ?? new Date(), "yyyy-MM-dd");
  doc.save(`maturidade-${opts.sector}-${slug}-${date}.pdf`);
}
