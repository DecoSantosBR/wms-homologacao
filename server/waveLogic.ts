import { getDb } from "./db";
import { pickingOrders, pickingOrderItems, pickingWaves, pickingWaveItems, products, inventory, warehouseLocations, tenants, pickingReservations } from "../drizzle/schema";
import { eq, and, inArray, sql, desc, asc } from "drizzle-orm";

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
 * Suporta múltiplos lotes: se um lote não tem saldo suficiente, busca próximo lote automaticamente
 */
async function allocateLocations(
  tenantId: number,
  consolidatedItems: ConsolidatedItem[],
  pickingRule: "FIFO" | "FEFO" | "Direcionado"
): Promise<Array<ConsolidatedItem & { inventoryId: number; locationId: number; locationCode: string; batch?: string; expiryDate?: Date; allocatedQuantity: number }>> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const allocated: Array<ConsolidatedItem & { inventoryId: number; locationId: number; locationCode: string; batch?: string; expiryDate?: Date; allocatedQuantity: number }> = [];

  for (const item of consolidatedItems) {
    // Buscar TODOS os lotes disponíveis do produto ordenado por FIFO ou FEFO
    const orderBy = pickingRule === "FEFO" ? asc(inventory.expiryDate) : asc(inventory.createdAt);

    const availableStock = await db
      .select({
        inventoryId: inventory.id,
        locationId: inventory.locationId,
        locationCode: warehouseLocations.code,
        batch: inventory.batch,
        expiryDate: inventory.expiryDate,
        quantity: inventory.quantity,
        reservedQuantity: inventory.reservedQuantity,
        availableQuantity: sql<number>`${inventory.quantity} - ${inventory.reservedQuantity}`.as('availableQuantity'),
      })
      .from(inventory)
      .leftJoin(warehouseLocations, eq(inventory.locationId, warehouseLocations.id))
      .where(
        and(
          eq(inventory.tenantId, tenantId),
          eq(inventory.productId, item.productId),
          eq(inventory.status, "available"),
          sql`${inventory.quantity} - ${inventory.reservedQuantity} > 0` // Considerar apenas quantidade disponível
        )
      )
      .orderBy(orderBy); // Buscar TODOS os lotes, não apenas o primeiro

    if (availableStock.length === 0) {
      throw new Error(`Estoque insuficiente para produto ${item.productSku} (${item.productName})`);
    }

    // Calcular total disponível em todos os lotes (quantidade - reservado)
    const totalAvailable = availableStock.reduce((sum, loc) => sum + loc.availableQuantity, 0);

    if (totalAvailable < item.totalQuantity) {
      throw new Error(
        `Estoque insuficiente para produto ${item.productSku} (${item.productName}). ` +
        `Disponível: ${totalAvailable}, Necessário: ${item.totalQuantity}`
      );
    }

    // Alocar lotes em ordem FIFO/FEFO até completar a quantidade necessária
    let remainingQuantity = item.totalQuantity;

    for (const location of availableStock) {
      if (remainingQuantity <= 0) break;

      const quantityToAllocate = Math.min(location.availableQuantity, remainingQuantity);

      allocated.push({
        ...item,
        inventoryId: location.inventoryId, // ID do registro de inventory para atualizar reservedQuantity
        locationId: location.locationId,
        locationCode: location.locationCode!,
        batch: location.batch || undefined,
        expiryDate: location.expiryDate || undefined,
        allocatedQuantity: quantityToAllocate, // Quantidade alocada DESTE lote
      });

      remainingQuantity -= quantityToAllocate;
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

  // 3. Buscar reservas dos pedidos (já alocadas durante criação do pedido)
  const reservations = await db
    .select({
      productId: pickingReservations.productId,
      inventoryId: pickingReservations.inventoryId,
      quantity: pickingReservations.quantity,
      productSku: products.sku,
      productName: products.description,
      locationId: inventory.locationId,
      locationCode: warehouseLocations.code,
      batch: inventory.batch,
      expiryDate: inventory.expiryDate,
    })
    .from(pickingReservations)
    .leftJoin(products, eq(pickingReservations.productId, products.id))
    .leftJoin(inventory, eq(pickingReservations.inventoryId, inventory.id))
    .leftJoin(warehouseLocations, eq(inventory.locationId, warehouseLocations.id))
    .where(inArray(pickingReservations.pickingOrderId, params.orderIds));

  if (reservations.length === 0) {
    throw new Error("Nenhuma reserva encontrada para os pedidos selecionados");
  }

  // 4. Transformar reservas em formato de allocatedItems
  const allocatedItems = reservations.map(r => ({
    productId: r.productId,
    productSku: r.productSku!,
    productName: r.productName!,
    totalQuantity: r.quantity, // Não usado, mas mantido para compatibilidade
    allocatedQuantity: r.quantity,
    orders: [], // Não usado na criação de waveItems
    inventoryId: r.inventoryId,
    locationId: r.locationId!,
    locationCode: r.locationCode!,
    batch: r.batch || undefined,
    expiryDate: r.expiryDate || undefined,
  }));

  // 5. Gerar número da onda
  const waveNumber = await generateWaveNumber();

  // 6. Criar registro da onda
  const [wave] = await db.insert(pickingWaves).values({
    tenantId,
    waveNumber,
    status: "pending",
    totalOrders: orders.length,
    totalItems: allocatedItems.length,
    totalQuantity: allocatedItems.reduce((sum, item) => sum + item.allocatedQuantity, 0),
    pickingRule,
    createdBy: params.userId,
  });

  const waveId = wave.insertId;

  // 7. Criar itens consolidados da onda (um registro por lote)
  const waveItemsData = allocatedItems.map((item) => ({
    waveId,
    productId: item.productId,
    productSku: item.productSku,
    productName: item.productName,
    totalQuantity: item.allocatedQuantity, // Usar quantidade alocada DESTE lote
    pickedQuantity: 0,
    locationId: item.locationId,
    locationCode: item.locationCode,
    batch: item.batch,
    expiryDate: item.expiryDate,
    status: "pending" as const,
  }));

  await db.insert(pickingWaveItems).values(waveItemsData);

  // Nota: A reserva de estoque já foi feita na criação dos pedidos,
  // então não precisamos incrementar reservedQuantity aqui novamente.

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
    totalQuantity: allocatedItems.reduce((sum, item) => sum + item.allocatedQuantity, 0),
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
