import { getDb } from "./db";
import { pickingOrders, pickingOrderItems, pickingWaves, pickingWaveItems, products, inventory, warehouseLocations, tenants } from "../drizzle/schema";
import { eq, and, or, isNull, inArray, sql, desc, asc } from "drizzle-orm";

/**
 * Lógica de geração e gerenciamento de ondas de separação (Wave Picking)
 */

interface CreateWaveParams {
  orderIds: number[]; // IDs dos pedidos a agrupar
  userId: number; // Usuário que está criando a onda
}

interface ConsolidatedItem {
  productId: number;
  productSku: string;
  productName: string;
  totalQuantity: number;
  orders: Array<{ orderId: number; quantity: number }>; // Rastreabilidade
}

/**
 * Gera número único de onda (OS)
 * Formato: OS-YYYYMMDD-XXXX
 */
async function generateWaveNumber(): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, ""); // YYYYMMDD

  // Buscar último número do dia
  const lastWave = await db
    .select({ waveNumber: pickingWaves.waveNumber })
    .from(pickingWaves)
    .where(sql`${pickingWaves.waveNumber} LIKE ${"OS-" + dateStr + "-%"}`)
    .orderBy(desc(pickingWaves.waveNumber))
    .limit(1);

  let sequence = 1;
  if (lastWave.length > 0) {
    const lastNumber = lastWave[0].waveNumber;
    const lastSeq = parseInt(lastNumber.split("-")[2]);
    sequence = lastSeq + 1;
  }

  return `OS-${dateStr}-${sequence.toString().padStart(4, "0")}`;
}

/**
 * Consolida itens de múltiplos pedidos
 * Soma quantidades de produtos iguais
 */
async function consolidateItems(orderIds: number[]): Promise<ConsolidatedItem[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Buscar todos os itens dos pedidos
  const items = await db
    .select({
      orderId: pickingOrderItems.pickingOrderId,
      productId: pickingOrderItems.productId,
      productSku: products.sku,
      productName: products.description,
      quantity: pickingOrderItems.requestedQuantity,
    })
    .from(pickingOrderItems)
    .leftJoin(products, eq(pickingOrderItems.productId, products.id))
    .where(inArray(pickingOrderItems.pickingOrderId, orderIds));

  // Consolidar por produto
  const consolidated = new Map<number, ConsolidatedItem>();

  for (const item of items) {
    const existing = consolidated.get(item.productId);
    if (existing) {
      existing.totalQuantity += item.quantity;
      existing.orders.push({ orderId: item.orderId, quantity: item.quantity });
    } else {
      consolidated.set(item.productId, {
        productId: item.productId,
        productSku: item.productSku!,
        productName: item.productName!,
        totalQuantity: item.quantity,
        orders: [{ orderId: item.orderId, quantity: item.quantity }],
      });
    }
  }

  return Array.from(consolidated.values());
}

/**
 * Aloca endereços para produtos consolidados baseado na regra FIFO/FEFO
 */
async function allocateLocations(
  tenantId: number,
  consolidatedItems: ConsolidatedItem[],
  pickingRule: "FIFO" | "FEFO" | "Direcionado"
): Promise<Array<ConsolidatedItem & { locationId: number; locationCode: string; batch?: string; expiryDate?: Date }>> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const allocated: Array<ConsolidatedItem & { locationId: number; locationCode: string; batch?: string; expiryDate?: Date }> = [];

  for (const item of consolidatedItems) {
    // Buscar estoque disponível do produto ordenado por FIFO ou FEFO
    const orderBy = pickingRule === "FEFO" ? asc(inventory.expiryDate) : asc(inventory.createdAt);
    
    // Buscar estoque disponível para este produto
    console.log(`[allocateLocations] Buscando estoque para produto ${item.productId} (${item.productName}), tenantId: ${tenantId}, quantidade necessária: ${item.totalQuantity}`);
    
    const availableStock = await db
      .select({
        locationId: inventory.locationId,
        locationCode: warehouseLocations.code,
        quantity: inventory.quantity,
        batch: inventory.batch,
        expiryDate: inventory.expiryDate,
      })
      .from(inventory)
      .leftJoin(warehouseLocations, eq(inventory.locationId, warehouseLocations.id))
      .where(
        and(
          eq(inventory.tenantId, tenantId),
          eq(inventory.productId, item.productId),
          sql`${inventory.quantity} > 0`
        )
      )
      .orderBy(orderBy); // Buscar todos os endereços disponíveis
    
    console.log(`[allocateLocations] Encontrados ${availableStock.length} endereços com estoque:`, JSON.stringify(availableStock, null, 2));
    
    if (availableStock.length === 0) {
      throw new Error(`Estoque insuficiente para produto ${item.productId} (${item.productName})`);
    }

    // Calcular estoque total disponível
    const totalAvailable = availableStock.reduce((sum, loc) => sum + loc.quantity, 0);

    // Verificar se quantidade total disponível é suficiente
    if (totalAvailable < item.totalQuantity) {
      throw new Error(
        `Estoque insuficiente para produto ${item.productId} (${item.productName}). ` +
        `Disponível: ${totalAvailable}, Necessário: ${item.totalQuantity}`
      );
    }

    // Alocar de múltiplos endereços se necessário (FIFO/FEFO)
    let remainingQuantity = item.totalQuantity;
    for (const location of availableStock) {
      if (remainingQuantity <= 0) break;

      const quantityFromThisLocation = Math.min(location.quantity, remainingQuantity);
      
      allocated.push({
        ...item,
        totalQuantity: quantityFromThisLocation,
        locationId: location.locationId,
        locationCode: location.locationCode!,
        batch: location.batch || undefined,
        expiryDate: location.expiryDate || undefined,
      });

      remainingQuantity -= quantityFromThisLocation;
    }
  }

  return allocated;
}

