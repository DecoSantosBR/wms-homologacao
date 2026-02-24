import { router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { pickingWaves, pickingWaveItems, pickingOrders, pickingOrderItems, inventory, products, labelAssociations, pickingReservations, warehouseLocations, labelReadings } from "../drizzle/schema";
import { eq, and, inArray, desc, sql } from "drizzle-orm";
import { createWave, getWaveById } from "./waveLogic";
import { generateWaveDocument } from "./waveDocument";
import { TRPCError } from "@trpc/server";

export const waveRouter = router({
  /**
   * Listar ondas de separação
   */
  list: protectedProcedure
    .input(z.object({
      status: z.enum(["pending", "picking", "picked", "staged", "completed", "cancelled"]).optional(),
      limit: z.number().min(1).max(500).default(100),
      tenantId: z.number().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const conditions = [];

      // Admins podem filtrar por tenantId; não-admins só veem as ondas do seu tenant
      if (ctx.user?.role === "admin") {
        if (input.tenantId) {
          conditions.push(eq(pickingWaves.tenantId, input.tenantId));
        }
      } else if (ctx.user?.tenantId) {
        conditions.push(eq(pickingWaves.tenantId, ctx.user.tenantId));
      }

      if (input.status) {
        conditions.push(eq(pickingWaves.status, input.status));
      }

      const query = db
        .select()
        .from(pickingWaves)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(pickingWaves.createdAt))
        .limit(input.limit);

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
      // JOIN direto com pickingOrders usando pickingOrderId
      const items = await db
        .select({
          id: pickingWaveItems.id,
          productSku: pickingWaveItems.productSku,
          productName: pickingWaveItems.productName,
          quantity: pickingWaveItems.totalQuantity,
          pickedQuantity: pickingWaveItems.pickedQuantity,
          status: pickingWaveItems.status,
          orderNumber: pickingOrders.orderNumber,
        })
        .from(pickingWaveItems)
        .leftJoin(pickingOrders, eq(pickingWaveItems.pickingOrderId, pickingOrders.id))
        .where(eq(pickingWaveItems.waveId, input.waveId))
        .orderBy(pickingWaveItems.productSku);

      // Calcular progresso
      const totalItems = items.length;
      const completedItems = items.filter(item => 
        item.status === "picked"
      ).length;
      const percentComplete = totalItems > 0 
        ? Math.round((completedItems / totalItems) * 100) 
        : 0;

      return {
        wave,
        items,
        progress: {
          totalItems,
          completedItems,
          percentComplete,
        },
      };
    }),

  /**
   * Registrar bipagem de um item durante a separação
   */
  registerItem: protectedProcedure
    .input(z.object({
      waveId: z.number(),
      itemId: z.number(),
      scannedCode: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // 1. Buscar item da onda
      const [waveItem] = await db
        .select()
        .from(pickingWaveItems)
        .where(eq(pickingWaveItems.id, input.itemId))
        .limit(1);

      if (!waveItem) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Item não encontrado" });
      }

      // 2. Buscar produto para validar código
      const [product] = await db
        .select()
        .from(products)
        .where(eq(products.sku, waveItem.productSku))
        .limit(1);

      if (!product) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Produto não encontrado" });
      }

      // 3. Validar código escaneado (simplificado - apenas SKU)
      const isValidSku = input.scannedCode === product.sku;

      if (!isValidSku) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Código inválido. Esperado: ${product.sku}`,
        });
      }

      // 4. Atualizar quantidade separada
      const newPickedQty = waveItem.pickedQuantity + 1;
      const isComplete = newPickedQty >= waveItem.totalQuantity;

      await db
        .update(pickingWaveItems)
        .set({
          pickedQuantity: newPickedQty,
          status: isComplete ? "picked" : "picking",
        })
        .where(eq(pickingWaveItems.id, input.itemId));

      // 5. Atualizar status da onda se necessário
      const [wave] = await db
        .select()
        .from(pickingWaves)
        .where(eq(pickingWaves.id, input.waveId))
        .limit(1);

      if (wave && wave.status === "pending") {
        await db
          .update(pickingWaves)
          .set({ status: "picking" })
          .where(eq(pickingWaves.id, input.waveId));
      }

      return {
        success: true,
        pickedQuantity: newPickedQty,
        totalQuantity: waveItem.totalQuantity,
        isComplete,
      };
    }),

  /**
   * Cancelar onda em andamento
   * Reverte status para cancelled e libera pedidos (mantém reservas)
   */
  cancel: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // 1. Buscar onda
      const [wave] = await db
        .select()
        .from(pickingWaves)
        .where(eq(pickingWaves.id, input.id))
        .limit(1);

      if (!wave) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Onda não encontrada" });
      }

      // 2. Validar status (apenas ondas pending ou picking podem ser canceladas)
      if (wave.status !== "pending" && wave.status !== "picking") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Apenas ondas pendentes ou em andamento podem ser canceladas"
        });
      }

      // 3. Verificar permissão (apenas admin ou gerente pode cancelar)
      if (ctx.user?.role !== "admin" && ctx.user?.role !== "manager") {
        throw new TRPCError({ 
          code: "FORBIDDEN", 
          message: "Apenas administradores ou gerentes podem cancelar ondas" 
        });
      }

      // 4. Zerar quantidades separadas nos waveItems
      await db
        .update(pickingWaveItems)
        .set({ 
          pickedQuantity: 0,
          status: "pending"
        })
        .where(eq(pickingWaveItems.waveId, input.id));

      // 5. Cancelar onda
      await db
        .update(pickingWaves)
        .set({ 
          status: "cancelled",
          updatedAt: new Date()
        })
        .where(eq(pickingWaves.id, input.id));

      // 6. Liberar pedidos (voltar para pending, mantendo reservas)
      await db
        .update(pickingOrders)
        .set({ 
          status: "pending",
          waveId: null
        })
        .where(eq(pickingOrders.waveId, input.id));

      console.info(
        `[WAVE] Onda ${wave.waveNumber} (ID: ${wave.id}) cancelada por usuário ${ctx.user.id}. ` +
        `Pedidos liberados e reservas mantidas.`
      );

      return { 
        success: true, 
        message: `Onda ${wave.waveNumber} cancelada com sucesso. Pedidos voltaram para pending.`
      };
    }),

  /**
   * Excluir onda separada (completed)
   * Reverte separação, libera estoque reservado e cancela onda
   */
  deleteCompleted: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // 1. Buscar onda
      const [wave] = await db
        .select()
        .from(pickingWaves)
        .where(eq(pickingWaves.id, input.id))
        .limit(1);

      if (!wave) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Onda não encontrada" });
      }

      if (wave.status !== "completed") {
        throw new TRPCError({ 
          code: "BAD_REQUEST", 
          message: "Apenas ondas separadas (completed) podem ser excluídas. Use cancelar para ondas pendentes." 
        });
      }

      // 2. Zerar quantidades separadas nos waveItems
      await db
        .update(pickingWaveItems)
        .set({ 
          pickedQuantity: 0,
          status: "pending"
        })
        .where(eq(pickingWaveItems.waveId, input.id));

      // 3. Cancelar onda
      await db
        .update(pickingWaves)
        .set({ status: "cancelled" })
        .where(eq(pickingWaves.id, input.id));

      // 4. Liberar pedidos (voltar para pending, mantendo reservas)
      await db
        .update(pickingOrders)
        .set({ 
          status: "pending",
          waveId: null
        })
        .where(eq(pickingOrders.waveId, input.id));

      return { 
        success: true, 
        message: `Onda ${wave.waveNumber} cancelada com sucesso. Pedidos voltaram para pending com reservas mantidas.`
      };
    }),

  /**
   * Editar quantidades separadas de uma onda completed
   * Permite ajustar quantidades para corrigir erros de separação
   */
  editCompleted: protectedProcedure
    .input(z.object({ 
      waveId: z.number(),
      items: z.array(z.object({
        waveItemId: z.number(),
        newPickedQuantity: z.number().min(0),
      }))
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // 1. Buscar onda
      const [wave] = await db
        .select()
        .from(pickingWaves)
        .where(eq(pickingWaves.id, input.waveId))
        .limit(1);

      if (!wave) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Onda não encontrada" });
      }

      if (wave.status !== "completed") {
        throw new TRPCError({ 
          code: "BAD_REQUEST", 
          message: "Apenas ondas separadas (completed) podem ser editadas" 
        });
      }

      // 2. Atualizar quantidades dos itens
      for (const item of input.items) {
        const [waveItem] = await db
          .select()
          .from(pickingWaveItems)
          .where(eq(pickingWaveItems.id, item.waveItemId))
          .limit(1);

        if (!waveItem) {
          throw new TRPCError({ 
            code: "NOT_FOUND", 
            message: `Item ${item.waveItemId} não encontrado` 
          });
        }

        // Determinar novo status baseado na quantidade
        let newStatus: "pending" | "picking" | "picked" = "pending";
        if (item.newPickedQuantity === 0) {
          newStatus = "pending";
        } else if (item.newPickedQuantity < waveItem.totalQuantity) {
          newStatus = "picking";
        } else {
          newStatus = "picked";
        }

        await db
          .update(pickingWaveItems)
          .set({ 
            pickedQuantity: item.newPickedQuantity,
            status: newStatus
          })
          .where(eq(pickingWaveItems.id, item.waveItemId));
      }

      return { 
        success: true, 
        message: `Quantidades da onda ${wave.waveNumber} atualizadas com sucesso`
      };
    }),

  /**
   * Excluir onda (apenas ondas pendentes ou canceladas)
   */
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Verificar se a onda existe e seu status
      const [wave] = await db
        .select()
        .from(pickingWaves)
        .where(eq(pickingWaves.id, input.id))
        .limit(1);

      if (!wave) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Onda não encontrada" });
      }

      // Apenas ondas pendentes ou canceladas podem ser excluídas
      if (wave.status !== "pending" && wave.status !== "cancelled") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Apenas ondas pendentes ou canceladas podem ser excluídas"
        });
      }

      // Verificar permissão (apenas admin pode excluir)
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Apenas administradores podem excluir ondas" });
      }

      // Nota: NÃO liberamos as reservas de estoque aqui porque:
      // - As reservas foram feitas na criação dos pedidos
      // - Os pedidos ainda existem (apenas voltam para "pending")
      // - As reservas só devem ser liberadas quando os pedidos forem excluídos/cancelados

      // Liberar pedidos associados (voltar para pending)
      await db
        .update(pickingOrders)
        .set({ status: "pending", waveId: null })
        .where(eq(pickingOrders.waveId, input.id));

      // Excluir itens da onda
      await db
        .delete(pickingWaveItems)
        .where(eq(pickingWaveItems.waveId, input.id));

      // Excluir onda
      await db
        .delete(pickingWaves)
        .where(eq(pickingWaves.id, input.id));

      return { success: true };
    }),

  /**
   * Gerar documento PDF da onda de separação
   */
  generateDocument: protectedProcedure
    .input(z.object({
      id: z.number(),
    }))
    .mutation(async ({ input }) => {
      const pdfBuffer = await generateWaveDocument(input.id);
      
      // Retornar como base64 para o frontend
      return {
        pdf: pdfBuffer.toString('base64'),
        filename: `onda-${input.id}.pdf`,
      };
    }),

  /**
   * Finalizar onda de separação
   * Verifica se todos os itens foram separados e atualiza status da onda e pedidos
   */
  completeWave: protectedProcedure
    .input(z.object({
      waveId: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // 1. Buscar onda
      const [wave] = await db
        .select()
        .from(pickingWaves)
        .where(eq(pickingWaves.id, input.waveId))
        .limit(1);

      if (!wave) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Onda não encontrada" });
      }

      // 2. Buscar itens da onda
      const items = await db
        .select()
        .from(pickingWaveItems)
        .where(eq(pickingWaveItems.waveId, input.waveId));

      // 3. Verificar se há itens pendentes
      const pendingItems = items.filter(item => 
        item.status !== "picked"
      );

      if (pendingItems.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Ainda há ${pendingItems.length} item(ns) pendente(s) de separação`
        });
      }

      // 4. Verificar se há divergências (quantidade parcial)
      const partialItems = items.filter(item => 
        item.pickedQuantity > 0 && item.pickedQuantity < item.totalQuantity
      );
      const hasDivergences = partialItems.length > 0;

      // 5. Atualizar status da onda
      await db
        .update(pickingWaves)
        .set({ 
          status: "completed",
          pickedAt: new Date(),
        })
        .where(eq(pickingWaves.id, input.waveId));

      // 6. Atualizar status dos pedidos
      await db
        .update(pickingOrders)
        .set({ status: "picked" })
        .where(eq(pickingOrders.waveId, input.waveId));

      // 7. Atualizar quantidades separadas nos itens dos pedidos
      // CORREÇÃO: Agrupar por pedido+produto antes de atualizar para somar lotes corretamente
      const groupedByOrderProduct = items.reduce((acc, waveItem) => {
        const key = `${waveItem.pickingOrderId}-${waveItem.productId}`;
        if (!acc[key]) {
          acc[key] = {
            pickingOrderId: waveItem.pickingOrderId,
            productId: waveItem.productId,
            totalPicked: 0,
            totalRequested: waveItem.totalQuantity, // Será sobrescrito se houver múltiplos lotes
          };
        }
        acc[key].totalPicked += waveItem.pickedQuantity;
        acc[key].totalRequested += waveItem.totalQuantity;
        return acc;
      }, {} as Record<string, { pickingOrderId: number; productId: number; totalPicked: number; totalRequested: number }>);

      for (const group of Object.values(groupedByOrderProduct)) {
        const isPartial = group.totalPicked < group.totalRequested;
        await db
          .update(pickingOrderItems)
          .set({ 
            pickedQuantity: group.totalPicked, // ✅ Soma de todos os lotes
            status: isPartial ? "pending" : "picked"
          })
          .where(
            and(
              eq(pickingOrderItems.pickingOrderId, group.pickingOrderId),
              eq(pickingOrderItems.productId, group.productId)
            )
          );
      }

      const message = hasDivergences
        ? `Onda ${wave.waveNumber} finalizada com ${partialItems.length} divergência(s). Revise os itens com falta.`
        : `Onda ${wave.waveNumber} finalizada com sucesso!`;

      return {
        success: true,
        message,
        hasDivergences,
        divergenceCount: partialItems.length,
      };
    }),
});
