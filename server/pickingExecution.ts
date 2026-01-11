import { getDb } from "./db";
import { 
  pickingWaves, 
  pickingWaveItems, 
  pickingExecutionItems,
  labelAssociations,
  inventory,
  warehouseLocations,
  products
} from "../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

/**
 * Buscar ondas disponíveis para separação
 * Retorna ondas com status "pending" ou "picking"
 */
export async function getAvailableWaves(tenantId: number | null) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

  // Se tenantId for null (admin), retorna todas as ondas
  const waves = await db
    .select()
    .from(pickingWaves)
    .where(
      tenantId
        ? and(
            eq(pickingWaves.tenantId, tenantId),
            sql`${pickingWaves.status} IN ('pending', 'picking')`
          )
        : sql`${pickingWaves.status} IN ('pending', 'picking')`
    )
    .orderBy(pickingWaves.createdAt);

  return waves;
}

/**
 * Iniciar separação de uma onda
 * Atualiza status para "picking" e registra operador
 */
export async function startWavePicking(waveId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

  // Verificar se onda existe e está disponível
  const [wave] = await db
    .select()
    .from(pickingWaves)
    .where(eq(pickingWaves.id, waveId))
    .limit(1);

  if (!wave) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Onda não encontrada" });
  }

  if (wave.status !== "pending" && wave.status !== "picking") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Onda não está disponível para separação" });
  }

  // Atualizar status
  await db
    .update(pickingWaves)
    .set({
      status: "picking",
      assignedTo: userId,
      updatedAt: new Date(),
    })
    .where(eq(pickingWaves.id, waveId));

  return { success: true };
}

/**
 * Buscar próximo endereço para separação
 * Retorna endereço com itens pendentes
 */
export async function getNextLocation(waveId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

  // Buscar primeiro item pendente
  const [nextItem] = await db
    .select()
    .from(pickingWaveItems)
    .where(
      and(
        eq(pickingWaveItems.waveId, waveId),
        sql`${pickingWaveItems.status} IN ('pending', 'picking')`
      )
    )
    .orderBy(pickingWaveItems.locationCode)
    .limit(1);

  if (!nextItem) {
    return null; // Todos os itens foram separados
  }

  // Buscar detalhes do endereço
  const [location] = await db
    .select()
    .from(warehouseLocations)
    .where(eq(warehouseLocations.id, nextItem.locationId))
    .limit(1);

  return {
    ...nextItem,
    location,
  };
}

/**
 * Buscar itens de um endereço específico
 */
export async function getLocationItems(waveId: number, locationCode: string) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

  const items = await db
    .select()
    .from(pickingWaveItems)
    .where(
      and(
        eq(pickingWaveItems.waveId, waveId),
        eq(pickingWaveItems.locationCode, locationCode),
        sql`${pickingWaveItems.status} IN ('pending', 'picking')`
      )
    );

  return items;
}

/**
 * Registrar item separado (conferência cega)
 * Similar ao processo de recebimento
 */
