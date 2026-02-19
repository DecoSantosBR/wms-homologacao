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
      productSku: z.string(),
      batch: z.string().nullable(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { labelCode, productSku, batch } = input;
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

      // 2. Buscar produto pelo SKU
      const productRecords = await db.select()
        .from(products)
        .where(eq(products.sku, productSku))
        .limit(1);
      
      const product = productRecords[0];
      
      if (!product) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Produto ${productSku} não encontrado`,
        });
      }

      // 3. Buscar informações do estoque (se houver lote)
      let expiryDate = null;
      if (batch) {
        const inventoryRecords = await db.select({
          expiryDate: inventory.expiryDate,
        })
          .from(inventory)
          .where(
            and(
              eq(inventory.productId, product.id),
              eq(inventory.batch, batch)
            )
          )
          .limit(1);
        
        if (inventoryRecords[0]) {
          expiryDate = inventoryRecords[0].expiryDate;
        }
      }

      // 4. Criar ou atualizar etiqueta
      if (existingLabel) {
        // Atualizar etiqueta existente
        await db.update(productLabels)
          .set({
            productId: product.id,
            productSku: product.sku,
            batch: batch || "",
            expiryDate: expiryDate,
          })
          .where(eq(productLabels.id, existingLabel.id));
      } else {
        // Criar nova etiqueta
        await db.insert(productLabels).values({
          labelCode: labelCode,
          productId: product.id,
          productSku: product.sku,
          batch: batch || "",
          expiryDate: expiryDate,
          createdBy: ctx.user.id,
        });
      }

      console.log(`[PICKING] Etiqueta ${labelCode} associada ao produto ${product.sku} (lote: ${batch || 'sem lote'})`);

      return {
        success: true,
        message: "Etiqueta associada com sucesso",
        product: {
          id: product.id,
          sku: product.sku,
          name: product.description,
        },
        batch: batch,
      };
    }),
});
