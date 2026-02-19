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
        // Verificar se a etiqueta já está vinculada ao produto/lote correto
        const isCorrectProduct = existingLabel.productSku === productSku;
        const isCorrectBatch = !batch || existingLabel.batch === batch;
        
        if (isCorrectProduct && isCorrectBatch) {
          // Etiqueta já vinculada corretamente - retornar sucesso
          console.log(`[PICKING] Etiqueta ${labelCode} já vinculada corretamente ao produto ${productSku}`);
          return {
            success: true,
            message: "Etiqueta já vinculada corretamente",
            product: {
              id: existingLabel.productId,
              sku: existingLabel.productSku,
              name: "(produto já vinculado)",
            },
            batch: batch,
          };
        } else {
          // Etiqueta vinculada a produto/lote diferente - erro
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Produto incorreto! Esperado SKU: ${productSku}, mas a etiqueta "${labelCode}" não corresponde`,
          });
        }
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
