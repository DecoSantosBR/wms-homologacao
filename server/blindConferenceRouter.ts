import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { 
  blindConferenceSessions, 
  labelAssociations, 
  labelReadings, 
  blindConferenceAdjustments,
  receivingOrders,
  receivingOrderItems,
  products,
  inventory,
  warehouseLocations,
  warehouseZones
} from "../drizzle/schema";
import { eq, and, or, desc, sql, isNull } from "drizzle-orm";
import { z } from "zod";

export const blindConferenceRouter = router({
  /**
   * 1. Iniciar Sessão de Conferência Cega
   */
  start: protectedProcedure
    .input(z.object({
      receivingOrderId: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const userId = ctx.user?.id;
      if (!userId) throw new Error("User not authenticated");

      // Verificar se ordem existe
      const order = await db.select().from(receivingOrders).where(eq(receivingOrders.id, input.receivingOrderId)).limit(1);
      if (order.length === 0) {
        throw new Error("Ordem de recebimento não encontrada");
      }

      // Verificar se já existe sessão ativa para esta ordem
      const existingSession = await db.select()
        .from(blindConferenceSessions)
        .where(
          and(
            eq(blindConferenceSessions.receivingOrderId, input.receivingOrderId),
            eq(blindConferenceSessions.status, "active")
          )
        )
        .limit(1);

      if (existingSession.length > 0) {
        return {
          success: true,
          sessionId: existingSession[0].id,
          message: "Sessão já existe e foi retomada"
        };
      }

      // Criar nova sessão
      await db.insert(blindConferenceSessions).values({
        tenantId: order[0].tenantId,
        receivingOrderId: input.receivingOrderId,
        startedBy: userId,
        status: "active",
      });

      // Buscar sessão criada
      const newSession = await db.select()
        .from(blindConferenceSessions)
        .where(
          and(
            eq(blindConferenceSessions.receivingOrderId, input.receivingOrderId),
            eq(blindConferenceSessions.status, "active")
          )
        )
        .orderBy(desc(blindConferenceSessions.id))
        .limit(1);

      return {
        success: true,
        sessionId: newSession[0].id,
        message: "Sessão iniciada com sucesso"
      };
    }),

  /**
   * 2. Ler Etiqueta
   * Regra: 1 etiqueta = 1 produto + 1 lote específico (ou sem lote)
   * Busca por sessionId + labelCode
   */
  readLabel: protectedProcedure
    .input(z.object({
      sessionId: z.number(),
      labelCode: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const userId = ctx.user?.id;
      if (!userId) throw new Error("User not authenticated");

      // Buscar associação existente
      const sessionIdStr = `R${input.sessionId}`;
      const existingAssociation = await db.select()
        .from(labelAssociations)
        .where(
          and(
            eq(labelAssociations.sessionId, sessionIdStr),
            eq(labelAssociations.labelCode, input.labelCode)
          )
        )
        .limit(1);

      // Se etiqueta é nova
      if (existingAssociation.length === 0) {
        return {
          isNewLabel: true,
          association: null
        };
      }

      // Etiqueta já associada - incrementar contagem
      const association = existingAssociation[0];
      const newPackagesRead = association.packagesRead + 1;
      const newTotalUnits = newPackagesRead * association.unitsPerPackage;

      // Atualizar associação
      await db.update(labelAssociations)
        .set({
          packagesRead: newPackagesRead,
          totalUnits: newTotalUnits,
        })
        .where(eq(labelAssociations.id, association.id));

      // Registrar leitura
      await db.insert(labelReadings).values({
        sessionId: sessionIdStr,
        associationId: association.id,
        labelCode: input.labelCode,
        readBy: userId,
        unitsAdded: association.unitsPerPackage,
      });

      // Buscar dados do produto
      const product = await db.select().from(products).where(eq(products.id, association.productId)).limit(1);

      return {
        isNewLabel: false,
        association: {
          id: association.id,
          productId: association.productId,
          productName: product[0]?.description || "",
          productSku: product[0]?.sku || "",
          batch: association.batch,
          unitsPerPackage: association.unitsPerPackage,
          packagesRead: newPackagesRead,
          totalUnits: newTotalUnits,
        }
      };
    }),

  /**
   * 3. Associar Etiqueta a Produto
   */
  associateLabel: protectedProcedure
    .input(z.object({
      sessionId: z.number(),
      labelCode: z.string(),
      productId: z.number(),
      batch: z.string().nullable(),
      expiryDate: z.string().nullable(),
      unitsPerPackage: z.number(),
      totalUnitsReceived: z.number().optional(), // Quantidade fracionada recebida
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const userId = ctx.user?.id;
      if (!userId) throw new Error("User not authenticated");

      // Converter sessionId para string com prefixo "R" (recebimento)
      const sessionIdStr = `R${input.sessionId}`;

      // Verificar se etiqueta já foi associada nesta sessão
      const existingAssociation = await db.select()
        .from(labelAssociations)
        .where(
          and(
            eq(labelAssociations.sessionId, sessionIdStr),
            eq(labelAssociations.labelCode, input.labelCode)
          )
        )
        .limit(1);

      if (existingAssociation.length > 0) {
        throw new Error("Etiqueta já associada nesta sessão");
      }

      // Usar totalUnitsReceived se fornecido, senão usar unitsPerPackage (caixa completa)
      const actualUnitsReceived = input.totalUnitsReceived || input.unitsPerPackage;

      // Criar associação
      await db.insert(labelAssociations).values({
        sessionId: sessionIdStr,
        labelCode: input.labelCode,
        productId: input.productId,
        batch: input.batch,
        expiryDate: input.expiryDate ? new Date(input.expiryDate) : null,
        unitsPerPackage: input.unitsPerPackage, // Mantém cadastro original
        packagesRead: 1, // Primeira leitura
        totalUnits: actualUnitsReceived, // Usa quantidade fracionada se fornecida
        associatedBy: userId,
      });

      // Buscar associação criada
      const newAssociation = await db.select()
        .from(labelAssociations)
        .where(
          and(
            eq(labelAssociations.sessionId, sessionIdStr),
            eq(labelAssociations.labelCode, input.labelCode)
          )
        )
        .limit(1);

      const associationId = newAssociation[0].id;

      // Registrar primeira leitura
      await db.insert(labelReadings).values({
        sessionId: sessionIdStr,
        associationId: associationId,
        labelCode: input.labelCode,
        readBy: userId,
        unitsAdded: actualUnitsReceived, // Usa quantidade fracionada
      });

      // Atualizar unitsPerBox no produto se não existir
      const product = await db.select().from(products).where(eq(products.id, input.productId)).limit(1);
      if (product.length > 0 && product[0].unitsPerBox === null) {
        await db.update(products)
          .set({ unitsPerBox: input.unitsPerPackage })
          .where(eq(products.id, input.productId));
      }

      return {
        success: true,
        associationId: associationId,
        product: {
          id: product[0].id,
          description: product[0].description,
          sku: product[0].sku,
          unitsPerBox: input.unitsPerPackage,
        },
        packagesRead: 1,
        totalUnits: actualUnitsReceived, // Retorna quantidade fracionada
      };
    }),

  /**
   * 4. Desfazer Última Leitura
   */
  undoLastReading: protectedProcedure
    .input(z.object({
      sessionId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Buscar última leitura
      const sessionIdStr = `R${input.sessionId}`;
      const lastReading = await db.select()
        .from(labelReadings)
        .where(eq(labelReadings.sessionId, sessionIdStr))
        .orderBy(desc(labelReadings.readAt))
        .limit(1);

      if (lastReading.length === 0) {
        throw new Error("Nenhuma leitura encontrada para desfazer");
      }

      const reading = lastReading[0];

      // Buscar associação
      const association = await db.select()
        .from(labelAssociations)
        .where(eq(labelAssociations.id, reading.associationId))
        .limit(1);

      if (association.length === 0) {
        throw new Error("Associação não encontrada");
      }

      const assoc = association[0];

      // Decrementar contagem
      const newPackagesRead = assoc.packagesRead - 1;
      const newTotalUnits = newPackagesRead * assoc.unitsPerPackage;

      if (newPackagesRead === 0) {
        // Remover associação completamente
        await db.delete(labelReadings).where(eq(labelReadings.associationId, assoc.id));
        await db.delete(labelAssociations).where(eq(labelAssociations.id, assoc.id));

        return {
          success: true,
          message: "Associação removida completamente",
          removedCompletely: true,
        };
      } else {
        // Atualizar contagem
        await db.update(labelAssociations)
          .set({
            packagesRead: newPackagesRead,
            totalUnits: newTotalUnits,
          })
          .where(eq(labelAssociations.id, assoc.id));

        // Remover leitura
        await db.delete(labelReadings).where(eq(labelReadings.id, reading.id));

        return {
          success: true,
          message: "Última leitura desfeita",
          removedCompletely: false,
          newPackagesRead: newPackagesRead,
          newTotalUnits: newTotalUnits,
        };
      }
    }),

  /**
   * 5. Ajustar Quantidade
   */
  adjustQuantity: protectedProcedure
    .input(z.object({
      sessionId: z.number(),
      associationId: z.number(),
      newQuantity: z.number(),
      reason: z.string().nullable(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const userId = ctx.user?.id;
      if (!userId) throw new Error("User not authenticated");

      // Buscar associação
      const association = await db.select()
        .from(labelAssociations)
        .where(eq(labelAssociations.id, input.associationId))
        .limit(1);

      if (association.length === 0) {
        throw new Error("Associação não encontrada");
      }

      const assoc = association[0];
      const previousQuantity = assoc.totalUnits;

      // Registrar ajuste
      await db.insert(blindConferenceAdjustments).values({
        sessionId: input.sessionId,
        associationId: input.associationId,
        previousQuantity: previousQuantity,
        newQuantity: input.newQuantity,
        reason: input.reason,
        adjustedBy: userId,
      });

      // Atualizar associação
      await db.update(labelAssociations)
        .set({
          totalUnits: input.newQuantity,
        })
        .where(eq(labelAssociations.id, input.associationId));

      return {
        success: true,
        previousQuantity: previousQuantity,
        newQuantity: input.newQuantity,
      };
    }),

  /**
   * 6. Obter Resumo da Sessão
   */
  getSummary: protectedProcedure
    .input(z.object({
      sessionId: z.number(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Buscar sessão
      const session = await db.select()
        .from(blindConferenceSessions)
        .where(eq(blindConferenceSessions.id, input.sessionId))
        .limit(1);

      if (session.length === 0) {
        throw new Error("Sessão não encontrada");
      }

      // Buscar associações com produtos
      const sessionIdStr = `R${input.sessionId}`;
      const associations = await db.select({
        id: labelAssociations.id,
        labelCode: labelAssociations.labelCode,
        productId: labelAssociations.productId,
        productName: products.description,
        productSku: products.sku,
        batch: labelAssociations.batch,
        unitsPerPackage: labelAssociations.unitsPerPackage,
        packagesRead: labelAssociations.packagesRead,
        totalUnits: labelAssociations.totalUnits,
      })
        .from(labelAssociations)
        .innerJoin(products, eq(labelAssociations.productId, products.id))
        .where(eq(labelAssociations.sessionId, sessionIdStr));

      // Buscar itens esperados da ordem
      const expectedItems = await db.select({
        id: receivingOrderItems.id,
        productId: receivingOrderItems.productId,
        productName: products.description,
        productSku: products.sku,
        batch: receivingOrderItems.batch,
        expectedQuantity: receivingOrderItems.expectedQuantity,
        unitsPerBox: products.unitsPerBox,
        expiryDate: receivingOrderItems.expiryDate,
      })
        .from(receivingOrderItems)
        .innerJoin(products, eq(receivingOrderItems.productId, products.id))
        .where(eq(receivingOrderItems.receivingOrderId, session[0].receivingOrderId));

      // Calcular resumo com divergências
      // IMPORTANTE: Comparar por productId + batch para tratar lotes diferentes separadamente
      const summary = expectedItems.map(expected => {
        const conferenced = associations
          .filter(a => 
            a.productId === expected.productId && 
            (a.batch === expected.batch || (a.batch === null && expected.batch === null))
          )
          .reduce((sum, a) => sum + a.totalUnits, 0);

        return {
          productId: expected.productId,
          productName: expected.productName,
          batch: expected.batch,
          quantityConferenced: conferenced,
          quantityExpected: expected.expectedQuantity,
          divergence: conferenced - expected.expectedQuantity,
        };
      });

      const hasDivergences = summary.some(s => s.divergence !== 0);

      return {
        associations,
        expectedItems,
        summary,
        hasDivergences,
      };
    }),

  /**
   * 7. Finalizar Conferência
   */
  finish: protectedProcedure
    .input(z.object({
      sessionId: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const userId = ctx.user?.id;
      if (!userId) throw new Error("User not authenticated");

      // Buscar sessão
      const session = await db.select()
        .from(blindConferenceSessions)
        .where(eq(blindConferenceSessions.id, input.sessionId))
        .limit(1);

      if (session.length === 0) {
        throw new Error("Sessão não encontrada");
      }

      // Buscar associações
      const sessionIdStr = `R${input.sessionId}`;
      const associations = await db.select()
        .from(labelAssociations)
        .where(eq(labelAssociations.sessionId, sessionIdStr));

      // Buscar endereço REC do cliente correto (mesmo tenantId da sessão)
      const sessionTenantId = session[0].tenantId;
      
      const recLocations = await db.select()
        .from(warehouseLocations)
        .where(
          and(
            sql`${warehouseLocations.code} LIKE '%REC%'`,
            sql`${warehouseLocations.tenantId} = ${sessionTenantId}`,
            or(
              eq(warehouseLocations.status, 'available'),
              eq(warehouseLocations.status, 'livre')
            )
          )
        )
        .limit(1);

      if (recLocations.length === 0) {
        throw new Error(`Nenhum endereço de recebimento (REC) encontrado para o cliente (tenantId=${sessionTenantId}). Cadastre um endereço REC para este cliente.`);
      }

      const recLocationId = recLocations[0].id;

      // Criar inventário em endereço REC para cada associação
      for (const assoc of associations) {
        // ✅ VALIDAÇÃO: Verificar se endereço REC pode receber este lote
        const { validateLocationForBatch } = await import("./locationValidation");
        const validation = await validateLocationForBatch(
          recLocationId,
          assoc.productId,
          assoc.batch
        );

        if (!validation.allowed) {
          throw new Error(`Erro ao finalizar conferência: ${validation.reason}`);
        }

        // Buscar SKU do produto para gerar uniqueCode
        const product = await db.select({ sku: products.sku })
          .from(products)
          .where(eq(products.id, assoc.productId))
          .limit(1);

        // Buscar zona do endereço de recebimento
        const location = await db.select({ zoneCode: warehouseZones.code })
          .from(warehouseLocations)
          .innerJoin(warehouseZones, eq(warehouseLocations.zoneId, warehouseZones.id))
          .where(eq(warehouseLocations.id, recLocationId))
          .limit(1);

        const { getUniqueCode } = await import("./utils/uniqueCode");

        await db.insert(inventory).values({
          tenantId: session[0].tenantId || null,
          productId: assoc.productId,
          locationId: recLocationId,
          batch: assoc.batch,
          expiryDate: assoc.expiryDate,
          quantity: assoc.totalUnits,
          status: "available", // Disponível após conferência
          uniqueCode: getUniqueCode(product[0]?.sku || "", assoc.batch), // ✅ Adicionar uniqueCode
          locationZone: location[0]?.zoneCode || null, // ✅ Adicionar locationZone
        });
      }

      // Atualizar sessão
      await db.update(blindConferenceSessions)
        .set({
          status: "completed",
          finishedAt: new Date(),
          finishedBy: userId,
        })
        .where(eq(blindConferenceSessions.id, input.sessionId));

      // Atualizar status da ordem
      await db.update(receivingOrders)
        .set({
          status: "addressing",
        })
        .where(eq(receivingOrders.id, session[0].receivingOrderId));

      return {
        success: true,
        message: "Conferência finalizada com sucesso. Estoque criado em quarentena.",
      };
    }),
});
