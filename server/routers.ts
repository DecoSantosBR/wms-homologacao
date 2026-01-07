import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { getDb } from "./db";
import { 
  tenants, contracts, products, warehouses, warehouseZones, warehouseLocations,
  receivingOrders, receivingOrderItems, pickingOrders, pickingOrderItems,
  inventory, inventoryMovements
} from "../drizzle/schema";
import { eq, and, sql, desc } from "drizzle-orm";

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // ============================================================================
  // TENANTS (CLIENTES)
  // ============================================================================
  
  tenants: router({
    list: protectedProcedure.query(async () => {
      return await db.getAllTenants();
    }),
    
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getTenantById(input.id);
      }),
    
    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        tradeName: z.string().optional(),
        cnpj: z.string().min(14),
        afe: z.string().optional(),
        ae: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        zipCode: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().email().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const result = await db.createTenant(input);
        const insertId = Number((result as any)[0]?.insertId || (result as any).insertId) || 0;
        
        await db.createAuditLog({
          userId: ctx.user.id,
          action: "create_tenant",
          entityType: "tenant",
          entityId: insertId,
          newValue: JSON.stringify(input),
          ipAddress: ctx.req.ip,
          userAgent: ctx.req.headers["user-agent"],
        });
        
        return { success: true, id: insertId };
      }),
  }),

  // ============================================================================
  // PRODUTOS
  // ============================================================================
  
  products: router({
    list: protectedProcedure
      .input(z.object({
        tenantId: z.number().optional(),
        search: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const dbConn = await getDb();
        if (!dbConn) throw new Error("Database not available");
        
        let query = dbConn.select().from(products);
        
        if (input.tenantId) {
          return await dbConn.select().from(products).where(eq(products.tenantId, input.tenantId));
        }
        
        return await query;
      }),
    
    create: protectedProcedure
      .input(z.object({
        tenantId: z.number(),
        sku: z.string().min(1),
        description: z.string().min(1),
        gtin: z.string().optional(),
        unitsPerBox: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const dbConn = await getDb();
        if (!dbConn) throw new Error("Database not available");
        
        const result = await dbConn.insert(products).values(input);
        return { success: true, id: Number((result as any).insertId) };
      }),
  }),

  // ============================================================================
  // ENDEREÇOS (WAREHOUSE LOCATIONS)
  // ============================================================================
  
  locations: router({
    list: protectedProcedure
      .input(z.object({
        zoneId: z.number().optional(),
        status: z.enum(["available", "occupied", "blocked", "counting"]).optional(),
      }))
      .query(async ({ input }) => {
        const dbConn = await getDb();
        if (!dbConn) throw new Error("Database not available");
        
        let query = dbConn.select().from(warehouseLocations);
        
        const conditions: any[] = [];
        if (input.zoneId) conditions.push(eq(warehouseLocations.zoneId, input.zoneId));
        if (input.status) conditions.push(eq(warehouseLocations.status, input.status));
        
        if (conditions.length > 0) {
          return await dbConn.select().from(warehouseLocations).where(and(...conditions));
        }
        
        return await query;
      }),
    
    create: protectedProcedure
      .input(z.object({
        zoneId: z.number(),
        code: z.string().min(1),
        aisle: z.string().optional(),
        rack: z.string().optional(),
        level: z.string().optional(),
        locationType: z.enum(["whole", "fraction"]).default("whole"),
        storageRule: z.enum(["single", "multi"]).default("single"),
      }))
      .mutation(async ({ input }) => {
        const dbConn = await getDb();
        if (!dbConn) throw new Error("Database not available");
        
        const result = await dbConn.insert(warehouseLocations).values(input);
        return { success: true, id: Number((result as any).insertId) };
      }),
  }),

  // ============================================================================
  // RECEBIMENTO (RECEIVING)
  // ============================================================================
  
  receiving: router({
    list: protectedProcedure
      .input(z.object({
        tenantId: z.number().optional(),
        status: z.enum(["pending", "in_progress", "in_quarantine", "completed", "cancelled"]).optional(),
      }))
      .query(async ({ input }) => {
        const dbConn = await getDb();
        if (!dbConn) throw new Error("Database not available");
        
        let query = dbConn.select().from(receivingOrders).orderBy(desc(receivingOrders.createdAt));
        
        const conditions: any[] = [];
        if (input.tenantId) conditions.push(eq(receivingOrders.tenantId, input.tenantId));
        if (input.status) conditions.push(eq(receivingOrders.status, input.status));
        
        if (conditions.length > 0) {
          return await dbConn.select().from(receivingOrders).where(and(...conditions)).orderBy(desc(receivingOrders.createdAt));
        }
        
        return await query;
      }),
    
    create: protectedProcedure
      .input(z.object({
        tenantId: z.number(),
        nfeNumber: z.string(),
        nfeKey: z.string(),
        supplierName: z.string(),
        supplierCnpj: z.string(),
        receivingLocationId: z.number(),
        items: z.array(z.object({
          productId: z.number(),
          expectedQuantity: z.number(),
          unitValue: z.number().optional(),
        })),
      }))
      .mutation(async ({ input, ctx }) => {
        const dbConn = await getDb();
        if (!dbConn) throw new Error("Database not available");
        
        const { items, ...orderData } = input;
        
        const orderResult = await dbConn.insert(receivingOrders).values({
          ...orderData,
          status: "pending",
          createdBy: ctx.user.id,
        });
        
        const orderId = Number((orderResult as any).insertId);
        
        for (const item of items) {
          await dbConn.insert(receivingOrderItems).values({
            receivingOrderId: orderId,
            productId: item.productId,
            expectedQuantity: item.expectedQuantity,
            unitValue: item.unitValue,
            status: "pending",
          });
        }
        
        return { success: true, id: orderId };
      }),
  }),

  // ============================================================================
  // PICKING (SEPARAÇÃO)
  // ============================================================================
  
  picking: router({
    list: protectedProcedure
      .input(z.object({
        tenantId: z.number().optional(),
        status: z.enum(["pending", "in_progress", "completed", "cancelled"]).optional(),
      }))
      .query(async ({ input }) => {
        const dbConn = await getDb();
        if (!dbConn) throw new Error("Database not available");
        
        let query = dbConn.select().from(pickingOrders).orderBy(desc(pickingOrders.createdAt));
        
        const conditions: any[] = [];
        if (input.tenantId) conditions.push(eq(pickingOrders.tenantId, input.tenantId));
        if (input.status) conditions.push(eq(pickingOrders.status, input.status));
        
        if (conditions.length > 0) {
          return await dbConn.select().from(pickingOrders).where(and(...conditions)).orderBy(desc(pickingOrders.createdAt));
        }
        
        return await query;
      }),
    
    create: protectedProcedure
      .input(z.object({
        tenantId: z.number(),
        orderNumber: z.string(),
        items: z.array(z.object({
          productId: z.number(),
          quantity: z.number(),
        })),
      }))
      .mutation(async ({ input, ctx }) => {
        const dbConn = await getDb();
        if (!dbConn) throw new Error("Database not available");
        
        const { items, ...orderData } = input;
        
        const orderResult = await dbConn.insert(pickingOrders).values({
          ...orderData,
          status: "pending",
          createdBy: ctx.user.id,
        });
        
        const orderId = Number((orderResult as any).insertId);
        
        for (const item of items) {
          await dbConn.insert(pickingOrderItems).values({
            pickingOrderId: orderId,
            productId: item.productId,
            quantity: item.quantity,
            status: "pending",
          });
        }
        
        return { success: true, id: orderId };
      }),
  }),

  // ============================================================================
  // ESTOQUE (INVENTORY)
  // ============================================================================
  
  inventory: router({
    list: protectedProcedure
      .input(z.object({
        tenantId: z.number().optional(),
        productId: z.number().optional(),
        locationId: z.number().optional(),
      }))
      .query(async ({ input }) => {
        const dbConn = await getDb();
        if (!dbConn) throw new Error("Database not available");
        
        let query = dbConn.select().from(inventory);
        
        const conditions: any[] = [];
        if (input.tenantId) conditions.push(eq(inventory.tenantId, input.tenantId));
        if (input.productId) conditions.push(eq(inventory.productId, input.productId));
        if (input.locationId) conditions.push(eq(inventory.locationId, input.locationId));
        
        if (conditions.length > 0) {
          return await dbConn.select().from(inventory).where(and(...conditions));
        }
        
        return await query;
      }),
  }),

  // ============================================================================
  // DASHBOARD / ESTATÍSTICAS
  // ============================================================================
  
  dashboard: router({
    stats: protectedProcedure.query(async () => {
      const dbConn = await getDb();
      if (!dbConn) throw new Error("Database not available");
      
      const [tenantsCount] = await dbConn.select({ count: sql<number>`count(*)` }).from(tenants);
      const [productsCount] = await dbConn.select({ count: sql<number>`count(*)` }).from(products);
      const [locationsCount] = await dbConn.select({ count: sql<number>`count(*)` }).from(warehouseLocations);
      
      const [receivingPending] = await dbConn
        .select({ count: sql<number>`count(*)` })
        .from(receivingOrders)
        .where(eq(receivingOrders.status, "pending"));
      
      const [pickingPending] = await dbConn
        .select({ count: sql<number>`count(*)` })
        .from(pickingOrders)
        .where(eq(pickingOrders.status, "pending"));
      
      return {
        tenants: Number(tenantsCount?.count) || 0,
        products: Number(productsCount?.count) || 0,
        locations: Number(locationsCount?.count) || 0,
        receivingPending: Number(receivingPending?.count) || 0,
        pickingPending: Number(pickingPending?.count) || 0,
      };
    }),
  }),
});

export type AppRouter = typeof appRouter;
