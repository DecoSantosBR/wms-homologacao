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
      // Apenas admins podem executar
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
      const { inventory, pickingOrders, pickingOrderItems, products } = await import("../drizzle/schema");
      const { sql } = await import("drizzle-orm");

      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Total de registros com reserva
      const [stats] = await db
        .select({
          totalInventoryRecords: sql<number>`COUNT(*)`,
          recordsWithReservation: sql<number>`SUM(CASE WHEN ${inventory.reservedQuantity} > 0 THEN 1 ELSE 0 END)`,
          totalReservedUnits: sql<number>`SUM(${inventory.reservedQuantity})`,
        })
        .from(inventory);

      // Pedidos ativos que geram reservas
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
          total: orderStats.activePendingOrders + orderStats.activeInProgressOrders + 
                 orderStats.activeSeparatedOrders + orderStats.activeInWaveOrders,
        },
      };
    }),
});
