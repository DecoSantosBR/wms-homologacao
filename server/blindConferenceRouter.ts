import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { 
  blindConferenceSessions, 
  blindConferenceItems,
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
import { TRPCError } from "@trpc/server";
import { getUniqueCode } from "./utils/uniqueCode";

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
   * 2. Ler Etiqueta (REFATORADO)
   * Regra: 1 etiqueta = 1 produto + 1 lote específico (ou sem lote)
   * Busca etiqueta global e registra progresso em blindConferenceItems
   */
  readLabel: protectedProcedure
    .input(z.object({
      conferenceId: z.number(), // Mudado de sessionId para conferenceId
      labelCode: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const userId = ctx.user?.id;
      const tenantId = ctx.user?.tenantId;
      if (!userId || !tenantId) throw new Error("User not authenticated");

      // 1. BUSCA GLOBAL DA ETIQUETA (Identidade Permanente)
      // Removemos qualquer filtro por sessionId, buscando apenas pelo código e tenant
      const label = await db.select()
        .from(labelAssociations)
        .where(
          and(
            eq(labelAssociations.labelCode, input.labelCode),
            eq(labelAssociations.tenantId, tenantId)
          )
        )
        .limit(1);

      // Se etiqueta não existe no sistema
      if (label.length === 0) {
        return {
          isNewLabel: true,
          association: null
        };
      }

      const labelData = label[0];

      // 2. UPSERT ATÔMICO NA TABELA DE ITENS DA CONFERÊNCIA
      // A Constraint Unique (conferenceId, productId, batch) garante a separação correta
      await db.insert(blindConferenceItems)
        .values({
          conferenceId: input.conferenceId,
          productId: labelData.productId,
          batch: labelData.batch || "",
          expiryDate: labelData.expiryDate,
          tenantId: tenantId,
          packagesRead: 1, // Valor inicial caso o registro seja criado agora
          expectedQuantity: 0, // Será preenchido posteriormente se houver NF
        })
        .onDuplicateKeyUpdate({
          set: {
            // Incrementa o contador do par Produto+Lote específico desta conferência
            packagesRead: sql`${blindConferenceItems.packagesRead} + 1`,
            updatedAt: new Date(),
          },
        });

      // 3. REGISTRAR LEITURA NO HISTÓRICO (labelReadings)
      const sessionIdStr = `R${input.conferenceId}`;
      await db.insert(labelReadings).values({
        sessionId: sessionIdStr,
        associationId: labelData.id,
        labelCode: input.labelCode,
        readBy: userId,
        unitsAdded: labelData.unitsPerPackage,
      });

      // 4. BUSCAR PROGRESSO ATUAL DO ITEM NA CONFERÊNCIA
      const conferenceItem = await db.select()
        .from(blindConferenceItems)
        .where(
          and(
            eq(blindConferenceItems.conferenceId, input.conferenceId),
            eq(blindConferenceItems.productId, labelData.productId),
            eq(blindConferenceItems.batch, labelData.batch || "")
          )
        )
        .limit(1);

      const currentPackagesRead = conferenceItem[0]?.packagesRead || 1;

      // 5. BUSCAR DADOS DO PRODUTO
      const product = await db.select().from(products).where(eq(products.id, labelData.productId)).limit(1);

      // 6. RETORNO PARA O FRONTEND (Facilita o undoLastReading)
      return {
        isNewLabel: false,
        association: {
          id: labelData.id,
          productId: labelData.productId,
          productName: product[0]?.description || "",
          productSku: product[0]?.sku || "",
          batch: labelData.batch,
          expiryDate: labelData.expiryDate,
          unitsPerPackage: labelData.unitsPerPackage,
          packagesRead: currentPackagesRead,
          totalUnits: currentPackagesRead * labelData.unitsPerPackage,
        }
      };
    }),

  /**
   * 3. Associar Etiqueta a Produto (REFATORADO)
   * Cria etiqueta PERMANENTE no estoque global (sem sessionId)
   * Registra primeiro bip na conferência atual
   */
  associateLabel: protectedProcedure
    .input(z.object({
      conferenceId: z.number(),
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
      const tenantId = ctx.user?.tenantId;
      if (!userId || !tenantId) throw new Error("User not authenticated");

      // Buscar produto para gerar uniqueCode
      const product = await db.select().from(products).where(eq(products.id, input.productId)).limit(1);
      if (product.length === 0) {
        throw new Error("Produto não encontrado");
      }

      const productSku = product[0].sku;
      const uniqueCode = getUniqueCode(productSku, input.batch);

      // Usar totalUnitsReceived se fornecido, senão usar unitsPerPackage (caixa completa)
      const actualUnitsReceived = input.totalUnitsReceived || input.unitsPerPackage;

      // 1. CRIAR ETIQUETA PERMANENTE NO ESTOQUE GLOBAL
      // Verificar se etiqueta já existe
      const existingLabel = await db.select()
        .from(labelAssociations)
        .where(eq(labelAssociations.labelCode, input.labelCode))
        .limit(1);

      if (existingLabel.length > 0) {
        throw new Error("Etiqueta já existe no sistema");
      }

      await db.insert(labelAssociations).values({
        labelCode: input.labelCode,
        uniqueCode: uniqueCode,
        productId: input.productId,
        batch: input.batch,
        expiryDate: input.expiryDate ? new Date(input.expiryDate) : null,
        unitsPerPackage: input.unitsPerPackage,
        totalUnits: actualUnitsReceived,
        associatedBy: userId,
        tenantId: tenantId,
      });

      // 2. REGISTRAR PRIMEIRO BIP NA CONFERÊNCIA
      await db.insert(blindConferenceItems)
        .values({
          conferenceId: input.conferenceId,
          productId: input.productId,
          batch: input.batch || "",
          expiryDate: input.expiryDate ? new Date(input.expiryDate) : null,
          tenantId: tenantId,
          packagesRead: 1,
          expectedQuantity: 0,
        })
        .onDuplicateKeyUpdate({
          set: {
            packagesRead: sql`${blindConferenceItems.packagesRead} + 1`,
            updatedAt: new Date(),
          },
        });

      // 3. REGISTRAR LEITURA NO HISTÓRICO
      const sessionIdStr = `R${input.conferenceId}`;
      const newLabel = await db.select()
        .from(labelAssociations)
        .where(eq(labelAssociations.labelCode, input.labelCode))
        .limit(1);

      await db.insert(labelReadings).values({
        sessionId: sessionIdStr,
        associationId: newLabel[0].id,
        labelCode: input.labelCode,
        readBy: userId,
        unitsAdded: actualUnitsReceived,
      });

      // 4. ATUALIZAR unitsPerBox NO PRODUTO SE NÃO EXISTIR
      if (product[0].unitsPerBox === null) {
        await db.update(products)
          .set({ unitsPerBox: input.unitsPerPackage })
          .where(eq(products.id, input.productId));
      }

      return {
        success: true,
        associationId: newLabel[0].id,
        product: {
          id: product[0].id,
          description: product[0].description,
          sku: product[0].sku,
          unitsPerBox: input.unitsPerPackage,
        },
        packagesRead: 1,
        totalUnits: actualUnitsReceived,
      };
    }),

  /**
   * 4. Desfazer Última Leitura (REFATORADO)
   * Decrementa packagesRead em blindConferenceItems
   * Frontend deve enviar productId + batch do último bip
   */
  undoLastReading: protectedProcedure
    .input(z.object({
      conferenceId: z.number(),
      productId: z.number(),
      batch: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const tenantId = ctx.user?.tenantId;
      if (!tenantId) throw new Error("User not authenticated");

      // Buscar item na conferência
      const conferenceItem = await db.select()
        .from(blindConferenceItems)
        .where(
          and(
            eq(blindConferenceItems.conferenceId, input.conferenceId),
            eq(blindConferenceItems.productId, input.productId),
            eq(blindConferenceItems.batch, input.batch),
            eq(blindConferenceItems.tenantId, tenantId)
          )
        )
        .limit(1);

      if (conferenceItem.length === 0) {
        throw new Error("Item não encontrado na conferência");
      }

      const currentPackagesRead = conferenceItem[0].packagesRead;

      if (currentPackagesRead <= 0) {
        throw new Error("Não há leituras para desfazer");
      }

      // Decrementar contador
      const newPackagesRead = currentPackagesRead - 1;

      if (newPackagesRead === 0) {
        // Se chegou a zero, deletar item da conferência
        await db.delete(blindConferenceItems)
          .where(
            and(
              eq(blindConferenceItems.conferenceId, input.conferenceId),
              eq(blindConferenceItems.productId, input.productId),
              eq(blindConferenceItems.batch, input.batch)
            )
          );
      } else {
        // Senão, decrementar contador
        await db.update(blindConferenceItems)
          .set({
            packagesRead: newPackagesRead,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(blindConferenceItems.conferenceId, input.conferenceId),
              eq(blindConferenceItems.productId, input.productId),
              eq(blindConferenceItems.batch, input.batch)
            )
          );
      }

      // Deletar última leitura do histórico
      const sessionIdStr = `R${input.conferenceId}`;
      const lastReading = await db.select()
        .from(labelReadings)
        .where(eq(labelReadings.sessionId, sessionIdStr))
        .orderBy(desc(labelReadings.readAt))
        .limit(1);

      if (lastReading.length > 0) {
        await db.delete(labelReadings).where(eq(labelReadings.id, lastReading[0].id));
      }

      return {
        success: true,
        message: newPackagesRead === 0 ? "Item removido da conferência" : "Leitura desfeita",
        packagesRead: newPackagesRead,
      };
    }),

  /**
   * 5. Ajustar Quantidade Manualmente
   */
  adjustQuantity: protectedProcedure
    .input(z.object({
      sessionId: z.number(),
      associationId: z.number(),
      newQuantity: z.number(),
      reason: z.string(),
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

      const previousQuantity = association[0].totalUnits;

      // Atualizar quantidade
      await db.update(labelAssociations)
        .set({ totalUnits: input.newQuantity })
        .where(eq(labelAssociations.id, input.associationId));

      // Registrar ajuste
      await db.insert(blindConferenceAdjustments).values({
        sessionId: input.sessionId,
        associationId: input.associationId,
        previousQuantity: previousQuantity,
        newQuantity: input.newQuantity,
        reason: input.reason,
        adjustedBy: userId,
      });

      return {
        success: true,
        previousQuantity,
        newQuantity: input.newQuantity,
      };
    }),

  /**
   * 6. Obter Resumo da Conferência (REFATORADO)
   * Busca progresso consolidado de blindConferenceItems
   */
  getSummary: protectedProcedure
    .input(z.object({
      conferenceId: z.number(),
    }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const tenantId = ctx.user?.tenantId;
      if (!tenantId) throw new Error("User not authenticated");

      // Buscar sessão
      const session = await db.select()
        .from(blindConferenceSessions)
        .where(eq(blindConferenceSessions.id, input.conferenceId))
        .limit(1);

      if (session.length === 0) {
        throw new Error("Sessão não encontrada");
      }

      // Buscar itens conferidos (progresso real)
      const conferenceItems = await db.select({
        id: blindConferenceItems.id,
        productId: blindConferenceItems.productId,
        productName: products.description,
        productSku: products.sku,
        batch: blindConferenceItems.batch,
        expiryDate: blindConferenceItems.expiryDate,
        packagesRead: blindConferenceItems.packagesRead,
        expectedQuantity: blindConferenceItems.expectedQuantity,
      })
        .from(blindConferenceItems)
        .innerJoin(products, eq(blindConferenceItems.productId, products.id))
        .where(
          and(
            eq(blindConferenceItems.conferenceId, input.conferenceId),
            eq(blindConferenceItems.tenantId, tenantId)
          )
        );

      // Buscar itens esperados da ordem (NF)
      const order = session[0];
      const expectedItems = await db.select({
        productId: receivingOrderItems.productId,
        productName: products.description,
        productSku: products.sku,
        batch: receivingOrderItems.batch,
        expectedQuantity: receivingOrderItems.expectedQuantity,
      })
        .from(receivingOrderItems)
        .innerJoin(products, eq(receivingOrderItems.productId, products.id))
        .where(eq(receivingOrderItems.receivingOrderId, order.receivingOrderId));

      // Calcular totais
      const totalReceived = conferenceItems.reduce((sum, item) => sum + item.packagesRead, 0);
      const totalExpected = expectedItems.reduce((sum, item) => sum + item.expectedQuantity, 0);

      return {
        session: {
          id: session[0].id,
          receivingOrderId: session[0].receivingOrderId,
          startedAt: session[0].startedAt,
          status: session[0].status,
        },
        conferenceItems,
        expectedItems,
        totals: {
          received: totalReceived,
          expected: totalExpected,
          difference: totalReceived - totalExpected,
        }
      };
    }),

  /**
   * 7. Finalizar Conferência (REFATORADO)
   * Busca itens de blindConferenceItems e cria estoque
   */
  finish: protectedProcedure
    .input(z.object({
      conferenceId: z.number(),
      forceClose: z.boolean().default(false),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const userId = ctx.user?.id;
      const tenantId = ctx.user?.tenantId;
      if (!userId || !tenantId) throw new Error("User not authenticated");

      // Buscar sessão
      const session = await db.select()
        .from(blindConferenceSessions)
        .where(eq(blindConferenceSessions.id, input.conferenceId))
        .limit(1);

      if (session.length === 0) {
        throw new Error("Sessão não encontrada");
      }

      // 1. BUSCAR CONSOLIDADO DE TUDO QUE FOI BIPADO
      const conferenceItems = await db.select()
        .from(blindConferenceItems)
        .where(
          and(
            eq(blindConferenceItems.conferenceId, input.conferenceId),
            eq(blindConferenceItems.tenantId, tenantId)
          )
        );

      if (conferenceItems.length === 0) {
        throw new Error("Nenhum item foi conferido");
      }

      // Buscar endereço REC do cliente correto (mesmo tenantId da sessão)
      const recLocation = await db.select()
        .from(warehouseLocations)
        .where(
          and(
            eq(warehouseLocations.code, "REC"),
            eq(warehouseLocations.tenantId, tenantId)
          )
        )
        .limit(1);

      if (recLocation.length === 0) {
        throw new Error("Endereço REC não encontrado para este cliente");
      }

      // Buscar zona do endereço de recebimento
      const locationZone = await db.select({
        zoneCode: warehouseZones.code
      })
        .from(warehouseLocations)
        .innerJoin(warehouseZones, eq(warehouseLocations.zoneId, warehouseZones.id))
        .where(eq(warehouseLocations.id, recLocation[0].id))
        .limit(1);

      // 2. CRIAR ESTOQUE PARA CADA ITEM CONFERIDO
      for (const item of conferenceItems) {
        if (item.packagesRead <= 0) continue;

        // Buscar produto para gerar uniqueCode
        const product = await db.select()
          .from(products)
          .where(eq(products.id, item.productId))
          .limit(1);

        if (product.length === 0) continue;

        // Buscar etiqueta para obter unitsPerPackage
        const label = await db.select()
          .from(labelAssociations)
          .where(
            and(
              eq(labelAssociations.productId, item.productId),
              eq(labelAssociations.batch, item.batch)
            )
          )
          .limit(1);

        const unitsPerPackage = label[0]?.unitsPerPackage || 1;
        const totalUnits = item.packagesRead * unitsPerPackage;

        // Criar registro de estoque
        await db.insert(inventory).values({
          tenantId: tenantId,
          productId: item.productId,
          locationId: recLocation[0].id,
          batch: item.batch,
          expiryDate: item.expiryDate,
          quantity: totalUnits,
          status: "available",
          uniqueCode: getUniqueCode(product[0].sku, item.batch),
          locationZone: locationZone[0]?.zoneCode || null,
        });
      }

      // 3. MARCAR CONFERÊNCIA COMO FINALIZADA
      await db.update(blindConferenceSessions)
        .set({
          status: "completed",
          finishedAt: new Date(),
          finishedBy: userId,
        })
        .where(eq(blindConferenceSessions.id, input.conferenceId));

      // 4. ATUALIZAR STATUS DA ORDEM
      await db.update(receivingOrders)
        .set({ status: "completed" })
        .where(eq(receivingOrders.id, session[0].receivingOrderId));

      return {
        success: true,
        message: "Conferência finalizada com sucesso",
        itemsProcessed: conferenceItems.length,
      };
    }),
});