export async function registerPickedItem(params: {
  waveId: number;
  waveItemId: number;
  locationCode: string;
  labelCode: string;
  quantity: number;
  userId: number;
}) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

  // 1. Buscar informações da etiqueta
  const [label] = await db
    .select({
      id: labelAssociations.id,
      labelCode: labelAssociations.labelCode,
      productId: labelAssociations.productId,
      batch: labelAssociations.batch,
      expiryDate: labelAssociations.expiryDate,
      productSku: products.sku,
      productName: products.description,
    })
    .from(labelAssociations)
    .innerJoin(products, eq(labelAssociations.productId, products.id))
    .where(eq(labelAssociations.labelCode, params.labelCode))
    .limit(1);

  if (!label) {
    throw new TRPCError({ 
      code: "NOT_FOUND", 
      message: `Etiqueta "${params.labelCode}" não encontrada. Verifique se o código está correto ou se a etiqueta foi criada no recebimento.` 
    });
  }

  // 2. Buscar item da onda com informações do produto
  const [waveItem] = await db
    .select({
      id: pickingWaveItems.id,
      waveId: pickingWaveItems.waveId,
      productId: pickingWaveItems.productId,
      batch: pickingWaveItems.batch,
      locationId: pickingWaveItems.locationId,
      totalQuantity: pickingWaveItems.totalQuantity,
      pickedQuantity: pickingWaveItems.pickedQuantity,
      status: pickingWaveItems.status,
      productSku: products.sku,
      productName: products.description,
    })
    .from(pickingWaveItems)
    .innerJoin(products, eq(pickingWaveItems.productId, products.id))
    .where(eq(pickingWaveItems.id, params.waveItemId))
    .limit(1);

  if (!waveItem) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Item da onda não encontrado" });
  }

  // 3. Verificar se produto corresponde (compara SKU, não productId)
  // Nota: Comparamos SKU porque podem existir produtos duplicados no banco com mesmo SKU mas IDs diferentes
  if (label.productSku !== waveItem.productSku) {
    throw new TRPCError({ 
      code: "BAD_REQUEST", 
      message: `Produto incorreto! Esperado SKU: ${waveItem.productSku}, mas a etiqueta "${params.labelCode}" pertence ao SKU: ${label.productSku}` 
    });
  }

  // 4. Buscar endereço
  const [location] = await db
    .select()
    .from(warehouseLocations)
    .where(eq(warehouseLocations.code, params.locationCode))
    .limit(1);

  if (!location) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Endereço não encontrado" });
  }

  // 5. Registrar item separado
  await db.insert(pickingExecutionItems).values({
    waveId: params.waveId,
    waveItemId: params.waveItemId,
    locationId: location.id,
    locationCode: params.locationCode,
    labelCode: params.labelCode,
    productId: label.productId,
    productSku: label.productSku,
    productName: label.productName,
    batch: label.batch || "",
    expiryDate: label.expiryDate,
    quantity: params.quantity,
    pickedBy: params.userId,
  });

  // 6. Atualizar quantidade separada no item da onda
  await db
    .update(pickingWaveItems)
    .set({
      pickedQuantity: sql`${pickingWaveItems.pickedQuantity} + ${params.quantity}`,
      status: sql`CASE 
        WHEN ${pickingWaveItems.pickedQuantity} + ${params.quantity} >= ${pickingWaveItems.totalQuantity} 
        THEN 'picked' 
        ELSE 'picking' 
      END`,
      pickedAt: sql`CASE 
        WHEN ${pickingWaveItems.pickedQuantity} + ${params.quantity} >= ${pickingWaveItems.totalQuantity} 
        THEN NOW() 
        ELSE ${pickingWaveItems.pickedAt} 
      END`,
    })
    .where(eq(pickingWaveItems.id, params.waveItemId));

  // 7. Verificar se todos os itens da onda foram separados
  const [waveStatus] = await db
    .select({
      totalItems: sql<number>`COUNT(*)`,
      pickedItems: sql<number>`SUM(CASE WHEN ${pickingWaveItems.status} = 'picked' THEN 1 ELSE 0 END)`,
    })
    .from(pickingWaveItems)
    .where(eq(pickingWaveItems.waveId, params.waveId));

  // 8. Se todos os itens foram separados, atualizar status da onda
  if (waveStatus.totalItems === waveStatus.pickedItems) {
    await db
      .update(pickingWaves)
      .set({
        status: "picked",
        pickedBy: params.userId,
        pickedAt: new Date(),
      })
      .where(eq(pickingWaves.id, params.waveId));
  }

  return { 
    success: true,
    itemCompleted: waveItem.pickedQuantity + params.quantity >= waveItem.totalQuantity,
    waveCompleted: waveStatus.totalItems === waveStatus.pickedItems,
  };
}

/**
 * Buscar progresso da separação
 */
export async function getPickingProgress(waveId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

  const [progress] = await db
    .select({
      totalItems: sql<number>`COUNT(*)`,
      pickedItems: sql<number>`SUM(CASE WHEN ${pickingWaveItems.status} = 'picked' THEN 1 ELSE 0 END)`,
      totalQuantity: sql<number>`SUM(${pickingWaveItems.totalQuantity})`,
      pickedQuantity: sql<number>`SUM(${pickingWaveItems.pickedQuantity})`,
    })
    .from(pickingWaveItems)
    .where(eq(pickingWaveItems.waveId, waveId));

  return progress;
}

/**
 * Listar etiquetas disponíveis para um produto/lote
 * Etiquetas são associadas ao produto+lote, não ao endereço
 * Ajuda o operador a saber quais etiquetas bipar
 */
export async function getAvailableLabels(params: {
  productId: number;
  batch?: string;
}) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

  // Buscar etiquetas do produto/lote
  const labels = await db
    .select({
      labelCode: labelAssociations.labelCode,
      batch: labelAssociations.batch,
      expiryDate: labelAssociations.expiryDate,
      totalUnits: labelAssociations.totalUnits,
      productSku: products.sku,
      productName: products.description,
    })
    .from(labelAssociations)
    .innerJoin(products, eq(labelAssociations.productId, products.id))
    .where(
      and(
        eq(labelAssociations.productId, params.productId),
        params.batch ? eq(labelAssociations.batch, params.batch) : sql`1=1`
      )
    );

  return labels;
}
