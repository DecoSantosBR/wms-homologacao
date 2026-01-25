/**
 * Router para Módulo de Expedição
 * Gerencia Notas Fiscais, Romaneios e Expedição
 */

import { router, protectedProcedure } from "./_core/trpc.js";
import { getDb } from "./db.js";
import { 
  invoices, 
  shipmentManifests, 
  shipmentManifestItems,
  pickingOrders,
  tenants 
} from "../drizzle/schema.js";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, and, sql, desc } from "drizzle-orm";

export const shippingRouter = router({
  // ============================================================================
  // PEDIDOS - Fila de Expedição
  // ============================================================================
  
  /**
   * Listar pedidos prontos para expedição (status: staged)
   */
  listOrders: protectedProcedure
    .input(
      z.object({
        status: z.enum(["awaiting_invoice", "invoice_linked", "in_manifest", "shipped"]).optional(),
      }).optional()
    )
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const tenantId = ctx.user.role === "admin" ? null : ctx.user.tenantId;

      const conditions: any[] = [
        eq(pickingOrders.status, "staged"), // Apenas pedidos conferidos no Stage
      ];

      if (tenantId !== null) {
        conditions.push(eq(pickingOrders.tenantId, tenantId));
      }

      if (input?.status) {
        conditions.push(eq(pickingOrders.shippingStatus, input.status));
      }

      const orders = await db
        .select({
          id: pickingOrders.id,
          orderNumber: pickingOrders.orderNumber,
          customerOrderNumber: pickingOrders.customerOrderNumber,
          customerName: pickingOrders.customerName,
          deliveryAddress: pickingOrders.deliveryAddress,
          shippingStatus: pickingOrders.shippingStatus,
          createdAt: pickingOrders.createdAt,
        })
        .from(pickingOrders)
        .where(and(...conditions))
        .orderBy(desc(pickingOrders.createdAt));

      return orders;
    }),

  // ============================================================================
  // NOTAS FISCAIS
  // ============================================================================

  /**
   * Importar XML de Nota Fiscal
   */
  importInvoice: protectedProcedure
    .input(
      z.object({
        xmlContent: z.string(), // Conteúdo do XML
        invoiceNumber: z.string(),
        series: z.string(),
        invoiceKey: z.string(),
        customerId: z.number(),
        customerName: z.string(),
        volumes: z.number(),
        totalValue: z.string(),
        issueDate: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const tenantId = ctx.user.role === "admin" ? input.customerId : ctx.user.tenantId!;

      // Verificar se NF já foi importada
      const existing = await db
        .select()
        .from(invoices)
        .where(eq(invoices.invoiceKey, input.invoiceKey))
        .limit(1);

      if (existing.length > 0) {
        throw new TRPCError({ 
          code: "BAD_REQUEST", 
          message: "Nota Fiscal já foi importada anteriormente" 
        });
      }

      // Inserir NF
      const [result] = await db.insert(invoices).values({
        tenantId,
        invoiceNumber: input.invoiceNumber,
        series: input.series,
        invoiceKey: input.invoiceKey,
        customerId: input.customerId,
        customerName: input.customerName,
        xmlData: { raw: input.xmlContent }, // Armazenar XML completo
        volumes: input.volumes,
        totalValue: input.totalValue,
        issueDate: new Date(input.issueDate),
        status: "imported",
        importedBy: ctx.user.id,
      });

      return { 
        success: true, 
        invoiceId: Number(result.insertId),
        message: `Nota Fiscal ${input.invoiceNumber} importada com sucesso` 
      };
    }),

  /**
   * Listar Notas Fiscais
   */
  listInvoices: protectedProcedure
    .input(
      z.object({
        status: z.enum(["imported", "linked", "in_manifest", "shipped"]).optional(),
      }).optional()
    )
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const tenantId = ctx.user.role === "admin" ? null : ctx.user.tenantId;

      const conditions: any[] = [];

      if (tenantId !== null) {
        conditions.push(eq(invoices.tenantId, tenantId));
      }

      if (input?.status) {
        conditions.push(eq(invoices.status, input.status));
      }

      const result = await db
        .select({
          id: invoices.id,
          invoiceNumber: invoices.invoiceNumber,
          series: invoices.series,
          invoiceKey: invoices.invoiceKey,
          customerName: invoices.customerName,
          pickingOrderId: invoices.pickingOrderId,
          volumes: invoices.volumes,
          totalValue: invoices.totalValue,
          issueDate: invoices.issueDate,
          status: invoices.status,
          importedAt: invoices.importedAt,
          linkedAt: invoices.linkedAt,
          orderNumber: pickingOrders.customerOrderNumber,
        })
        .from(invoices)
        .leftJoin(pickingOrders, eq(invoices.pickingOrderId, pickingOrders.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(invoices.importedAt));

      return result;
    }),

  /**
   * Vincular NF a Pedido
   */
  linkInvoiceToOrder: protectedProcedure
    .input(
      z.object({
        invoiceId: z.number(),
        pickingOrderId: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Verificar se NF já está vinculada
      const [invoice] = await db
        .select()
        .from(invoices)
        .where(eq(invoices.id, input.invoiceId))
        .limit(1);

      if (!invoice) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Nota Fiscal não encontrada" });
      }

      if (invoice.pickingOrderId) {
        throw new TRPCError({ 
          code: "BAD_REQUEST", 
          message: "Nota Fiscal já está vinculada a outro pedido" 
        });
      }

      // Verificar se pedido existe e está no status correto
      const [order] = await db
        .select()
        .from(pickingOrders)
        .where(eq(pickingOrders.id, input.pickingOrderId))
        .limit(1);

      if (!order) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Pedido não encontrado" });
      }

      if (order.status !== "staged") {
        throw new TRPCError({ 
          code: "BAD_REQUEST", 
          message: "Pedido deve estar com status 'staged' para receber NF" 
        });
      }

      // Vincular NF ao pedido
      await db
        .update(invoices)
        .set({
          pickingOrderId: input.pickingOrderId,
          status: "linked",
          linkedAt: new Date(),
        })
        .where(eq(invoices.id, input.invoiceId));

      // Atualizar status de expedição do pedido
      await db
        .update(pickingOrders)
        .set({
          shippingStatus: "invoice_linked",
        })
        .where(eq(pickingOrders.id, input.pickingOrderId));

      return { 
        success: true, 
        message: "Nota Fiscal vinculada ao pedido com sucesso" 
      };
    }),

  // ============================================================================
  // ROMANEIOS
  // ============================================================================

  /**
   * Criar Romaneio
   */
  createManifest: protectedProcedure
    .input(
      z.object({
        carrierName: z.string(),
        orderIds: z.array(z.number()).min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Validar pedidos
      const orders = await db
        .select({
          id: pickingOrders.id,
          customerOrderNumber: pickingOrders.customerOrderNumber,
          shippingStatus: pickingOrders.shippingStatus,
          tenantId: pickingOrders.tenantId,
        })
        .from(pickingOrders)
        .where(
          sql`${pickingOrders.id} IN (${sql.join(input.orderIds.map(id => sql`${id}`), sql`, `)})`
        );

      if (orders.length !== input.orderIds.length) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Alguns pedidos não foram encontrados" });
      }

      // Verificar se todos os pedidos têm NF vinculada
      const ordersWithoutInvoice = orders.filter(o => o.shippingStatus !== "invoice_linked");
      if (ordersWithoutInvoice.length > 0) {
        throw new TRPCError({ 
          code: "BAD_REQUEST", 
          message: `Pedidos sem NF vinculada: ${ordersWithoutInvoice.map(o => o.customerOrderNumber).join(", ")}` 
        });
      }

      // Buscar NFs dos pedidos
      const invoicesList = await db
        .select()
        .from(invoices)
        .where(
          sql`${invoices.pickingOrderId} IN (${sql.join(input.orderIds.map(id => sql`${id}`), sql`, `)})`
        );

      const totalVolumes = invoicesList.reduce((sum, inv) => sum + (inv.volumes || 0), 0);

      // Usar tenantId do primeiro pedido (todos devem ser do mesmo cliente)
      const manifestTenantId = orders[0].tenantId;

      // Gerar número do romaneio
      const manifestNumber = `ROM-${Date.now()}`;

      // Criar romaneio
      const [manifest] = await db.insert(shipmentManifests).values({
        tenantId: manifestTenantId,
        manifestNumber,
        carrierName: input.carrierName,
        totalOrders: input.orderIds.length,
        totalInvoices: invoicesList.length,
        totalVolumes,
        status: "draft",
        createdBy: ctx.user.id,
      });

      const manifestId = Number(manifest.insertId);

      // Adicionar itens ao romaneio
      for (const orderId of input.orderIds) {
        const invoice = invoicesList.find(inv => inv.pickingOrderId === orderId);
        if (invoice) {
          await db.insert(shipmentManifestItems).values({
            manifestId,
            pickingOrderId: orderId,
            invoiceId: invoice.id,
            volumes: invoice.volumes,
          });
        }
      }

      // Atualizar status dos pedidos e NFs
      await db
        .update(pickingOrders)
        .set({ shippingStatus: "in_manifest" })
        .where(
          sql`${pickingOrders.id} IN (${sql.join(input.orderIds.map(id => sql`${id}`), sql`, `)})`
        );

      await db
        .update(invoices)
        .set({ status: "in_manifest" })
        .where(
          sql`${invoices.pickingOrderId} IN (${sql.join(input.orderIds.map(id => sql`${id}`), sql`, `)})`
        );

      return { 
        success: true, 
        manifestId,
        manifestNumber,
        message: `Romaneio ${manifestNumber} criado com ${input.orderIds.length} pedido(s)` 
      };
    }),

  /**
   * Listar Romaneios
   */
  listManifests: protectedProcedure
    .input(
      z.object({
        status: z.enum(["draft", "ready", "collected", "shipped"]).optional(),
      }).optional()
    )
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const tenantId = ctx.user.role === "admin" ? null : ctx.user.tenantId;

      const conditions: any[] = [];

      if (tenantId !== null) {
        conditions.push(eq(shipmentManifests.tenantId, tenantId));
      }

      if (input?.status) {
        conditions.push(eq(shipmentManifests.status, input.status));
      }

      const manifests = await db
        .select()
        .from(shipmentManifests)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(shipmentManifests.createdAt));

      return manifests;
    }),

  /**
   * Finalizar Expedição (Romaneio)
   */
  finalizeManifest: protectedProcedure
    .input(z.object({ manifestId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Buscar romaneio
      const [manifest] = await db
        .select()
        .from(shipmentManifests)
        .where(eq(shipmentManifests.id, input.manifestId))
        .limit(1);

      if (!manifest) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Romaneio não encontrado" });
      }

      // Buscar itens do romaneio
      const items = await db
        .select()
        .from(shipmentManifestItems)
        .where(eq(shipmentManifestItems.manifestId, input.manifestId));

      const orderIds = items.map(item => item.pickingOrderId);

      // Atualizar status do romaneio
      await db
        .update(shipmentManifests)
        .set({
          status: "shipped",
          shippedAt: new Date(),
        })
        .where(eq(shipmentManifests.id, input.manifestId));

      // Atualizar status dos pedidos
      await db
        .update(pickingOrders)
        .set({
          status: "shipped",
          shippingStatus: "shipped",
          shippedAt: new Date(),
        })
        .where(
          sql`${pickingOrders.id} IN (${sql.join(orderIds.map(id => sql`${id}`), sql`, `)})`
        );

      // Atualizar status das NFs
      await db
        .update(invoices)
        .set({ status: "shipped" })
        .where(
          sql`${invoices.pickingOrderId} IN (${sql.join(orderIds.map(id => sql`${id}`), sql`, `)})`
        );

      return { 
        success: true, 
        message: `Romaneio ${manifest.manifestNumber} expedido com sucesso` 
      };
    }),
});
