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
  nonConformities
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
      const isGlobalAdmin = ctx.user.role === 'admin' && ctx.user.tenantId === 1;
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
        tenantId: activeTenantId,
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
      const isGlobalAdmin = ctx.user.role === 'admin' && ctx.user.tenantId === 1;
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
          and(
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

      // 1. BUSCA GLOBAL DA ETIQUETA (Identidade Permanente)
      const label = await db.select()
        .from(labelAssociations)
        .where(
          and(
            eq(labelAssociations.labelCode, input.labelCode),
            eq(labelAssociations.tenantId, activeTenantId)
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
          tenantId: activeTenantId,
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
      const isGlobalAdmin = ctx.user.role === 'admin' && ctx.user.tenantId === 1;
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
          and(
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
      console.log("🔍 [associateLabel] Buscando etiqueta existente:", input.labelCode, "| tenantId:", activeTenantId);
      
      let existingLabel;
      try {
        existingLabel = await db.select()
          .from(labelAssociations)
          .where(
            and(
              eq(labelAssociations.labelCode, input.labelCode),
              eq(labelAssociations.tenantId, activeTenantId)
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
        expiryDate: input.expiryDate ? new Date(input.expiryDate) : null,
        unitsPerBox: input.unitsPerBox,
        totalUnits: actualUnitsReceived,
        status: "RECEIVING", // Etiqueta criada durante conferência fica bloqueada até fechamento
        associatedBy: userId,
        tenantId: activeTenantId,
      });

      // 2. REGISTRAR PRIMEIRO BIP NA CONFERÊNCIA
      await db.insert(blindConferenceItems)
        .values({
          conferenceId: input.conferenceId,
          productId: input.productId,
          batch: input.batch || "",
          expiryDate: input.expiryDate ? new Date(input.expiryDate) : null,
          tenantId: activeTenantId,
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
          and(
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
      const isGlobalAdmin = ctx.user.role === 'admin' && ctx.user.tenantId === 1;
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

      // 3. GERAR OU VERIFICAR ETIQUETA
      let labelCode = input.labelCode;
      
      if (!labelCode) {
        // Gerar labelCode automático: SKU + Lote + timestamp
        const timestamp = Date.now().toString().slice(-6); // Últimos 6 dígitos
        labelCode = `${orderItem.productSku}${orderItem.batch || 'SL'}${timestamp}`;
        console.log("[registerNCG] LabelCode gerado automaticamente:", labelCode);
      }

      // Verificar se etiqueta já existe
      const [existingLabel] = await db.select()
        .from(labelAssociations)
        .where(
          and(
            eq(labelAssociations.labelCode, labelCode),
            eq(labelAssociations.tenantId, activeTenantId)
          )
        )
        .limit(1);

      // Se não existir, criar nova etiqueta
      if (!existingLabel) {
        console.log("[registerNCG] Criando nova etiqueta:", labelCode);
        
        // Usar dados da Tela 2 se fornecidos, senão usar do orderItem
        const finalUnitsPerBox = input.unitsPerBox || orderItem.unitsPerBox || 1;
        const finalBatch = input.batch || orderItem.batch || null;
        const finalExpiryDate = input.expiryDate || orderItem.expiryDate || null;
        const finalProductId = input.productId || orderItem.productId;
        
        await db.insert(labelAssociations).values({
          tenantId: activeTenantId,
          labelCode: labelCode,
          productId: finalProductId,
          batch: finalBatch,
          expiryDate: finalExpiryDate,
          unitsPerBox: finalUnitsPerBox,
          status: "BLOCKED", // Já nasce bloqueada (NCG)
          scannedAt: new Date(),
        });
      } else {
        // Se já existe, atualizar status para BLOCKED
        await db.update(labelAssociations)
          .set({ status: "BLOCKED" })
          .where(eq(labelAssociations.labelCode, labelCode));
      }

      // 4. CRIAR REGISTRO DE INVENTÁRIO BLOQUEADO EM NCG
      await db.insert(inventory).values({
        tenantId: activeTenantId,
        productId: orderItem.productId,
        locationId: ncgLocation.id,
        batch: orderItem.batch || null,
        expiryDate: orderItem.expiryDate || null,
        uniqueCode: orderItem.uniqueCode || null,
        labelCode: labelCode,
        serialNumber: orderItem.serialNumber || null,
        locationZone: ncgLocation.zoneCode || null,
        quantity: input.quantity,
        reservedQuantity: 0,
        status: "blocked", // 🔒 CRUCIAL: Picking ignora este status
      });

      // 5. ATUALIZAR QUANTIDADE BLOQUEADA NO ITEM DA ORDEM
      await db.update(receivingOrderItems)
        .set({
          blockedQuantity: sql`${receivingOrderItems.blockedQuantity} + ${input.quantity}`,
          status: "receiving"
        })
        .where(eq(receivingOrderItems.id, input.receivingOrderItemId));

      // 6. (JÁ FEITO NO PASSO 3) Etiqueta já foi criada/atualizada com status BLOCKED

      // 7. REGISTRAR NÃO-CONFORMIDADE
      await db.insert(nonConformities).values({
        tenantId: activeTenantId,
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
      const isGlobalAdmin = ctx.user.role === 'admin' && ctx.user.tenantId === 1;
      const activeTenantId = (isGlobalAdmin && input.tenantId) 
        ? input.tenantId 
        : ctx.user.tenantId;

      if (!activeTenantId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Usuário sem Tenant vinculado" });
      }

      console.log("[undoLastReading] Tenant Ativo:", activeTenantId, "| isGlobalAdmin:", isGlobalAdmin);

      const batchValue = input.batch || "";

      // 1. BUSCAR ITEM NA CONFERÊNCIA
      const conferenceItem = await db.select()
        .from(blindConferenceItems)
        .where(
          and(
            eq(blindConferenceItems.conferenceId, input.conferenceId),
            eq(blindConferenceItems.productId, input.productId),
            eq(blindConferenceItems.batch, batchValue),
            eq(blindConferenceItems.tenantId, activeTenantId)
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
              eq(blindConferenceItems.tenantId, activeTenantId)
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
              eq(blindConferenceItems.tenantId, activeTenantId)
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
      const isGlobalAdmin = ctx.user.role === 'admin' && ctx.user.tenantId === 1;
      const activeTenantId = (isGlobalAdmin && input.tenantId) 
        ? input.tenantId 
        : ctx.user.tenantId;

      if (!activeTenantId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Usuário sem Tenant vinculado" });
      }

      console.log("[adjustQuantity] Tenant Ativo:", activeTenantId, "| isGlobalAdmin:", isGlobalAdmin);

      const batchValue = input.batch || "";

      // 1. BUSCAR ITEM NA CONFERÊNCIA
      const conferenceItem = await db.select()
        .from(blindConferenceItems)
        .where(
          and(
            eq(blindConferenceItems.conferenceId, input.conferenceId),
            eq(blindConferenceItems.productId, input.productId),
            eq(blindConferenceItems.batch, batchValue),
            eq(blindConferenceItems.tenantId, activeTenantId)
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
            eq(blindConferenceItems.tenantId, activeTenantId)
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
      const isGlobalAdmin = ctx.user.role === 'admin' && ctx.user.tenantId === 1;
      const activeTenantId = (isGlobalAdmin && input.tenantId) 
        ? input.tenantId 
        : ctx.user.tenantId;

      if (!activeTenantId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Usuário sem Tenant vinculado" });
      }

      console.log("[getSummary] Tenant Ativo:", activeTenantId, "| isGlobalAdmin:", isGlobalAdmin);

      // 1. BUSCAR ITENS DA CONFERÊNCIA
      const items = await db.select({
        productId: blindConferenceItems.productId,
        productSku: products.sku,
        productName: products.description,
        batch: blindConferenceItems.batch,
        expiryDate: blindConferenceItems.expiryDate,
        packagesRead: blindConferenceItems.packagesRead,
        unitsRead: blindConferenceItems.unitsRead, // CAMPO ADICIONADO
        expectedQuantity: blindConferenceItems.expectedQuantity,
      })
        .from(blindConferenceItems)
        .leftJoin(products, eq(blindConferenceItems.productId, products.id))
        .where(
          and(
            eq(blindConferenceItems.conferenceId, input.conferenceId),
            eq(blindConferenceItems.tenantId, activeTenantId)
          )
        );

      return {
        conferenceId: input.conferenceId,
        conferenceItems: items.map(item => ({
          productId: item.productId,
          productSku: item.productSku || "",
          productName: item.productName || "",
          batch: item.batch || null,
          expiryDate: item.expiryDate,
          packagesRead: item.packagesRead,
          unitsRead: item.unitsRead, // CAMPO ADICIONADO
          expectedQuantity: item.expectedQuantity,
        }))
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
      const isGlobalAdmin = ctx.user.role === 'admin' && ctx.user.tenantId === 1;
      const activeTenantId = (isGlobalAdmin && input.tenantId) 
        ? input.tenantId 
        : ctx.user.tenantId;

      if (!activeTenantId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Usuário sem Tenant vinculado" });
      }

      console.log("[finish] Tenant Ativo:", activeTenantId, "| isGlobalAdmin:", isGlobalAdmin);

      // 1. BUSCAR SESSÃO
      const session = await db.select()
        .from(blindConferenceSessions)
        .where(eq(blindConferenceSessions.id, input.conferenceId))
        .limit(1);

      if (session.length === 0) {
        throw new Error("Sessão de conferência não encontrada");
      }

      // 2. BUSCAR ITENS CONFERIDOS
      const items = await db.select()
        .from(blindConferenceItems)
        .where(
          and(
            eq(blindConferenceItems.conferenceId, input.conferenceId),
            eq(blindConferenceItems.tenantId, activeTenantId)
          )
        );

      if (items.length === 0) {
        throw new Error("Nenhum item foi conferido");
      }

      // 3. CRIAR/ATUALIZAR ESTOQUE PARA CADA ITEM
      for (const item of items) {
        const product = await db.select().from(products).where(eq(products.id, item.productId)).limit(1);
        if (product.length === 0) continue;

        const productSku = product[0].sku;
        const uniqueCode = getUniqueCode(productSku, item.batch);

        // 1. Buscar zona de recebimento (REC)
        const zoneREC = await db.select()
          .from(warehouseZones)
          .where(eq(warehouseZones.code, 'REC'))
          .limit(1);

        if (zoneREC.length === 0) {
          throw new Error("Zona de Recebimento ('REC') não configurada");
        }

        // 2. Buscar endereço de recebimento usando zoneId
        const recLocation = await db.select()
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

        // ✅ NOVA LÓGICA: 1 LPN = 1 Inventory
        // Buscar apenas etiquetas OK (sem NCG) para alocar em REC
        // Buscar todas as etiquetas em RECEIVING
        const labels = await db.select()
          .from(labelAssociations)
          .where(
            and(
              eq(labelAssociations.productId, item.productId),
              eq(labelAssociations.batch, item.batch || ""),
              eq(labelAssociations.tenantId, activeTenantId),
              eq(labelAssociations.status, 'RECEIVING')
            )
          );
        
        // Buscar NCGs para filtrar
        const ncgLabels = await db.select({ labelCode: nonConformities.labelCode })
          .from(nonConformities)
          .where(eq(nonConformities.tenantId, activeTenantId));
        
        const ncgLabelCodes = new Set(ncgLabels.map(n => n.labelCode));
        
        // Filtrar apenas etiquetas sem NCG
        const labelsOK = labels.filter(label => !ncgLabelCodes.has(label.labelCode));

        console.log(`[finish] Total de etiquetas: ${labels.length}, NCGs: ${ncgLabelCodes.size}, OK: ${labelsOK.length}`);
        console.log(`[finish] Criando inventory para ${labelsOK.length} etiquetas OK do produto ${item.productId}`);

        // Criar um registro de inventory para cada etiqueta OK
        for (const label of labelsOK) {
          console.log('🔍 [finish] Label completo:', JSON.stringify(label, null, 2));
          
          if (!label.labelCode) {
            console.error('❌ [finish] labelCode está NULL/undefined! Pulando...');
            continue;
          }
          
          console.log('🔍 [finish] Buscando inventory para labelCode:', label.labelCode, 'tenantId:', activeTenantId);
          
          let existingByLabel;
          try {
            existingByLabel = await db.select()
              .from(inventory)
              .where(
                and(
                  eq(inventory.labelCode, label.labelCode),
                  eq(inventory.tenantId, activeTenantId)
                )
              )
              .limit(1);
            
            console.log('✅ [finish] Query executada com sucesso. Resultados:', existingByLabel.length);
          } catch (error: any) {
            console.error('❌ [finish] ERRO na query de inventory:', error?.message || error);
            console.error('❌ [finish] Stack:', error?.stack);
            console.error('❌ [finish] labelCode:', label.labelCode);
            console.error('❌ [finish] tenantId:', activeTenantId);
            console.error('❌ [finish] Tipo de labelCode:', typeof label.labelCode);
            throw new Error(`Erro ao buscar inventory: ${error?.message || error}`);
          }

          if (existingByLabel.length > 0) {
            // 🔄 Etiqueta já existe (re-entrada ou correção)
            await db.update(inventory)
              .set({
                quantity: label.totalUnits, // ✅ Campo correto de labelAssociations
                locationId: locationId,
                status: "available",
                updatedAt: new Date()
              })
              .where(eq(inventory.id, existingByLabel[0].id));
          } else {
            // ✨ Nova etiqueta entrando no estoque
            await db.insert(inventory).values({
              tenantId: activeTenantId,
              productId: item.productId,
              locationId: locationId,
              batch: item.batch || "",
              expiryDate: item.expiryDate,
              uniqueCode: uniqueCode,
              labelCode: label.labelCode, // 🔑 Identidade física da caixa
              locationZone: 'REC',
              quantity: label.totalUnits, // ✅ Campo correto de labelAssociations
              reservedQuantity: 0,
              status: "available",
            });
          }
        }
      }

      // 4. ATIVAR ETIQUETAS (RECEIVING → AVAILABLE)
      // Buscar todos os produtos conferidos para liberar suas etiquetas
      const productIds = items.map(item => item.productId);
      
      if (productIds.length > 0) {
        await db.update(labelAssociations)
          .set({ status: "AVAILABLE" })
          .where(
            and(
              eq(labelAssociations.tenantId, activeTenantId),
              eq(labelAssociations.status, "RECEIVING"),
              sql`${labelAssociations.productId} IN (${sql.join(productIds.map(id => sql`${id}`), sql`, `)})`
            )
          );
      }

      // 5. CALCULAR E ATUALIZAR addressedQuantity EM receivingOrderItems
      // addressedQuantity = receivedQuantity - blockedQuantity
      const orderItems = await db.select()
        .from(receivingOrderItems)
        .where(
          and(
            eq(receivingOrderItems.receivingOrderId, session[0].receivingOrderId),
            eq(receivingOrderItems.tenantId, activeTenantId)
          )
        );

      for (const orderItem of orderItems) {
        const addressableQty = (orderItem.receivedQuantity || 0) - (orderItem.blockedQuantity || 0);
        
        await db.update(receivingOrderItems)
          .set({
            addressedQuantity: addressableQty,
            status: "completed",
            updatedAt: new Date()
          })
          .where(eq(receivingOrderItems.id, orderItem.id));
      }

      // 6. FINALIZAR SESSÃO
      await db.update(blindConferenceSessions)
        .set({
          status: "completed",
          finishedAt: new Date()
        })
        .where(eq(blindConferenceSessions.id, input.conferenceId));

      // 7. ATUALIZAR STATUS DA ORDEM DE RECEBIMENTO
      await db.update(receivingOrders)
        .set({
          status: "completed",
          updatedAt: new Date()
        })
        .where(eq(receivingOrders.id, session[0].receivingOrderId));

      return {
        success: true,
        message: "Conferência finalizada com sucesso",
        itemsProcessed: items.length
      };
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
      const isGlobalAdmin = ctx.user?.role === 'admin' && ctx.user?.tenantId === 1;
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
      const isGlobalAdmin = ctx.user.role === 'admin' && ctx.user.tenantId === 1;
      const activeTenantId = (isGlobalAdmin && input.tenantId) 
        ? input.tenantId 
        : ctx.user.tenantId;

      if (!activeTenantId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Usuário sem Tenant vinculado" });
      }

      console.log("[closeReceivingOrder] Tenant Ativo:", activeTenantId, "| isGlobalAdmin:", isGlobalAdmin);

      // TRANSAÇÃO ATÔMICA: Tudo ou nada
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
                eq(blindConferenceItems.tenantId, activeTenantId)
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
                eq(blindConferenceItems.tenantId, activeTenantId)
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

        // 6. ATIVAR ETIQUETAS EM MASSA (RECEIVING → AVAILABLE)
        const productIds = items.map(item => item.productId);
        
        await tx.update(labelAssociations)
          .set({ status: "AVAILABLE" })
          .where(
            and(
              eq(labelAssociations.tenantId, activeTenantId),
              eq(labelAssociations.status, "RECEIVING"),
              sql`${labelAssociations.productId} IN (${sql.join(productIds.map(id => sql`${id}`), sql`, `)})`
            )
          );

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
});
