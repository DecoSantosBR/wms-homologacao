import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { productLabels, inventory, products } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const labelRouter = router({
  /**
   * Associar etiqueta não vinculada durante picking
   * Similar à conferência cega, mas no contexto de separação
   */
  associateInPicking: protectedProcedure
    .input(z.object({
      labelCode: z.string(),
      inventoryId: z.number(), // ID do registro de estoque sendo separado
    }))
    .mutation(async ({ input, ctx }) => {
      const { labelCode, inventoryId } = input;
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // 1. Verificar se a etiqueta já existe e está vinculada
      const existingLabels = await db.select()
        .from(productLabels)
        .where(eq(productLabels.labelCode, labelCode))
        .limit(1);
      
      const existingLabel = existingLabels[0];

      if (existingLabel && existingLabel.productId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Etiqueta ${labelCode} já está vinculada ao produto ID ${existingLabel.productId}`,
        });
      }

      // 2. Buscar informações do estoque
      const inventoryRecords = await db.select({
        id: inventory.id,
        productId: inventory.productId,
        batch: inventory.batch,
        expiryDate: inventory.expiryDate,
        productSku: products.sku,
        productName: products.description,
      })
        .from(inventory)
        .innerJoin(products, eq(inventory.productId, products.id))
        .where(eq(inventory.id, inventoryId))
        .limit(1);
      
      const inventoryRecord = inventoryRecords[0];

      if (!inventoryRecord) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Registro de estoque não encontrado",
        });
      }

      // 3. Criar ou atualizar etiqueta
      if (existingLabel) {
        // Atualizar etiqueta existente
        await db.update(productLabels)
          .set({
            productId: inventoryRecord.productId,
            productSku: inventoryRecord.productSku,
            batch: inventoryRecord.batch || "",
            expiryDate: inventoryRecord.expiryDate,
          })
          .where(eq(productLabels.id, existingLabel.id));
      } else {
        // Criar nova etiqueta
        await db.insert(productLabels).values({
          labelCode: labelCode,
          productId: inventoryRecord.productId,
          productSku: inventoryRecord.productSku,
          batch: inventoryRecord.batch || "",
          expiryDate: inventoryRecord.expiryDate,
          createdBy: ctx.user.id,
        });
      }

      console.log(`[PICKING] Etiqueta ${labelCode} associada ao produto ${inventoryRecord.productSku} (lote: ${inventoryRecord.batch})`);

      return {
        success: true,
        message: "Etiqueta associada com sucesso",
        product: {
          id: inventoryRecord.productId,
          sku: inventoryRecord.productSku,
          name: inventoryRecord.productName,
        },
        batch: inventoryRecord.batch,
      };
    }),
});
