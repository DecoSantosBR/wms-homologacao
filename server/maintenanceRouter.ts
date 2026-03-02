/**
 * Router de Manutenção e Jobs Automáticos
 *
 * Endpoints para executar tarefas de manutenção do sistema,
 * como sincronização de reservas, limpeza de dados órfãos, etc.
 */

import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { syncInventoryReservations } from "./syncReservations";

export const maintenanceRouter = router({
  /**
   * Sincronizar reservas de estoque
   *
   * Recalcula reservedQuantity em todos os registros de estoque
   * baseado apenas em pedidos ativos. Corrige reservas órfãs.
   */
  syncReservations: protectedProcedure
    .mutation(async ({ ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new Error("Apenas administradores podem executar sincronização de reservas");
      }
      console.log(`[maintenanceRouter] Sincronização de reservas iniciada por ${ctx.user.name} (${ctx.user.id})`);
      const result = await syncInventoryReservations();
      console.log(`[maintenanceRouter] Sincronização concluída: ${result.correctionsApplied} correções aplicadas`);
      return {
        success: true,
        message: `Sincronização concluída. ${result.correctionsApplied} correção(ões) aplicada(s) em ${result.totalProcessed} registro(s).`,
        totalProcessed: result.totalProcessed,
        correctionsApplied: result.correctionsApplied,
        corrections: result.corrections,
      };
    }),

  /**
   * Obter estatísticas de reservas
   *
   * Retorna informações sobre reservas de estoque para monitoramento
   */
  getReservationStats: protectedProcedure
    .query(async () => {
      const { getDb } = await import("./db");
      const { inventory, pickingOrders } = await import("../drizzle/schema");
      const { sql } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [stats] = await db
        .select({
          totalInventoryRecords: sql<number>`COUNT(*)`,
          recordsWithReservation: sql<number>`SUM(CASE WHEN ${inventory.reservedQuantity} > 0 THEN 1 ELSE 0 END)`,
          totalReservedUnits: sql<number>`SUM(${inventory.reservedQuantity})`,
        })
        .from(inventory);

      const [orderStats] = await db
        .select({
          activePendingOrders: sql<number>`COUNT(DISTINCT CASE WHEN ${pickingOrders.status} = 'pending' THEN ${pickingOrders.id} END)`,
          activeInProgressOrders: sql<number>`COUNT(DISTINCT CASE WHEN ${pickingOrders.status} = 'in_progress' THEN ${pickingOrders.id} END)`,
          activeSeparatedOrders: sql<number>`COUNT(DISTINCT CASE WHEN ${pickingOrders.status} = 'separated' THEN ${pickingOrders.id} END)`,
          activeInWaveOrders: sql<number>`COUNT(DISTINCT CASE WHEN ${pickingOrders.status} = 'in_wave' THEN ${pickingOrders.id} END)`,
        })
        .from(pickingOrders)
        .where(sql`${pickingOrders.status} IN ('pending', 'in_progress', 'separated', 'in_wave')`);

      return {
        inventory: {
          totalRecords: stats.totalInventoryRecords,
          recordsWithReservation: stats.recordsWithReservation,
          totalReservedUnits: stats.totalReservedUnits,
        },
        orders: {
          pending: orderStats.activePendingOrders,
          inProgress: orderStats.activeInProgressOrders,
          separated: orderStats.activeSeparatedOrders,
          inWave: orderStats.activeInWaveOrders,
          total:
            orderStats.activePendingOrders +
            orderStats.activeInProgressOrders +
            orderStats.activeSeparatedOrders +
            orderStats.activeInWaveOrders,
        },
      };
    }),

  /**
   * Limpeza de registros órfãos de inventário
   *
   * Critérios de órfão:
   * 1. Zona NCG sem nonConformity correspondente (labelCode sem registro em nonConformities)
   * 2. Zona REC com quantity = 0 (resquício de tentativa falha de finish)
   * 3. locationId inexistente (endereço foi deletado)
   * 4. productId inexistente (produto foi deletado)
   *
   * dryRun = true  → apenas relatório, sem deletar
   * dryRun = false → executa a limpeza
   */
  cleanupOrphanInventory: protectedProcedure
    .input(
      z.object({
        dryRun: z.boolean().default(true),
        tenantId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new Error("Apenas administradores podem executar limpeza de inventário");
      }

      const { getDb } = await import("./db");
      const { inventory, nonConformities, warehouseLocations, products } = await import("../drizzle/schema");
      const { sql, and, eq, notInArray, inArray } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      type OrphanRecord = {
        id: number;
        reason: string;
        labelCode: string | null;
        uniqueCode: string | null;
        locationZone: string | null;
        tenantId: number | null;
        quantity: number;
        createdAt: Date;
      };

      const orphans: OrphanRecord[] = [];
      const tenantFilter = input.tenantId ? eq(inventory.tenantId, input.tenantId) : sql`1=1`;

      // ── Critério 1: NCG sem nonConformity correspondente ──────────────────
      const ncgItems = await db
        .select({
          id: inventory.id,
          labelCode: inventory.labelCode,
          uniqueCode: inventory.uniqueCode,
          locationZone: inventory.locationZone,
          tenantId: inventory.tenantId,
          quantity: inventory.quantity,
          createdAt: inventory.createdAt,
        })
        .from(inventory)
        .where(and(eq(inventory.locationZone, "NCG"), tenantFilter));

      for (const item of ncgItems) {
        if (!item.labelCode) {
          orphans.push({ ...item, reason: "NCG sem labelCode (registro incompleto de tentativa falha)" });
          continue;
        }
        // Normalizar: remover sufixo -NCG para buscar o labelCode original
        const originalLabelCode = item.labelCode.replace(/-NCG$/, "");
        const ncgRecord = await db
          .select({ id: nonConformities.id })
          .from(nonConformities)
          .where(eq(nonConformities.labelCode, originalLabelCode))
          .limit(1);
        if (ncgRecord.length === 0) {
          orphans.push({
            ...item,
            reason: "NCG sem nonConformity correspondente (tentativa falha de finish)",
          });
        }
      }

      // ── Critério 2: REC com quantity = 0 ──────────────────────────────────
      const zeroQtyItems = await db
        .select({
          id: inventory.id,
          labelCode: inventory.labelCode,
          uniqueCode: inventory.uniqueCode,
          locationZone: inventory.locationZone,
          tenantId: inventory.tenantId,
          quantity: inventory.quantity,
          createdAt: inventory.createdAt,
        })
        .from(inventory)
        .where(and(eq(inventory.locationZone, "REC"), eq(inventory.quantity, 0), tenantFilter));

      for (const item of zeroQtyItems) {
        orphans.push({ ...item, reason: "REC com quantity = 0 (resquício de operação incompleta)" });
      }

      // ── Critério 3: locationId inexistente ────────────────────────────────
      const allLocationIds = (
        await db.select({ id: warehouseLocations.id }).from(warehouseLocations)
      ).map((l) => l.id);

      if (allLocationIds.length > 0) {
        const invalidLocationItems = await db
          .select({
            id: inventory.id,
            labelCode: inventory.labelCode,
            uniqueCode: inventory.uniqueCode,
            locationZone: inventory.locationZone,
            tenantId: inventory.tenantId,
            quantity: inventory.quantity,
            createdAt: inventory.createdAt,
          })
          .from(inventory)
          .where(and(notInArray(inventory.locationId, allLocationIds), tenantFilter));

        for (const item of invalidLocationItems) {
          orphans.push({ ...item, reason: "locationId inexistente (endereço foi deletado)" });
        }
      }

      // ── Critério 4: productId inexistente ─────────────────────────────────
      const allProductIds = (
        await db.select({ id: products.id }).from(products)
      ).map((p) => p.id);

      if (allProductIds.length > 0) {
        const invalidProductItems = await db
          .select({
            id: inventory.id,
            labelCode: inventory.labelCode,
            uniqueCode: inventory.uniqueCode,
            locationZone: inventory.locationZone,
            tenantId: inventory.tenantId,
            quantity: inventory.quantity,
            createdAt: inventory.createdAt,
          })
          .from(inventory)
          .where(and(notInArray(inventory.productId, allProductIds), tenantFilter));

        for (const item of invalidProductItems) {
          orphans.push({ ...item, reason: "productId inexistente (produto foi deletado)" });
        }
      }

      // Deduplicar por id
      const uniqueOrphans = Array.from(new Map(orphans.map((o) => [o.id, o])).values());

      let deletedCount = 0;
      if (!input.dryRun && uniqueOrphans.length > 0) {
        const idsToDelete = uniqueOrphans.map((o) => o.id);
        await db.delete(inventory).where(inArray(inventory.id, idsToDelete));
        deletedCount = idsToDelete.length;
        console.log(
          `[maintenanceRouter] Limpeza de órfãos: ${deletedCount} registros removidos por ${ctx.user.name} (${ctx.user.id})`
        );
      }

      return {
        dryRun: input.dryRun,
        orphansFound: uniqueOrphans.length,
        deletedCount,
        orphans: uniqueOrphans.map((o) => ({
          id: o.id,
          reason: o.reason,
          labelCode: o.labelCode,
          uniqueCode: o.uniqueCode,
          locationZone: o.locationZone,
          tenantId: o.tenantId,
          quantity: o.quantity,
          createdAt: o.createdAt,
        })),
      };
    }),
});
