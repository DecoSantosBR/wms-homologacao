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
  pickingOrderItems,
  products,
  tenants,
  inventory,
  inventoryMovements,
  pickingReservations,
  warehouseLocations,
  stageCheckItems,
  stageChecks
} from "../drizzle/schema.js";
import { parseNFE } from "./nfeParser.js";
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
        invoiceNumber: z.string(),
        orderNumber: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Buscar NF pelo número
      const [invoice] = await db
        .select()
        .from(invoices)
        .where(eq(invoices.invoiceNumber, input.invoiceNumber))
        .limit(1);

      if (!invoice) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `NF ${input.invoiceNumber} não encontrada`,
        });
      }

      // Buscar pedido pelo número do cliente
      const [order] = await db
        .select()
        .from(pickingOrders)
        .where(eq(pickingOrders.customerOrderNumber, input.orderNumber))
        .limit(1);

      if (!order) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Pedido ${input.orderNumber} não encontrado`,
        });
      }

      // Verificar se NF já está vinculada
      if (invoice.pickingOrderId) {
        throw new TRPCError({ 
          code: "BAD_REQUEST", 
          message: "Nota Fiscal já está vinculada a outro pedido" 
        });
      }

      if (order.status !== "staged") {
        throw new TRPCError({ 
          code: "BAD_REQUEST", 
          message: "Pedido deve estar com status 'staged' para receber NF" 
        });
      }

      // Buscar itens do pedido com dados do produto
      const orderItems = await db
        .select({
          productId: pickingOrderItems.productId,
          sku: products.sku,
          supplierCode: products.supplierCode,
          requestedQuantity: pickingOrderItems.requestedQuantity,
          requestedUM: pickingOrderItems.requestedUM,
          unitsPerBox: products.unitsPerBox,
          batch: pickingOrderItems.batch,
        })
        .from(pickingOrderItems)
        .leftJoin(products, eq(pickingOrderItems.productId, products.id))
        .where(eq(pickingOrderItems.pickingOrderId, order.id));

      // Parse XML da NF para validar
      const nfeData = await parseNFE((invoice.xmlData as any).raw);

      // Validar SKUs
      const orderSkus = new Set(orderItems.map(item => item.sku || item.supplierCode));
      const nfeSkus = new Set(nfeData.produtos.map(p => p.codigo));
      
      const missingSkus = Array.from(nfeSkus).filter(sku => !orderSkus.has(sku));
      if (missingSkus.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `SKUs da NF não encontrados no pedido: ${missingSkus.join(", ")}`,
        });
      }

      // Validar quantidades e lotes
      for (const nfeProd of nfeData.produtos) {
        const orderItem = orderItems.find(item => 
          item.sku === nfeProd.codigo || item.supplierCode === nfeProd.codigo
        );

        if (!orderItem) continue;

        // Normalizar quantidade do pedido para unidades
        let expectedQuantity = orderItem.requestedQuantity;
        if (orderItem.requestedUM === 'box' && orderItem.unitsPerBox) {
          expectedQuantity = orderItem.requestedQuantity * orderItem.unitsPerBox;
        }

        // Validar quantidade (NF sempre vem em unidades)
        if (expectedQuantity !== nfeProd.quantidade) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Quantidade divergente para SKU ${nfeProd.codigo}: Pedido=${expectedQuantity} unidades, NF=${nfeProd.quantidade} unidades`,
          });
        }

        // Validar lote
        if (orderItem.batch && nfeProd.lote && orderItem.batch !== nfeProd.lote) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Lote divergente para SKU ${nfeProd.codigo}: Pedido=${orderItem.batch}, NF=${nfeProd.lote}`,
          });
        }
      }

      // Validar volumes (comparar com total esperado do pedido)
      // Por enquanto apenas log, pode adicionar validação se necessário
      console.log(`[Shipping] Volumes da NF: ${nfeData.volumes}`);

      // Vincular NF ao pedido
      await db
        .update(invoices)
        .set({
          pickingOrderId: order.id,
          status: "linked",
          linkedAt: new Date(),
        })
        .where(eq(invoices.id, invoice.id));

      // Atualizar status de expedição do pedido
      await db
        .update(pickingOrders)
        .set({
          shippingStatus: "invoice_linked",
        })
        .where(eq(pickingOrders.id, order.id));

      return { 
        success: true, 
        message: "Nota Fiscal vinculada ao pedido com sucesso" 
      };
    }),

  /**
   * Desvincular NF de Pedido
   */
  unlinkInvoice: protectedProcedure
    .input(
      z.object({
        invoiceNumber: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Buscar NF pelo número
      const [invoice] = await db
        .select()
        .from(invoices)
        .where(eq(invoices.invoiceNumber, input.invoiceNumber))
        .limit(1);

      if (!invoice) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `NF ${input.invoiceNumber} não encontrada`,
        });
      }

      if (!invoice.pickingOrderId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nota Fiscal não está vinculada a nenhum pedido",
        });
      }

      const orderId = invoice.pickingOrderId;

      // Desvincular NF do pedido
      await db
        .update(invoices)
        .set({
          pickingOrderId: null,
          status: "imported",
          linkedAt: null,
        })
        .where(eq(invoices.id, invoice.id));

      // Atualizar status de expedição do pedido para awaiting_invoice
      await db
        .update(pickingOrders)
        .set({
          shippingStatus: "awaiting_invoice",
        })
        .where(eq(pickingOrders.id, orderId));

      return {
        success: true,
        message: "Nota Fiscal desvinculada do pedido com sucesso",
      };
    }),

  /**
   * Excluir NF Importada
   */
  deleteInvoice: protectedProcedure
    .input(
      z.object({
        invoiceNumber: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Buscar NF pelo número
      const [invoice] = await db
        .select()
        .from(invoices)
        .where(eq(invoices.invoiceNumber, input.invoiceNumber))
        .limit(1);

      if (!invoice) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `NF ${input.invoiceNumber} não encontrada`,
        });
      }

      if (invoice.pickingOrderId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Não é possível excluir NF vinculada a um pedido. Desvincule primeiro.",
        });
      }

      if (invoice.status !== "imported") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Não é possível excluir NF com status '${invoice.status}'`,
        });
      }

      // Excluir NF
      await db
        .delete(invoices)
        .where(eq(invoices.id, invoice.id));

      return {
        success: true,
        message: "Nota Fiscal excluída com sucesso",
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

      // ===== BAIXA DE ESTOQUE =====
      // Para cada pedido do romaneio, executar baixa de estoque
      for (const orderItem of items) {
        const orderId = orderItem.pickingOrderId;

        // Buscar pedido para obter tenantId
        const [pickingOrder] = await db
          .select()
          .from(pickingOrders)
          .where(eq(pickingOrders.id, orderId))
          .limit(1);

        if (!pickingOrder) continue;

        // Buscar endereço de expedição do cliente
        const [tenant] = await db
          .select({ shippingAddress: tenants.shippingAddress })
          .from(tenants)
          .where(eq(tenants.id, pickingOrder.tenantId))
          .limit(1);

        let shippingLocation;

        // Se cliente não tem shippingAddress configurado, buscar automaticamente endereço EXP disponível
        if (!tenant || !tenant.shippingAddress) {
          const [autoShippingLocation] = await db
            .select()
            .from(warehouseLocations)
            .where(
              and(
                sql`${warehouseLocations.code} LIKE 'EXP%'`,
                eq(warehouseLocations.tenantId, pickingOrder.tenantId),
                eq(warehouseLocations.status, 'available')
              )
            )
            .limit(1);

          if (!autoShippingLocation) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: `Nenhum endereço de expedição disponível encontrado para o pedido ${pickingOrder.customerOrderNumber}`,
            });
          }

          shippingLocation = autoShippingLocation;
        } else {
          // Buscar endereço de expedição configurado no sistema
          const [configuredLocation] = await db
            .select()
            .from(warehouseLocations)
            .where(
              and(
                eq(warehouseLocations.code, tenant.shippingAddress),
                eq(warehouseLocations.tenantId, pickingOrder.tenantId)
              )
            )
            .limit(1);

          if (!configuredLocation) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: `Endereço de expedição ${tenant.shippingAddress} não encontrado no sistema`,
            });
          }

          shippingLocation = configuredLocation;
        }

        // Buscar itens conferidos no Stage para este pedido
        const [stageCheck] = await db
          .select()
          .from(stageChecks)
          .where(
            and(
              eq(stageChecks.pickingOrderId, orderId),
              eq(stageChecks.status, 'completed')
            )
          )
          .orderBy(desc(stageChecks.completedAt))
          .limit(1);

        if (!stageCheck) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Pedido ${pickingOrder.customerOrderNumber} não possui conferência Stage concluída`,
          });
        }

        // Buscar itens conferidos
        const checkedItems = await db
          .select()
          .from(stageCheckItems)
          .where(eq(stageCheckItems.stageCheckId, stageCheck.id));

        // Para cada item conferido, executar baixa de estoque do endereço EXP
        for (const item of checkedItems) {
          // Buscar estoque no endereço de expedição para este produto
          const expInventory = await db
            .select()
            .from(inventory)
            .where(
              and(
                eq(inventory.locationId, shippingLocation.id),
                eq(inventory.productId, item.productId),
                eq(inventory.tenantId, pickingOrder.tenantId)
              )
            );

          let remainingToShip = item.checkedQuantity;

          for (const inv of expInventory) {
            if (remainingToShip <= 0) break;

            const quantityToShip = Math.min(remainingToShip, inv.quantity);

            // Subtrair do estoque de expedição (baixa)
            const newQuantity = inv.quantity - quantityToShip;
            
            if (newQuantity > 0) {
              // Atualizar quantidade
              await db
                .update(inventory)
                .set({ quantity: newQuantity })
                .where(eq(inventory.id, inv.id));
            } else {
              // Remover registro se quantidade zerou
              await db
                .delete(inventory)
                .where(eq(inventory.id, inv.id));
            }

            // Registrar movimentação de baixa (saída)
            await db.insert(inventoryMovements).values({
              productId: inv.productId,
              batch: inv.batch,
              fromLocationId: shippingLocation.id,
              toLocationId: null, // Baixa de estoque (saída)
              quantity: quantityToShip,
              movementType: "picking",
              referenceType: "shipment_manifest",
              referenceId: input.manifestId,
              performedBy: ctx.user.id,
              notes: `Baixa de estoque ao finalizar romaneio ${manifest.manifestNumber} - Pedido ${pickingOrder.customerOrderNumber}`,
              tenantId: pickingOrder.tenantId,
            });

            remainingToShip -= quantityToShip;
          }

          // Verificar se conseguiu baixar toda a quantidade
          if (remainingToShip > 0) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Estoque insuficiente no endereço de expedição para o produto ${item.productSku}. Faltam ${remainingToShip} unidades.`,
            });
          }
        }
      }
      // ===== FIM DA BAIXA DE ESTOQUE =====

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

  // Gerar PDF do romaneio
  generateManifestPDF: protectedProcedure
    .input(z.object({ manifestId: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Buscar romaneio
      const [manifest] = await db
        .select()
        .from(shipmentManifests)
        .where(eq(shipmentManifests.id, input.manifestId))
        .limit(1);

      if (!manifest) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Romaneio não encontrado",
        });
      }

      // Buscar tenant (remetente)
      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, manifest.tenantId))
        .limit(1);

      // Buscar itens do romaneio com pedidos e NFs
      const items = await db
        .select({
          orderId: shipmentManifestItems.pickingOrderId,
          orderNumber: pickingOrders.customerOrderNumber,
          invoiceId: invoices.id,
          invoiceNumber: invoices.invoiceNumber,
          customerName: invoices.customerName,
          customerCity: invoices.customerCity,
          customerState: invoices.customerState,
          volumes: invoices.volumes,
          pesoB: invoices.pesoB,
          totalValue: invoices.totalValue,
        })
        .from(shipmentManifestItems)
        .innerJoin(pickingOrders, eq(shipmentManifestItems.pickingOrderId, pickingOrders.id))
        .leftJoin(invoices, eq(invoices.pickingOrderId, pickingOrders.id))
        .where(eq(shipmentManifestItems.manifestId, input.manifestId));

      // Retornar dados para geração de PDF
      return {
        manifest: {
          number: manifest.manifestNumber,
          createdAt: manifest.createdAt,
          carrierName: manifest.carrierName,
          totalOrders: manifest.totalOrders,
          totalInvoices: manifest.totalInvoices,
          totalVolumes: manifest.totalVolumes,
        },
        tenant: {
          name: tenant?.name || "N/A",
          cnpj: tenant?.cnpj || "N/A",
        },
        items: items.map(item => ({
          orderNumber: item.orderNumber,
          invoiceNumber: item.invoiceNumber || "N/A",
          customerName: item.customerName || "N/A",
          customerCity: item.customerCity || "",
          customerState: item.customerState || "",
          volumes: item.volumes || 0,
          weight: parseFloat(item.pesoB || "0")
        })),
      };
    }),
});
