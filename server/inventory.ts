import { eq, and, like, isNull, sql, gte, lte, gt } from "drizzle-orm";
import { alias } from "drizzle-orm/mysql-core";
import { getDb } from "./db";
import {
  inventory,
  products,
  warehouseLocations,
  warehouseZones,
  tenants,
} from "../drizzle/schema";

export interface InventoryFilters {
  tenantId?: number | null;
  productId?: number;
  locationId?: number;
  zoneId?: number;
  batch?: string;
  status?: "available" | "quarantine" | "blocked" | "damaged" | "expired";
  minQuantity?: number;
  search?: string;
  locationCode?: string;
}

export interface InventoryPosition {
  id: number;
  productId: number;
  productSku: string;
  productDescription: string;
  locationId: number;
  locationCode: string;
  locationStatus: string;
  zoneName: string;
  batch: string | null;
  expiryDate: Date | null;
  quantity: number;
  status: string;
  tenantId: number | null;
  tenantName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Consulta posições de estoque com filtros avançados
 */
export async function getInventoryPositions(
  filters: InventoryFilters
): Promise<InventoryPosition[]> {
  const dbConn = await getDb();
  if (!dbConn) throw new Error("Database connection failed");

  const conditions = [];

  // Filtro por tenant
  if (filters.tenantId !== undefined) {
    if (filters.tenantId === null) {
      conditions.push(isNull(warehouseLocations.tenantId));
    } else {
      conditions.push(eq(warehouseLocations.tenantId, filters.tenantId));
    }
  }

  // Filtros adicionais
  if (filters.productId) {
    conditions.push(eq(inventory.productId, filters.productId));
  }
  if (filters.locationId) {
    conditions.push(eq(inventory.locationId, filters.locationId));
  }
  if (filters.zoneId) {
    conditions.push(eq(warehouseLocations.zoneId, filters.zoneId));
  }
  if (filters.batch) {
    conditions.push(like(inventory.batch, `%${filters.batch}%`));
  }
  if (filters.status) {
    conditions.push(eq(inventory.status, filters.status));
  }
  if (filters.minQuantity !== undefined) {
    conditions.push(gte(inventory.quantity, filters.minQuantity));
  }
  if (filters.locationCode) {
    conditions.push(like(warehouseLocations.code, `%${filters.locationCode}%`));
  }

  // Busca geral (SKU ou descrição)
  if (filters.search) {
    conditions.push(
      sql`(${products.sku} LIKE ${`%${filters.search}%`} OR ${products.description} LIKE ${`%${filters.search}%`})`
    );
  }

  const locationTenant = alias(tenants, "locationTenant");

  const results = await dbConn
    .select({
      id: inventory.id,
      productId: inventory.productId,
      productSku: products.sku,
      productDescription: products.description,
      locationId: inventory.locationId,
      locationCode: warehouseLocations.code,
      locationStatus: warehouseLocations.status,
      zoneName: warehouseZones.name,
      batch: inventory.batch,
      expiryDate: inventory.expiryDate,
      quantity: inventory.quantity,
      status: inventory.status,
      tenantId: warehouseLocations.tenantId,
      tenantName: locationTenant.name,
      createdAt: inventory.createdAt,
      updatedAt: inventory.updatedAt,
    })
    .from(inventory)
    .innerJoin(products, eq(inventory.productId, products.id))
    .innerJoin(warehouseLocations, eq(inventory.locationId, warehouseLocations.id))
    .innerJoin(warehouseZones, eq(warehouseLocations.zoneId, warehouseZones.id))
    .leftJoin(locationTenant, eq(warehouseLocations.tenantId, locationTenant.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(warehouseLocations.code, products.sku)
    .limit(1000);

  return results;
}

/**
 * Obtém resumo de estoque (cards de métricas)
 */
export async function getInventorySummary(filters: InventoryFilters) {
  const positions = await getInventoryPositions(filters);

  const totalQuantity = positions.reduce((sum, p) => sum + p.quantity, 0);
  const uniqueLocations = new Set(positions.map((p) => p.locationId)).size;
  const uniqueBatches = new Set(positions.map((p) => p.batch).filter(Boolean)).size;

  return {
    totalPositions: positions.length,
    totalQuantity,
    uniqueLocations,
    uniqueBatches,
  };
}

/**
 * Obtém saldo disponível em um endereço específico
 */
export async function getLocationStock(
  locationId: number,
  productId?: number,
  batch?: string
): Promise<number> {
  const dbConn = await getDb();
  if (!dbConn) throw new Error("Database connection failed");

  const conditions = [eq(inventory.locationId, locationId)];
  if (productId) conditions.push(eq(inventory.productId, productId));
  if (batch) conditions.push(eq(inventory.batch, batch));

  const result = await dbConn
    .select({ total: sql<number>`SUM(${inventory.quantity})` })
    .from(inventory)
    .where(and(...conditions));

  return result[0]?.total ?? 0;
}

/**
 * Obtém produtos com estoque abaixo do mínimo
 */
export async function getLowStockProducts(
  minQuantity: number = 10
): Promise<InventoryPosition[]> {
  return getInventoryPositions({ minQuantity });
}

/**
 * Obtém produtos próximos do vencimento
 */
export async function getExpiringProducts(
  daysThreshold: number = 30
): Promise<InventoryPosition[]> {
  const dbConn = await getDb();
  if (!dbConn) throw new Error("Database connection failed");

  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysThreshold);

  const locationTenant = alias(tenants, "locationTenant");

  const results = await dbConn
    .select({
      id: inventory.id,
      productId: inventory.productId,
      productSku: products.sku,
      productDescription: products.description,
      locationId: inventory.locationId,
      locationCode: warehouseLocations.code,
      locationStatus: warehouseLocations.status,
      zoneName: warehouseZones.name,
      batch: inventory.batch,
      expiryDate: inventory.expiryDate,
      quantity: inventory.quantity,
      status: inventory.status,
      tenantId: warehouseLocations.tenantId,
      tenantName: locationTenant.name,
      createdAt: inventory.createdAt,
      updatedAt: inventory.updatedAt,
    })
    .from(inventory)
    .innerJoin(products, eq(inventory.productId, products.id))
    .innerJoin(warehouseLocations, eq(inventory.locationId, warehouseLocations.id))
    .innerJoin(warehouseZones, eq(warehouseLocations.zoneId, warehouseZones.id))
    .leftJoin(locationTenant, eq(warehouseLocations.tenantId, locationTenant.id))
    .where(
      and(
        lte(inventory.expiryDate, futureDate),
        gt(inventory.expiryDate, new Date())
      )
    )
    .orderBy(inventory.expiryDate)
    .limit(1000);

  return results;
}