/**
 * Cria onda de separação consolidando múltiplos pedidos
 */
export async function createWave(params: CreateWaveParams) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 1. Validar que todos os pedidos existem e são do mesmo cliente
  const orders = await db
    .select({
      id: pickingOrders.id,
      tenantId: pickingOrders.tenantId,
      status: pickingOrders.status,
    })
    .from(pickingOrders)
    .where(inArray(pickingOrders.id, params.orderIds));

  if (orders.length !== params.orderIds.length) {
    throw new Error("Um ou mais pedidos não foram encontrados");
  }

  const tenantIds = new Set(orders.map((o) => o.tenantId));
  if (tenantIds.size > 1) {
    throw new Error("Todos os pedidos devem ser do mesmo cliente");
  }

  const tenantId = orders[0].tenantId;

  // Verificar se algum pedido já está em onda
  const inWave = orders.filter((o) => o.status === "in_wave");
  if (inWave.length > 0) {
    throw new Error("Um ou mais pedidos já estão em uma onda");
  }

  // 2. Buscar regra de picking do cliente
  const [tenant] = await db
    .select({ pickingRule: tenants.pickingRule })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!tenant) {
    throw new Error("Cliente não encontrado");
  }

  const pickingRule = tenant.pickingRule as "FIFO" | "FEFO" | "Direcionado";

  // 3. Consolidar itens dos pedidos
  const consolidatedItems = await consolidateItems(params.orderIds);

  // 4. Alocar endereços baseado na regra FIFO/FEFO
  const allocatedItems = await allocateLocations(tenantId, consolidatedItems, pickingRule);

  // 5. Gerar número da onda
  const waveNumber = await generateWaveNumber();

  // 6. Criar registro da onda
  const [wave] = await db.insert(pickingWaves).values({
    tenantId,
    waveNumber,
    status: "pending",
    totalOrders: orders.length,
    totalItems: allocatedItems.length,
    totalQuantity: allocatedItems.reduce((sum, item) => sum + item.totalQuantity, 0),
    pickingRule,
    createdBy: params.userId,
  });

  const waveId = wave.insertId;

  // 7. Criar itens consolidados da onda
  const waveItemsData = allocatedItems.map((item) => ({
    waveId,
    productId: item.productId,
    productSku: item.productSku,
    productName: item.productName,
    totalQuantity: item.totalQuantity,
    pickedQuantity: 0,
    locationId: item.locationId,
    locationCode: item.locationCode,
    batch: item.batch,
    expiryDate: item.expiryDate,
    status: "pending" as const,
  }));

  await db.insert(pickingWaveItems).values(waveItemsData);

  // 8. Atualizar status dos pedidos para "in_wave" e associar à onda
  await db
    .update(pickingOrders)
    .set({
      status: "in_wave",
      waveId,
    })
    .where(inArray(pickingOrders.id, params.orderIds));

  return {
    waveId,
    waveNumber,
    totalOrders: orders.length,
    totalItems: allocatedItems.length,
    totalQuantity: allocatedItems.reduce((sum, item) => sum + item.totalQuantity, 0),
    items: allocatedItems,
  };
}

/**
 * Busca detalhes de uma onda
 */
export async function getWaveById(waveId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [wave] = await db
    .select()
    .from(pickingWaves)
    .where(eq(pickingWaves.id, waveId))
    .limit(1);

  if (!wave) {
    throw new Error("Onda não encontrada");
  }

  const items = await db
    .select()
    .from(pickingWaveItems)
    .where(eq(pickingWaveItems.waveId, waveId));

  const orders = await db
    .select()
    .from(pickingOrders)
    .where(eq(pickingOrders.waveId, waveId));

  return {
    ...wave,
    items,
    orders,
  };
}
