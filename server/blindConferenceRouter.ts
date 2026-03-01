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
  warehouseZones,
  nonConformities,
  systemUsers,
  auditLogs,
} from "../drizzle/schema";
import crypto from "crypto";
import { eq, and, or, desc, sql, isNull, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getUniqueCode } from "./utils/uniqueCode";

/** Extrai a parte YYYY-MM-DD de um Date ou string, ignorando timezone.
 * Usa a representação UTC do Date para evitar que o offset local mude o dia.
 * Retorna null se o valor for nulo/undefined.
 */
function toDateStr(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  if (typeof d === "string") {
    // "YYYY-MM-DD" ou "YYYY-MM-DD HH:MM:SS" — pegar apenas a parte da data
    return d.split("T")[0].split(" ")[0];
  }
  // É um objeto Date — usar UTC para evitar que offset local mude o dia
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Helper: Busca o tenantId real da ordem de recebimento vinculada à sessão de conferência.
 * Usar este valor em todos os filtros de blindConferenceItems e labelAssociations,
 * pois os dados são gravados com o tenantId da ORDEM, não do usuário logado.
 */
async function getOrderTenantId(db: Awaited<ReturnType<typeof getDb>>, conferenceId: number): Promise<number> {
  if (!db) throw new Error("Database not available");
  const [session] = await db.select({ receivingOrderId: blindConferenceSessions.receivingOrderId })
    .from(blindConferenceSessions)
    .where(eq(blindConferenceSessions.id, conferenceId))
    .limit(1);
  if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Sessão de conferência não encontrada" });
  const [order] = await db.select({ tenantId: receivingOrders.tenantId })
    .from(receivingOrders)
    .where(eq(receivingOrders.id, session.receivingOrderId))
    .limit(1);
  if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Ordem de recebimento não encontrada" });
  return order.tenantId;
}

export const blindConferenceRouter = router({
  /**
   * 1. Iniciar Sessão de Conferência Cega
   */
  start: protectedProcedure
    .input(z.object({
      receivingOrderId: z.number(),
      tenantId: z.number().optional(), // Opcional: Admin Global pode enviar
    }))
    .mutation(async ({ input, ctx }) => {
      console.log("[blindConference.start] Context:", {
        hasUser: !!ctx.user,
        userId: ctx.user?.id,
        userName: ctx.user?.name,
        userRole: ctx.user?.role,
        userTenantId: ctx.user?.tenantId
      });

      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const userId = ctx.user?.id;
      if (!userId) {
        console.error("[blindConference.start] User not authenticated! ctx.user:", ctx.user);
        throw new TRPCError({ code: "UNAUTHORIZED", message: "User not authenticated" });
      }

      // Lógica de Admin Global: admin + tenantId=1 pode escolher tenant
      const isGlobalAdmin = ctx.user.role === 'admin' && (ctx.user.tenantId === 1 || ctx.user.tenantId === null);
      const activeTenantId = (isGlobalAdmin && input.tenantId) 
        ? input.tenantId 
        : ctx.user.tenantId;
      
      if (!activeTenantId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Usuário sem Tenant vinculado" });
      }

      console.log("[start] Tenant Ativo:", activeTenantId, "| isGlobalAdmin:", isGlobalAdmin);

      // Verificar se ordem existe
      const order = await db.select().from(receivingOrders).where(eq(receivingOrders.id, input.receivingOrderId)).limit(1);
      if (order.length === 0) {
        throw new Error("Ordem de recebimento não encontrada");
      }

      // ✅ USAR tenantId DA ORDEM, NÃO DO USUÁRIO
      const orderTenantId = order[0].tenantId;

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
        tenantId: orderTenantId,
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
      conferenceId: z.number(),
      labelCode: z.string(),
      tenantId: z.number().optional(), // Opcional: Admin Global pode enviar
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const userId = ctx.user?.id;
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED", message: "User not authenticated" });

      // Lógica de Admin Global
      const isGlobalAdmin = ctx.user.role === 'admin' && (ctx.user.tenantId === 1 || ctx.user.tenantId === null);
      const activeTenantId = (isGlobalAdmin && input.tenantId) 
        ? input.tenantId 
        : ctx.user.tenantId;

      if (!activeTenantId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Usuário sem Tenant vinculado" });
      }

      console.log("[readLabel] Tenant Ativo:", activeTenantId, "| isGlobalAdmin:", isGlobalAdmin);

      // 🔑 0. BUSCAR SESSÃO DE CONFERÊNCIA PRIMEIRO (ESCOPO RAIZ)
      const conferenceSession = await db.select()
        .from(blindConferenceSessions)
        .where(
          isGlobalAdmin
            ? eq(blindConferenceSessions.id, input.conferenceId)
            : and(
                eq(blindConferenceSessions.id, input.conferenceId),
                eq(blindConferenceSessions.tenantId, activeTenantId)
              )
        )
        .limit(1);
      
      if (conferenceSession.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Sessão de conferência não encontrada"
        });
      }
      
      const conference = conferenceSession[0];
      console.log("[readLabel] Conference encontrada:", conference.id, "| receivingOrderId:", conference.receivingOrderId);

      // ✅ BUSCAR receivingOrder PARA OBTER tenantId CORRETO
      const receivingOrder = await db.select()
        .from(receivingOrders)
        .where(eq(receivingOrders.id, conference.receivingOrderId))
        .limit(1);
      
      if (receivingOrder.length === 0) {
        throw new Error("Ordem de recebimento não encontrada");
      }
      
      const orderTenantId = receivingOrder[0].tenantId;
      console.log("[readLabel] Usando tenantId da ordem:", orderTenantId);

      // 1. BUSCA GLOBAL DA ETIQUETA (Identidade Permanente)
      // ✅ USA orderTenantId (tenant da ordem) para buscar a etiqueta,
      // pois a etiqueta é inserida com o tenantId da ordem, não do usuário logado
      const label = await db.select()
        .from(labelAssociations)
        .where(
          and(
            eq(labelAssociations.labelCode, input.labelCode),
            eq(labelAssociations.tenantId, orderTenantId)
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
      await db.insert(blindConferenceItems)
        .values({
          conferenceId: input.conferenceId,
          productId: labelData.productId,
          batch: labelData.batch || "",
          expiryDate: labelData.expiryDate,
          tenantId: orderTenantId, // ✅ USA tenantId DA ORDEM
          packagesRead: 1,
          unitsRead: labelData.unitsPerBox, // Primeira leitura: 1 caixa * unitsPerBox
          expectedQuantity: 0,
        })
        .onDuplicateKeyUpdate({
          set: {
            packagesRead: sql`${blindConferenceItems.packagesRead} + 1`,
            unitsRead: sql`${blindConferenceItems.unitsRead} + ${labelData.unitsPerBox}`, // Incrementa unidades
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
        unitsAdded: labelData.unitsPerBox,
      });

      // 3.5. SINCRONIZAR COM receivingOrderItems (Atualização Automática)
      // Busca produto para gerar uniqueCode
      const productForSync = await db.select({ sku: products.sku })
        .from(products)
        .where(eq(products.id, labelData.productId))
        .limit(1);

      if (productForSync[0]) {
        const uniqueCode = getUniqueCode(productForSync[0].sku, labelData.batch || "");

        // 🛡️ BUSCAR ITEM PRIMEIRO (Padrão Enterprise)
        const existingOrderItem = await db.select()
          .from(receivingOrderItems)
          .where(
            and(
              eq(receivingOrderItems.receivingOrderId, conference.receivingOrderId),
              eq(receivingOrderItems.uniqueCode, uniqueCode),
              eq(receivingOrderItems.tenantId, activeTenantId)
            )
          )
          .limit(1);
        
        if (existingOrderItem && existingOrderItem.length > 0) {
          const orderItem = existingOrderItem[0];
          const newQuantity = (orderItem.receivedQuantity || 0) + labelData.unitsPerBox;
          
          // 🛡️ PROTEÇÃO ENTERPRISE: Verificar over-receiving
          if (newQuantity > orderItem.expectedQuantity) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Over-receiving detectado! Esperado: ${orderItem.expectedQuantity}, Tentando receber: ${newQuantity}`,
            });
          }
          
          // ✅ UPDATE por ID (chave primária) - SEMPRE funciona
          await db.update(receivingOrderItems)
            .set({
              labelCode: input.labelCode,
              receivedQuantity: newQuantity,
              status: 'receiving',
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(receivingOrderItems.id, orderItem.id), // ✅ ID correto
                eq(receivingOrderItems.tenantId, activeTenantId)
              )
            );
        }
      }

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

      // 5.5. ✅ BUSCAR LINHA DA ORDEM (receivingOrderItem) POR uniqueCode
      const productForOrderItem = await db.select({ sku: products.sku })
        .from(products)
        .where(eq(products.id, labelData.productId))
        .limit(1);
      
      const uniqueCodeForOrderItem = getUniqueCode(productForOrderItem[0]?.sku || "", labelData.batch || "");
      
      const orderItem = await db.select()
        .from(receivingOrderItems)
        .where(
          and(
            eq(receivingOrderItems.receivingOrderId, conference.receivingOrderId),
            eq(receivingOrderItems.uniqueCode, uniqueCodeForOrderItem),
            eq(receivingOrderItems.tenantId, activeTenantId)
          )
        )
        .limit(1);
      
      console.log("✅ [readLabel] receivingOrderItem encontrado:", orderItem[0]?.id || "NÃO ENCONTRADO");

      // 6. RETORNO PARA O FRONTEND
      return {
        isNewLabel: false,
        association: {
          id: labelData.id,
          receivingOrderItemId: orderItem[0]?.id || null, // ✅ ID da linha da ordem
          productId: labelData.productId,
          productName: product[0]?.description || "",
          productSku: product[0]?.sku || "",
          batch: labelData.batch,
          expiryDate: labelData.expiryDate,
          unitsPerBox: labelData.unitsPerBox,
          packagesRead: currentPackagesRead,
          totalUnits: currentPackagesRead * labelData.unitsPerBox,
        }
      };
    }),

  /**
   * 3. Associar Etiqueta a Produto (REFATORADO)
   */
  associateLabel: protectedProcedure
    .input(z.object({
      conferenceId: z.number(),
      labelCode: z.string(),
      receivingOrderItemId: z.number(), // ✅ ID da linha da ordem (chave primária)
      productId: z.number(),
      batch: z.string().nullable(),
      expiryDate: z.string().nullable(),
      unitsPerBox: z.number(),
      totalUnitsReceived: z.number().optional(),
      tenantId: z.number().optional(), // Opcional: Admin Global pode enviar
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const userId = ctx.user?.id;
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED", message: "User not authenticated" });

      // Lógica de Admin Global
      const isGlobalAdmin = ctx.user.role === 'admin' && (ctx.user.tenantId === 1 || ctx.user.tenantId === null);
      const activeTenantId = (isGlobalAdmin && input.tenantId) 
        ? input.tenantId 
        : ctx.user.tenantId;

      if (!activeTenantId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Usuário sem Tenant vinculado" });
      }

      console.log("[associateLabel] Tenant Ativo:", activeTenantId, "| isGlobalAdmin:", isGlobalAdmin);

      // 🔑 0. BUSCAR SESSÃO DE CONFERÊNCIA PRIMEIRO (ESCOPO RAIZ)
      const conferenceSession = await db.select()
        .from(blindConferenceSessions)
        .where(
          isGlobalAdmin
            ? eq(blindConferenceSessions.id, input.conferenceId)
            : and(
                eq(blindConferenceSessions.id, input.conferenceId),
                eq(blindConferenceSessions.tenantId, activeTenantId)
              )
        )
        .limit(1);
      
      if (conferenceSession.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Sessão de conferência não encontrada"
        });
      }
      
      const conference = conferenceSession[0];
      console.log("[associateLabel] Conference encontrada:", conference.id, "| receivingOrderId:", conference.receivingOrderId);

      // ✅ BUSCAR receivingOrder PARA OBTER tenantId CORRETO
      const receivingOrder = await db.select()
        .from(receivingOrders)
        .where(eq(receivingOrders.id, conference.receivingOrderId))
        .limit(1);
      
      if (receivingOrder.length === 0) {
        throw new Error("Ordem de recebimento não encontrada");
      }
      
      const orderTenantId = receivingOrder[0].tenantId;
      console.log("[associateLabel] Usando tenantId da ordem:", orderTenantId);

      // Buscar produto para gerar uniqueCode
      const product = await db.select().from(products).where(eq(products.id, input.productId)).limit(1);
      if (product.length === 0) {
        throw new Error("Produto não encontrado");
      }

      const productSku = product[0].sku;
      console.log("[associateLabel] DEBUG:", { productSku, batch: input.batch, batchType: typeof input.batch });
      const uniqueCode = getUniqueCode(productSku, input.batch);
      console.log("[associateLabel] uniqueCode gerado:", uniqueCode);

      const actualUnitsReceived = input.totalUnitsReceived || input.unitsPerBox; // ✅ Fallback para unitsPerBox

      // 1. CRIAR ETIQUETA PERMANENTE NO ESTOQUE GLOBAL
      console.log("🔍 [associateLabel] Buscando etiqueta existente:", input.labelCode, "| orderTenantId:", orderTenantId);
      
      let existingLabel;
      try {
        existingLabel = await db.select()
          .from(labelAssociations)
          .where(
            and(
              eq(labelAssociations.labelCode, input.labelCode),
              eq(labelAssociations.tenantId, orderTenantId) // ✅ USA orderTenantId (tenant da ordem)
            )
          )
          .limit(1);
        
        console.log("✅ [associateLabel] Query executada com sucesso. Resultados:", existingLabel.length);
      } catch (error: any) {
        console.error("❌ [associateLabel] ERRO na query de existingLabel:");
        console.error("Mensagem:", error.message);
        console.error("Stack:", error.stack);
        throw new Error(`Erro ao buscar etiqueta existente: ${error.message}`);
      }

      if (existingLabel.length > 0) {
        throw new Error("Etiqueta já existe no sistema");
      }

      await db.insert(labelAssociations).values({
        labelCode: input.labelCode,
        uniqueCode: uniqueCode,
        productId: input.productId,
        batch: input.batch,
        expiryDate: toDateStr(input.expiryDate) as any,
        unitsPerBox: input.unitsPerBox,
        totalUnits: actualUnitsReceived,
        associatedBy: userId,
        associatedAt: new Date(),
        status: 'AVAILABLE' as any,
        tenantId: orderTenantId, // ✅ USA tenantId DA ORDEM
      });

      // 2. REGISTRAR PRIMEIRO BIP NA CONFERÊNCIA
      await db.insert(blindConferenceItems)
        .values({
          conferenceId: input.conferenceId,
          productId: input.productId,
          batch: input.batch || "",
          expiryDate: toDateStr(input.expiryDate) as any,
          tenantId: orderTenantId, // ✅ USA tenantId DA ORDEM
          packagesRead: 1,
          unitsRead: actualUnitsReceived, // Primeira leitura: actualUnitsReceived (pode ser fracionado)
          expectedQuantity: 0,
        })
        .onDuplicateKeyUpdate({
          set: {
            packagesRead: sql`${blindConferenceItems.packagesRead} + 1`,
            unitsRead: sql`${blindConferenceItems.unitsRead} + ${actualUnitsReceived}`, // Incrementa unidades
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
      if (!product[0].unitsPerBox) {
        await db.update(products)
          .set({ unitsPerBox: input.unitsPerBox })
          .where(eq(products.id, input.productId));
      }

      // 4.5. SINCRONIZAR COM receivingOrderItems (Atualização Automática)
      // ✅ SOLUÇÃO DEFINITIVA: UPDATE direto por ID (chave primária)
      const existingItem = await db.select()
        .from(receivingOrderItems)
        .where(
          isGlobalAdmin
            ? eq(receivingOrderItems.id, input.receivingOrderItemId)
            : and(
                eq(receivingOrderItems.id, input.receivingOrderItemId),
                eq(receivingOrderItems.tenantId, activeTenantId)
              )
        )
        .limit(1);
      
      // 🛡️ VALIDAÇÃO DEFENSIVA 1: Item existe?
      if (!existingItem || existingItem.length === 0) {
        console.error("[associateLabel] ERRO: Item não encontrado com ID:", input.receivingOrderItemId);
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Item da ordem não encontrado (ID: ${input.receivingOrderItemId}). Verifique se a NF-e foi importada corretamente.`
        });
      }
      
      // ✅ Extrair para variável segura (evitar acessar [0] múltiplas vezes)
      const item = existingItem[0];
      
      // 🛡️ VALIDAÇÃO DEFENSIVA 2: Item pertence à sessão correta?
      if (item.receivingOrderId !== conference.receivingOrderId) {
        console.error("[associateLabel] ERRO: Item não pertence a esta ordem:", { 
          itemOrderId: item.receivingOrderId, 
          sessionOrderId: conference.receivingOrderId,
          labelCode: input.labelCode,
          userId: userId,
          conferenceId: input.conferenceId
        });
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Item não pertence a esta ordem de recebimento. Possível corrupção de dados."
        });
      }
      
      const currentQuantity = item.receivedQuantity || 0;
      const newQuantity = currentQuantity + actualUnitsReceived;
      
      // 🛡️ PROTEÇÃO ENTERPRISE: Verificar over-receiving
      if (newQuantity > item.expectedQuantity) {
        console.error("[associateLabel] ERRO: Over-receiving detectado", {
          itemId: item.id,
          expectedQuantity: item.expectedQuantity,
          currentQuantity: currentQuantity,
          newQuantity: newQuantity,
          labelCode: input.labelCode,
          userId: userId
        });
        
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Over-receiving detectado! Esperado: ${item.expectedQuantity}, Tentando receber: ${newQuantity}. Verifique a quantidade bipada.`,
        });
      }
      
      console.log("[associateLabel] Atualizando item:", { 
        id: item.id, // ✅ ID correto da busca (não do input)
        currentQuantity, 
        actualUnitsReceived, 
        newQuantity 
      });
      
      // ✅ UPDATE por ID correto da busca (NÃO confiar no input.receivingOrderItemId)
      await db.update(receivingOrderItems)
        .set({
          labelCode: input.labelCode,
          receivedQuantity: newQuantity,
          status: 'receiving',
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(receivingOrderItems.id, item.id), // ✅ ID correto da busca (variável segura)
            eq(receivingOrderItems.tenantId, activeTenantId)
          )
        );
      
      console.log("[associateLabel] UPDATE concluído com sucesso! Nova quantidade:", newQuantity);

      return {
        success: true,
        message: "Etiqueta associada com sucesso",
        association: {
          id: newLabel[0].id,
          productId: input.productId,
          productName: product[0].description,
          productSku: product[0].sku,
          batch: input.batch,
          expiryDate: input.expiryDate,
          unitsPerBox: input.unitsPerBox,
          packagesRead: 1,
          totalUnits: actualUnitsReceived,
          currentQuantity: newQuantity
        }
      };
    }),

  /**
   * 3.5. Registrar Não-Conformidade (NCG)
   * REFATORADO: Cria inventory em NCG imediatamente e atualiza blockedQuantity
   */
  registerNCG: protectedProcedure
    .input(z.object({
      receivingOrderItemId: z.number(), // ID do item da ordem
      labelCode: z.string().optional(), // Opcional: será gerado se não fornecido
      conferenceId: z.number(),
      quantity: z.number().positive("Quantidade deve ser maior que zero"), // Quantidade bloqueada
      description: z.string().min(10, "Descrição deve ter no mínimo 10 caracteres"), // Motivo da NCG
      photoUrl: z.string().optional(),
      unitsPerBox: z.number().positive().optional(), // Obrigatório se etiqueta não existe
      batch: z.string().optional(), // Vindo da Tela 2
      expiryDate: z.string().optional(), // Vindo da Tela 2
      productId: z.number().optional(), // Vindo da Tela 2
      tenantId: z.number().optional(), // Opcional: Admin Global pode enviar
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const userId = ctx.user?.id;
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED", message: "User not authenticated" });

      // Lógica de Admin Global
      const isGlobalAdmin = ctx.user.role === 'admin' && (ctx.user.tenantId === 1 || ctx.user.tenantId === null);
      const activeTenantId = (isGlobalAdmin && input.tenantId) 
        ? input.tenantId 
        : ctx.user.tenantId;

      if (!activeTenantId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Usuário sem Tenant vinculado" });
      }

      console.log("[registerNCG] Tenant Ativo:", activeTenantId, "| isGlobalAdmin:", isGlobalAdmin);

      // 1. BUSCAR LOCALIZAÇÃO NCG (Não Conformidade/Quarentena)
      const [ncgLocation] = await db.select()
        .from(warehouseLocations)
        .where(
          and(
            eq(warehouseLocations.zoneCode, "NCG"), // Busca por zoneCode NCG
            eq(warehouseLocations.tenantId, activeTenantId)
          )
        )
        .limit(1);

      if (!ncgLocation) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Localização NCG não configurada" });
      }

      // 2. BUSCAR DADOS DO ITEM DA ORDEM
      const [orderItem] = await db.select()
        .from(receivingOrderItems)
        .where(eq(receivingOrderItems.id, input.receivingOrderItemId))
        .limit(1);

      if (!orderItem) {
        throw new Error("Item da ordem não encontrado");
      }

      // ✅ BUSCAR receivingOrder PARA OBTER tenantId CORRETO
      const [receivingOrder] = await db.select()
        .from(receivingOrders)
        .where(eq(receivingOrders.id, orderItem.receivingOrderId))
        .limit(1);
      
      if (!receivingOrder) {
        throw new Error("Ordem de recebimento não encontrada");
      }
      
      const orderTenantId = receivingOrder.tenantId;
      console.log("[registerNCG] Usando tenantId da ordem:", orderTenantId);

      // ✅ BUSCAR PRODUTO PARA OBTER SKU E unitsPerBox
      const [product] = await db.select()
        .from(products)
        .where(eq(products.id, orderItem.productId))
        .limit(1);

      // 3. GERAR OU VERIFICAR ETIQUETA
      let labelCode = input.labelCode;
      
      if (!labelCode) {
        // Gerar labelCode automático: SKU + Lote + timestamp
        const timestamp = Date.now().toString().slice(-6); // Últimos 6 dígitos
        labelCode = `${product?.sku || orderItem.productId}${orderItem.batch || 'SL'}${timestamp}`;
        console.log("[registerNCG] LabelCode gerado automaticamente:", labelCode);
      }

      // Verificar se etiqueta já existe
      // ✅ USA orderTenantId (tenant da ordem) para buscar a etiqueta
      const [existingLabel] = await db.select()
        .from(labelAssociations)
        .where(
          and(
            eq(labelAssociations.labelCode, labelCode),
            eq(labelAssociations.tenantId, orderTenantId)
          )
        )
        .limit(1);

      // Se não existir, criar nova etiqueta
      if (!existingLabel) {
        console.log("[registerNCG] Criando nova etiqueta:", labelCode);
        
        // Usar dados da Tela 2 se fornecidos, senão usar do orderItem
        const finalUnitsPerBox = input.unitsPerBox || product?.unitsPerBox || 1;
        const finalBatch = input.batch || orderItem.batch || null;
        const finalExpiryDateRaw = input.expiryDate || (orderItem.expiryDate ? String(orderItem.expiryDate) : null) || null;
        const finalExpiryDate = toDateStr(finalExpiryDateRaw) as any;
        const finalProductId = input.productId || orderItem.productId;
        
        await db.insert(labelAssociations).values({
          tenantId: orderTenantId, // ✅ USA tenantId DA ORDEM
          labelCode: labelCode,
          uniqueCode: orderItem.uniqueCode || `${finalProductId}-${finalBatch || 'SL'}`,
          productId: finalProductId,
          batch: finalBatch,
          expiryDate: finalExpiryDate,
          unitsPerBox: finalUnitsPerBox,
          associatedBy: userId,
          associatedAt: new Date(),
          status: 'AVAILABLE' as any,
        });
      }

      // 4. INVENTÁRIO NCG: criado apenas no confirmFinish com formato de data consistente
      // O registerNCG apenas registra a não-conformidade para auditoria.

      // 5. ATUALIZAR receivedQuantity E blockedQuantity NO ITEM DA ORDEM
      // O registerNCG representa uma leitura de etiqueta como qualquer outra.
      // receivedQuantity = total físico recebido (etiquetas normais + NCG)
      // blockedQuantity  = apenas unidades NCG (para calcular addressedQuantity)
      // addressedQuantity = receivedQuantity - blockedQuantity (calculado no prepareFinish)
      const ncgUnitsPerBox = input.unitsPerBox || product?.unitsPerBox || 1;
      const ncgPackages = Math.ceil(input.quantity / ncgUnitsPerBox);
      // 5a. Incrementar receivedQuantity (total físico) e blockedQuantity no receivingOrderItems
      await db.update(receivingOrderItems)
        .set({
          receivedQuantity: sql`${receivingOrderItems.receivedQuantity} + ${input.quantity}`,
          blockedQuantity: sql`${receivingOrderItems.blockedQuantity} + ${input.quantity}`,
          status: "receiving"
        })
        .where(eq(receivingOrderItems.id, input.receivingOrderItemId));
      // 5b. Registrar leitura NCG em blindConferenceItems (packagesRead + unitsRead)
      // NCG é uma leitura de etiqueta como qualquer outra — deve aparecer no contador de volumes
      const finalBatchNCG = input.batch || orderItem.batch || "";
      const finalExpiryNCG = toDateStr(input.expiryDate || (orderItem.expiryDate ? String(orderItem.expiryDate) : null)) as any;
      const finalProductIdNCG = input.productId || orderItem.productId;
      await db.insert(blindConferenceItems)
        .values({
          conferenceId: input.conferenceId,
          productId: finalProductIdNCG,
          batch: finalBatchNCG,
          expiryDate: finalExpiryNCG,
          tenantId: orderTenantId,
          packagesRead: ncgPackages,
          unitsRead: input.quantity,
          expectedQuantity: 0,
        })
        .onDuplicateKeyUpdate({
          set: {
            packagesRead: sql`${blindConferenceItems.packagesRead} + ${ncgPackages}`,
            unitsRead: sql`${blindConferenceItems.unitsRead} + ${input.quantity}`,
            updatedAt: new Date(),
          },
        });
      // 6. (JÁ FEITO NO PASSO 3) Etiqueta já foi criada/atualizada com status BLOCKED

      // 7. REGISTRAR NÃO-CONFORMIDADE
      await db.insert(nonConformities).values({
        tenantId: orderTenantId, // ✅ USA tenantId DA ORDEM
        receivingOrderItemId: input.receivingOrderItemId,
        labelCode: labelCode,
        conferenceId: input.conferenceId,
        locationId: ncgLocation.id, // Localização NCG onde foi alocado
        shippingId: null, // NULL enquanto em estoque
        description: input.description,
        photoUrl: input.photoUrl || null,
        registeredBy: userId,
      });

      return {
        success: true,
        message: "Não-conformidade registrada com sucesso",
        labelCode: labelCode,
        quantity: input.quantity,
        location: ncgLocation.code
      };
    }),

  /**
   * 4. Desfazer Última Leitura (REFATORADO)
   */
  undoLastReading: protectedProcedure
    .input(z.object({
      conferenceId: z.number(),
      productId: z.number(),
      batch: z.string().nullable(),
      tenantId: z.number().optional(), // Opcional: Admin Global pode enviar
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const userId = ctx.user?.id;
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED", message: "User not authenticated" });

      // Lógica de Admin Global
      const isGlobalAdmin = ctx.user.role === 'admin' && (ctx.user.tenantId === 1 || ctx.user.tenantId === null);
      const activeTenantId = (isGlobalAdmin && input.tenantId) 
        ? input.tenantId 
        : ctx.user.tenantId;

      if (!activeTenantId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Usuário sem Tenant vinculado" });
      }

      console.log("[undoLastReading] Tenant Ativo:", activeTenantId, "| isGlobalAdmin:", isGlobalAdmin);
      // ✅ USA orderTenantId (tenant da ordem) para buscar blindConferenceItems
      const orderTenantId = await getOrderTenantId(db, input.conferenceId);
      const batchValue = input.batch || "";
      // 1. BUSCAR ITEM NA CONFERÊNCIAIA
      const conferenceItem = await db.select()
        .from(blindConferenceItems)
        .where(
          and(
            eq(blindConferenceItems.conferenceId, input.conferenceId),
            eq(blindConferenceItems.productId, input.productId),
            eq(blindConferenceItems.batch, batchValue),
            eq(blindConferenceItems.tenantId, orderTenantId)
          )
        )
        .limit(1);

      if (conferenceItem.length === 0) {
        throw new Error("Item não encontrado na conferência");
      }

      const currentPackages = conferenceItem[0].packagesRead;

      if (currentPackages <= 0) {
        throw new Error("Não há leituras para desfazer");
      }

      // 2. DECREMENTO ATÔMICO
      if (currentPackages === 1) {
        // Se era a última embalagem, deletar o registro
        await db.delete(blindConferenceItems)
          .where(
            and(
              eq(blindConferenceItems.conferenceId, input.conferenceId),
              eq(blindConferenceItems.productId, input.productId),
              eq(blindConferenceItems.batch, batchValue),
              eq(blindConferenceItems.tenantId, orderTenantId)
            )
          );
      } else {
        // Caso contrário, decrementar
        await db.update(blindConferenceItems)
          .set({
            packagesRead: sql`${blindConferenceItems.packagesRead} - 1`,
            updatedAt: new Date()
          })
          .where(
            and(
              eq(blindConferenceItems.conferenceId, input.conferenceId),
              eq(blindConferenceItems.productId, input.productId),
              eq(blindConferenceItems.batch, batchValue),
              eq(blindConferenceItems.tenantId, orderTenantId)
            )
          );
      }

      return {
        success: true,
        message: "Última leitura desfeita com sucesso",
        newPackagesRead: Math.max(0, currentPackages - 1)
      };
    }),

  /**
   * 5. Ajustar Quantidade (REFATORADO)
   */
  adjustQuantity: protectedProcedure
    .input(z.object({
      conferenceId: z.number(),
      productId: z.number(),
      batch: z.string().nullable(),
      newQuantity: z.number(),
      reason: z.string(),
      tenantId: z.number().optional(), // Opcional: Admin Global pode enviar
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const userId = ctx.user?.id;
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED", message: "User not authenticated" });

      // Lógica de Admin Global
      const isGlobalAdmin = ctx.user.role === 'admin' && (ctx.user.tenantId === 1 || ctx.user.tenantId === null);
      const activeTenantId = (isGlobalAdmin && input.tenantId) 
        ? input.tenantId 
        : ctx.user.tenantId;

      if (!activeTenantId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Usuário sem Tenant vinculado" });
      }

      console.log("[adjustQuantity] Tenant Ativo:", activeTenantId, "| isGlobalAdmin:", isGlobalAdmin);
      // ✅ USA orderTenantId (tenant da ordem) para buscar blindConferenceItems
      const orderTenantId = await getOrderTenantId(db, input.conferenceId);
      const batchValue = input.batch || "";;

      // 1. BUSCAR ITEM NA CONFERÊNCIA
      const conferenceItem = await db.select()
        .from(blindConferenceItems)
        .where(
          and(
            eq(blindConferenceItems.conferenceId, input.conferenceId),
            eq(blindConferenceItems.productId, input.productId),
            eq(blindConferenceItems.batch, batchValue),
            eq(blindConferenceItems.tenantId, orderTenantId)
          )
        )
        .limit(1);

      if (conferenceItem.length === 0) {
        throw new Error("Item não encontrado na conferência");
      }

      const oldQuantity = conferenceItem[0].packagesRead;

      // 2. ATUALIZAR QUANTIDADE
      await db.update(blindConferenceItems)
        .set({
          packagesRead: input.newQuantity,
          updatedAt: new Date()
        })
        .where(
          and(
            eq(blindConferenceItems.conferenceId, input.conferenceId),
            eq(blindConferenceItems.productId, input.productId),
            eq(blindConferenceItems.batch, batchValue),
            eq(blindConferenceItems.tenantId, orderTenantId)
          )
        );

      // 3. REGISTRAR AJUSTE NO HISTÓRICO
      await db.insert(blindConferenceAdjustments).values({
        conferenceId: input.conferenceId,
        productId: input.productId,
        batch: input.batch,
        oldQuantity: oldQuantity,
        newQuantity: input.newQuantity,
        reason: input.reason,
        adjustedBy: userId,
      });

      return {
        success: true,
        message: "Quantidade ajustada com sucesso",
        oldQuantity,
        newQuantity: input.newQuantity
      };
    }),

  /**
   * 6. Obter Resumo da Conferência (REFATORADO)
   */
  getSummary: protectedProcedure
    .input(z.object({
      conferenceId: z.number(),
      tenantId: z.number().optional(), // Opcional: Admin Global pode enviar
    }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const userId = ctx.user?.id;
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED", message: "User not authenticated" });

      // Lógica de Admin Global
      const isGlobalAdmin = ctx.user.role === 'admin' && (ctx.user.tenantId === 1 || ctx.user.tenantId === null);
      const activeTenantId = (isGlobalAdmin && input.tenantId) 
        ? input.tenantId 
        : ctx.user.tenantId;

      if (!activeTenantId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Usuário sem Tenant vinculado" });
      }

       console.log("[getSummary] Tenant Ativo:", activeTenantId, "| isGlobalAdmin:", isGlobalAdmin);
      // ✅ USA orderTenantId (tenant da ordem) para buscar blindConferenceItems
      const orderTenantId = await getOrderTenantId(db, input.conferenceId);
      // 1. BUSCAR ITENS DA CONFERÊNCIA
      const items = await db.select({
        productId: blindConferenceItems.productId,
        productSku: products.sku,
        productName: products.description,
        batch: blindConferenceItems.batch,
        expiryDate: blindConferenceItems.expiryDate,
        packagesRead: blindConferenceItems.packagesRead,
        unitsRead: blindConferenceItems.unitsRead,
        expectedQuantity: blindConferenceItems.expectedQuantity,
      })
        .from(blindConferenceItems)
        .leftJoin(products, eq(blindConferenceItems.productId, products.id))
        .where(
          and(
            eq(blindConferenceItems.conferenceId, input.conferenceId),
            eq(blindConferenceItems.tenantId, orderTenantId)
          )
        );

      // readLabel é a única fonte de verdade para unitsRead e packagesRead.
      // Toda etiqueta lida (incluindo NCG) passa pelo readLabel, então unitsRead já
      // inclui as unidades NCG. Não é necessário buscar blockedQuantity aqui.
      return {
        conferenceId: input.conferenceId,
        conferenceItems: items.map(item => ({
          productId: item.productId,
          productSku: item.productSku || "",
          productName: item.productName || "",
          batch: item.batch || null,
          expiryDate: item.expiryDate,
          packagesRead: item.packagesRead,
          unitsRead: (item.unitsRead || 0),
          expectedQuantity: item.expectedQuantity,
        }))
      };
    }),

  /**
   * 6.5. Preparar Finalização - Calcular addressedQuantity e retornar resumo
   */
  prepareFinish: protectedProcedure
    .input(z.object({
      conferenceId: z.number(),
      tenantId: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const userId = ctx.user?.id;
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED", message: "User not authenticated" });

      const isGlobalAdmin = ctx.user.role === 'admin' && (ctx.user.tenantId === 1 || ctx.user.tenantId === null);
      const activeTenantId = (isGlobalAdmin && input.tenantId) 
        ? input.tenantId 
        : ctx.user.tenantId;

      if (!activeTenantId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Usuário sem Tenant vinculado" });
      }

      // 1. BUSCAR SESSÃO
      const session = await db.select()
        .from(blindConferenceSessions)
        .where(eq(blindConferenceSessions.id, input.conferenceId))
        .limit(1);

      if (!session || session.length === 0 || !session[0]) {
        throw new TRPCError({ 
          code: 'NOT_FOUND', 
          message: 'Sessão de conferência não encontrada.' 
        });
      }

      // 2. BUSCAR ORDEM DE RECEBIMENTO
      const [order] = await db.select()
        .from(receivingOrders)
        .where(eq(receivingOrders.id, session[0].receivingOrderId))
        .limit(1);
      
      if (!order) {
        throw new Error("Ordem de recebimento não encontrada");
      }

      // 3. CALCULAR E ATUALIZAR addressedQuantity
      const orderItems = await db.select()
        .from(receivingOrderItems)
        .where(
          and(
            eq(receivingOrderItems.receivingOrderId, session[0].receivingOrderId),
            eq(receivingOrderItems.tenantId, activeTenantId)
          )
        );

      const summary = [];

       for (const orderItem of orderItems) {
        // SEMÂNTICA DEFINITIVA DOS CAMPOS:
        // receivedQuantity (banco) = total físico recebido: readLabel (normais) + registerNCG (NCG) = 560
        // blockedQuantity (banco)  = apenas unidades NCG registradas pelo registerNCG = 80
        // addressedQuantity        = receivedQuantity - blockedQuantity = 480 (vai para endereços normais)
        const receivedQtyDB  = (orderItem.receivedQuantity || 0);  // 560 (total físico)
        const blockedQtyDB   = (orderItem.blockedQuantity  || 0);  // 80  (NCG)
        const addressableQty = receivedQtyDB - blockedQtyDB;       // 480 (endereçável)
        const totalPhysicalReceived = receivedQtyDB;               // 560 (já é o total físico)

        await db.update(receivingOrderItems)
          .set({
            addressedQuantity: addressableQty,
            status: "completed",
            updatedAt: new Date()
          })
          .where(eq(receivingOrderItems.id, orderItem.id));
        // Buscar produto para exibir no resumo
        const [product] = await db.select({ sku: products.sku, description: products.description })
          .from(products)
          .where(eq(products.id, orderItem.productId))
          .limit(1);
        summary.push({
          productId: orderItem.productId,
          productSku: product?.sku || '',
          productDescription: product?.description || '',
          batch: orderItem.batch,
          expectedQuantity: orderItem.expectedQuantity,
          receivedQuantity: totalPhysicalReceived, // 560: total físico para exibição
          blockedQuantity: blockedQtyDB,           // 80: NCG
          addressedQuantity: addressableQty,       // 480: endereçável
        });
      }

      return {
        success: true,
        receivingOrderId: session[0].receivingOrderId,
        receivingOrderCode: order.orderNumber,
        summary,
      };
    }),

  /**
   * 7. Finalizar Conferência (REFATORADO)
   */
  finish: protectedProcedure
    .input(z.object({
      conferenceId: z.number(),
      tenantId: z.number().optional(), // Opcional: Admin Global pode enviar
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const userId = ctx.user?.id;
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED", message: "User not authenticated" });

      // Lógica de Admin Global
      const isGlobalAdmin = ctx.user.role === 'admin' && (ctx.user.tenantId === 1 || ctx.user.tenantId === null);
      const activeTenantId = (isGlobalAdmin && input.tenantId) 
        ? input.tenantId 
        : ctx.user.tenantId;

      if (!activeTenantId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Usuário sem Tenant vinculado" });
      }

      console.log("[finish] Tenant Ativo:", activeTenantId, "| isGlobalAdmin:", isGlobalAdmin);

      // TRANSAÇÃO ATÔMICA: Tudo ou nada (mesmo padrão do closeReceivingOrder)
      return await db.transaction(async (tx) => {
        // 1. BUSCAR SESSÃO
        const session = await tx.select()
        .from(blindConferenceSessions)
        .where(eq(blindConferenceSessions.id, input.conferenceId))
        .limit(1);

        if (!session || session.length === 0 || !session[0]) {
          throw new TRPCError({ 
            code: 'NOT_FOUND', 
            message: 'Sessão de conferência não encontrada.' 
          });
        }

        // Buscar receivingOrder para obter tenantId correto
        const [order] = await tx.select()
          .from(receivingOrders)
          .where(eq(receivingOrders.id, session[0].receivingOrderId))
          .limit(1);
        
        if (!order) {
          throw new Error("Ordem de recebimento não encontrada");
        }
        
        const orderTenantId = order.tenantId;

        // 2. BUSCAR ITENS COM addressedQuantity JÁ CALCULADO (pelo prepareFinish)
        const itemsWithQty = await tx.select({
          id: receivingOrderItems.id,
          productId: receivingOrderItems.productId,
          batch: receivingOrderItems.batch,
          expiryDate: receivingOrderItems.expiryDate,
          serialNumber: receivingOrderItems.serialNumber,
          uniqueCode: receivingOrderItems.uniqueCode,
          labelCode: receivingOrderItems.labelCode,
          tenantId: receivingOrderItems.tenantId,
          addressedQuantity: receivingOrderItems.addressedQuantity,
          blockedQuantity: receivingOrderItems.blockedQuantity,
        })
          .from(receivingOrderItems)
          .where(
            and(
              eq(receivingOrderItems.receivingOrderId, session[0].receivingOrderId),
              eq(receivingOrderItems.tenantId, activeTenantId)
            )
          );

        console.log('[finish] Items com addressedQuantity:', itemsWithQty.length);

        if (itemsWithQty.length === 0) {
          throw new Error("Nenhum item encontrado para criar inventory");
        }

        // 3. BUSCAR ZONA E ENDEREÇO DE RECEBIMENTO (REC)
        const zoneREC = await tx.select()
          .from(warehouseZones)
          .where(eq(warehouseZones.code, 'REC'))
          .limit(1);

        if (zoneREC.length === 0) {
          throw new Error("Zona de Recebimento ('REC') não configurada");
        }

        const recLocation = await tx.select()
          .from(warehouseLocations)
          .where(
            and(
              eq(warehouseLocations.tenantId, activeTenantId),
              eq(warehouseLocations.zoneId, zoneREC[0].id)
            )
          )
          .limit(1);

        if (recLocation.length === 0) {
          throw new Error("Endereço de recebimento não encontrado para este tenant");
        }

        const locationId = recLocation[0].id;

        // 4. VALIDATION GUARD: Validar todos os itens ANTES de inserir
        const validationErrors: string[] = [];
        
        for (const item of itemsWithQty) {
          if (!item || item.addressedQuantity === undefined || item.addressedQuantity === null) {
            validationErrors.push(`Item ${item?.uniqueCode || 'desconhecido'}: addressedQuantity ausente`);
          }
          if (!item.productId) {
            validationErrors.push(`Item ${item?.uniqueCode || 'desconhecido'}: productId ausente`);
          }
          if (!item.uniqueCode) {
            validationErrors.push(`Item com productId ${item?.productId}: uniqueCode ausente`);
          }
          if (!item.labelCode) {
            validationErrors.push(`Item ${item?.uniqueCode}: labelCode ausente`);
          }
        }
        
        if (validationErrors.length > 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Validação falhou. Erros encontrados:\n${validationErrors.join('\n')}`
          });
        }

        // 5. CRIAR 1 INVENTORY POR receivingOrderItem (1 uniqueCode = 1 inventory)
        // Todos os itens já foram validados pelo Validation Guard acima
        for (const item of itemsWithQty) {
          console.log('[finish] Criando inventory para item:', item.uniqueCode, 'quantity:', item.addressedQuantity);
          
          // Buscar se já existe inventory para este uniqueCode
          const existingInventory = await tx.select()
            .from(inventory)
            .where(
              and(
                eq(inventory.uniqueCode, item.uniqueCode || ""),
                eq(inventory.tenantId, activeTenantId),
                eq(inventory.locationZone, 'REC')
              )
            )
            .limit(1);

          if (existingInventory.length > 0) {
            // Atualizar inventory existente
            await tx.update(inventory)
              .set({
                quantity: Number(item.addressedQuantity) || 0,
                locationId: locationId,
                status: "available",
                updatedAt: new Date()
              })
              .where(eq(inventory.id, existingInventory[0].id));
          } else {
            // Criar novo inventory
            await tx.insert(inventory).values({
              tenantId: activeTenantId,
              productId: item.productId,
              locationId: locationId,
              batch: item.batch || "",
              expiryDate: toDateStr(item.expiryDate) as any,  // string YYYY-MM-DD aceita pelo mysql2
              uniqueCode: item.uniqueCode || "",
              labelCode: item.labelCode || null,
              serialNumber: null,                             // explícito para não deslocar parâmetros
              locationZone: 'REC',
              quantity: Number(item.addressedQuantity) || 0,
              reservedQuantity: 0,
              status: "available",
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }
        }

// 5b. CRIAR INVENTORY DAMAGED PARA ITENS COM NCG (blockedQuantity > 0)
// ... busca de ncgZone e ncgLocation ...

if (ncgLocation.length > 0) {
  const ncgLocationId = ncgLocation[0].id;
  const ncgZoneCode = ncgLocation[0].zoneCode || 'NCG';

  for (const item of itemsWithQty) {
    const blockedQty = Number(item.blockedQuantity) || 0;
    if (blockedQty <= 0) continue;

    const existingDamaged = await tx.select()
      .from(inventory)
      .where(
        and(
          eq(inventory.uniqueCode, item.uniqueCode || ""),
          eq(inventory.tenantId, activeTenantId),
          eq(inventory.status, "quarantine"), // Busca correta por status de quarentena
          eq(inventory.locationId, ncgLocationId)
        )
      )
      .limit(1);

    if (existingDamaged.length > 0) {
      await tx.update(inventory)
        .set({ quantity: blockedQty, updatedAt: new Date() })
        .where(eq(inventory.id, existingDamaged[0].id));
    } else {
      await tx.insert(inventory).values({
        tenantId: activeTenantId,
        productId: item.productId,
        locationId: ncgLocationId,
        batch: item.batch || "",
        expiryDate: toDateStr(item.expiryDate) as any,
        uniqueCode: item.uniqueCode || "",
        labelCode: item.labelCode || null,
        serialNumber: null,
        locationZone: ncgZoneCode,
        quantity: blockedQty,
        reservedQuantity: 0,
        status: "quarantine", // ✅ CORRETO: Status para o PRODUTO (Inventory)
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }
}

// 5c. ATUALIZAR STATUS DOS ENDEREÇOS (WAREHOUSE LOCATIONS)
// Endereço físico deve ser 'active' ou 'occupied'
await tx.update(warehouseLocations)
  .set({ status: "active", updatedAt: new Date() }) // ✅ CORRETO: Status para o LOCAL (WarehouseLocation)
  .where(eq(warehouseLocations.id, locationId));

if (ncgZone.length > 0) {
  // ... busca ncgLocForUpdate ...
  if (ncgLocForUpdate.length > 0) {
    await tx.update(warehouseLocations)
      .set({ status: "active", updatedAt: new Date() }) // ✅ CORRETO: Status para o LOCAL (WarehouseLocation)
      .where(eq(warehouseLocations.id, ncgLocForUpdate[0].id));
  }
}

        // 5. ATIVAR ETIQUETAS (RECEIVING → AVAILABLE)
        // Buscar todos os produtos conferidos para liberar suas etiquetas
        const productIds = itemsWithQty.map(item => item.productId);
        
        // Etiquetas ativas: status controlado por inventory.status (sem atualização em labelAssociations)

        // 5. FINALIZAR SESSÃO
        await tx.update(blindConferenceSessions)
          .set({
            status: "completed",
            finishedAt: new Date()
          })
          .where(eq(blindConferenceSessions.id, input.conferenceId));

        // 7. ATUALIZAR STATUS DA ORDEM DE RECEBIMENTO
        await tx.update(receivingOrders)
          .set({
            status: "completed",
            updatedAt: new Date()
          })
          .where(eq(receivingOrders.id, session[0].receivingOrderId));

          return {
            success: true,
            message: "Conferência finalizada com sucesso",
            itemsProcessed: itemsWithQty.length
          };
      }); // Fim da transação atômica
    }),

  /**
   * 7. Buscar Data de Validade do XML (getExpiryDateFromXML)
   * Busca expiryDate de receivingOrderItems por SKU+Lote
   */
  getExpiryDateFromXML: protectedProcedure
    .input(z.object({
      sku: z.string(),
      batch: z.string(),
      tenantId: z.number().optional(), // Opcional: Admin Global pode enviar
    }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Lógica de Admin Global
      const isGlobalAdmin = ctx.user?.role === 'admin' && (ctx.user?.tenantId === 1 || ctx.user?.tenantId === null);
      const activeTenantId = (isGlobalAdmin && input.tenantId) 
        ? input.tenantId 
        : ctx.user?.tenantId;

      if (!activeTenantId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Usuário sem Tenant vinculado" });
      }

      // Gera uniqueCode (SKU+Lote)
      const uniqueCode = getUniqueCode(input.sku, input.batch);

      // Busca item da NF-e por uniqueCode
      const item = await db.select({
        expiryDate: receivingOrderItems.expiryDate,
        expectedQuantity: receivingOrderItems.expectedQuantity,
      })
        .from(receivingOrderItems)
        .where(
          and(
            eq(receivingOrderItems.uniqueCode, uniqueCode),
            eq(receivingOrderItems.tenantId, activeTenantId)
          )
        )
        .limit(1);

      if (item.length === 0) {
        return {
          found: false,
          expiryDate: null,
          expectedQuantity: null,
        };
      }

      return {
        found: true,
        expiryDate: item[0].expiryDate,
        expectedQuantity: item[0].expectedQuantity,
      };
    }),

  /**
   * 8. Fechar Ordem de Recebimento (closeReceivingOrder)
   * Valida divergências, atualiza saldos e ativa etiquetas (RECEIVING → AVAILABLE)
   */
  closeReceivingOrder: protectedProcedure
    .input(z.object({
      receivingOrderId: z.number(),
      adminApprovalToken: z.string().optional(), // Senha do admin se houver divergência
      tenantId: z.number().optional(), // Opcional: Admin Global pode enviar
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const userId = ctx.user?.id;
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED", message: "User not authenticated" });

      // Lógica de Admin Global
      const isGlobalAdmin = ctx.user.role === 'admin' && (ctx.user.tenantId === 1 || ctx.user.tenantId === null);
      const activeTenantId = (isGlobalAdmin && input.tenantId) 
        ? input.tenantId 
        : ctx.user.tenantId;

      if (!activeTenantId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Usuário sem Tenant vinculado" });
      }

      console.log("[closeReceivingOrder] Tenant Ativo:", activeTenantId, "| isGlobalAdmin:", isGlobalAdmin);
      // ✅ USA orderTenantId (tenant da ordem) para buscar blindConferenceItems
      const [receivingOrderForTenant] = await db.select({ tenantId: receivingOrders.tenantId })
        .from(receivingOrders)
        .where(eq(receivingOrders.id, input.receivingOrderId))
        .limit(1);
      if (!receivingOrderForTenant) throw new TRPCError({ code: "NOT_FOUND", message: "Ordem de recebimento não encontrada" });
      const orderTenantId = receivingOrderForTenant.tenantId;
      // TRANSAÇÃO ATÔMICA: Tudo ou nadaa
      return await db.transaction(async (tx) => {
        // 1. BUSCAR TODOS OS ITENS ESPERADOS (XML)
        const items = await tx.select()
          .from(receivingOrderItems)
          .where(
            and(
              eq(receivingOrderItems.receivingOrderId, input.receivingOrderId),
              eq(receivingOrderItems.tenantId, activeTenantId)
            )
          );

        if (items.length === 0) {
          throw new Error("Ordem de recebimento não possui itens");
        }

        // ✅ VALIDAÇÃO: Impedir fechamento se nenhum item foi conferido
        const totalReceived = items.reduce((sum, item) => sum + (item.receivedQuantity || 0), 0);
        console.log("[closeReceivingOrder] Total recebido:", totalReceived);
        
        if (totalReceived === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Não é possível finalizar uma ordem sem nenhum item conferido. Verifique se as etiquetas foram associadas corretamente."
          });
        }

        const divergences: string[] = [];

        for (const item of items) {
          // 2. BUSCAR TOTAL CONFERIDO (blindConferenceItems)
          const conferenceData = await tx.select({
            totalReceived: sql<number>`COALESCE(SUM(${blindConferenceItems.packagesRead}), 0)`,
          })
            .from(blindConferenceItems)
            .where(
              and(
                eq(blindConferenceItems.productId, item.productId),
                eq(blindConferenceItems.batch, item.batch || ""),
                eq(blindConferenceItems.tenantId, orderTenantId)
              )
            );

          const receivedPackages = Number(conferenceData[0]?.totalReceived || 0);
          const expectedPackages = item.expectedQuantity;

          // 3. VALIDAÇÃO DE DIVERGÊNCIA
          if (receivedPackages !== expectedPackages) {
            const product = await tx.select({ sku: products.sku, description: products.description })
              .from(products)
              .where(eq(products.id, item.productId))
              .limit(1);

            const productInfo = product[0] ? `${product[0].sku} - ${product[0].description}` : `ID ${item.productId}`;
            divergences.push(
              `${productInfo}: Esperado ${expectedPackages}, Recebido ${receivedPackages}`
            );
          }
        }

        // 4. SE HOUVER DIVERGÊNCIA, EXIGIR APROVAÇÃO ADMIN
        if (divergences.length > 0 && !input.adminApprovalToken) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `Divergências encontradas:\n${divergences.join('\n')}\n\nRequer aprovação de administrador.`
          });
        }

        // 5. ATUALIZAR SALDOS E STATUS DOS ITENS
        for (const item of items) {
          const conferenceData = await tx.select({
            totalReceived: sql<number>`COALESCE(SUM(${blindConferenceItems.packagesRead}), 0)`,
          })
            .from(blindConferenceItems)
            .where(
              and(
                eq(blindConferenceItems.productId, item.productId),
                eq(blindConferenceItems.batch, item.batch || ""),
                eq(blindConferenceItems.tenantId, orderTenantId)
              )
            );

          const receivedUnits = Number(conferenceData[0]?.totalReceived || 0);
          const blockedUnits = item.blockedQuantity || 0;
          const addressedUnits = receivedUnits - blockedUnits;

          await tx.update(receivingOrderItems)
            .set({
              receivedQuantity: receivedUnits,
              blockedQuantity: blockedUnits,
              addressedQuantity: addressedUnits,
              approvedBy: divergences.length > 0 ? userId : null,
              status: "approved",
            })
            .where(eq(receivingOrderItems.id, item.id));
        }

        // 6. ETIQUETAS ATIVAS: status controlado por inventory.status (sem atualização em labelAssociations)

        // 7. FINALIZAR ORDEM DE RECEBIMENTO
        await tx.update(receivingOrders)
          .set({
            status: "completed",
            updatedAt: new Date()
          })
          .where(eq(receivingOrders.id, input.receivingOrderId));

        return {
          success: true,
          message: divergences.length > 0 
            ? `Ordem finalizada com ${divergences.length} divergência(s) aprovada(s)` 
            : "Ordem finalizada com sucesso",
          itemsProcessed: items.length,
          divergences: divergences
        };
      });
    }),

  /**
   * checkLabelExists: Verifica se uma etiqueta já está cadastrada em labelAssociations
   * Usado no fluxo NCG para autofill do produto quando a etiqueta já existe
   */
  checkLabelExists: protectedProcedure
    .input(z.object({
      labelCode: z.string(),
      tenantId: z.number().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const isGlobalAdmin = ctx.user?.role === 'admin' && (ctx.user.tenantId === 1 || ctx.user.tenantId === null);
      const activeTenantId = (isGlobalAdmin && input.tenantId)
        ? input.tenantId
        : ctx.user?.tenantId;

      if (!activeTenantId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Usuário sem Tenant vinculado" });
      }

      // Buscar etiqueta em labelAssociations (mesmo padrão do readLabel)
      const [label] = await db.select()
        .from(labelAssociations)
        .where(
          and(
            eq(labelAssociations.labelCode, input.labelCode),
            eq(labelAssociations.tenantId, activeTenantId)
          )
        )
        .limit(1);

      if (!label) {
        return { exists: false, label: null, product: null };
      }

      // Buscar dados do produto vinculado à etiqueta
      const [product] = await db.select()
        .from(products)
        .where(eq(products.id, label.productId))
        .limit(1);

      return {
        exists: true,
        label: {
          id: label.id,
          labelCode: label.labelCode,
          productId: label.productId,
          batch: label.batch,
          expiryDate: label.expiryDate,
          unitsPerBox: label.unitsPerBox,
        },
        product: product ? {
          id: product.id,
          sku: product.sku,
          description: product.description,
        } : null,
      };
    }),

  /**
   * Liberação Gerencial de Estoque Restrito
   * Autentica um usuário admin/manager e libera itens com status blocked ou quarantine
   * para o status available, registrando em auditLogs.
   *
   * blocked: impede entrada E saída — requer liberação gerencial
   * quarantine: permite entrada, impede saída — requer liberação gerencial
   */
  releaseInventory: protectedProcedure
    .input(z.object({
      inventoryId: z.number().optional(),   // Liberar por ID de registro de estoque
      labelCode: z.string().optional(),     // Liberar por código de etiqueta (LPN)
      adminLogin: z.string().min(1),        // Login do admin autorizador
      adminPassword: z.string().min(1),     // Senha do admin autorizador
      reason: z.string().min(1),            // Motivo da liberação
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // 1. Autenticar o admin
      const [adminUser] = await db
        .select({
          id: systemUsers.id,
          tenantId: systemUsers.tenantId,
          fullName: systemUsers.fullName,
          passwordHash: systemUsers.passwordHash,
          active: systemUsers.active,
          failedLoginAttempts: systemUsers.failedLoginAttempts,
          lockedUntil: systemUsers.lockedUntil,
        })
        .from(systemUsers)
        .where(eq(systemUsers.login, input.adminLogin))
        .limit(1);

      if (!adminUser) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Credenciais inválidas." });
      }
      if (!adminUser.active) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Usuário inativo." });
      }
      if (adminUser.lockedUntil && adminUser.lockedUntil > new Date()) {
        const mins = Math.ceil((adminUser.lockedUntil.getTime() - Date.now()) / 60000);
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: `Conta bloqueada. Tente em ${mins} min.` });
      }

      const hashedInput = crypto.createHash("sha256").update(input.adminPassword).digest("hex");
      if (hashedInput !== adminUser.passwordHash) {
        const newAttempts = (adminUser.failedLoginAttempts ?? 0) + 1;
        const lockedUntil = newAttempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
        await db.update(systemUsers).set({
          failedLoginAttempts: newAttempts,
          ...(lockedUntil ? { lockedUntil } : {}),
        }).where(eq(systemUsers.id, adminUser.id));
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Credenciais inválidas." });
      }

      // Reset tentativas falhas
      await db.update(systemUsers)
        .set({ failedLoginAttempts: 0, lockedUntil: null })
        .where(eq(systemUsers.id, adminUser.id));

      // 2. Verificar se o admin tem permissão (role admin ou manager na tabela users OAuth)
      // O ctx.user é o usuário que fez a requisição; o admin autorizador é adminUser (systemUsers)
      // Verificar role do adminUser via userRoles
      const { userRoles, roles } = await import("../drizzle/schema");
      const adminRoles = await db
        .select({ code: roles.code })
        .from(userRoles)
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(eq(userRoles.userId, adminUser.id));

      const allowedRoles = ["ADMIN_SISTEMA", "SUPERVISOR", "GERENTE", "admin", "manager"];
      const hasAdminRole = adminRoles.some(r => allowedRoles.includes(r.code));
      if (!hasAdminRole) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Usuário não possui permissão de gerente/administrador para liberar estoque." });
      }

      // 3. Buscar o(s) registro(s) de estoque a liberar
      let inventoryRecords: any[] = [];
      if (input.inventoryId) {
        inventoryRecords = await db
          .select()
          .from(inventory)
          .where(eq(inventory.id, input.inventoryId));
      } else if (input.labelCode) {
        inventoryRecords = await db
          .select()
          .from(inventory)
          .where(eq(inventory.labelCode, input.labelCode));
      } else {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Informe inventoryId ou labelCode." });
      }

      if (inventoryRecords.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Registro de estoque não encontrado." });
      }

      const restricted = inventoryRecords.filter((r: any) => r.status === "blocked" || r.status === "quarantine");
      if (restricted.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Estoque não está em status restrito (blocked/quarantine)." });
      }

      // 4. Liberar: atualizar status para available
      const releasedIds: number[] = [];
      for (const rec of restricted) {
        await db.update(inventory)
          .set({ status: "available" })
          .where(eq(inventory.id, rec.id));
        releasedIds.push(rec.id);

        // 5. Registrar em auditLogs
        await db.insert(auditLogs).values({
          tenantId: rec.tenantId,
          userId: adminUser.id,
          action: "release_inventory",
          entityType: "inventory",
          entityId: rec.id,
          oldValue: JSON.stringify({ status: rec.status }),
          newValue: JSON.stringify({ status: "available", reason: input.reason }),
          signature: crypto
            .createHash("sha256")
            .update(`${adminUser.id}:${rec.id}:${input.reason}:${Date.now()}`)
            .digest("hex"),
        });
      }

      return {
        ok: true,
        releasedCount: releasedIds.length,
        releasedIds,
        authorizedBy: adminUser.fullName,
      };
    }),
});
