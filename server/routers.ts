import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { suggestPickingLocations, allocatePickingStock, getClientPickingRule, logPickingAudit } from "./pickingLogic";
import { getDb } from "./db";
import { tenants, products, warehouseLocations, receivingOrders, pickingOrders, inventory, contracts, systemUsers, receivingOrderItems, pickingOrderItems, pickingWaves, pickingWaveItems, labelAssociations, pickingReservations } from "../drizzle/schema";
import { eq, and, desc, inArray, sql, or } from "drizzle-orm";
import { z } from "zod";
import { parseNFE, isValidNFE } from "./nfeParser";
import { warehouseZones } from "../drizzle/schema";
import { blindConferenceRouter } from "./blindConferenceRouter";
import { stockRouter } from "./stockRouter";
import { preallocationRouter } from "./preallocationRouter";
import { waveRouter } from "./waveRouter";

export const appRouter = router({
  system: systemRouter,
  blindConference: blindConferenceRouter,
  stock: stockRouter,
  preallocation: preallocationRouter,
  wave: waveRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // Endpoint temporário de debug
  debug: router({
    checkTenants: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      // Buscar Hapvida
      const hapvida = await db.select().from(tenants).where(sql`name LIKE '%Hapvida%'`).limit(1);
      
      // Buscar estoque
      const stockTenants = await db
        .select({
          tenantId: inventory.tenantId,
          tenantName: tenants.name,
          count: sql<number>`COUNT(*)`
        })
        .from(inventory)
        .leftJoin(tenants, eq(inventory.tenantId, tenants.id))
        .groupBy(inventory.tenantId, tenants.name);
      
      return {
        hapvida: hapvida[0] || null,
        stockByTenant: stockTenants
      };
    })
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
              customerOrderNumber: pickingOrders.customerOrderNumber,
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
              customerOrderNumber: pickingOrders.customerOrderNumber,
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
          customerOrderNumber: z.string().optional(), // Número do pedido do cliente
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

        // PASSO 1: Validar estoque de TODOS os itens ANTES de criar o pedido
        // Isso evita criar pedidos órfãos quando há estoque insuficiente
        const stockValidations: Array<{
          item: typeof input.items[number];
          product: any;
          availableStock: any[];
        }> = [];

        for (const item of input.items) {
          // Buscar produto para obter SKU, nome e unitsPerBox
          const [product] = await db
            .select()
            .from(products)
            .where(eq(products.id, item.productId))
            .limit(1);

          if (!product) {
            throw new TRPCError({ 
              code: "NOT_FOUND", 
              message: `Produto ID ${item.productId} não encontrado` 
            });
          }

          // Converter quantidade para unidades se solicitado em caixa
          let quantityInUnits = item.requestedQuantity;
          if (item.requestedUnit === "box") {
            if (!product.unitsPerBox || product.unitsPerBox <= 0) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: `Produto ${product.sku} não possui quantidade por caixa configurada`
              });
            }
            quantityInUnits = item.requestedQuantity * product.unitsPerBox;
          }

          // Buscar estoque disponível (FIFO/FEFO)
          // IMPORTANTE: Usar input.tenantId (cliente selecionado) ao invés de ctx.user.tenantId (usuário logado)
          // Isso permite que admin crie pedidos para qualquer cliente
          const availableStock = await db
            .select({
              id: inventory.id,
              locationId: inventory.locationId,
              locationCode: warehouseLocations.code,
              quantity: inventory.quantity,
              reservedQuantity: inventory.reservedQuantity,
              batch: inventory.batch,
              expiryDate: inventory.expiryDate,
              availableQuantity: sql<number>`${inventory.quantity} - ${inventory.reservedQuantity}`.as('availableQuantity'),
            })
            .from(inventory)
            .leftJoin(warehouseLocations, eq(inventory.locationId, warehouseLocations.id))
            .where(
              and(
                eq(inventory.tenantId, input.tenantId), // ← CORRIGIDO: usar cliente selecionado
                eq(inventory.productId, item.productId),
                eq(inventory.status, "available"),
                sql`${inventory.quantity} - ${inventory.reservedQuantity} > 0`
              )
            )
            .orderBy(inventory.expiryDate); // FEFO por padrão

          // Calcular total disponível
          const totalAvailable = availableStock.reduce((sum, loc) => sum + loc.availableQuantity, 0);
          
          console.log(`[PICKING DEBUG] Product: ${product.sku}, Available: ${totalAvailable}, Requested: ${quantityInUnits}`);

          if (totalAvailable < quantityInUnits) {
            console.log(`[PICKING DEBUG] Insufficient stock, fetching detailed breakdown...`);
            // Buscar estoque total (todos os status) para mensagem mais informativa
            const totalStockAll = await db
              .select({
                quantity: inventory.quantity,
                reservedQuantity: inventory.reservedQuantity,
                status: inventory.status,
              })
              .from(inventory)
              .where(
                and(
                  eq(inventory.tenantId, input.tenantId),
                  eq(inventory.productId, item.productId)
                )
              );
            
            const totalInStock = totalStockAll.reduce((sum, s) => sum + (s.quantity - s.reservedQuantity), 0);
            const statusBreakdown = totalStockAll.reduce((acc, s) => {
              const available = s.quantity - s.reservedQuantity;
              acc[s.status] = (acc[s.status] || 0) + available;
              return acc;
            }, {} as Record<string, number>);
            
            const statusMsg = Object.entries(statusBreakdown)
              .map(([status, qty]) => `${status}: ${qty}`)
              .join(', ');

            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Estoque insuficiente para produto ${product.sku} (${product.description}). Disponível para picking: ${totalAvailable} unidades. Solicitado: ${item.requestedQuantity} ${item.requestedUnit === 'box' ? 'caixa(s)' : 'unidade(s)'} (${quantityInUnits} unidades). Estoque total: ${totalInStock} unidades (${statusMsg})`
            });
          }

          // Armazenar validação para uso posterior (incluindo quantidade convertida)
          stockValidations.push({ item, product, availableStock, quantityInUnits } as any);
        }

        // PASSO 2: Todas as validações passaram, agora criar o pedido
        const orderNumber = `PK${Date.now()}`;

        await db.insert(pickingOrders).values({
          tenantId,
          orderNumber,
          customerOrderNumber: input.customerOrderNumber || null,
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

        // PASSO 3: Criar itens e reservar estoque
        for (const validation of stockValidations) {
          const { item, product, availableStock, quantityInUnits } = validation as any;

          // Reservar estoque e registrar reservas (em unidades)
          let remainingToReserve = quantityInUnits;
          for (const stock of availableStock) {
            if (remainingToReserve <= 0) break;

            const toReserve = Math.min(stock.availableQuantity, remainingToReserve);
            
            // Incrementar reservedQuantity no inventory
            await db
              .update(inventory)
              .set({
                reservedQuantity: sql`${inventory.reservedQuantity} + ${toReserve}`
              })
              .where(eq(inventory.id, stock.id));

            // Registrar reserva na tabela pickingReservations
            await db.insert(pickingReservations).values({
              pickingOrderId: order.id,
              productId: item.productId,
              inventoryId: stock.id,
              quantity: toReserve,
            });

            remainingToReserve -= toReserve;
          }

          // Criar item do pedido
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

    // Atualizar pedido completo (apenas pendentes)
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          tenantId: z.number(),
          customerName: z.string().min(1),
          priority: z.enum(["low", "normal", "urgent", "emergency"]),
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

        // Buscar pedido para validar permissões e status
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

        // Apenas pedidos pendentes podem ser editados
        if (order.status !== "pending") {
          throw new TRPCError({ 
            code: "BAD_REQUEST", 
            message: "Apenas pedidos pendentes podem ser editados" 
          });
        }

        // Validar permissão para alterar tenantId (apenas admin)
        if (ctx.user.role !== "admin" && input.tenantId !== order.tenantId) {
          throw new TRPCError({ 
            code: "FORBIDDEN", 
            message: "Você não tem permissão para alterar o cliente do pedido" 
          });
        }

        // Atualizar pedido
        await db
          .update(pickingOrders)
          .set({
            tenantId: input.tenantId,
            customerName: input.customerName,
            priority: input.priority,
            scheduledDate: input.scheduledDate ? new Date(input.scheduledDate) : null,
            totalItems: input.items.length,
            totalQuantity: input.items.reduce((sum, item) => sum + item.requestedQuantity, 0),
          })
          .where(eq(pickingOrders.id, input.id));

        // Excluir itens antigos
        await db
          .delete(pickingOrderItems)
          .where(eq(pickingOrderItems.pickingOrderId, input.id));

        // Inserir novos itens
        if (input.items.length > 0) {
          await db.insert(pickingOrderItems).values(
            input.items.map((item) => ({
              pickingOrderId: input.id,
              productId: item.productId,
              requestedQuantity: item.requestedQuantity,
              requestedUM: item.requestedUnit,
              pickedQuantity: 0,
              status: "pending" as const,
            }))
          );
        }

        return { success: true };
      }),

    // Excluir pedidos em lote
    deleteBatch: protectedProcedure
      .input(
        z.object({
          ids: z.array(z.number()).min(1),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

        // Validar permissões e buscar pedidos
        let ordersToDelete;
        if (ctx.user.role === "admin") {
          ordersToDelete = await db
            .select({ id: pickingOrders.id, status: pickingOrders.status })
            .from(pickingOrders)
            .where(inArray(pickingOrders.id, input.ids));
        } else {
          const tenantId = ctx.user.tenantId!;
          ordersToDelete = await db
            .select({ id: pickingOrders.id, status: pickingOrders.status })
            .from(pickingOrders)
            .where(
              and(
                inArray(pickingOrders.id, input.ids),
                eq(pickingOrders.tenantId, tenantId)
              )
            );
        }

        if (ordersToDelete.length === 0) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Nenhum pedido encontrado para exclusão" });
        }

        // Verificar se algum pedido não pode ser excluído (status não permitido)
        const nonDeletableOrders = ordersToDelete.filter(
          order => !['pending', 'cancelled'].includes(order.status)
        );

        if (nonDeletableOrders.length > 0) {
          throw new TRPCError({ 
            code: "BAD_REQUEST", 
            message: `${nonDeletableOrders.length} pedido(s) não podem ser excluídos pois já estão em processo de separação` 
          });
        }

        const idsToDelete = ordersToDelete.map(o => o.id);

        // Liberar reservas de estoque antes de excluir
        for (const orderId of idsToDelete) {
          // Buscar reservas do pedido
          const reservations = await db
            .select()
            .from(pickingReservations)
            .where(eq(pickingReservations.pickingOrderId, orderId));

          if (reservations.length > 0) {
            // Liberar estoque reservado
            for (const reservation of reservations) {
              await db
                .update(inventory)
                .set({
                  reservedQuantity: sql`${inventory.reservedQuantity} - ${reservation.quantity}`
                })
                .where(eq(inventory.id, reservation.inventoryId));
            }

            // Excluir registros de reserva
            await db
              .delete(pickingReservations)
              .where(eq(pickingReservations.pickingOrderId, orderId));
          } else {
            // CORREÇÃO: Se não há reservas mas o pedido existe, pode haver reservas órfãs
            // Buscar itens do pedido para identificar posições de estoque afetadas
            const orderItems = await db
              .select()
              .from(pickingOrderItems)
              .where(eq(pickingOrderItems.pickingOrderId, orderId));

            // Para cada item, verificar se há estoque com reservedQuantity órfã
            for (const item of orderItems) {
              const inventoryRecords = await db
                .select()
                .from(inventory)
                .where(
                  and(
                    eq(inventory.productId, item.productId),
                    sql`${inventory.reservedQuantity} > 0`
                  )
                );

              // Verificar se cada posição tem reservas ativas
              for (const inv of inventoryRecords) {
                const [activeReservations] = await db
                  .select({ total: sql<number>`COALESCE(SUM(${pickingReservations.quantity}), 0)` })
                  .from(pickingReservations)
                  .where(eq(pickingReservations.inventoryId, inv.id));

                const activeTotal = Number(activeReservations?.total) || 0;

                // Se não há reservas ativas mas reservedQuantity > 0, corrigir
                if (activeTotal === 0 && inv.reservedQuantity > 0) {
                  await db
                    .update(inventory)
                    .set({ reservedQuantity: 0 })
                    .where(eq(inventory.id, inv.id));
                }
              }
            }
          }
        }

        // Excluir itens dos pedidos primeiro (foreign key)
        await db
          .delete(pickingOrderItems)
          .where(inArray(pickingOrderItems.pickingOrderId, idsToDelete));

        // Excluir pedidos
        await db
          .delete(pickingOrders)
          .where(inArray(pickingOrders.id, idsToDelete));

        return { success: true, deleted: idsToDelete.length };
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

    // Buscar progresso de execução de uma onda (proxy para wave.getPickingProgress)
    getPickingProgress: protectedProcedure
      .input(z.object({ waveId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const [wave] = await db
          .select()
          .from(pickingWaves)
          .where(eq(pickingWaves.id, input.waveId))
          .limit(1);

        if (!wave) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Onda não encontrada" });
        }

        const items = await db
          .select({
            id: pickingWaveItems.id,
            waveId: pickingWaveItems.waveId,
            productId: pickingWaveItems.productId,
            productSku: pickingWaveItems.productSku,
            productName: pickingWaveItems.productName,
            totalQuantity: pickingWaveItems.totalQuantity,
            pickedQuantity: pickingWaveItems.pickedQuantity,
            locationId: pickingWaveItems.locationId,
            locationCode: pickingWaveItems.locationCode,
            batch: pickingWaveItems.batch,
            expiryDate: pickingWaveItems.expiryDate,
            status: pickingWaveItems.status,
            pickedAt: pickingWaveItems.pickedAt,
            createdAt: pickingWaveItems.createdAt,
            unitsPerBox: products.unitsPerBox, // Adicionar unitsPerBox do produto
          })
          .from(pickingWaveItems)
          .leftJoin(products, eq(pickingWaveItems.productId, products.id))
          .where(eq(pickingWaveItems.waveId, input.waveId));

        const totalItems = items.length;
        const completedItems = items.filter(item => item.status === "picked").length;
        const totalQuantity = items.reduce((sum, item) => sum + item.totalQuantity, 0);
        const pickedQuantity = items.reduce((sum, item) => sum + item.pickedQuantity, 0);

        return {
          wave,
          items,
          progress: {
            totalItems,
            completedItems,
            totalQuantity,
            pickedQuantity,
            percentComplete: totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0,
          },
        };
      }),

    // Registrar item separado (escanear etiqueta) (proxy para wave.registerPickedItem)
    registerPickedItem: protectedProcedure
      .input(z.object({
        waveId: z.number(),
        itemId: z.number(),
        scannedCode: z.string(),
        quantity: z.number().min(1),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const [waveItem] = await db
          .select()
          .from(pickingWaveItems)
          .where(eq(pickingWaveItems.id, input.itemId))
          .limit(1);

        if (!waveItem) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Item da onda não encontrado" });
        }

        // Validar que o código escaneado corresponde à etiqueta armazenada no recebimento
        if (waveItem.batch) {
          // Buscar etiqueta associada ao produto/lote no recebimento
          const [labelRecord] = await db
            .select({ labelCode: labelAssociations.labelCode })
            .from(labelAssociations)
            .where(
              and(
                eq(labelAssociations.productId, waveItem.productId),
                eq(labelAssociations.batch, waveItem.batch)
              )
            )
            .limit(1);

          if (labelRecord) {
            // Se há labelCode armazenado, comparar diretamente
            if (input.scannedCode.trim() !== labelRecord.labelCode.trim()) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: `Etiqueta incorreta! Esperado: ${labelRecord.labelCode}, mas foi escaneado: "${input.scannedCode}"`,
              });
            }
          } else {
            // Fallback: se não houver labelCode, validar pelo SKU (legado)
            const skuLength = waveItem.productSku.length;
            const scannedSku = input.scannedCode.substring(0, skuLength);
            
            if (scannedSku !== waveItem.productSku) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: `Produto incorreto! Esperado SKU: ${waveItem.productSku}, mas a etiqueta "${input.scannedCode}" não corresponde`,
              });
            }
          }
        } else {
          // Se não há lote, validar apenas pelo SKU
          const skuLength = waveItem.productSku.length;
          const scannedSku = input.scannedCode.substring(0, skuLength);
          
          if (scannedSku !== waveItem.productSku) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Produto incorreto! Esperado SKU: ${waveItem.productSku}`,
            });
          }
        }

        // Validar saldo disponível na posição de estoque
        // Validação de estoque removida - a reserva já foi feita na criação do pedido
        // Durante a separação, permitir separar até totalQuantity do waveItem

        const newPickedQuantity = waveItem.pickedQuantity + input.quantity;
        if (newPickedQuantity > waveItem.totalQuantity) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Quantidade excede o solicitado! Solicitado: ${waveItem.totalQuantity}, já separado: ${waveItem.pickedQuantity}, tentando adicionar: ${input.quantity}`,
          });
        }

        const isComplete = newPickedQuantity === waveItem.totalQuantity;
        await db
          .update(pickingWaveItems)
          .set({
            pickedQuantity: newPickedQuantity,
            status: isComplete ? "picked" : "picking",
          })
          .where(eq(pickingWaveItems.id, input.itemId));

        const allItems = await db
          .select()
          .from(pickingWaveItems)
          .where(eq(pickingWaveItems.waveId, input.waveId));

        const allCompleted = allItems.every(item => 
          item.id === input.itemId ? isComplete : item.status === "picked"
        );

        if (allCompleted) {
          await db
            .update(pickingWaves)
            .set({ status: "completed" })
            .where(eq(pickingWaves.id, input.waveId));

          await db
            .update(pickingOrders)
            .set({ status: "picked" })
            .where(eq(pickingOrders.waveId, input.waveId));
        } else {
          await db
            .update(pickingWaves)
            .set({ status: "picking" })
            .where(
              and(
                eq(pickingWaves.id, input.waveId),
                eq(pickingWaves.status, "pending")
              )
            );
        }

        return {
          success: true,
          itemCompleted: isComplete,
          waveCompleted: allCompleted,
          pickedQuantity: newPickedQuantity,
          totalQuantity: waveItem.totalQuantity,
        };
      }),

    // Importar pedidos via Excel
    importOrders: protectedProcedure
      .input(
        z.object({
          fileData: z.string(), // Base64 do arquivo Excel
        })
      )
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

        try {
          // Decodificar base64 e processar Excel
          const buffer = Buffer.from(input.fileData, 'base64');
          const xlsx = await import('xlsx');
          const workbook = xlsx.read(buffer, { type: 'buffer' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const rows: any[] = xlsx.utils.sheet_to_json(sheet);

          if (rows.length === 0) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Planilha vazia" });
          }

          const results = {
            success: [] as any[],
            errors: [] as any[],
          };

          // Agrupar por número do pedido
          const orderGroups = new Map<string, any[]>();
          
          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowNum = i + 2; // +2 porque linha 1 é cabeçalho e array começa em 0

            // Validar campos obrigatórios
            if (!row['Nº do Pedido']) {
              results.errors.push({ linha: rowNum, erro: 'Nº do Pedido é obrigatório' });
              continue;
            }
            if (!row['Cliente']) {
              results.errors.push({ linha: rowNum, erro: 'Cliente é obrigatório' });
              continue;
            }
            if (!row['Destinatário']) {
              results.errors.push({ linha: rowNum, erro: 'Destinatário é obrigatório' });
              continue;
            }
            if (!row['Cód. do Produto']) {
              results.errors.push({ linha: rowNum, erro: 'Cód. do Produto é obrigatório' });
              continue;
            }
            if (!row['Quantidade'] || row['Quantidade'] <= 0) {
              results.errors.push({ linha: rowNum, erro: 'Quantidade deve ser maior que zero' });
              continue;
            }
            if (!row['Unidade de Medida']) {
              results.errors.push({ linha: rowNum, erro: 'Unidade de Medida é obrigatória' });
              continue;
            }

            const orderNumber = String(row['Nº do Pedido']).trim();
            if (!orderGroups.has(orderNumber)) {
              orderGroups.set(orderNumber, []);
            }
            orderGroups.get(orderNumber)!.push({ ...row, rowNum });
          }

          // Processar cada pedido
          for (const [orderNumber, items] of Array.from(orderGroups.entries())) {
            try {
              const firstItem = items[0];
              const clientName = String(firstItem['Cliente']).trim();
              const customerName = String(firstItem['Destinatário']).trim();

              // Buscar cliente (tenant) por nome ou nome fantasia
              // Normalizar nome do cliente (remover espaços extras e converter para lowercase)
              const normalizedClientName = clientName.toLowerCase().trim();
              
              const [tenant] = await db
                .select()
                .from(tenants)
                .where(
                  or(
                    sql`LOWER(TRIM(${tenants.name})) = ${normalizedClientName}`,
                    sql`LOWER(TRIM(${tenants.tradeName})) = ${normalizedClientName}`
                  )
                )
                .limit(1);

              if (!tenant) {
                results.errors.push({
                  pedido: orderNumber,
                  erro: `Cliente "${clientName}" não encontrado no sistema. Verifique se o nome está correto.`,
                });
                continue;
              }

              // Validar permissões
              if (ctx.user.role !== "admin" && ctx.user.tenantId !== tenant.id) {
                results.errors.push({
                  pedido: orderNumber,
                  erro: "Você não tem permissão para criar pedidos para este cliente",
                });
                continue;
              }

              // Processar itens do pedido
              const orderItems: Array<{
                productId: number;
                requestedQuantity: number;
                requestedUnit: "box" | "unit" | "pallet";
              }> = [];

              let hasItemError = false;
              for (const item of items) {
                const productCode = String(item['Cód. do Produto']).trim();
                const quantity = Number(item['Quantidade']);
                const unit = String(item['Unidade de Medida']).toLowerCase().trim();

                // Buscar produto por SKU
                const [product] = await db
                  .select()
                  .from(products)
                  .where(
                    and(
                      eq(products.tenantId, tenant.id),
                      sql`LOWER(${products.sku}) = LOWER(${productCode})`
                    )
                  )
                  .limit(1);

                if (!product) {
                  results.errors.push({
                    pedido: orderNumber,
                    linha: item.rowNum,
                    erro: `Produto "${productCode}" não encontrado para o cliente ${clientName}`,
                  });
                  hasItemError = true;
                  break;
                }

                // Validar unidade de medida
                let requestedUnit: "box" | "unit" | "pallet";
                if (unit === "caixa" || unit === "box") {
                  requestedUnit = "box";
                } else if (unit === "unidade" || unit === "unit" || unit === "un") {
                  requestedUnit = "unit";
                } else if (unit === "pallet" || unit === "palete") {
                  requestedUnit = "pallet";
                } else {
                  results.errors.push({
                    pedido: orderNumber,
                    linha: item.rowNum,
                    erro: `Unidade de medida inválida: "${item['Unidade de Medida']}". Use: caixa, unidade ou pallet`,
                  });
                  hasItemError = true;
                  break;
                }

                // Converter quantidade para unidades se solicitado em caixa
                let quantityInUnits = quantity;
                if (requestedUnit === "box") {
                  if (!product.unitsPerBox || product.unitsPerBox <= 0) {
                    results.errors.push({
                      pedido: orderNumber,
                      linha: item.rowNum,
                      erro: `Produto ${product.sku} não possui quantidade por caixa configurada`,
                    });
                    hasItemError = true;
                    break;
                  }
                  quantityInUnits = quantity * product.unitsPerBox;
                }

                orderItems.push({
                  productId: product.id,
                  requestedQuantity: quantity,
                  requestedUnit,
                  quantityInUnits, // Adicionar quantidade convertida
                } as any);
              }

              if (hasItemError) {
                continue;
              }

              // Criar pedido usando a mesma lógica do endpoint create
              const generatedOrderNumber = `PK${Date.now()}`;

              // Validar estoque antes de criar
              for (const item of orderItems) {
                const itemAny = item as any;
                const availableStock = await db
                  .select({
                    availableQuantity: sql<number>`${inventory.quantity} - ${inventory.reservedQuantity}`.as('availableQuantity'),
                  })
                  .from(inventory)
                  .where(
                    and(
                      eq(inventory.tenantId, tenant.id),
                      eq(inventory.productId, item.productId),
                      eq(inventory.status, "available"),
                      sql`${inventory.quantity} - ${inventory.reservedQuantity} > 0`
                    )
                  );

                const totalAvailable = availableStock.reduce((sum, loc) => sum + loc.availableQuantity, 0);

                if (totalAvailable < itemAny.quantityInUnits) {
                  const [product] = await db.select().from(products).where(eq(products.id, item.productId)).limit(1);
                  results.errors.push({
                    pedido: orderNumber,
                    erro: `Estoque insuficiente para produto ${product?.sku}. Disponível: ${totalAvailable} unidades, Solicitado: ${item.requestedQuantity} ${item.requestedUnit === 'box' ? 'caixa(s)' : 'unidade(s)'} (${itemAny.quantityInUnits} unidades)`,
                  });
                  hasItemError = true;
                  break;
                }
              }

              if (hasItemError) {
                continue;
              }

              // Criar pedido
              await db.insert(pickingOrders).values({
                tenantId: tenant.id,
                orderNumber: generatedOrderNumber,
                customerOrderNumber: orderNumber, // Usar número do pedido do cliente
                customerName,
                priority: "normal",
                status: "pending",
                totalItems: orderItems.length,
                totalQuantity: orderItems.reduce((sum, item) => sum + item.requestedQuantity, 0),
                createdBy: ctx.user.id,
              });

              // Buscar pedido criado
              const [order] = await db
                .select()
                .from(pickingOrders)
                .where(
                  and(
                    eq(pickingOrders.tenantId, tenant.id),
                    eq(pickingOrders.orderNumber, generatedOrderNumber)
                  )
                )
                .limit(1);

              if (!order) {
                throw new Error("Falha ao criar pedido");
              }

              // Criar itens do pedido
              await db.insert(pickingOrderItems).values(
                orderItems.map((item) => ({
                  pickingOrderId: order.id,
                  productId: item.productId,
                  requestedQuantity: item.requestedQuantity,
                  requestedUM: item.requestedUnit,
                  pickedQuantity: 0,
                  status: "pending" as const,
                }))
              );

              // Reservar estoque (FEFO)
              for (const item of orderItems) {
                const itemAny = item as any;
                const availableStock = await db
                  .select({
                    id: inventory.id,
                    quantity: inventory.quantity,
                    reservedQuantity: inventory.reservedQuantity,
                    batch: inventory.batch,
                    expiryDate: inventory.expiryDate,
                    availableQuantity: sql<number>`${inventory.quantity} - ${inventory.reservedQuantity}`.as('availableQuantity'),
                  })
                  .from(inventory)
                  .where(
                    and(
                      eq(inventory.tenantId, tenant.id),
                      eq(inventory.productId, item.productId),
                      eq(inventory.status, "available"),
                      sql`${inventory.quantity} - ${inventory.reservedQuantity} > 0`
                    )
                  )
                  .orderBy(inventory.expiryDate); // FEFO

                let remainingToReserve = itemAny.quantityInUnits; // Usar quantidade convertida
                for (const stock of availableStock) {
                  if (remainingToReserve <= 0) break;

                  const quantityToReserve = Math.min(remainingToReserve, stock.availableQuantity);

                  // Atualizar estoque reservado
                  await db
                    .update(inventory)
                    .set({
                      reservedQuantity: sql`${inventory.reservedQuantity} + ${quantityToReserve}`,
                    })
                    .where(eq(inventory.id, stock.id));

                  // Registrar reserva
                  await db.insert(pickingReservations).values({
                    pickingOrderId: order.id,
                    productId: item.productId,
                    inventoryId: stock.id,
                    quantity: quantityToReserve,
                  });

                  remainingToReserve -= quantityToReserve;
                }
              }

              results.success.push({
                pedido: orderNumber,
                numeroSistema: generatedOrderNumber,
                cliente: clientName,
                destinatario: customerName,
                itens: orderItems.length,
                quantidadeTotal: orderItems.reduce((sum, item) => sum + item.requestedQuantity, 0),
              });
            } catch (error: any) {
              results.errors.push({
                pedido: orderNumber,
                erro: error.message || "Erro ao processar pedido",
              });
            }
          }

          return results;
        } catch (error: any) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error.message || "Erro ao processar arquivo Excel",
          });
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
