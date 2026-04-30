import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { ITCOItem } from "@/hooks/useITTCO";

const fmt = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Args {
  orgName: string;
  from: string;
  to: string;
  items: ITCOItem[];
  totals: { direct: number; depr: number; inc: number; mov: number; tco: number };
}

export function generateITTCOReportPDF({ orgName, from, to, items, totals }: Args) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 40;
  let y = margin;

  doc.setFontSize(14);
  doc.text("Relatório TCO — TI & Patrimônio Tech", margin, y);
  y += 18;
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`${orgName}`, margin, y);
  y += 12;
  doc.text(`Período: ${new Date(from).toLocaleDateString("pt-BR")} a ${new Date(to).toLocaleDateString("pt-BR")}`, margin, y);
  y += 12;
  doc.text(`Emitido em: ${new Date().toLocaleString("pt-BR")}`, margin, y);
  y += 18;

  doc.setTextColor(0);
  doc.setFontSize(11);
  doc.text("Resumo", margin, y);
  y += 14;
  autoTable(doc, {
    startY: y,
    head: [["Componente", "Valor"]],
    body: [
      ["Custo direto", fmt(totals.direct)],
      ["Depreciação", fmt(totals.depr)],
      ["Custos de incidentes", fmt(totals.inc)],
      ["Movimentações", fmt(totals.mov)],
      ["TCO total", fmt(totals.tco)],
    ],
    margin: { left: margin, right: margin },
    styles: { fontSize: 9 },
    headStyles: { fillColor: [36, 214, 196] },
  });
  y = (doc as any).lastAutoTable.finalY + 18;

  doc.setFontSize(11);
  doc.text("Ranking por TCO", margin, y);
  y += 8;
  autoTable(doc, {
    startY: y,
    head: [["Tipo", "Nome", "Direto", "Depr.", "Incidentes", "Movim.", "TCO total", "TCO/usuário"]],
    body: items.map((r) => [
      r.entity_type === "system" ? "Sistema" : "Equipamento",
      r.name,
      fmt(r.direct_cost),
      fmt(r.depreciation),
      fmt(r.incident_cost),
      fmt(r.movement_cost),
      fmt(r.tco_total),
      fmt(r.tco_per_user),
    ]),
    margin: { left: margin, right: margin },
    styles: { fontSize: 8 },
    headStyles: { fillColor: [36, 214, 196] },
    columnStyles: {
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right", fontStyle: "bold" },
      7: { halign: "right" },
    },
  });

  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Página ${i} de ${totalPages}`, pageW - margin, doc.internal.pageSize.getHeight() - 20, { align: "right" });
  }

  doc.save(`tco-ti-${from}-${to}.pdf`);
}
