import PDFDocument from "pdfkit";
import { getDb } from "./db";
import { pickingWaves, pickingWaveItems, pickingOrders, pickingReservations, tenants } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

interface WaveDocumentData {
  waveCode: string;
  clientName: string;
  completedAt: Date;
  completedBy: string;
  orders: Array<{
    orderNumber: string;
    destination: string;
    items: Array<{
      productName: string;
      sku: string;
      locationCode: string;
      batch: string | null;
      expiryDate: Date | null;
      quantity: number;
    }>;
  }>;
}

/**
 * Buscar dados da onda para o documento
 */
async function fetchWaveData(waveId: number): Promise<WaveDocumentData> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Buscar dados da onda
  const [wave] = await db
    .select({
      waveNumber: pickingWaves.waveNumber,
      tenantId: pickingWaves.tenantId,
      pickedAt: pickingWaves.pickedAt,
      pickedBy: pickingWaves.pickedBy,
    })
    .from(pickingWaves)
    .where(eq(pickingWaves.id, waveId));

  if (!wave) {
    throw new Error("Onda não encontrada");
  }

  // Buscar cliente
  const [tenant] = await db
    .select({ name: tenants.name })
    .from(tenants)
    .where(eq(tenants.id, wave.tenantId));

  // Buscar pedidos da onda com seus itens
  const waveOrders = await db
    .select({
      id: pickingOrders.id,
      orderNumber: pickingOrders.customerOrderNumber,
      deliveryAddress: pickingOrders.deliveryAddress,
    })
    .from(pickingOrders)
    .where(eq(pickingOrders.waveId, waveId));

  // Para cada pedido, buscar seus itens específicos
  const orders = await Promise.all(
    waveOrders.map(async (order) => {
      // Buscar itens do pedido através das reservas
      const orderItems = await db
        .selectDistinct({
          productName: pickingWaveItems.productName,
          sku: pickingWaveItems.productSku,
          locationCode: pickingWaveItems.locationCode,
          batch: pickingWaveItems.batch,
          expiryDate: pickingWaveItems.expiryDate,
          quantity: pickingWaveItems.totalQuantity,
        })
        .from(pickingWaveItems)
        .innerJoin(
          pickingReservations,
          eq(pickingWaveItems.productId, pickingReservations.productId)
        )
        .where(
          and(
            eq(pickingWaveItems.waveId, waveId),
            eq(pickingReservations.pickingOrderId, order.id)
          )
        );

      return {
        orderNumber: order.orderNumber || "N/A",
        destination: order.deliveryAddress || "N/A",
        items: orderItems.map((item) => ({
          productName: item.productName,
          sku: item.sku,
          locationCode: item.locationCode,
          batch: item.batch,
          expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
          quantity: item.quantity,
        })),
      };
    })
  );

  return {
    waveCode: wave.waveNumber,
    clientName: tenant?.name || "N/A",
    completedAt: wave.pickedAt ? new Date(wave.pickedAt) : new Date(),
    completedBy: wave.pickedBy?.toString() || "N/A",
    orders,
  };
}

/**
 * Gerar documento PDF da onda de separação
 */
export async function generateWaveDocument(waveId: number): Promise<Buffer> {
  const data = await fetchWaveData(waveId);

  const doc = new PDFDocument({ size: "A4", margin: 40 });
  const chunks: Buffer[] = [];

  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  // Cabeçalho
  doc.fontSize(10);
  doc.fillColor("#666666");

  const headerY = 40;
  doc.rect(40, headerY, 515, 30).fill("#f0f0f0");

  doc.fillColor("#000000");
  doc.font("Helvetica-Bold");
  doc.text(`Onda ${data.waveCode}`, 50, headerY + 10, { width: 130 });
  doc.text(`Cliente: ${data.clientName}`, 190, headerY + 10, { width: 150 });
  doc.text(`Data: ${data.completedAt.toLocaleDateString("pt-BR")}`, 350, headerY + 10, { width: 100 });
  doc.fontSize(8);
  doc.font("Helvetica");
  doc.text(`Separado por: ${data.completedBy}`, 460, headerY + 20, { width: 90, align: "right" });

  let currentY = headerY + 60;

  // Itens agrupados por pedido
  for (const order of data.orders) {
    // Verificar se precisa de nova página
    if (currentY > 700) {
      doc.addPage();
      currentY = 40;
    }

    // Cabeçalho do pedido
    doc.fontSize(10);
    doc.font("Helvetica-Bold");
    doc.text(`Pedido: ${order.orderNumber}`, 40, currentY);
    doc.text(`Destinatário: ${order.destination}`, 40, currentY + 15);
    currentY += 40;

    // Cabeçalho da tabela
    doc.fontSize(9);
    doc.fillColor("#666666");
    doc.rect(40, currentY, 515, 20).fill("#e0e0e0");

    doc.fillColor("#000000");
    doc.font("Helvetica-Bold");
    doc.text("Produto", 45, currentY + 5, { width: 150 });
    doc.text("SKU", 200, currentY + 5, { width: 60 });
    doc.text("Endereço", 265, currentY + 5, { width: 70 });
    doc.text("Lote", 340, currentY + 5, { width: 70 });
    doc.text("Validade", 415, currentY + 5, { width: 60 });
    doc.text("Quantidade", 480, currentY + 5, { width: 70, align: "right" });

    currentY += 25;

    // Itens do pedido
    doc.font("Helvetica");
    doc.fontSize(8);

    for (const item of order.items) {
      // Verificar se precisa de nova página
      if (currentY > 750) {
        doc.addPage();
        currentY = 40;
      }

      doc.text(item.productName || "N/A", 45, currentY, { width: 150 });
      doc.text(item.sku || "N/A", 200, currentY, { width: 60 });
      doc.text(item.locationCode || "N/A", 265, currentY, { width: 70 });
      doc.text(item.batch || "N/A", 340, currentY, { width: 70 });
      doc.text(
        item.expiryDate ? item.expiryDate.toLocaleDateString("pt-BR") : "N/A",
        415,
        currentY,
        { width: 60 }
      );
      doc.text(item.quantity?.toString() || "0", 480, currentY, { width: 70, align: "right" });

      currentY += 20;
    }

    // Linha separadora entre pedidos
    doc.moveTo(40, currentY + 5).lineTo(555, currentY + 5).stroke("#cccccc");
    currentY += 20;
  }

  // Rodapé
  const footerY = 800;
  doc.fontSize(8);
  doc.fillColor("#666666");
  doc.text(
    `Data de Impressão: ${new Date().toLocaleString("pt-BR")}`,
    40,
    footerY,
    { align: "center", width: 515 }
  );

  doc.end();

  return new Promise((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}
