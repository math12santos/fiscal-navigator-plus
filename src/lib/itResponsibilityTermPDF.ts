import jsPDF from "jspdf";
import QRCode from "qrcode";

const fmt = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dateBR = (d?: string | Date) =>
  d ? new Date(d).toLocaleDateString("pt-BR") : "—";

interface Args {
  equipment: any;
  employee?: { name?: string; cpf?: string; position?: string } | null;
  movement?: any;
  organizationName?: string;
}

export async function generateResponsibilityTermPDF({
  equipment,
  employee,
  movement,
  organizationName = "—",
}: Args) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 48;
  let y = margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("TERMO DE RESPONSABILIDADE — ATIVO DE TI", pageW / 2, y, { align: "center" });
  y += 26;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Empresa: ${organizationName}`, margin, y);
  doc.text(`Emitido em: ${dateBR(new Date())}`, pageW - margin, y, { align: "right" });
  y += 22;

  // QR
  try {
    const qrPayload = JSON.stringify({
      type: "it_equipment",
      id: equipment?.id,
      code: equipment?.patrimonial_code,
    });
    const qrUrl = await QRCode.toDataURL(qrPayload, { width: 200, margin: 0 });
    doc.addImage(qrUrl, "PNG", pageW - margin - 90, y, 90, 90);
  } catch {
    /* ignore */
  }

  doc.setFont("helvetica", "bold");
  doc.text("Equipamento", margin, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  const eqLines = [
    `Código patrimonial: ${equipment?.patrimonial_code ?? "—"}`,
    `Descrição: ${equipment?.name ?? "—"}`,
    `Tipo: ${(equipment?.equipment_type ?? "—").toString().replace(/_/g, " ")}`,
    `Marca/Modelo: ${[equipment?.brand, equipment?.model].filter(Boolean).join(" ") || "—"}`,
    `Nº de série: ${equipment?.serial_number ?? "—"}`,
    `Valor de aquisição: ${fmt(equipment?.acquisition_value)}`,
    `Data de aquisição: ${dateBR(equipment?.acquisition_date)}`,
  ];
  eqLines.forEach((l) => { doc.text(l, margin, y); y += 13; });

  y += 10;
  doc.setFont("helvetica", "bold");
  doc.text("Colaborador responsável", margin, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.text(`Nome: ${employee?.name ?? "—"}`, margin, y); y += 13;
  doc.text(`Cargo: ${employee?.position ?? "—"}`, margin, y); y += 13;
  doc.text(`CPF: ${employee?.cpf ?? "—"}`, margin, y); y += 13;
  doc.text(`Data da entrega: ${dateBR(movement?.movement_date)}`, margin, y); y += 13;
  doc.text(`Local: ${movement?.to_location ?? equipment?.location ?? "—"}`, margin, y); y += 18;

  doc.setFont("helvetica", "bold");
  doc.text("Declaração", margin, y); y += 14;
  doc.setFont("helvetica", "normal");
  const decl =
    "Declaro ter recebido, em perfeito estado de conservação e funcionamento, o equipamento de TI descrito acima, " +
    "comprometendo-me a utilizá-lo exclusivamente para fins profissionais, zelar pela sua integridade física e lógica, " +
    "manter sigilo sobre as informações nele contidas e devolvê-lo nas mesmas condições quando solicitado pela empresa " +
    "ou no encerramento do vínculo. Em caso de dano, extravio ou uso inadequado, autorizo o ressarcimento dos custos " +
    "correspondentes, conforme política interna.";
  const wrap = doc.splitTextToSize(decl, pageW - margin * 2);
  doc.text(wrap, margin, y);
  y += wrap.length * 13 + 40;

  // Assinaturas
  const colW = (pageW - margin * 2 - 30) / 2;
  doc.line(margin, y, margin + colW, y);
  doc.line(margin + colW + 30, y, pageW - margin, y);
  y += 12;
  doc.setFontSize(9);
  doc.text("Colaborador", margin + colW / 2, y, { align: "center" });
  doc.text("Empresa / TI", margin + colW + 30 + colW / 2, y, { align: "center" });

  const filename = `Termo-${equipment?.patrimonial_code ?? "TI"}.pdf`;
  doc.save(filename);
}
