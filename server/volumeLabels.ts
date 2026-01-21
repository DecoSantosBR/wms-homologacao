import PDFDocument from "pdfkit";
import bwipjs from "bwip-js";
import path from "path";
import fs from "fs";

interface VolumeLabel {
  customerOrderNumber: string;
  customerName: string;
  tenantName: string;
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

      // Carregar logo Med@x
      const logoPath = path.join(__dirname, "assets", "medax-logo.png");
      const logoExists = fs.existsSync(logoPath);

      labels.forEach((label, index) => {
        if (index > 0) {
          doc.addPage({ size: [labelWidth, labelHeight], margins: { top: 10, bottom: 10, left: 10, right: 10 } });
        }

        let currentY = 10;

        // Logo Med@x no canto superior esquerdo
        if (logoExists) {
          doc.image(logoPath, 10, currentY, { width: 60, height: 20 });
        }

        // Obter código de barras pré-gerado
        const barcodeBuffer = barcodes.get(label.customerOrderNumber)!;

        // Posicionar código de barras ao lado do logo (ou no topo se não houver logo)
        const barcodeX = logoExists ? 80 : 10;
        const barcodeWidth = logoExists ? labelWidth - 90 : labelWidth - 20;
        doc.image(barcodeBuffer, barcodeX, currentY, { width: barcodeWidth, height: 30 });

        currentY += 35;

        // Número do pedido (texto alfanumérico)
        doc.fontSize(12).font("Helvetica-Bold").text(
          `Pedido: ${label.customerOrderNumber}`,
          10,
          currentY,
          { width: labelWidth - 20, align: "center" }
        );

        currentY += 20;

        // Destinatário
        doc.fontSize(10).font("Helvetica").text(
          `Destinatário: ${label.customerName}`,
          10,
          currentY,
          { width: labelWidth - 20, align: "left" }
        );

        currentY += 15;

        // Cliente (Tenant)
        doc.fontSize(10).font("Helvetica").text(
          `Cliente: ${label.tenantName}`,
          10,
          currentY,
          { width: labelWidth - 20, align: "left" }
        );

        currentY += 20;

        // Quantidade de volumes
        doc.fontSize(14).font("Helvetica-Bold").text(
          `Volume ${label.volumeNumber} de ${label.totalVolumes}`,
          10,
          currentY,
          { width: labelWidth - 20, align: "center" }
        );
      });

      doc.end();
    });
  } catch (error) {
    throw error;
  }
}
