import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { labelAssociations, inventory, products } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const labelRouter = router({
  /**
   * Associar etiqueta não vinculada durante picking
   * Cria associação em labelAssociations com prefixo "P" (picking)
   * 
   * Regra: Sistema usa APENAS labelAssociations para ambos os fluxos:
   * - Recebimento: sessionId = "R" + blindConferenceSessionId
   * - Picking: sessionId = "P" + waveId
   */
  associateInPicking: protectedProcedure
    .input(z.object({
      labelCode: z.string(),
      productSku: z.string(),
      batch: z.string().nullable(),
      waveId: z.number(), // ID da onda de picking
    }))
    .mutation(async ({ input, ctx }) => {
      const { labelCode, productSku, batch, waveId } = input;
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Criar sessionId com prefixo "P" (picking)
      const sessionIdStr = `P${waveId}`;

      // 1. Verificar se a etiqueta já existe (qualquer sessão)
      const existingLabels = await db.select()
        .from(labelAssociations)
        .where(eq(labelAssociations.labelCode, labelCode))
        .limit(1);
      
      const existingLabel = existingLabels[0];

      if (existingLabel && existingLabel.productId) {
        // Buscar produto para validar
        const productRecords = await db.select()
          .from(products)
          .where(eq(products.id, existingLabel.productId))
          .limit(1);
        
        const product = productRecords[0];
        
        // Verificar se a etiqueta já está vinculada ao produto/lote correto
        const isCorrectProduct = product && product.sku === productSku;
        const isCorrectBatch = !batch || existingLabel.batch === batch;
        
        if (isCorrectProduct && isCorrectBatch) {
          // Etiqueta já vinculada corretamente - retornar sucesso
          console.log(`[PICKING] Etiqueta ${labelCode} já vinculada corretamente ao produto ${productSku}`);
          return {
            success: true,
            message: "Etiqueta já vinculada corretamente",
            product: {
              id: existingLabel.productId,
              sku: product.sku,
              name: product.description,
            },
            batch: batch,
          };
        } else {
          // Etiqueta vinculada a produto/lote diferente - erro
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Produto incorreto! Esperado SKU: ${productSku}, mas a etiqueta "${labelCode}" está vinculada a outro produto`,
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
      let unitsPerPackage = product.unitsPerBox || 1;
      
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

      // 4. Criar associação em labelAssociations
      await db.insert(labelAssociations).values({
        sessionId: sessionIdStr,
        labelCode: labelCode,
        productId: product.id,
        batch: batch || "",
        expiryDate: expiryDate,
        unitsPerPackage: unitsPerPackage,
        packagesRead: 1,
        totalUnits: unitsPerPackage,
        associatedBy: ctx.user.id,
      });

      console.log(`[PICKING] Etiqueta ${labelCode} associada ao produto ${product.sku} (lote: ${batch || 'sem lote'}) - sessionId: ${sessionIdStr}`);

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
