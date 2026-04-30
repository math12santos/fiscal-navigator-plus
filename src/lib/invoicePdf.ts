import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Invoice, InvoiceItem } from "@/hooks/useBilling";

interface InvoicePdfPayload {
  invoice: Invoice;
  items: InvoiceItem[];
  orgName: string;
  orgDocument?: string | null;
  issuerName?: string;
}

export function generateInvoicePdf({ invoice, items, orgName, orgDocument, issuerName }: InvoicePdfPayload) {
  const doc = new jsPDF();
  const fmt = (n: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);
  const fmtDate = (s: string) => new Date(s).toLocaleDateString("pt-BR");

  // Header
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("FATURA", 14, 18);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Nº ${invoice.number}`, 14, 25);
  doc.text(`Emitida em ${fmtDate(invoice.issued_at)}`, 14, 30);
  doc.text(`Vencimento: ${fmtDate(invoice.due_at)}`, 14, 35);

  // Status badge
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  const statusLabel: Record<string, string> = {
    draft: "RASCUNHO", open: "EM ABERTO", paid: "PAGA", overdue: "VENCIDA", void: "CANCELADA",
  };
  doc.text(statusLabel[invoice.status] ?? invoice.status, 160, 18);

  // Cliente
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Cliente", 14, 48);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(orgName, 14, 54);
  if (orgDocument) doc.text(orgDocument, 14, 59);

  // Período
  doc.setFont("helvetica", "bold");
  doc.text("Período de referência", 110, 48);
  doc.setFont("helvetica", "normal");
  doc.text(`${fmtDate(invoice.period_start)} a ${fmtDate(invoice.period_end)}`, 110, 54);

  // Itens
  autoTable(doc, {
    startY: 70,
    head: [["Descrição", "Qtd", "Unit.", "Total"]],
    body: items.map((it) => [
      it.description,
      String(it.quantity),
      fmt(it.unit_price),
      fmt(it.amount),
    ]),
    headStyles: { fillColor: [36, 214, 196] },
    styles: { fontSize: 9 },
  });

  // Total
  const finalY = (doc as any).lastAutoTable?.finalY ?? 90;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`Total: ${fmt(invoice.amount)}`, 196, finalY + 10, { align: "right" });

  // Pagamento
  if (invoice.payment_link) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Link de pagamento: ${invoice.payment_link}`, 14, finalY + 22);
  }
  if (invoice.notes) {
    doc.setFontSize(9);
    doc.text(`Observações: ${invoice.notes}`, 14, finalY + 28);
  }

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(
    `Emitido por ${issuerName ?? "Backoffice"} em ${new Date().toLocaleString("pt-BR")}`,
    14,
    285,
  );

  doc.save(`${invoice.number}.pdf`);
}
