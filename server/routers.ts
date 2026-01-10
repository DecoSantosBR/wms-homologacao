import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { suggestPickingLocations, allocatePickingStock, getClientPickingRule, logPickingAudit } from "./pickingLogic";
import { getDb } from "./db";
import { tenants, products, warehouseLocations, receivingOrders, pickingOrders, inventory, contracts, systemUsers, receivingOrderItems, pickingOrderItems, pickingWaves, pickingWaveItems } from "../drizzle/schema";
import { eq, and, desc, inArray, sql, or } from "drizzle-orm";
import { z } from "zod";
import { parseNFE, isValidNFE } from "./nfeParser";
import { warehouseZones } from "../drizzle/schema";
import { blindConferenceRouter } from "./blindConferenceRouter";
import { stockRouter } from "./stockRouter";
import { preallocationRouter } from "./preallocationRouter";

export const appRouter = router({
  system: systemRouter,
  blindConference: blindConferenceRouter,
  stock: stockRouter,
  preallocation: preallocationRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  dashboard: router({
    stats: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return { receivingToday: 0, pickingInProgress: 0, shippingPending: 0, totalProcessed: 0 };

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const receivingToday = await db.select().from(receivingOrders).where(
        and(
          eq(receivingOrders.status, 'scheduled')
        )
      );

      const pickingInProgress = await db.select().from(pickingOrders).where(
        eq(pickingOrders.status, 'picking')
      );

      return {
        receivingToday: receivingToday.length,
        pickingInProgress: pickingInProgress.length,
        shippingPending: 15,
        totalProcessed: 55
      };
    }),
  }),

  tenants: router({
    list: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(tenants).orderBy(desc(tenants.createdAt));
    }),

    create: protectedProcedure
      .input(z.object({
        name: z.string(),
        cnpj: z.string(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        await db.insert(tenants).values({
          name: input.name,
          cnpj: input.cnpj,
        });
        
        return { success: true };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string(),
        cnpj: z.string(),
        email: z.string().optional(),
        phone: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        zipCode: z.string().optional(),
        pickingRule: z.enum(["FIFO", "FEFO", "Direcionado"]).optional(),
        status: z.enum(["active", "inactive", "suspended"]).optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        await db.update(tenants)
          .set({ 
            name: input.name,
            cnpj: input.cnpj,
            email: input.email,
            phone: input.phone,
            address: input.address,
            city: input.city,
            state: input.state,
            zipCode: input.zipCode,
            pickingRule: input.pickingRule,
            status: input.status,
          })
          .where(eq(tenants.id, input.id));
        
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        await db.update(tenants)
          .set({ status: 'inactive' })
          .where(eq(tenants.id, input.id));
        
        return { success: true };
      }),

    deleteMany: protectedProcedure
      .input(z.object({ ids: z.array(z.number()) }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        // Verificar se há produtos associados aos clientes
        const productsCount = await db.select({ count: sql<number>`count(*)` })
          .from(products)
          .where(inArray(products.tenantId, input.ids));
        
        if (productsCount[0]?.count > 0) {
          throw new Error(`Não é possível excluir. Existem ${productsCount[0].count} produto(s) associado(s) aos clientes selecionados. Remova os produtos primeiro.`);
        }
        
        // Verificar se há contratos associados
        const contractsCount = await db.select({ count: sql<number>`count(*)` })
          .from(contracts)
          .where(inArray(contracts.tenantId, input.ids));
        
        if (contractsCount[0]?.count > 0) {
          throw new Error(`Não é possível excluir. Existem ${contractsCount[0].count} contrato(s) associado(s) aos clientes selecionados.`);
        }
        
        // Verificar se há usuários associados
        const usersCount = await db.select({ count: sql<number>`count(*)` })
          .from(systemUsers)
          .where(inArray(systemUsers.tenantId, input.ids));
        
        if (usersCount[0]?.count > 0) {
          throw new Error(`Não é possível excluir. Existem ${usersCount[0].count} usuário(s) associado(s) aos clientes selecionados.`);
        }
        
        // Se passou em todas as validações, executar hard delete
        await db.delete(tenants)
          .where(inArray(tenants.id, input.ids));
        
        return { success: true, deletedCount: input.ids.length };
      }),
  }),

  products: router({
    list: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(products).orderBy(desc(products.createdAt)).limit(100);
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;
        const result = await db.select().from(products).where(eq(products.id, input.id)).limit(1);
        return result.length > 0 ? result[0] : null;
      }),

    create: protectedProcedure
      .input(z.object({
        tenantId: z.number(),
        sku: z.string().min(1, "SKU é obrigatório"),
        description: z.string().min(1, "Descrição é obrigatória"),
        category: z.string().optional(),
        gtin: z.string().optional(),
        anvisaRegistry: z.string().optional(),
        therapeuticClass: z.string().optional(),
        manufacturer: z.string().optional(),
        unitOfMeasure: z.string().default("UN"),
        unitsPerBox: z.number().optional(),
        minQuantity: z.number().min(0).default(0),
        dispensingQuantity: z.number().min(1).default(1),
        requiresBatchControl: z.boolean().default(true),
        requiresExpiryControl: z.boolean().default(true),
        storageCondition: z.enum(["ambient", "refrigerated_2_8", "frozen_minus_20", "controlled"]).default("ambient"),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        await db.insert(products).values(input);
        return { success: true };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        tenantId: z.number(),
        sku: z.string().min(1, "SKU é obrigatório"),
        description: z.string().min(1, "Descrição é obrigatória"),
        category: z.string().optional(),
        gtin: z.string().optional(),
        anvisaRegistry: z.string().optional(),
        therapeuticClass: z.string().optional(),
        manufacturer: z.string().optional(),
        unitOfMeasure: z.string().default("UN"),
        unitsPerBox: z.number().optional(),
        minQuantity: z.number().min(0).default(0),
        dispensingQuantity: z.number().min(1).default(1),
        requiresBatchControl: z.boolean().default(true),
        requiresExpiryControl: z.boolean().default(true),
        storageCondition: z.enum(["ambient", "refrigerated_2_8", "frozen_minus_20", "controlled"]).default("ambient"),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        const { id, ...updateData } = input;
        await db.update(products)
          .set(updateData)
          .where(eq(products.id, id));
        
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        await db.update(products)
          .set({ status: 'discontinued' })
          .where(eq(products.id, input.id));
        
        return { success: true };
      }),

    deleteMany: protectedProcedure
      .input(z.object({ ids: z.array(z.number()) }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Verificar se há inventário nos produtos
        const inventoryCheck = await db
          .select({ productId: inventory.productId })
          .from(inventory)
          .where(inArray(inventory.productId, input.ids))
          .limit(1);

        if (inventoryCheck.length > 0) {
          throw new Error(
            "Não é possível excluir produtos que possuem inventário. Remova o estoque antes de excluir."
          );
        }

        // Verificar se há pedidos de recebimento
        const receivingCheck = await db
          .select({ productId: receivingOrderItems.productId })
          .from(receivingOrderItems)
          .where(inArray(receivingOrderItems.productId, input.ids))
          .limit(1);

        if (receivingCheck.length > 0) {
          throw new Error(
            "Não é possível excluir produtos que possuem pedidos de recebimento associados."
          );
        }

        // Verificar se há pedidos de separação
        const pickingCheck = await db
          .select({ productId: pickingOrderItems.productId })
          .from(pickingOrderItems)
          .where(inArray(pickingOrderItems.productId, input.ids))
          .limit(1);

        if (pickingCheck.length > 0) {
          throw new Error(
            "Não é possível excluir produtos que possuem pedidos de separação associados."
          );
        }

        // Se passou todas as validações, excluir permanentemente
        await db.delete(products).where(inArray(products.id, input.ids));
        
        return { success: true, deletedCount: input.ids.length };
      }),

    updateCustomerCode: protectedProcedure
      .input(z.object({
        productId: z.number(),
        customerCode: z.string().min(1, "Código do cliente é obrigatório"),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Atualizar customerCode e SKU (SKU passa a ser o código do cliente)
        await db.update(products)
          .set({
            customerCode: input.customerCode,
            sku: input.customerCode, // SKU passa a ser o código do cliente
          })
          .where(eq(products.id, input.productId));

        return { success: true };
      }),
  }),

  zones: router({
    list: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(warehouseZones).orderBy(desc(warehouseZones.createdAt));
    }),

    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1, "Nome é obrigatório"),
        code: z.string().min(1, "Código é obrigatório"),
        warehouseId: z.number().default(1),
        storageCondition: z.enum(["ambient", "refrigerated_2_8", "frozen_minus_20", "controlled", "quarantine"]).default("ambient"),
        hasTemperatureControl: z.boolean().default(false),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        await db.insert(warehouseZones).values(input);
        return { success: true };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1, "Nome é obrigatório"),
        code: z.string().min(1, "Código é obrigatório"),
        storageCondition: z.enum(["ambient", "refrigerated_2_8", "frozen_minus_20", "controlled", "quarantine"]),
        hasTemperatureControl: z.boolean(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        const { id, ...updateData } = input;
        await db.update(warehouseZones)
          .set(updateData)
          .where(eq(warehouseZones.id, id));
        
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        await db.update(warehouseZones)
          .set({ status: "inactive" })
          .where(eq(warehouseZones.id, input.id));
        
        return { success: true };
      }),
  }),

  locations: router({
    list: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(warehouseLocations).orderBy(desc(warehouseLocations.createdAt));
    }),

    create: protectedProcedure
      .input(z.object({
        zoneId: z.number(),
        tenantId: z.number().optional(),
        code: z.string().min(1, "Código é obrigatório"),
        aisle: z.string().optional(),
        rack: z.string().optional(),
        level: z.string().optional(),
        position: z.string().optional(),
        locationType: z.enum(["whole", "fraction"]).default("whole"),
        storageRule: z.enum(["single", "multi"]).default("single"),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        await db.insert(warehouseLocations).values(input);
        return { success: true };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        zoneId: z.number(),
        tenantId: z.number().optional(),
        code: z.string().min(1, "Código é obrigatório"),
        aisle: z.string().optional(),
        rack: z.string().optional(),
        level: z.string().optional(),
        position: z.string().optional(),
        locationType: z.enum(["whole", "fraction"]).default("whole"),
        storageRule: z.enum(["single", "multi"]).default("single"),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        const { id, ...updateData } = input;
        await db.update(warehouseLocations)
          .set(updateData)
          .where(eq(warehouseLocations.id, id));
        
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        await db.update(warehouseLocations)
          .set({ status: 'blocked' })
          .where(eq(warehouseLocations.id, input.id));
        
        return { success: true };
      }),

    deleteMany: protectedProcedure
      .input(z.object({ ids: z.array(z.number()) }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        // Verificar se há inventário nos endereços antes de excluir
        const inventoryCheck = await db.select({ locationId: inventory.locationId })
          .from(inventory)
          .where(inArray(inventory.locationId, input.ids))
          .limit(1);
        
        if (inventoryCheck.length > 0) {
          throw new Error(
            "Não é possível excluir os endereços selecionados porque há inventário (produtos armazenados) neles. " +
            "Por favor, mova ou remova o inventário antes de excluir os endereços."
          );
        }
        
        // Hard delete (remover permanentemente do banco)
        await db.delete(warehouseLocations)
          .where(inArray(warehouseLocations.id, input.ids));
        
        return { success: true, count: input.ids.length };
      }),

    importExcel: protectedProcedure
      .input(z.object({
        fileBase64: z.string(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const XLSX = await import('xlsx');
        
        // Decodificar base64 para buffer
        const buffer = Buffer.from(input.fileBase64, 'base64');
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(worksheet);

        const results = {
          success: [] as string[],
          errors: [] as { row: number; error: string }[],
        };

        // Buscar todas as zonas para mapear código -> ID
        const zones = await db.select().from(warehouseZones);
        const zoneMap = new Map(zones.map(z => [z.code, z.id]));

        // Buscar todos os clientes para mapear nome -> ID
        const clients = await db.select().from(tenants);
        const clientMap = new Map(clients.map(c => [c.name, c.id]));

        // Preparar lote de inserções
        const locationsToInsert: any[] = [];

        for (let i = 0; i < data.length; i++) {
          const row: any = data[i];
          const rowNum = i + 2; // +2 porque começa na linha 2 (1 é cabeçalho)

          try {
            // Validar campos obrigatórios
            if (!row.zona || !row.rua || !row.tipo || !row.regra) {
              results.errors.push({
                row: rowNum,
                error: 'Campos obrigatórios faltando (zona, rua, tipo, regra)'
              });
              continue;
            }

            // Buscar ID da zona
            const zoneId = zoneMap.get(String(row.zona).padStart(3, '0'));
            if (!zoneId) {
              results.errors.push({
                row: rowNum,
                error: `Zona "${row.zona}" não encontrada`
              });
              continue;
            }

            // Buscar ID do cliente (opcional)
            let tenantId = null;
            if (row.cliente) {
              tenantId = clientMap.get(row.cliente);
              if (!tenantId) {
                results.errors.push({
                  row: rowNum,
                  error: `Cliente "${row.cliente}" não encontrado`
                });
                continue;
              }
            }

            // Mapear tipo: "Fração" -> "fraction", "Inteira" -> "whole"
            const locationType = row.tipo.toLowerCase().includes('fra') ? 'fraction' : 'whole';
            
            // Mapear regra: "single" ou "multi"
            const storageRule = row.regra.toLowerCase() === 'single' ? 'single' : 'multi';

            // Gerar código do endereço (SEM ZONA, formato: RUA-PRÉDIO-ANDAR[QUADRANTE])
            let code = '';
            if (locationType === 'whole') {
              // Formato: A10-01-73 (RUA-PRÉDIO-ANDAR)
              const codeParts = [row.rua, row.predio, row.andar].filter(Boolean);
              code = codeParts.join('-');
            } else {
              // Formato: BI-A201-1D (RUA-PRÉDIO-ANDAR+QUADRANTE, sem hífen antes do quadrante)
              const codeParts = [row.rua, row.predio, row.andar].filter(Boolean);
              code = codeParts.join('-');
              if (row.quadrante) {
                code += row.quadrante; // Concatenar quadrante SEM hífen
              }
            }

            // Adicionar ao lote
            locationsToInsert.push({
              zoneId,
              tenantId,
              code,
              aisle: row.rua || null,
              rack: row.predio || null,
              level: row.andar || null,
              position: row.quadrante || null,
              locationType,
              storageRule,
              status: 'available',
            });

            results.success.push(code);
          } catch (error: any) {
            results.errors.push({
              row: rowNum,
              error: error.message || 'Erro desconhecido'
            });
          }
        }

        // Inserir todos os endereços em lotes de 500 para evitar timeout
        const BATCH_SIZE = 500;
        for (let i = 0; i < locationsToInsert.length; i += BATCH_SIZE) {
          const batch = locationsToInsert.slice(i, i + BATCH_SIZE);
          try {
            await db.insert(warehouseLocations).values(batch);
          } catch (error: any) {
            // Se falhar o lote inteiro, tentar inserir um por um
            for (const location of batch) {
              try {
                await db.insert(warehouseLocations).values(location);
              } catch (err: any) {
                const failedCode = location.code;
                const failedIndex = results.success.indexOf(failedCode);
                if (failedIndex > -1) {
                  results.success.splice(failedIndex, 1);
                  results.errors.push({
                    row: failedIndex + 2,
                    error: err.message || 'Erro ao inserir'
                  });
                }
              }
            }
          }
        }

        return results;
      }),
  }),

  receiving: router({
    list: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      
      // JOIN com tenants para retornar nome do cliente
      const orders = await db
        .select({
          id: receivingOrders.id,
          tenantId: receivingOrders.tenantId,
          orderNumber: receivingOrders.orderNumber,
          supplierName: receivingOrders.supplierName,
          supplierCnpj: receivingOrders.supplierCnpj,
          nfeNumber: receivingOrders.nfeNumber,
          nfeKey: receivingOrders.nfeKey,
          scheduledDate: receivingOrders.scheduledDate,
          status: receivingOrders.status,
          createdBy: receivingOrders.createdBy,
          createdAt: receivingOrders.createdAt,
          updatedAt: receivingOrders.updatedAt,
          clientName: tenants.name, // Nome do cliente (tenant)
        })
        .from(receivingOrders)
        .leftJoin(tenants, eq(receivingOrders.tenantId, tenants.id))
        .orderBy(desc(receivingOrders.createdAt))
        .limit(50);
      
      return orders;
    }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        await db.delete(receivingOrders).where(eq(receivingOrders.id, input.id));
        return { success: true };
      }),

    deleteBatch: protectedProcedure
      .input(z.object({ ids: z.array(z.number()) }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        await db.delete(receivingOrders).where(inArray(receivingOrders.id, input.ids));
        return { success: true };
      }),

    schedule: protectedProcedure
      .input(z.object({ 
        id: z.number(),
        scheduledDate: z.string(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        await db.update(receivingOrders)
          .set({ scheduledDate: new Date(input.scheduledDate) })
          .where(eq(receivingOrders.id, input.id));
        return { success: true };
      }),

    getItemByProductAndBatch: protectedProcedure
      .input(z.object({ 
        receivingOrderId: z.number(),
        productId: z.number(),
        batch: z.string(),
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;
        const result = await db.select()
          .from(receivingOrderItems)
          .where(
            and(
              eq(receivingOrderItems.receivingOrderId, input.receivingOrderId),
              eq(receivingOrderItems.productId, input.productId),
              eq(receivingOrderItems.batch, input.batch)
            )
          )
          .limit(1);
        return result.length > 0 ? result[0] : null;
      }),

    getItems: protectedProcedure
      .input(z.object({ receivingOrderId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const items = await db.select()
          .from(receivingOrderItems)
          .where(eq(receivingOrderItems.receivingOrderId, input.receivingOrderId));
        
        // Join com produtos para pegar informações
        const itemsWithProducts = await Promise.all(
          items.map(async (item) => {
            const product = await db.select()
              .from(products)
              .where(eq(products.id, item.productId))
              .limit(1);
            return {
              ...item,
              productSku: product[0]?.sku || null,
              productDescription: product[0]?.description || null,
              expectedGtin: product[0]?.gtin || null,
            };
          })
        );
        
        return itemsWithProducts;
      }),
  }),

  inventory: router({
    list: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(inventory).orderBy(desc(inventory.createdAt)).limit(100);
    }),
  }),

  nfe: router({
    /**
     * Importação de NF-e (entrada ou saída)
     * - Entrada: Cria Ordem de Recebimento
     * - Saída: Cria Pedido de Separação
     * Cria produtos automaticamente se não existirem
     */
    import: protectedProcedure
      .input(z.object({
        tenantId: z.number(),
        xmlContent: z.string(),
        tipo: z.enum(["entrada", "saida"]), // Tipo de movimento
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Validar XML
        if (!isValidNFE(input.xmlContent)) {
          throw new Error("XML inválido. O arquivo não é uma NF-e válida.");
        }

        // Parse do XML
        const nfeData = await parseNFE(input.xmlContent);

        // Verificar se NF-e já foi importada (entrada ou saída)
        if (input.tipo === "entrada") {
          const existingReceiving = await db.select()
            .from(receivingOrders)
            .where(eq(receivingOrders.nfeKey, nfeData.chaveAcesso))
            .limit(1);

          if (existingReceiving.length > 0) {
            throw new Error(`NF-e já importada. Ordem de recebimento: ${existingReceiving[0].orderNumber}`);
          }
        } else {
          const existingPicking = await db.select()
            .from(pickingOrders)
            .where(eq(pickingOrders.nfeKey, nfeData.chaveAcesso))
            .limit(1);

          if (existingPicking.length > 0) {
            throw new Error(`NF-e já importada. Pedido de separação: ${existingPicking[0].orderNumber}`);
          }
        }

        // Criar ordem (recebimento ou picking) baseado no tipo
        let orderId: number;
        let orderNumber: string;
        let orderType: "entrada" | "saida" = input.tipo;

        if (input.tipo === "entrada") {
          // Criar ordem de recebimento
          orderNumber = `REC-${nfeData.numero}-${Date.now()}`;
          await db.insert(receivingOrders).values({
            tenantId: input.tenantId,
            orderNumber,
            supplierName: nfeData.fornecedor.razaoSocial,
            supplierCnpj: nfeData.fornecedor.cnpj,
            nfeNumber: nfeData.numero,
            nfeKey: nfeData.chaveAcesso,
            status: 'scheduled',
            scheduledDate: null,
            createdBy: ctx.user?.id || 1,
          });

          const [receivingOrder] = await db.select()
            .from(receivingOrders)
            .where(eq(receivingOrders.orderNumber, orderNumber))
            .limit(1);
          orderId = receivingOrder.id;
        } else {
          // Criar pedido de separação
          orderNumber = `PK-${nfeData.numero}-${Date.now()}`;
          await db.insert(pickingOrders).values({
            tenantId: input.tenantId,
            orderNumber,
            customerName: nfeData.fornecedor.razaoSocial, // Usar fornecedor como cliente por padrão
            deliveryAddress: null,
            nfeNumber: nfeData.numero,
            nfeKey: nfeData.chaveAcesso,
            priority: 'normal',
            status: 'pending',
            totalItems: 0, // Será atualizado após processar produtos
            totalQuantity: 0,
            createdBy: ctx.user?.id || 1,
          });

          const [pickingOrder] = await db.select()
            .from(pickingOrders)
            .where(eq(pickingOrders.orderNumber, orderNumber))
            .limit(1);
          orderId = pickingOrder.id;
        }

        // Resultados da importação
        const result = {
          orderId,
          orderNumber,
          orderType,
          nfeNumero: nfeData.numero,
          nfeSerie: nfeData.serie,
          fornecedor: nfeData.fornecedor.razaoSocial,
          totalProdutos: nfeData.produtos.length,
          produtosNovos: [] as string[],
          produtosExistentes: [] as string[],
          erros: [] as string[],
        };

        // Processar cada produto da NF-e
        for (const produtoNFE of nfeData.produtos) {
          try {
            // Buscar produto existente por supplierCode, GTIN ou SKU
            const produtoExistente = await db
              .select()
              .from(products)
              .where(
                and(
                  eq(products.tenantId, input.tenantId),
                  or(
                    eq(products.supplierCode, produtoNFE.codigo),
                    produtoNFE.ean ? eq(products.gtin, produtoNFE.ean) : sql`false`,
                    eq(products.sku, produtoNFE.codigo)
                  )
                )
              )
              .limit(1);

            let productId: number;

            if (produtoExistente.length > 0) {
              // Produto já existe
              productId = produtoExistente[0].id;
              result.produtosExistentes.push(
                `${produtoNFE.codigo} - ${produtoNFE.descricao}`
              );
            } else {
              // Criar produto automaticamente
              const novoProduto = {
                tenantId: input.tenantId,
                sku: produtoNFE.codigo, // Usar código do fornecedor como SKU inicial
                supplierCode: produtoNFE.codigo,
                description: produtoNFE.descricao,
                gtin: produtoNFE.ean || produtoNFE.eanTributavel || undefined,
                unitOfMeasure: produtoNFE.unidade || "UN",
                status: "active" as const,
                requiresBatchControl: true,
                requiresExpiryControl: true,
              };

              await db.insert(products).values(novoProduto);
              
              // Buscar produto criado
              const [createdProduct] = await db.select()
                .from(products)
                .where(
                  and(
                    eq(products.tenantId, input.tenantId),
                    eq(products.supplierCode, produtoNFE.codigo)
                  )
                )
                .limit(1);
              productId = createdProduct.id;
              result.produtosNovos.push(
                `${produtoNFE.codigo} - ${produtoNFE.descricao}`
              );
            }

            // Criar item da ordem (recebimento ou picking)
            if (input.tipo === "entrada") {
              await db.insert(receivingOrderItems).values({
                receivingOrderId: orderId,
                productId: productId,
                expectedQuantity: produtoNFE.quantidade,
                receivedQuantity: 0,
                addressedQuantity: 0,
                batch: produtoNFE.lote || null,
                expiryDate: produtoNFE.validade ? new Date(produtoNFE.validade) : null,
                expectedGtin: produtoNFE.ean || produtoNFE.eanTributavel || null,
              });
            } else {
              await db.insert(pickingOrderItems).values({
                pickingOrderId: orderId,
                productId: productId,
                requestedQuantity: produtoNFE.quantidade,
                requestedUM: "unit", // Assumir unidade por padrão
                pickedQuantity: 0,
                batch: produtoNFE.lote || null,
                expiryDate: produtoNFE.validade ? new Date(produtoNFE.validade) : null,
                status: "pending",
              });
            }
          } catch (error: any) {
            result.erros.push(
              `Erro ao processar ${produtoNFE.codigo}: ${error.message}`
            );
          }
        }

        return result;
      }),
  }),

  // ========================================
  // PICKING (SEPARAÇÃO)
  // ========================================
  picking: router({
    // Sugerir endereços para picking (FIFO/FEFO)
    suggestLocations: protectedProcedure
      .input(
        z.object({
          productId: z.number(),
          requestedQuantity: z.number().positive(),
          tenantId: z.number().optional(), // Admin pode passar tenantId do pedido
        })
      )
      .query(async ({ input, ctx }) => {
        // Admin pode especificar tenantId, usuário comum usa o próprio
        const tenantId = input.tenantId || ctx.user.tenantId;
        
        if (!tenantId) {
          // Se admin não passou tenantId, retornar vazio
          return [];
        }
        
        const suggestions = await suggestPickingLocations({
          tenantId,
          productId: input.productId,
          requestedQuantity: input.requestedQuantity,
        });

        return suggestions;
      }),

    // Listar pedidos de separação
    list: protectedProcedure
      .input(
        z.object({
          limit: z.number().default(100),
        })
      )
      .query(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        
        // Admin vê todos os pedidos, usuário comum vê apenas do seu tenant
        let orders;
        if (ctx.user.role === "admin") {
          orders = await db
            .select({
              id: pickingOrders.id,
              tenantId: pickingOrders.tenantId,
              clientName: tenants.name, // Nome do cliente (tenant) correto
              orderNumber: pickingOrders.orderNumber,
              customerName: pickingOrders.customerName,
              priority: pickingOrders.priority,
              status: pickingOrders.status,
              totalItems: pickingOrders.totalItems,
              totalQuantity: pickingOrders.totalQuantity,
              scheduledDate: pickingOrders.scheduledDate,
              createdAt: pickingOrders.createdAt,
              createdBy: pickingOrders.createdBy,
              assignedTo: pickingOrders.assignedTo,
              pickedBy: pickingOrders.pickedBy,
              pickedAt: pickingOrders.pickedAt,
              nfeNumber: pickingOrders.nfeNumber,
              nfeKey: pickingOrders.nfeKey,
            })
            .from(pickingOrders)
            .leftJoin(tenants, eq(pickingOrders.tenantId, tenants.id))
            .orderBy(desc(pickingOrders.createdAt))
            .limit(input.limit);
        } else {
          const tenantId = ctx.user.tenantId!;
          orders = await db
            .select({
              id: pickingOrders.id,
              tenantId: pickingOrders.tenantId,
              clientName: tenants.name, // Nome do cliente (tenant) correto
              orderNumber: pickingOrders.orderNumber,
              customerName: pickingOrders.customerName,
              priority: pickingOrders.priority,
              status: pickingOrders.status,
              totalItems: pickingOrders.totalItems,
              totalQuantity: pickingOrders.totalQuantity,
              scheduledDate: pickingOrders.scheduledDate,
              createdAt: pickingOrders.createdAt,
              createdBy: pickingOrders.createdBy,
              assignedTo: pickingOrders.assignedTo,
              pickedBy: pickingOrders.pickedBy,
              pickedAt: pickingOrders.pickedAt,
              nfeNumber: pickingOrders.nfeNumber,
              nfeKey: pickingOrders.nfeKey,
            })
            .from(pickingOrders)
            .leftJoin(tenants, eq(pickingOrders.tenantId, tenants.id))
            .where(eq(pickingOrders.tenantId, tenantId))
            .orderBy(desc(pickingOrders.createdAt))
            .limit(input.limit);
        }

        return orders;
      }),

    // Criar pedido de separação
    create: protectedProcedure
      .input(
        z.object({
          tenantId: z.number(), // Cliente para quem o pedido está sendo criado
          customerName: z.string().min(1),
          priority: z.enum(["low", "normal", "urgent", "emergency"]).default("normal"),
          scheduledDate: z.string().optional(),
          items: z.array(
            z.object({
              productId: z.number(),
              requestedQuantity: z.number().positive(),
              requestedUnit: z.enum(["box", "unit", "pallet"]),
            })
          ),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        
        // Validação de permissões:
        // - Admin pode criar pedido para qualquer cliente
        // - Usuário comum só pode criar para seu próprio tenant
        if (ctx.user.role !== "admin" && ctx.user.tenantId !== input.tenantId) {
          throw new TRPCError({ 
            code: "FORBIDDEN", 
            message: "Você não tem permissão para criar pedidos para este cliente" 
          });
        }
        
        const tenantId = input.tenantId;
        const userId = ctx.user.id;

        // Gerar número do pedido
        const orderNumber = `PK${Date.now()}`;

        // Criar pedido
        await db.insert(pickingOrders).values({
          tenantId,
          orderNumber,
          customerName: input.customerName,
          priority: input.priority,
          status: "pending",
          totalItems: input.items.length,
          totalQuantity: input.items.reduce((sum, item) => sum + item.requestedQuantity, 0),
          scheduledDate: input.scheduledDate ? new Date(input.scheduledDate) : null,
          createdBy: userId,
        });

        // Buscar pedido criado
        const [order] = await db
          .select()
          .from(pickingOrders)
          .where(
            and(
              eq(pickingOrders.tenantId, tenantId),
              eq(pickingOrders.orderNumber, orderNumber)
            )
          )
          .limit(1);

        // Criar itens
        for (const item of input.items) {
          await db.insert(pickingOrderItems).values({
            pickingOrderId: order.id,
            productId: item.productId,
            requestedQuantity: item.requestedQuantity,
            requestedUM: item.requestedUnit,
            pickedQuantity: 0,
            status: "pending",
          });
        }

        return { success: true, orderId: order.id, orderNumber };
      }),

    // Buscar pedido por ID
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

        // Admin pode ver qualquer pedido, usuário comum apenas do seu tenant
        let order;
        if (ctx.user.role === "admin") {
          const [result] = await db
            .select()
            .from(pickingOrders)
            .where(eq(pickingOrders.id, input.id))
            .limit(1);
          order = result;
        } else {
          const tenantId = ctx.user.tenantId!;
          const [result] = await db
            .select()
            .from(pickingOrders)
            .where(
              and(
                eq(pickingOrders.id, input.id),
                eq(pickingOrders.tenantId, tenantId)
              )
            )
            .limit(1);
          order = result;
        }

        if (!order) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Pedido não encontrado" });
        }

        // Buscar itens com dados do produto
        const items = await db
          .select({
            id: pickingOrderItems.id,
            productId: pickingOrderItems.productId,
            productName: products.description,
            productSku: products.sku,
            requestedQuantity: pickingOrderItems.requestedQuantity,
            requestedUM: pickingOrderItems.requestedUM,
            pickedQuantity: pickingOrderItems.pickedQuantity,
            status: pickingOrderItems.status,
          })
          .from(pickingOrderItems)
          .leftJoin(products, eq(pickingOrderItems.productId, products.id))
          .where(eq(pickingOrderItems.pickingOrderId, order.id));

        return { ...order, items };
      }),

    // Atualizar status do pedido
    updateStatus: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum(["pending", "picking", "picked", "checking", "packed", "shipped", "cancelled"]),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

        // Admin pode atualizar qualquer pedido, usuário comum apenas do seu tenant
        if (ctx.user.role === "admin") {
          await db
            .update(pickingOrders)
            .set({ status: input.status })
            .where(eq(pickingOrders.id, input.id));
        } else {
          const tenantId = ctx.user.tenantId!;
          await db
            .update(pickingOrders)
            .set({ status: input.status })
            .where(
              and(
                eq(pickingOrders.id, input.id),
                eq(pickingOrders.tenantId, tenantId)
              )
            );
        }

        return { success: true };
      }),

    // ========================================
    // WAVE PICKING (SEPARAÇÃO POR ONDA)
    // ========================================

    // Criar onda de separação
    createWave: protectedProcedure
      .input(
        z.object({
          orderIds: z.array(z.number()).min(1, "Selecione pelo menos um pedido"),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { createWave } = await import("./waveLogic");
        
        try {
          const result = await createWave({
            orderIds: input.orderIds,
            userId: ctx.user.id,
          });
          
          return result;
        } catch (error: any) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error.message || "Erro ao criar onda de separação",
          });
        }
      }),

    // Listar ondas de separação
    listWaves: protectedProcedure
      .input(
        z.object({
          status: z.enum(["pending", "picking", "picked", "staged", "completed", "cancelled"]).optional(),
          tenantId: z.number().optional(), // Admin pode filtrar por cliente
        }).optional()
      )
      .query(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

        const tenantId = ctx.user.role === "admin" && input?.tenantId 
          ? input.tenantId 
          : ctx.user.tenantId;

        if (!tenantId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Usuário deve pertencer a um cliente" });
        }

        let query = db
          .select({
            id: pickingWaves.id,
            waveNumber: pickingWaves.waveNumber,
            status: pickingWaves.status,
            totalOrders: pickingWaves.totalOrders,
            totalItems: pickingWaves.totalItems,
            totalQuantity: pickingWaves.totalQuantity,
            pickingRule: pickingWaves.pickingRule,
            assignedTo: pickingWaves.assignedTo,
            pickedBy: pickingWaves.pickedBy,
            pickedAt: pickingWaves.pickedAt,
            createdAt: pickingWaves.createdAt,
          })
          .from(pickingWaves)
          .where(eq(pickingWaves.tenantId, tenantId));

        const waves = await query;

        // Filtrar por status se fornecido
        if (input?.status) {
          return waves.filter(w => w.status === input.status);
        }

        return waves;
      }),

    // Buscar detalhes de uma onda
    getWaveById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        const { getWaveById } = await import("./waveLogic");
        
        try {
          const wave = await getWaveById(input.id);
          
          // Verificar permissão
          if (ctx.user.role !== "admin" && wave.tenantId !== ctx.user.tenantId) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
          }
          
          return wave;
        } catch (error: any) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: error.message || "Onda não encontrada",
          });
        }
      }),

    // Atualizar status da onda
    updateWaveStatus: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum(["pending", "picking", "picked", "staged", "completed", "cancelled"]),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

        // Buscar onda para verificar permissão
        const [wave] = await db
          .select({ 
            tenantId: pickingWaves.tenantId,
            assignedTo: pickingWaves.assignedTo 
          })
          .from(pickingWaves)
          .where(eq(pickingWaves.id, input.id))
          .limit(1);

        if (!wave) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Onda não encontrada" });
        }

        // Verificar permissão
        if (ctx.user.role !== "admin" && wave.tenantId !== ctx.user.tenantId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
        }

        // Atualizar status e campos relacionados
        const updateData: any = { status: input.status };
        
        if (input.status === "picking" && !wave.assignedTo) {
          updateData.assignedTo = ctx.user.id;
        }
        
        if (input.status === "picked") {
          updateData.pickedBy = ctx.user.id;
          updateData.pickedAt = new Date();
        }
        
        if (input.status === "staged") {
          updateData.stagedBy = ctx.user.id;
          updateData.stagedAt = new Date();
        }

        await db
          .update(pickingWaves)
          .set(updateData)
          .where(eq(pickingWaves.id, input.id));

        return { success: true };
      }),

    // Registrar picking de item
    pickItem: protectedProcedure
      .input(
        z.object({
          itemId: z.number(),
          pickedQuantity: z.number().positive(),
          locationId: z.number(),
          batch: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

        await db
          .update(pickingOrderItems)
          .set({
            pickedQuantity: input.pickedQuantity,
            fromLocationId: input.locationId,
            batch: input.batch,
            status: "picked",
          })
          .where(eq(pickingOrderItems.id, input.itemId));

        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
