import PDFDocument from "pdfkit";
import bwipjs from "bwip-js";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface VolumeLabel {
  customerOrderNumber: string;
  customerName: string;
  tenantName: string;
  volumeNumber: number;
  totalVolumes: number;
}

/**
 * Gera etiquetas de volumes em PDF (15cm x 7.5cm cada)
 *
 * Layout fiel à imagem de referência:
 * ┌─────────────────────────────────────────────────────┐
 * │  [Logo Med@x]              [||||||||||||||||||||]   │
 * │  Soluções Logísticas Para Saúde                     │
 * ├─────────────────────────────────────────────────────┤
 * │  Destinatário: HMV              Pedido: 005         │
 * │  Cliente: AESC - Mãe de Deus - UCG                  │
 * │                Volume 1 de 12                       │
 * └─────────────────────────────────────────────────────┘
 */
export async function generateVolumeLabels(labels: VolumeLabel[]): Promise<Buffer> {
  // Dimensões: 15cm x 7.5cm em pontos (1cm = 28.346pt)
  const labelWidth = 425.2;   // 15cm
  const labelHeight = 212.6;  // 7.5cm
  const margin = 14;

  // Pré-gerar todos os códigos de barras (async, deduplica por pedido)
  const barcodes = new Map<string, Buffer>();
  for (const label of labels) {
    if (!barcodes.has(label.customerOrderNumber)) {
      const barcodeBuffer = await bwipjs.toBuffer({
        bcid: "code128",
        text: label.customerOrderNumber,
        scale: 3,
        height: 12,
        includetext: false,
        paddingwidth: 0,
        paddingheight: 0,
      });
      barcodes.set(label.customerOrderNumber, barcodeBuffer);
    }
  }

  // Carregar logo
  const logoPath = path.join(__dirname, "assets", "medax-logo.png");
  const logoExists = fs.existsSync(logoPath);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: [labelWidth, labelHeight],
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      autoFirstPage: false,
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    labels.forEach((label, index) => {
      doc.addPage({ size: [labelWidth, labelHeight], margins: { top: 0, bottom: 0, left: 0, right: 0 } });

      // ── Fundo branco com borda arredondada simulada ───────────────────────
      doc
        .roundedRect(2, 2, labelWidth - 4, labelHeight - 4, 8)
        .fillAndStroke("#FFFFFF", "#CCCCCC");

      // ── SEÇÃO SUPERIOR: Logo (esquerda) + Barcode (direita) ──────────────
      const topSectionHeight = 72;
      const logoAreaWidth = 180;
      const barcodeAreaX = logoAreaWidth + margin;
      const barcodeAreaWidth = labelWidth - barcodeAreaX - margin;

      // Logo Med@x
      if (logoExists) {
        doc.image(logoPath, margin, margin, {
          width: logoAreaWidth - margin,
          height: 52,
          fit: [logoAreaWidth - margin, 52],
        });
      } else {
        // Fallback texto se logo não existir
        doc
          .fontSize(20)
          .font("Helvetica-Bold")
          .fillColor("#1a3a8c")
          .text("Med@x", margin, margin + 8, { width: logoAreaWidth - margin });
        doc
          .fontSize(8)
          .font("Helvetica")
          .fillColor("#666666")
          .text("Soluções Logísticas Para Saúde", margin, margin + 34, { width: logoAreaWidth - margin });
      }

      // Código de barras (direita, alinhado ao topo)
      const barcodeBuffer = barcodes.get(label.customerOrderNumber)!;
      doc.image(barcodeBuffer, barcodeAreaX, margin + 4, {
        width: barcodeAreaWidth,
        height: 48,
        fit: [barcodeAreaWidth, 48],
      });

      // ── Linha divisória horizontal ────────────────────────────────────────
      const dividerY = topSectionHeight + 4;
      doc
        .moveTo(margin, dividerY)
        .lineTo(labelWidth - margin, dividerY)
        .lineWidth(1.2)
        .strokeColor("#000000")
        .stroke();

      // ── SEÇÃO INFERIOR: Dados do pedido ───────────────────────────────────
      doc.fillColor("#000000");

      // Linha 1: Destinatário (esquerda) + Pedido (direita) — mesma linha
      const line1Y = dividerY + 14;
      const halfWidth = (labelWidth - margin * 2) / 2;

      doc
        .fontSize(14)
        .font("Helvetica-Bold")
        .text(`Destinatário: ${label.customerName}`, margin, line1Y, {
          width: halfWidth + 10,
          align: "left",
          lineBreak: false,
        });

      doc
        .fontSize(14)
        .font("Helvetica-Bold")
        .text(`Pedido: ${label.customerOrderNumber}`, margin + halfWidth - 10, line1Y, {
          width: halfWidth + 10,
          align: "right",
          lineBreak: false,
        });

      // Linha 2: Cliente
      const line2Y = line1Y + 28;
      doc
        .fontSize(14)
        .font("Helvetica-Bold")
        .text(`Cliente: ${label.tenantName}`, margin, line2Y, {
          width: labelWidth - margin * 2,
          align: "left",
        });

      // Linha 3: Volume N de X — centralizado e em destaque
      const line3Y = line2Y + 30;
      doc
        .fontSize(16)
        .font("Helvetica-Bold")
        .text(`Volume ${label.volumeNumber} de ${label.totalVolumes}`, margin, line3Y, {
          width: labelWidth - margin * 2,
          align: "center",
        });
    });

    doc.end();
  });
}
