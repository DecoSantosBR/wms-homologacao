import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { tenants, products, warehouseLocations, receivingOrders, pickingOrders, inventory, contracts, systemUsers, receivingOrderItems, pickingOrderItems, receivingConferences, receivingDivergences } from "../drizzle/schema";
import { eq, and, desc, inArray, sql, or } from "drizzle-orm";
import { z } from "zod";
import { parseNFE, isValidNFE } from "./nfeParser";
import {
  processPreallocationExcel,
  validatePreallocations,
  generatePreallocationTemplate,
  type PreallocationValidation,
} from "./preallocationProcessor";
import { warehouseZones } from "../drizzle/schema";

export const appRouter = router({
  system: systemRouter,
  
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
        eq(pickingOrders.status, 'in_progress')
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

            // Gerar código do endereço
            const codeParts = [row.zona, row.rua, row.predio, row.andar, row.quadrante].filter(Boolean);
            const code = codeParts.join('-');

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
    /**
     * Lista todas as ordens de recebimento
     */
    list: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(receivingOrders).orderBy(desc(receivingOrders.createdAt)).limit(50);
    }),

    /**
     * Busca itens de uma ordem de recebimento
     */
    getItems: protectedProcedure
      .input(z.object({ receivingOrderId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        
        return db
          .select({
            id: receivingOrderItems.id,
            receivingOrderId: receivingOrderItems.receivingOrderId,
            productId: receivingOrderItems.productId,
            expectedQuantity: receivingOrderItems.expectedQuantity,
            receivedQuantity: receivingOrderItems.receivedQuantity,
            addressedQuantity: receivingOrderItems.addressedQuantity,
            expectedGtin: receivingOrderItems.expectedGtin,
            expectedSupplierCode: receivingOrderItems.expectedSupplierCode,
            // Join com produtos para pegar informações
            productSku: products.sku,
            productDescription: products.description,
            productGtin: products.gtin,
          })
          .from(receivingOrderItems)
          .leftJoin(products, eq(receivingOrderItems.productId, products.id))
          .where(eq(receivingOrderItems.receivingOrderId, input.receivingOrderId));
      }),

    /**
     * Cria uma ordem de recebimento manual
     */
    create: protectedProcedure
      .input(z.object({
        tenantId: z.number(),
        description: z.string().optional(),
        scheduledDate: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Gerar número da ordem (REC-YYYYMMDD-XXXX)
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
        const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
        const orderNumber = `REC-${dateStr}-${randomNum}`;

        const [result] = await db.insert(receivingOrders).values({
          tenantId: input.tenantId,
          orderNumber,
          scheduledDate: input.scheduledDate ? new Date(input.scheduledDate) : now,
          status: "scheduled",
          createdBy: ctx.user.id,
        });

        return { id: result.insertId, orderNumber };
      }),

    /**
     * Deleta uma ordem de recebimento
     */
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Verificar se a ordem existe
        const [order] = await db
          .select()
          .from(receivingOrders)
          .where(eq(receivingOrders.id, input.id))
          .limit(1);

        if (!order) {
          throw new Error("Ordem de recebimento não encontrada");
        }

        // Verificar se a ordem pode ser deletada (não pode estar finalizada)
        if (order.status === "completed") {
          throw new Error("Não é possível deletar uma ordem finalizada");
        }

        // Deletar itens da ordem primeiro
        await db.delete(receivingOrderItems).where(eq(receivingOrderItems.receivingOrderId, input.id));

        // Deletar conferências
        await db.delete(receivingConferences).where(
          inArray(
            receivingConferences.receivingOrderItemId,
            db.select({ id: receivingOrderItems.id }).from(receivingOrderItems).where(eq(receivingOrderItems.receivingOrderId, input.id))
          )
        );

        // Deletar divergências
        await db.delete(receivingDivergences).where(
          inArray(
            receivingDivergences.receivingOrderItemId,
            db.select({ id: receivingOrderItems.id }).from(receivingOrderItems).where(eq(receivingOrderItems.receivingOrderId, input.id))
          )
        );

        // Deletar a ordem
        await db.delete(receivingOrders).where(eq(receivingOrders.id, input.id));

        return { success: true };
      }),

    /**
     * Deleta múltiplas ordens de recebimento
     */
    deleteBatch: protectedProcedure
      .input(z.object({ ids: z.array(z.number()) }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        let deletedCount = 0;
        const errors: string[] = [];

        for (const id of input.ids) {
          try {
            // Verificar se a ordem existe e pode ser deletada
            const [order] = await db
              .select()
              .from(receivingOrders)
              .where(eq(receivingOrders.id, id))
              .limit(1);

            if (!order) {
              errors.push(`Ordem ${id}: não encontrada`);
              continue;
            }

            if (order.status === "completed") {
              errors.push(`Ordem ${id}: não pode deletar ordem finalizada`);
              continue;
            }

            // Deletar itens e dependências
            await db.delete(receivingOrderItems).where(eq(receivingOrderItems.receivingOrderId, id));
            await db.delete(receivingOrders).where(eq(receivingOrders.id, id));
            deletedCount++;
          } catch (error: any) {
            errors.push(`Ordem ${id}: ${error.message}`);
          }
        }

        return { count: deletedCount, errors };
      }),

    /**
     * Confere um item de recebimento
     */
    checkItem: protectedProcedure
      .input(z.object({
        itemId: z.number(),
        quantityReceived: z.number(),
        batch: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Buscar item
        const [item] = await db
          .select()
          .from(receivingOrderItems)
          .where(eq(receivingOrderItems.id, input.itemId))
          .limit(1);

        if (!item) {
          throw new Error("Item não encontrado");
        }

        // Atualizar quantidade recebida
        await db
          .update(receivingOrderItems)
          .set({ receivedQuantity: input.quantityReceived })
          .where(eq(receivingOrderItems.id, input.itemId));

        // Registrar conferência
        await db.insert(receivingConferences).values({
          receivingOrderItemId: input.itemId,
          batch: input.batch || null,
          quantityConferenced: input.quantityReceived,
          conferencedBy: ctx.user.id,
          notes: input.notes || null,
        });

        // Detectar divergência
        if (input.quantityReceived !== item.expectedQuantity) {
          const divergenceType = input.quantityReceived < item.expectedQuantity ? "shortage" : "surplus";
          const differenceQuantity = input.quantityReceived - item.expectedQuantity;

          await db.insert(receivingDivergences).values({
            receivingOrderItemId: input.itemId,
            divergenceType,
            expectedQuantity: item.expectedQuantity,
            receivedQuantity: input.quantityReceived,
            differenceQuantity,
            batch: input.batch || null,
            status: "pending",
            reportedBy: ctx.user.id,
          });
        }

        return { success: true, hasDivergence: input.quantityReceived !== item.expectedQuantity };
      }),

    /**
     * Endereça um item de recebimento
     */
    addressItem: protectedProcedure
      .input(z.object({
        itemId: z.number(),
        locationId: z.number(),
        quantity: z.number(),
        batch: z.string().optional(),
        expiryDate: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Buscar item
        const [item] = await db
          .select()
          .from(receivingOrderItems)
          .where(eq(receivingOrderItems.id, input.itemId))
          .limit(1);

        if (!item) {
          throw new Error("Item não encontrado");
        }

        // Verificar se quantidade endereçada não excede recebida
        const newAddressedQuantity = item.addressedQuantity + input.quantity;
        if (newAddressedQuantity > item.receivedQuantity) {
          throw new Error("Quantidade endereçada excede quantidade recebida");
        }

        // Atualizar quantidade endereçada
        await db
          .update(receivingOrderItems)
          .set({ addressedQuantity: newAddressedQuantity })
          .where(eq(receivingOrderItems.id, input.itemId));

        // Buscar tenant do produto para criar inventário
        const [product] = await db
          .select({ tenantId: products.tenantId })
          .from(products)
          .where(eq(products.id, item.productId))
          .limit(1);

        // Criar registro de inventário
        await db.insert(inventory).values({
          tenantId: product?.tenantId || null,
          productId: item.productId,
          locationId: input.locationId,
          batch: input.batch || null,
          expiryDate: input.expiryDate ? new Date(input.expiryDate) : null,
          quantity: input.quantity,
          status: "available",
        });

        return { success: true, fullyAddressed: newAddressedQuantity === item.receivedQuantity };
      }),

    /**
     * Retorna saldo pendente de endereçamento de um item
     */
    getPendingAddressingBalance: protectedProcedure
      .input(z.object({ receivingOrderItemId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { pending: 0, received: 0, addressed: 0 };

        const [item] = await db
          .select({
            receivedQuantity: receivingOrderItems.receivedQuantity,
            addressedQuantity: receivingOrderItems.addressedQuantity,
          })
          .from(receivingOrderItems)
          .where(eq(receivingOrderItems.id, input.receivingOrderItemId))
          .limit(1);

        if (!item) {
          return { pending: 0, received: 0, addressed: 0 };
        }

        return {
          pending: item.receivedQuantity - item.addressedQuantity,
          received: item.receivedQuantity,
          addressed: item.addressedQuantity,
        };
      }),

    /**
     * Agenda previsão de chegada do veículo
     */
    schedule: protectedProcedure
      .input(z.object({ 
        id: z.number(),
        scheduledDate: z.string(), // ISO date string
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        await db
          .update(receivingOrders)
          .set({ 
            scheduledDate: new Date(input.scheduledDate),
            updatedAt: new Date(),
          })
          .where(eq(receivingOrders.id, input.id));

        return { success: true };
      }),

    /**
     * Download de modelo Excel para pré-alocação
     */
    downloadPreallocationTemplate: protectedProcedure.query(async () => {
      const buffer = generatePreallocationTemplate();
      const fileBase64 = buffer.toString("base64");
      return {
        fileBase64,
        filename: "modelo-preallocacao.xlsx",
      };
    }),

    /**
     * Upload e validação de arquivo de pré-alocação
     */
    uploadPreallocationFile: protectedProcedure
      .input(
        z.object({
          receivingOrderId: z.number(),
          tenantId: z.number(),
          fileBase64: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        try {
          // Decodificar base64 para Buffer
          const fileBuffer = Buffer.from(input.fileBase64, "base64");

          // Processar arquivo Excel
          const { success, rows, errors } = await processPreallocationExcel(fileBuffer);

          if (!success || rows.length === 0) {
            return { success: false, validations: [], errors };
          }

          // Validar contra banco de dados
          const validations = await validatePreallocations(rows, input.tenantId);

          return { success: true, validations, errors: [] };
        } catch (error: any) {
          return {
            success: false,
            validations: [],
            errors: [error.message],
          };
        }
      }),

    /**
     * Salvar pré-alocações válidas no banco
     */
    savePreallocations: protectedProcedure
      .input(
        z.object({
          receivingOrderId: z.number(),
          validations: z.array(
            z.object({
              isValid: z.boolean(),
              productId: z.number().optional(),
              locationId: z.number().optional(),
              lote: z.string(),
              quantidade: z.number(),
            })
          ),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Filtrar apenas validações válidas
        const validOnes = input.validations.filter(
          (v) => v.isValid && v.productId && v.locationId
        );

        if (validOnes.length === 0) {
          return { success: false, count: 0 };
        }

        // Importar receivingPreallocations do schema
        const { receivingPreallocations } = await import("../drizzle/schema");

        // Inserir pré-alocações
        for (const validation of validOnes) {
          await db.insert(receivingPreallocations).values({
            receivingOrderId: input.receivingOrderId,
            productId: validation.productId!,
            locationId: validation.locationId!,
            batch: validation.lote,
            quantity: validation.quantidade,
            status: "pending",
            createdBy: ctx.user.id,
            createdAt: new Date(),
          });
        }

        return { success: true, count: validOnes.length };
      }),

    /**
     * Obter pré-alocações de uma ordem
     */
    getPreallocations: protectedProcedure
      .input(z.object({ receivingOrderId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];

        const { receivingPreallocations } = await import("../drizzle/schema");

        const preallocations = await db
          .select({
            id: receivingPreallocations.id,
            productId: receivingPreallocations.productId,
            locationId: receivingPreallocations.locationId,
            batch: receivingPreallocations.batch,
            quantity: receivingPreallocations.quantity,
            status: receivingPreallocations.status,
            productSku: products.sku,
            productDescription: products.description,
            locationCode: warehouseLocations.code,
          })
          .from(receivingPreallocations)
          .leftJoin(products, eq(receivingPreallocations.productId, products.id))
          .leftJoin(
            warehouseLocations,
            eq(receivingPreallocations.locationId, warehouseLocations.id)
          )
          .where(eq(receivingPreallocations.receivingOrderId, input.receivingOrderId));

        return preallocations;
      }),

    /**
     * Sugerir endereço para movimentação (prioriza pré-alocação)
     */
    getSuggestedLocation: protectedProcedure
      .input(
        z.object({
          productId: z.number(),
          batch: z.string(),
          quantity: z.number(),
          tenantId: z.number(),
        })
      )
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;

        const { receivingPreallocations } = await import("../drizzle/schema");

        // 1. Buscar pré-alocação pendente
        const [preallocation] = await db
          .select({
            locationId: receivingPreallocations.locationId,
            locationCode: warehouseLocations.code,
          })
          .from(receivingPreallocations)
          .leftJoin(
            warehouseLocations,
            eq(receivingPreallocations.locationId, warehouseLocations.id)
          )
          .where(
            and(
              eq(receivingPreallocations.productId, input.productId),
              eq(receivingPreallocations.batch, input.batch),
              eq(receivingPreallocations.status, "pending")
            )
          )
          .limit(1);

        if (preallocation && preallocation.locationCode) {
          return {
            locationId: preallocation.locationId,
            locationCode: preallocation.locationCode,
            source: "preallocation" as const,
          };
        }

        // 2. Buscar endereço livre
        const [freeLocation] = await db
          .select()
          .from(warehouseLocations)
          .where(
            and(
              eq(warehouseLocations.tenantId, input.tenantId),
              eq(warehouseLocations.status, "available")
            )
          )
          .limit(1);

        if (freeLocation) {
          return {
            locationId: freeLocation.id,
            locationCode: freeLocation.code,
            source: "free_location" as const,
          };
        }

        return null;
      }),

    /**
     * Gerar etiquetas para impressão (usa pré-alocações se existirem)
     */
    generateLabels: protectedProcedure
      .input(z.object({ receivingOrderId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const { receivingPreallocations } = await import("../drizzle/schema");

        // Buscar pré-alocações
        const preallocations = await db
          .select({
            locationCode: warehouseLocations.code,
            zone: warehouseZones.name,
            locationType: warehouseLocations.locationType,
          })
          .from(receivingPreallocations)
          .leftJoin(
            warehouseLocations,
            eq(receivingPreallocations.locationId, warehouseLocations.id)
          )
          .leftJoin(
            warehouseZones,
            eq(warehouseLocations.zoneId, warehouseZones.id)
          )
          .where(eq(receivingPreallocations.receivingOrderId, input.receivingOrderId));

        // Se não houver pré-alocações, usar endereços de recebimento
        let labels = preallocations;
        if (labels.length === 0) {
          // Buscar endereços da zona REC
          const recZone = await db
            .select()
            .from(warehouseZones)
            .where(eq(warehouseZones.code, "REC"))
            .limit(1);

          if (recZone.length > 0) {
            labels = await db
              .select({
                locationCode: warehouseLocations.code,
                zone: warehouseZones.name,
                locationType: warehouseLocations.locationType,
              })
              .from(warehouseLocations)
              .leftJoin(
                warehouseZones,
                eq(warehouseLocations.zoneId, warehouseZones.id)
              )
              .where(eq(warehouseLocations.zoneId, recZone[0].id))
              .limit(10);
          }
        }

        // TODO: Gerar PDF com etiquetas usando biblioteca de PDF
        // Por enquanto, retornar dados das etiquetas
        return {
          pdfBase64: "", // Implementar geração de PDF
          labelCount: labels.length,
          labels,
        };
      }),
  }),

  picking: router({
    list: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(pickingOrders).orderBy(desc(pickingOrders.createdAt)).limit(50);
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
     * Importação de NF-e de entrada (recebimento)
     * Cria produtos automaticamente se não existirem
     */
    importReceiving: protectedProcedure
      .input(z.object({
        tenantId: z.number(),
        xmlContent: z.string(),
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

        // Gerar número da ordem de recebimento
        const today = new Date();
        const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
        const orderNumber = `REC-${dateStr}-${Math.floor(Math.random() * 10000).toString().padStart(4, "0")}`;

        // Criar ordem de recebimento
        await db.insert(receivingOrders).values({
          tenantId: input.tenantId,
          orderNumber,
          supplierName: nfeData.fornecedor.razaoSocial,
          supplierCnpj: nfeData.fornecedor.cnpj,
          nfeKey: nfeData.chaveAcesso,
          nfeNumber: nfeData.numero,
          scheduledDate: new Date(nfeData.dataEmissao),
          status: "scheduled" as const,
          createdBy: ctx.user.id,
        });

        // Buscar ordem criada
        const [receivingOrder] = await db
          .select()
          .from(receivingOrders)
          .where(eq(receivingOrders.orderNumber, orderNumber))
          .limit(1);

        // Resultados da importação
        const result = {
          receivingOrderId: receivingOrder.id,
          orderNumber: receivingOrder.orderNumber,
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

            if (produtoExistente.length > 0) {
              // Produto já existe
              result.produtosExistentes.push(
                `${produtoNFE.codigo} - ${produtoNFE.descricao}`
              );

              // Criar item da ordem de recebimento
              await db.insert(receivingOrderItems).values({
                receivingOrderId: receivingOrder.id,
                productId: produtoExistente[0].id,
                expectedQuantity: produtoNFE.quantidade,
                expectedGtin: produtoNFE.ean || produtoNFE.eanTributavel || null,
                expectedSupplierCode: produtoNFE.codigo,
              });
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
              const [produtoCriado] = await db
                .select()
                .from(products)
                .where(eq(products.sku, novoProduto.sku))
                .limit(1);
              result.produtosNovos.push(
                `${produtoNFE.codigo} - ${produtoNFE.descricao}`
              );

              // Criar item da ordem de recebimento
              await db.insert(receivingOrderItems).values({
                receivingOrderId: receivingOrder.id,
                productId: produtoCriado.id,
                expectedQuantity: produtoNFE.quantidade,
                expectedGtin: produtoNFE.ean || produtoNFE.eanTributavel || null,
                expectedSupplierCode: produtoNFE.codigo,
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
});

export type AppRouter = typeof appRouter;
