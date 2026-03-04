/**
 * labelReprintRouter.ts
 * Procedures para reimpressão de etiquetas de todos os tipos do WMS.
 *
 * Tipos suportados:
 *  1. Recebimento   – etiquetas de ordens de recebimento (labelPrintHistory + receivingOrderItems)
 *  2. Separação     – etiquetas de ondas de picking (pickingWaves + pickingOrders)
 *  3. Volumes       – etiquetas de volumes de expedição (shipments)
 *  4. Produtos      – etiquetas de itens individuais (labelAssociations + productLabels)
 *  5. Endereços     – etiquetas de posições de estoque (warehouseLocations)
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, desc, like, or, sql } from "drizzle-orm";
import PDFDocument from "pdfkit";
import bwipjs from "bwip-js";
import { router } from "./_core/trpc";
import { tenantProcedure } from "./_core/tenantGuard";
import { getDb } from "./db";
import {
  receivingOrders,
  receivingOrderItems,
  pickingWaves,
  pickingOrders,
  shipments,
  labelAssociations,
  productLabels,
  warehouseLocations,
  warehouseZones,
  products,
  tenants,
} from "../drizzle/schema";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Gera um PDF de etiqueta simples (10cm × 5cm) com código de barras Code-128 */
async function buildLabelPdf(
  labelCode: string,
  line1: string,
  line2?: string,
  line3?: string
): Promise<string> {
  const barcodeBuffer = await bwipjs.toBuffer({
    bcid: "code128",
    text: labelCode,
    scale: 2,
    height: 10,
    includetext: true,
    textxalign: "center",
  });

  const doc = new PDFDocument({
    size: [283.46, 141.73], // 10cm × 5cm
    margins: { top: 8, bottom: 8, left: 8, right: 8 },
  });

  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));

  // Texto descritivo
  doc.fontSize(9).font("Helvetica-Bold").text(line1, 8, 10, { width: 267 });
  if (line2) doc.fontSize(8).font("Helvetica").text(line2, 8, 22, { width: 267 });
  if (line3) doc.fontSize(7).font("Helvetica").text(line3, 8, 33, { width: 267 });

  // Código de barras centralizado
  doc.image(barcodeBuffer, 42, 48, { width: 200, height: 50 });

  doc.end();

  const pdfBuffer = await new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  return `data:application/pdf;base64,${pdfBuffer.toString("base64")}`;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const labelReprintRouter = router({
  // ── 1. RECEBIMENTO ─────────────────────────────────────────────────────────

  /** Lista ordens de recebimento disponíveis para reimpressão */
  listReceiving: tenantProcedure
    .input(
      z.object({
        search: z.string().optional(),
        limit: z.number().default(30),
      })
    )
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const { effectiveTenantId, isGlobalAdmin } = ctx;

      const tenantFilter = isGlobalAdmin
        ? undefined
        : eq(receivingOrders.tenantId, effectiveTenantId);

      const searchFilter = input.search
        ? or(
            like(receivingOrders.orderNumber, `%${input.search}%`),
            like(receivingOrders.nfeNumber, `%${input.search}%`),
            like(receivingOrders.supplierName, `%${input.search}%`)
          )
        : undefined;

      const whereClause = tenantFilter && searchFilter
        ? and(tenantFilter, searchFilter)
        : tenantFilter ?? searchFilter;

      const rows = await db
        .select({
          id: receivingOrders.id,
          orderNumber: receivingOrders.orderNumber,
          nfeNumber: receivingOrders.nfeNumber,
          supplierName: receivingOrders.supplierName,
          status: receivingOrders.status,
          tenantId: receivingOrders.tenantId,
          createdAt: receivingOrders.createdAt,
        })
        .from(receivingOrders)
        .where(whereClause)
        .orderBy(desc(receivingOrders.createdAt))
        .limit(input.limit);

      return rows;
    }),

  /** Reimprime etiquetas de uma ordem de recebimento */
  reprintReceiving: tenantProcedure
    .input(z.object({ receivingOrderId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const { effectiveTenantId, isGlobalAdmin } = ctx;

      const [order] = await db
        .select()
        .from(receivingOrders)
        .where(eq(receivingOrders.id, input.receivingOrderId))
        .limit(1);

      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Ordem não encontrada" });
      if (!isGlobalAdmin && order.tenantId !== effectiveTenantId)
        throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });

      const pdf = await buildLabelPdf(
        order.orderNumber,
        `OT: ${order.orderNumber}`,
        order.supplierName ?? "",
        order.nfeNumber ? `NF: ${order.nfeNumber}` : undefined
      );

      return { success: true, labelCode: order.orderNumber, pdf };
    }),

  // ── 2. SEPARAÇÃO ───────────────────────────────────────────────────────────

  /** Lista ondas de picking para reimpressão */
  listWaves: tenantProcedure
    .input(
      z.object({
        search: z.string().optional(),
        limit: z.number().default(30),
      })
    )
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const { effectiveTenantId, isGlobalAdmin } = ctx;

      const tenantFilter = isGlobalAdmin
        ? undefined
        : eq(pickingWaves.tenantId, effectiveTenantId);

      const searchFilter = input.search
        ? like(pickingWaves.waveNumber, `%${input.search}%`)
        : undefined;

      const whereClause = tenantFilter && searchFilter
        ? and(tenantFilter, searchFilter)
        : tenantFilter ?? searchFilter;

      const rows = await db
        .select({
          id: pickingWaves.id,
          waveNumber: pickingWaves.waveNumber,
          status: pickingWaves.status,
          totalOrders: pickingWaves.totalOrders,
          totalItems: pickingWaves.totalItems,
          tenantId: pickingWaves.tenantId,
          createdAt: pickingWaves.createdAt,
        })
        .from(pickingWaves)
        .where(whereClause)
        .orderBy(desc(pickingWaves.createdAt))
        .limit(input.limit);

      return rows;
    }),

  /** Reimprime etiqueta de uma onda de picking */
  reprintWave: tenantProcedure
    .input(z.object({ waveId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const { effectiveTenantId, isGlobalAdmin } = ctx;

      const [wave] = await db
        .select()
        .from(pickingWaves)
        .where(eq(pickingWaves.id, input.waveId))
        .limit(1);

      if (!wave) throw new TRPCError({ code: "NOT_FOUND", message: "Onda não encontrada" });
      if (!isGlobalAdmin && wave.tenantId !== effectiveTenantId)
        throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });

      const pdf = await buildLabelPdf(
        wave.waveNumber,
        `Onda: ${wave.waveNumber}`,
        `Pedidos: ${wave.totalOrders ?? 0}  |  Itens: ${wave.totalItems ?? 0}`,
        `Status: ${wave.status}`
      );

      return { success: true, labelCode: wave.waveNumber, pdf };
    }),

  // ── 3. VOLUMES ─────────────────────────────────────────────────────────────

  /** Lista expedições (volumes) para reimpressão */
  listShipments: tenantProcedure
    .input(
      z.object({
        search: z.string().optional(),
        limit: z.number().default(30),
      })
    )
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const { effectiveTenantId, isGlobalAdmin } = ctx;

      const tenantFilter = isGlobalAdmin
        ? undefined
        : eq(shipments.tenantId, effectiveTenantId);

      const searchFilter = input.search
        ? or(
            like(shipments.shipmentNumber, `%${input.search}%`),
            like(shipments.carrierName, `%${input.search}%`),
            like(shipments.vehiclePlate, `%${input.search}%`)
          )
        : undefined;

      const whereClause = tenantFilter && searchFilter
        ? and(tenantFilter, searchFilter)
        : tenantFilter ?? searchFilter;

      const rows = await db
        .select({
          id: shipments.id,
          shipmentNumber: shipments.shipmentNumber,
          carrierName: shipments.carrierName,
          vehiclePlate: shipments.vehiclePlate,
          driverName: shipments.driverName,
          status: shipments.status,
          tenantId: shipments.tenantId,
          createdAt: shipments.createdAt,
        })
        .from(shipments)
        .where(whereClause)
        .orderBy(desc(shipments.createdAt))
        .limit(input.limit);

      return rows;
    }),

  /** Reimprime etiqueta de volume de expedição */
  reprintShipment: tenantProcedure
    .input(z.object({ shipmentId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const { effectiveTenantId, isGlobalAdmin } = ctx;

      const [shipment] = await db
        .select()
        .from(shipments)
        .where(eq(shipments.id, input.shipmentId))
        .limit(1);

      if (!shipment) throw new TRPCError({ code: "NOT_FOUND", message: "Expedição não encontrada" });
      if (!isGlobalAdmin && shipment.tenantId !== effectiveTenantId)
        throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });

      const pdf = await buildLabelPdf(
        shipment.shipmentNumber,
        `Romaneio: ${shipment.shipmentNumber}`,
        shipment.carrierName ?? "",
        shipment.vehiclePlate ? `Placa: ${shipment.vehiclePlate}` : undefined
      );

      return { success: true, labelCode: shipment.shipmentNumber, pdf };
    }),

  // ── 4. PRODUTOS ────────────────────────────────────────────────────────────

  /** Lista etiquetas de produtos (labelAssociations) para reimpressão */
  listProductLabels: tenantProcedure
    .input(
      z.object({
        search: z.string().optional(),
        limit: z.number().default(30),
      })
    )
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const { effectiveTenantId, isGlobalAdmin } = ctx;

      const tenantFilter = isGlobalAdmin
        ? undefined
        : eq(labelAssociations.tenantId, effectiveTenantId);

      const searchFilter = input.search
        ? or(
            like(labelAssociations.labelCode, `%${input.search}%`),
            like(labelAssociations.uniqueCode, `%${input.search}%`),
            like(labelAssociations.batch, `%${input.search}%`)
          )
        : undefined;

      const whereClause = tenantFilter && searchFilter
        ? and(tenantFilter, searchFilter)
        : tenantFilter ?? searchFilter;

      const rows = await db
        .select({
          id: labelAssociations.id,
          labelCode: labelAssociations.labelCode,
          uniqueCode: labelAssociations.uniqueCode,
          batch: labelAssociations.batch,
          expiryDate: labelAssociations.expiryDate,
          unitsPerBox: labelAssociations.unitsPerBox,
          status: labelAssociations.status,
          tenantId: labelAssociations.tenantId,
          associatedAt: labelAssociations.associatedAt,
          productId: labelAssociations.productId,
        })
        .from(labelAssociations)
        .where(whereClause)
        .orderBy(desc(labelAssociations.associatedAt))
        .limit(input.limit);

      // Enriquecer com nome do produto
      const productIds = Array.from(new Set(rows.map((r) => r.productId)));
      let productMap: Record<number, string> = {};
      if (productIds.length > 0) {
        const prods = await db
          .select({ id: products.id, sku: products.sku, description: products.description })
          .from(products)
          .where(sql`${products.id} IN (${sql.join(productIds.map((id) => sql`${id}`), sql`, `)})`);
        productMap = Object.fromEntries(prods.map((p) => [p.id, `${p.sku} – ${p.description}`]));
      }

      return rows.map((r) => ({
        ...r,
        productName: productMap[r.productId] ?? `Produto #${r.productId}`,
      }));
    }),

  /** Reimprime etiqueta de produto (por labelCode) */
  reprintProductLabel: tenantProcedure
    .input(z.object({ labelCode: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const { effectiveTenantId, isGlobalAdmin } = ctx;

      const [label] = await db
        .select()
        .from(labelAssociations)
        .where(eq(labelAssociations.labelCode, input.labelCode))
        .limit(1);

      if (!label) throw new TRPCError({ code: "NOT_FOUND", message: "Etiqueta não encontrada" });
      if (!isGlobalAdmin && label.tenantId !== effectiveTenantId)
        throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });

      // Buscar nome do produto
      const [product] = await db
        .select({ sku: products.sku, description: products.description })
        .from(products)
        .where(eq(products.id, label.productId))
        .limit(1);

      const productLine = product
        ? `${product.sku} – ${product.description}`
        : `Produto #${label.productId}`;

      const expiryStr = label.expiryDate
        ? `Val: ${String(label.expiryDate).substring(0, 10)}`
        : undefined;

      const pdf = await buildLabelPdf(
        label.labelCode,
        productLine,
        label.batch ? `Lote: ${label.batch}` : "Sem lote",
        expiryStr
      );

      return { success: true, labelCode: label.labelCode, pdf };
    }),

  // ── 5. ENDEREÇOS ───────────────────────────────────────────────────────────

  /** Lista endereços de estoque para reimpressão */
  listLocations: tenantProcedure
    .input(
      z.object({
        search: z.string().optional(),
        limit: z.number().default(50),
      })
    )
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const { effectiveTenantId, isGlobalAdmin } = ctx;

      const tenantFilter = isGlobalAdmin
        ? undefined
        : eq(warehouseLocations.tenantId, effectiveTenantId);

      const searchFilter = input.search
        ? like(warehouseLocations.code, `%${input.search}%`)
        : undefined;

      const whereClause = tenantFilter && searchFilter
        ? and(tenantFilter, searchFilter)
        : tenantFilter ?? searchFilter;

      const rows = await db
        .select({
          id: warehouseLocations.id,
          code: warehouseLocations.code,
          zoneCode: warehouseLocations.zoneCode,
          aisle: warehouseLocations.aisle,
          rack: warehouseLocations.rack,
          level: warehouseLocations.level,
          status: warehouseLocations.status,
          tenantId: warehouseLocations.tenantId,
        })
        .from(warehouseLocations)
        .where(whereClause)
        .orderBy(warehouseLocations.code)
        .limit(input.limit);

      return rows;
    }),

  /** Reimprime etiquetas de múltiplos endereços em um único PDF */
  reprintLocationsBatch: tenantProcedure
    .input(
      z.object({
        locationIds: z.array(z.number()).min(1).max(200),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const { effectiveTenantId, isGlobalAdmin } = ctx;

      // Buscar todos os endereços solicitados
      const locs = await db
        .select()
        .from(warehouseLocations)
        .where(sql`${warehouseLocations.id} IN (${sql.join(input.locationIds.map((id) => sql`${id}`), sql`, `)})`)
        .orderBy(warehouseLocations.code);

      if (locs.length === 0)
        throw new TRPCError({ code: "NOT_FOUND", message: "Nenhum endereço encontrado" });

      // Verificar acesso cross-tenant
      if (!isGlobalAdmin) {
        const forbidden = locs.find((l) => l.tenantId !== effectiveTenantId);
        if (forbidden)
          throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado a endereço de outro tenant" });
      }

      // Gerar PDF com uma etiqueta por página (10cm × 5cm)
      const barcodeBuffers = await Promise.all(
        locs.map((loc) =>
          bwipjs.toBuffer({
            bcid: "code128",
            text: loc.code,
            scale: 2,
            height: 10,
            includetext: true,
            textxalign: "center",
          })
        )
      );

      const doc = new PDFDocument({
        size: [283.46, 141.73], // 10cm × 5cm
        margins: { top: 8, bottom: 8, left: 8, right: 8 },
        autoFirstPage: false,
      });

      const chunks: Buffer[] = [];
      doc.on("data", (c: Buffer) => chunks.push(c));

      locs.forEach((loc, idx) => {
        doc.addPage();
        const details = [loc.aisle, loc.rack, loc.level].filter(Boolean).join(" / ");
        doc.fontSize(9).font("Helvetica-Bold").text(`Endereço: ${loc.code}`, 8, 10, { width: 267 });
        if (loc.zoneCode) doc.fontSize(8).font("Helvetica").text(`Zona: ${loc.zoneCode}`, 8, 22, { width: 267 });
        if (details) doc.fontSize(7).font("Helvetica").text(details, 8, 33, { width: 267 });
        doc.image(barcodeBuffers[idx], 42, 48, { width: 200, height: 50 });
      });

      doc.end();

      const pdfBuffer = await new Promise<Buffer>((resolve) => {
        doc.on("end", () => resolve(Buffer.concat(chunks)));
      });

      return {
        success: true,
        count: locs.length,
        pdf: `data:application/pdf;base64,${pdfBuffer.toString("base64")}`,
      };
    }),

  /** Reimprime etiqueta de endereço */
  reprintLocation: tenantProcedure
    .input(z.object({ locationId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const { effectiveTenantId, isGlobalAdmin } = ctx;

      const [loc] = await db
        .select()
        .from(warehouseLocations)
        .where(eq(warehouseLocations.id, input.locationId))
        .limit(1);

      if (!loc) throw new TRPCError({ code: "NOT_FOUND", message: "Endereço não encontrado" });
      if (!isGlobalAdmin && loc.tenantId !== effectiveTenantId)
        throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });

      const details = [loc.aisle, loc.rack, loc.level]
        .filter(Boolean)
        .join(" / ");

      const pdf = await buildLabelPdf(
        loc.code,
        `Endereço: ${loc.code}`,
        loc.zoneCode ? `Zona: ${loc.zoneCode}` : undefined,
        details || undefined
      );

      return { success: true, labelCode: loc.code, pdf };
    }),
});
