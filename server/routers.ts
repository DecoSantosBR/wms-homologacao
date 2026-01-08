import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { tenants, products, warehouseLocations, receivingOrders, pickingOrders, inventory, contracts, systemUsers, receivingOrderItems, pickingOrderItems } from "../drizzle/schema";
import { eq, and, desc, inArray, sql, or } from "drizzle-orm";
import { z } from "zod";
import { parseNFE, isValidNFE } from "./nfeParser";
import { warehouseZones } from "../drizzle/schema";
import { blindConferenceRouter } from "./blindConferenceRouter";

export const appRouter = router({
  system: systemRouter,
  blindConference: blindConferenceRouter,
  
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
    list: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(receivingOrders).orderBy(desc(receivingOrders.createdAt)).limit(50);
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
              product: product[0] || null,
            };
          })
        );
        
        return itemsWithProducts;
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

        // Criar ordem de recebimento
        const orderNumber = `REC-${nfeData.numero}-${Date.now()}`;
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

        // Buscar ordem criada
        const [receivingOrder] = await db.select()
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

            // Criar item da ordem de recebimento
            await db.insert(receivingOrderItems).values({
              receivingOrderId: receivingOrder.id,
              productId: productId,
              expectedQuantity: produtoNFE.quantidade,
              receivedQuantity: 0,
              addressedQuantity: 0,
              batch: null,
              expiryDate: null,
              expectedGtin: produtoNFE.ean || produtoNFE.eanTributavel || null,
            });
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
