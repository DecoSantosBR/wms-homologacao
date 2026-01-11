import { router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { pickingWaves, pickingWaveItems, pickingOrders, inventory, products } from "../drizzle/schema";
import { eq, and, inArray, desc } from "drizzle-orm";
import { createWave, getWaveById } from "./waveLogic";
import { TRPCError } from "@trpc/server";

export const waveRouter = router({
  /**
   * Listar ondas de separação
   */
  list: protectedProcedure
    .input(z.object({
      status: z.enum(["pending", "picking", "completed", "cancelled"]).optional(),
      limit: z.number().min(1).max(500).default(100),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      let query = db
        .select()
        .from(pickingWaves)
        .orderBy(desc(pickingWaves.createdAt))
        .limit(input.limit);

      if (input.status) {
        query = query.where(eq(pickingWaves.status, input.status)) as any;
      }

      return await query;
    }),

  /**
   * Criar onda de separação consolidando múltiplos pedidos
   */
  create: protectedProcedure
    .input(z.object({
      orderIds: z.array(z.number()).min(1, "Selecione pelo menos um pedido"),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Usuário não autenticado" });
      }

      return await createWave({
        orderIds: input.orderIds,
        userId: ctx.user.id,
      });
    }),

  /**
   * Buscar detalhes de uma onda
   */
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return await getWaveById(input.id);
    }),

  /**
   * Buscar progresso de execução de uma onda
   * Usado pela interface de picking para exibir status em tempo real
   */
  getPickingProgress: protectedProcedure
    .input(z.object({ waveId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Buscar onda
      const [wave] = await db
        .select()
        .from(pickingWaves)
        .where(eq(pickingWaves.id, input.waveId))
        .limit(1);

      if (!wave) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Onda não encontrada" });
      }

      // Buscar itens da onda com progresso
      const items = await db
        .select()
        .from(pickingWaveItems)
        .where(eq(pickingWaveItems.waveId, input.waveId));

      // Calcular progresso
      const totalItems = items.length;
      const completedItems = items.filter(item => item.status === "picked").length;
      const totalQuantity = items.reduce((sum, item) => sum + item.totalQuantity, 0);
      const pickedQuantity = items.reduce((sum, item) => sum + item.pickedQuantity, 0);

      return {
        wave,
        items,
        progress: {
          totalItems,
          completedItems,
          totalQuantity,
          pickedQuantity,
          percentComplete: totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0,
        },
      };
    }),

  /**
   * Registrar item separado (escanear etiqueta)
   * Atualiza quantidade separada e status do item
   */
  registerPickedItem: protectedProcedure
    .input(z.object({
      waveId: z.number(),
      itemId: z.number(), // ID do pickingWaveItem
      scannedCode: z.string(), // Código escaneado (etiqueta)
      quantity: z.number().min(1),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // 1. Buscar item da onda
      const [waveItem] = await db
        .select({
          id: pickingWaveItems.id,
          waveId: pickingWaveItems.waveId,
          productId: pickingWaveItems.productId,
          productSku: pickingWaveItems.productSku,
          totalQuantity: pickingWaveItems.totalQuantity,
          pickedQuantity: pickingWaveItems.pickedQuantity,
          locationId: pickingWaveItems.locationId,
          batch: pickingWaveItems.batch,
          status: pickingWaveItems.status,
        })
        .from(pickingWaveItems)
        .where(eq(pickingWaveItems.id, input.itemId))
        .limit(1);

      if (!waveItem) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Item da onda não encontrado" });
      }

      // 2. Validar que o código escaneado corresponde ao produto
      // Buscar produto pelo SKU extraído da etiqueta
      const scannedSku = input.scannedCode.substring(0, 7); // Primeiros 7 caracteres = SKU

      if (scannedSku !== waveItem.productSku) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Produto incorreto! Esperado SKU: ${waveItem.productSku}, mas a etiqueta "${input.scannedCode}" pertence ao SKU: ${scannedSku}`,
        });
      }

      // 3. Validar quantidade
      const newPickedQuantity = waveItem.pickedQuantity + input.quantity;
      if (newPickedQuantity > waveItem.totalQuantity) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Quantidade excede o solicitado! Solicitado: ${waveItem.totalQuantity}, já separado: ${waveItem.pickedQuantity}, tentando adicionar: ${input.quantity}`,
        });
      }

      // 4. Atualizar item da onda
      const isComplete = newPickedQuantity === waveItem.totalQuantity;
      await db
        .update(pickingWaveItems)
        .set({
          pickedQuantity: newPickedQuantity,
          status: isComplete ? "picked" : "picking",
        })
        .where(eq(pickingWaveItems.id, input.itemId));

      // 5. Verificar se todos os itens da onda foram completados
      const allItems = await db
        .select()
        .from(pickingWaveItems)
        .where(eq(pickingWaveItems.waveId, input.waveId));

      const allCompleted = allItems.every(item => 
        item.id === input.itemId 
          ? isComplete 
          : item.status === "picked"
      );

      // 6. Atualizar status da onda se todos os itens foram completados
      if (allCompleted) {
        await db
          .update(pickingWaves)
          .set({ status: "completed" })
          .where(eq(pickingWaves.id, input.waveId));

        // Atualizar status dos pedidos associados
        await db
          .update(pickingOrders)
          .set({ status: "picked" })
          .where(eq(pickingOrders.waveId, input.waveId));
      } else {
        // Atualizar status da onda para "picking" se ainda não estiver
        await db
          .update(pickingWaves)
          .set({ status: "picking" })
          .where(
            and(
              eq(pickingWaves.id, input.waveId),
              eq(pickingWaves.status, "pending")
            )
          );
      }

      return {
        success: true,
        itemCompleted: isComplete,
        waveCompleted: allCompleted,
        pickedQuantity: newPickedQuantity,
        totalQuantity: waveItem.totalQuantity,
      };
    }),

  /**
   * Cancelar onda
   */
  cancel: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Atualizar status da onda
      await db
        .update(pickingWaves)
        .set({ status: "cancelled" })
        .where(eq(pickingWaves.id, input.id));

      // Liberar pedidos associados
      await db
        .update(pickingOrders)
        .set({ status: "pending", waveId: null })
        .where(eq(pickingOrders.waveId, input.id));

      return { success: true };
    }),
});
