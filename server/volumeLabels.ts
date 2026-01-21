import PDFDocument from "pdfkit";
import bwipjs from "bwip-js";

interface VolumeLabel {
  customerOrderNumber: string;
  customerName: string;
  volumeNumber: number;
  totalVolumes: number;
}

/**
 * Gera etiquetas de volumes em PDF (10cm x 5cm cada)
 * Inclui código de barras Code-128 do customerOrderNumber
 */
export async function generateVolumeLabels(labels: VolumeLabel[]): Promise<Buffer> {
  try {
    // Dimensões: 10cm x 5cm = 283.46pt x 141.73pt (1cm = 28.346pt)
    const labelWidth = 283.46;
    const labelHeight = 141.73;

    // Gerar todos os códigos de barras primeiro (async)
    const barcodes = new Map<string, Buffer>();
    for (const label of labels) {
      if (!barcodes.has(label.customerOrderNumber)) {
        const barcodeBuffer = await bwipjs.toBuffer({
          bcid: "code128",
          text: label.customerOrderNumber,
          scale: 2,
          height: 8,
          includetext: false,
        });
        barcodes.set(label.customerOrderNumber, barcodeBuffer);
      }
    }

    // Criar PDF
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: [labelWidth, labelHeight],
        margins: { top: 10, bottom: 10, left: 10, right: 10 },
      });

      const chunks: Buffer[] = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      labels.forEach((label, index) => {
        if (index > 0) {
          doc.addPage({ size: [labelWidth, labelHeight], margins: { top: 10, bottom: 10, left: 10, right: 10 } });
        }

        // Obter código de barras pré-gerado
        const barcodeBuffer = barcodes.get(label.customerOrderNumber)!;

        // Posicionar código de barras no topo
        doc.image(barcodeBuffer, 10, 10, { width: labelWidth - 20, height: 40 });

        // Número do pedido (texto alfanumérico)
        doc.fontSize(14).font("Helvetica-Bold").text(
          `Pedido: ${label.customerOrderNumber}`,
          10,
          55,
          { width: labelWidth - 20, align: "center" }
        );

        // Destinatário
        doc.fontSize(12).font("Helvetica").text(
          `Destinatário: ${label.customerName}`,
          10,
          75,
          { width: labelWidth - 20, align: "left" }
        );

        // Quantidade de volumes
        doc.fontSize(16).font("Helvetica-Bold").text(
          `Volume ${label.volumeNumber} de ${label.totalVolumes}`,
          10,
          105,
          { width: labelWidth - 20, align: "center" }
        );
      });

      doc.end();
    });
  } catch (error) {
    throw error;
  }
}
