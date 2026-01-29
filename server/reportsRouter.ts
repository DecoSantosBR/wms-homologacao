import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc.js";
import { getDb } from "./db.js";
import { 
  inventory, products, tenants, warehouseLocations, pickingOrders, 
  pickingOrderItems, shipmentManifests, users, inventoryMovements,
  reportLogs, reportFavorites, auditLogs
} from "../drizzle/schema.js";
import { eq, and, gte, lte, desc, asc, sql, or } from "drizzle-orm";

/**
 * Helper: Registra log de geração de relatório
 */
async function logReportGeneration(
  db: any,
  userId: number,
  reportType: string,
  filters: Record<string, any>
) {
  try {
    await db.insert(reportLogs).values({
      userId,
      reportType,
      filters: JSON.stringify(filters),
      generatedAt: new Date(),
    });
  } catch (error) {
    console.error('Erro ao registrar log de relatório:', error);
    // Não falhar a operação se log falhar
  }
}

/**
 * Router de Relatórios
 * 
 * Implementa relatórios gerenciais para o WMS:
 * - Estoque (6 relatórios)
 * - Operacionais (5 relatórios)
 * - Expedição (4 relatórios)
 * - Auditoria (3 relatórios)
 */
export const reportsRouter = router({
  /**
   * ========================================
   * RELATÓRIOS DE ESTOQUE
   * ========================================
   */

  /**
   * 1. Posição de Estoque
   * Visão detalhada do estoque por produto, lote, endereço e cliente
   */
  stockPosition: protectedProcedure
    .input(z.object({
      tenantId: z.number().optional(),
      productId: z.number().optional(),
      batchNumber: z.string().optional(),
      expiryDateStart: z.string().optional(),
      expiryDateEnd: z.string().optional(),
      page: z.number().default(1),
      pageSize: z.number().default(50),
    }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const { tenantId, productId, batchNumber, expiryDateStart, expiryDateEnd, page, pageSize } = input;
      const effectiveTenantId = ctx.user.role === 'admin' ? tenantId : ctx.user.tenantId;
      const conditions = [];
      if (effectiveTenantId) conditions.push(eq(inventory.tenantId, effectiveTenantId));
      if (productId) conditions.push(eq(inventory.productId, productId));
      if (batchNumber) conditions.push(eq(inventory.batch, batchNumber));
      if (expiryDateStart) conditions.push(gte(inventory.expiryDate, new Date(expiryDateStart)));
      if (expiryDateEnd) conditions.push(lte(inventory.expiryDate, new Date(expiryDateEnd)));
      
      const offset = (page - 1) * pageSize;
      
      const results = await db
        .select({
          id: inventory.id,
          productCode: products.sku,
          productName: products.description,
          batchNumber: inventory.batch,
          expiryDate: inventory.expiryDate,
          quantity: inventory.quantity,
          reserved: inventory.reservedQuantity,
          available: sql<number>`${inventory.quantity} - ${inventory.reservedQuantity}`,
          locationCode: warehouseLocations.code,
          status: inventory.status,
          tenantName: tenants.name,
        })
        .from(inventory)
        .leftJoin(products, eq(inventory.productId, products.id))
        .leftJoin(warehouseLocations, eq(inventory.locationId, warehouseLocations.id))
        .leftJoin(tenants, eq(inventory.tenantId, tenants.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(asc(warehouseLocations.code), asc(products.sku))
        .limit(pageSize)
        .offset(offset);
      
      const [{ total }] = await db
        .select({ total: sql<number>`COUNT(*)` })
        .from(inventory)
        .leftJoin(products, eq(inventory.productId, products.id))
        .leftJoin(warehouseLocations, eq(inventory.locationId, warehouseLocations.id))
        .leftJoin(tenants, eq(inventory.tenantId, tenants.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined);
      
      return { data: results, total, page, pageSize };
    }),

  /**
   * 2. Estoque por Cliente
   * Totalização de estoque agrupado por cliente
   */
  stockByTenant: protectedProcedure
    .input(z.object({
      tenantId: z.number().optional(),
      page: z.number().default(1),
      pageSize: z.number().default(50),
    }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const { tenantId, page, pageSize } = input;
      const effectiveTenantId = ctx.user.role === 'admin' ? tenantId : ctx.user.tenantId;
      const conditions = [];
      if (effectiveTenantId) conditions.push(eq(inventory.tenantId, effectiveTenantId));
      
      const offset = (page - 1) * pageSize;
      
      const results = await db
        .select({
          tenantId: inventory.tenantId,
          tenantName: tenants.name,
          totalQuantity: sql<number>`SUM(${inventory.quantity})`,
          totalReserved: sql<number>`SUM(${inventory.reservedQuantity})`,
          totalAvailable: sql<number>`SUM(${inventory.quantity} - ${inventory.reservedQuantity})`,
          productCount: sql<number>`COUNT(DISTINCT ${inventory.productId})`,
          locationCount: sql<number>`COUNT(DISTINCT ${inventory.locationId})`,
        })
        .from(inventory)
        .leftJoin(tenants, eq(inventory.tenantId, tenants.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .groupBy(inventory.tenantId, tenants.name)
        .orderBy(desc(sql`SUM(${inventory.quantity})`))
        .limit(pageSize)
        .offset(offset);
      
      return { data: results };
    }),

  /**
   * 3. Estoque por Endereço
   * Ocupação e utilização de endereços de armazenagem
   */
  stockByLocation: protectedProcedure
    .input(z.object({
      tenantId: z.number().optional(),
      locationType: z.enum(['whole', 'fraction']).optional(),
      page: z.number().default(1),
      pageSize: z.number().default(50),
    }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const { tenantId, locationType, page, pageSize } = input;
      const effectiveTenantId = ctx.user.role === 'admin' ? tenantId : ctx.user.tenantId;
      const conditions = [];
      if (effectiveTenantId) conditions.push(eq(inventory.tenantId, effectiveTenantId));
      if (locationType) conditions.push(eq(warehouseLocations.locationType, locationType));
      
      const offset = (page - 1) * pageSize;
      
      const results = await db
        .select({
          locationId: inventory.locationId,
          locationCode: warehouseLocations.code,
          locationType: warehouseLocations.locationType,
          totalQuantity: sql<number>`SUM(${inventory.quantity})`,
          totalReserved: sql<number>`SUM(${inventory.reservedQuantity})`,
          totalAvailable: sql<number>`SUM(${inventory.quantity} - ${inventory.reservedQuantity})`,
          productCount: sql<number>`COUNT(DISTINCT ${inventory.productId})`,
          tenantCount: sql<number>`COUNT(DISTINCT ${inventory.tenantId})`,
        })
        .from(inventory)
        .leftJoin(warehouseLocations, eq(inventory.locationId, warehouseLocations.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .groupBy(inventory.locationId, warehouseLocations.code, warehouseLocations.locationType)
        .orderBy(asc(warehouseLocations.code))
        .limit(pageSize)
        .offset(offset);
      
      return { data: results };
    }),

  /**
   * 4. Produtos Próximos ao Vencimento
   * Alerta de produtos com validade próxima (FEFO)
   */
  expiringProducts: protectedProcedure
    .input(z.object({
      tenantId: z.number().optional(),
      daysUntilExpiry: z.number().default(90),
      page: z.number().default(1),
      pageSize: z.number().default(50),
    }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const { tenantId, daysUntilExpiry, page, pageSize } = input;
      const effectiveTenantId = ctx.user.role === 'admin' ? tenantId : ctx.user.tenantId;
      
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + daysUntilExpiry);
      
      const conditions = [
        lte(inventory.expiryDate, futureDate),
      ];
      if (effectiveTenantId) conditions.push(eq(inventory.tenantId, effectiveTenantId));
      
      const offset = (page - 1) * pageSize;
      
      const results = await db
        .select({
          productCode: products.sku,
          productName: products.description,
          batchNumber: inventory.batch,
          expiryDate: inventory.expiryDate,
          daysUntilExpiry: sql<number>`DATEDIFF(${inventory.expiryDate}, NOW())`,
          totalQuantity: sql<number>`SUM(${inventory.quantity})`,
          totalReserved: sql<number>`SUM(${inventory.reservedQuantity})`,
          totalAvailable: sql<number>`SUM(${inventory.quantity} - ${inventory.reservedQuantity})`,
          locationCount: sql<number>`COUNT(DISTINCT ${inventory.locationId})`,
          tenantName: tenants.name,
        })
        .from(inventory)
        .leftJoin(products, eq(inventory.productId, products.id))
        .leftJoin(tenants, eq(inventory.tenantId, tenants.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .groupBy(inventory.productId, products.sku, products.description, inventory.batch, inventory.expiryDate, tenants.name)
        .orderBy(asc(inventory.expiryDate))
        .limit(pageSize)
        .offset(offset);
      
      return { data: results };
    }),

  /**
   * 5. Disponibilidade de Produtos
   * Análise de disponibilidade vs reservas
   */
  productAvailability: protectedProcedure
    .input(z.object({
      tenantId: z.number().optional(),
      productId: z.number().optional(),
      page: z.number().default(1),
      pageSize: z.number().default(50),
    }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const { tenantId, productId, page, pageSize } = input;
      const effectiveTenantId = ctx.user.role === 'admin' ? tenantId : ctx.user.tenantId;
      const conditions = [];
      if (effectiveTenantId) conditions.push(eq(inventory.tenantId, effectiveTenantId));
      if (productId) conditions.push(eq(inventory.productId, productId));
      
      const offset = (page - 1) * pageSize;
      
      const results = await db
        .select({
          productCode: products.sku,
          productName: products.description,
          totalQuantity: sql<number>`SUM(${inventory.quantity})`,
          totalReserved: sql<number>`SUM(${inventory.reservedQuantity})`,
          totalAvailable: sql<number>`SUM(${inventory.quantity} - ${inventory.reservedQuantity})`,
          blockedQuantity: sql<number>`SUM(CASE WHEN ${inventory.status} = 'blocked' THEN ${inventory.quantity} ELSE 0 END)`,
          availablePercentage: sql<number>`ROUND((SUM(${inventory.quantity} - ${inventory.reservedQuantity}) / NULLIF(SUM(${inventory.quantity}), 0)) * 100, 2)`,
          tenantName: tenants.name,
        })
        .from(inventory)
        .leftJoin(products, eq(inventory.productId, products.id))
        .leftJoin(tenants, eq(inventory.tenantId, tenants.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .groupBy(inventory.productId, products.sku, products.description, tenants.name)
        .orderBy(desc(sql`SUM(${inventory.quantity})`))
        .limit(pageSize)
        .offset(offset);
      
      return { data: results };
    }),

  /**
   * 6. Movimentações de Estoque
   * Histórico detalhado de movimentações
   */
  inventoryMovements: protectedProcedure
    .input(z.object({
      tenantId: z.number().optional(),
      productId: z.number().optional(),
      movementType: z.enum(['receiving', 'put_away', 'picking', 'transfer', 'adjustment', 'return', 'disposal', 'quality']).optional(),
      startDate: z.string(),
      endDate: z.string(),
      userId: z.number().optional(),
      page: z.number().default(1),
      pageSize: z.number().default(50),
    }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const { tenantId, productId, movementType, startDate, endDate, userId, page, pageSize } = input;
      const effectiveTenantId = ctx.user.role === 'admin' ? tenantId : ctx.user.tenantId;
      
      const conditions = [
        gte(inventoryMovements.createdAt, new Date(startDate)),
        lte(inventoryMovements.createdAt, new Date(endDate)),
      ];
      if (effectiveTenantId) conditions.push(eq(inventoryMovements.tenantId, effectiveTenantId));
      if (productId) conditions.push(eq(inventoryMovements.productId, productId));
      if (movementType) conditions.push(eq(inventoryMovements.movementType, movementType));
      if (userId) conditions.push(eq(inventoryMovements.performedBy, userId));
      
      const offset = (page - 1) * pageSize;
      
      const results = await db
        .select({
          id: inventoryMovements.id,
          movementType: inventoryMovements.movementType,
          productCode: products.sku,
          productName: products.description,
          quantity: inventoryMovements.quantity,
          fromLocation: sql<string>`fromLoc.code`,
          toLocation: sql<string>`toLoc.code`,
          notes: inventoryMovements.notes,
          performedBy: users.name,
          createdAt: inventoryMovements.createdAt,
        })
        .from(inventoryMovements)
        .leftJoin(products, eq(inventoryMovements.productId, products.id))
        .leftJoin(sql`${warehouseLocations} AS fromLoc`, sql`${inventoryMovements.fromLocationId} = fromLoc.id`)
        .leftJoin(sql`${warehouseLocations} AS toLoc`, sql`${inventoryMovements.toLocationId} = toLoc.id`)
        .leftJoin(users, eq(inventoryMovements.performedBy, users.id))
        .where(and(...conditions))
        .orderBy(desc(inventoryMovements.createdAt))
        .limit(pageSize)
        .offset(offset);
      
      return { data: results };
    }),

  /**
   * ========================================
   * UTILITÁRIOS
   * ========================================
   */

  /**
   * Salvar filtros favoritos
   */
  saveFavorite: protectedProcedure
    .input(z.object({
      reportType: z.string(),
      favoriteName: z.string(),
      filters: z.record(z.string(), z.any()),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const result = await db.insert(reportFavorites).values({
        userId: ctx.user.id,
        reportType: input.reportType,
        favoriteName: input.favoriteName,
        filters: JSON.stringify(input.filters),
      });
      
      return { success: true, id: result[0].insertId };
    }),

  /**
   * Listar filtros favoritos do usuário
   */
  listFavorites: protectedProcedure
    .input(z.object({
      reportType: z.string().optional(),
    }).optional())
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const conditions = [eq(reportFavorites.userId, ctx.user.id)];
      if (input?.reportType) conditions.push(eq(reportFavorites.reportType, input.reportType));
      
      const results = await db
        .select()
        .from(reportFavorites)
        .where(and(...conditions))
        .orderBy(desc(reportFavorites.createdAt));
      
      return results.map(r => ({
        ...r,
        filters: JSON.parse(r.filters as string),
      }));
    }),

  /**
   * Deletar favorito
   */
  deleteFavorite: protectedProcedure
    .input(z.object({
      id: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      await db
        .delete(reportFavorites)
        .where(and(
          eq(reportFavorites.id, input.id),
          eq(reportFavorites.userId, ctx.user.id)
        ));
      
      return { success: true };
    }),

  /**
   * Registrar geração de relatório (para auditoria)
   */
  logReportGeneration: protectedProcedure
    .input(z.object({
      reportType: z.string(),
      reportCategory: z.enum(['stock', 'operational', 'shipping', 'audit']),
      filters: z.record(z.string(), z.any()),
      exportFormat: z.enum(['screen', 'excel', 'pdf', 'csv']),
      recordCount: z.number(),
      executionTime: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      await db.insert(reportLogs).values({
        tenantId: ctx.user.tenantId ?? null,
        userId: ctx.user.id,
        reportType: input.reportType,
        reportCategory: input.reportCategory,
        filters: JSON.stringify(input.filters),
        exportFormat: input.exportFormat,
        recordCount: input.recordCount,
        executionTime: input.executionTime,
      });
      
      return { success: true };
    }),
});
