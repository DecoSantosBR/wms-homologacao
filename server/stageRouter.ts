import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import {
  getOrderForStage,
  startStageCheck,
  recordStageItem,
  completeStageCheck,
  getActiveStageCheck,
  getStageCheckHistory,
} from "./stage";

/**
 * Router para o módulo de Stage (Conferência de Expedição)
 * Permite conferência cega de pedidos antes da expedição
 */
export const stageRouter = {
  /**
   * Busca pedido por customerOrderNumber para iniciar conferência
   * Apenas pedidos com status 'completed' podem ser conferidos
   */
  getOrderForStage: protectedProcedure
    .input(z.object({
      customerOrderNumber: z.string(),
    }))
    .query(async ({ input, ctx }) => {
      return await getOrderForStage(input.customerOrderNumber, ctx.user.tenantId);
    }),

  /**
   * Inicia conferência de Stage para um pedido
   * Cria registro de stageCheck e retorna itens (sem quantidades esperadas)
   */
  startStageCheck: protectedProcedure
    .input(z.object({
      pickingOrderId: z.number(),
      customerOrderNumber: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      return await startStageCheck({
        pickingOrderId: input.pickingOrderId,
        customerOrderNumber: input.customerOrderNumber,
        operatorId: ctx.user.id,
        tenantId: ctx.user.tenantId,
      });
    }),

  /**
   * Registra item conferido (produto bipado + quantidade informada)
   */
  recordStageItem: protectedProcedure
    .input(z.object({
      stageCheckId: z.number(),
      labelCode: z.string(),
      quantity: z.number().positive(),
    }))
    .mutation(async ({ input, ctx }) => {
      return await recordStageItem({
        stageCheckId: input.stageCheckId,
        labelCode: input.labelCode,
        quantity: input.quantity,
        tenantId: ctx.user.tenantId,
      });
    }),

  /**
   * Finaliza conferência de Stage
   * Valida divergências, baixa estoque e atualiza status do pedido
   */
  completeStageCheck: protectedProcedure
    .input(z.object({
      stageCheckId: z.number(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      return await completeStageCheck({
        stageCheckId: input.stageCheckId,
        notes: input.notes,
        tenantId: ctx.user.tenantId,
      });
    }),

  /**
   * Busca conferência ativa (in_progress) do operador
   */
  getActiveStageCheck: protectedProcedure
    .query(async ({ ctx }) => {
      return await getActiveStageCheck(ctx.user.id, ctx.user.tenantId);
    }),

  /**
   * Lista histórico de conferências de Stage
   */
  getStageCheckHistory: protectedProcedure
    .input(z.object({
      limit: z.number().default(50),
      offset: z.number().default(0),
    }))
    .query(async ({ input, ctx }) => {
      return await getStageCheckHistory({
        tenantId: ctx.user.tenantId,
        limit: input.limit,
        offset: input.offset,
      });
    }),

  /**
   * Gera etiquetas de volumes em PDF
   * Retorna PDF em base64 para impressão automática
   */
  generateVolumeLabels: protectedProcedure
    .input(z.object({
      customerOrderNumber: z.string(),
      customerName: z.string(),
      totalVolumes: z.number().min(1),
    }))
    .mutation(async ({ input }) => {
      const { generateVolumeLabels } = await import("./volumeLabels");
      
      const labels = Array.from({ length: input.totalVolumes }, (_, i) => ({
        customerOrderNumber: input.customerOrderNumber,
        customerName: input.customerName,
        volumeNumber: i + 1,
        totalVolumes: input.totalVolumes,
      }));

      const pdfBuffer = await generateVolumeLabels(labels);
      
      return {
        success: true,
        pdfBase64: pdfBuffer.toString("base64"),
        filename: `etiquetas-${input.customerOrderNumber}.pdf`,
      };
    }),
};
