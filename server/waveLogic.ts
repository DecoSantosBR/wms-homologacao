import { getDb } from "./db";
import { pickingOrders, pickingOrderItems, pickingWaves, pickingWaveItems, products, inventory, warehouseLocations, warehouseZones, tenants, pickingAllocations } from "../drizzle/schema";
import { eq, and, inArray, sql, desc, asc } from "drizzle-orm";
import { getUniqueCode } from "./utils/uniqueCode";

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
  batch: string | null; // ✅ Lote específico (null quando produto não tem lote)
  expiryDate: Date | null; // ✅ Validade do lote (null quando não tem validade)
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
      batch: pickingOrderItems.batch, // ✅ Incluir lote
      expiryDate: pickingOrderItems.expiryDate, // ✅ Incluir validade
      uniqueCode: (pickingOrderItems as any).uniqueCode, // ✅ Incluir uniqueCode
    })
    .from(pickingOrderItems)
    .leftJoin(products, eq(pickingOrderItems.productId, products.id))
    .where(inArray(pickingOrderItems.pickingOrderId, orderIds));

  // ✅ CORREÇÃO: Consolidar por uniqueCode (SKU+Lote)
  const consolidated = new Map<string, ConsolidatedItem>();

  for (const item of items) {
    // Usar uniqueCode do banco (já calculado: SKU-LOTE)
    const key = (item as any).uniqueCode || `${item.productSku}-${item.batch || 'null'}`;
    const existing = consolidated.get(key);
    if (existing) {
      existing.totalQuantity += item.quantity;
      existing.orders.push({ orderId: item.orderId, quantity: item.quantity });
    } else {
      consolidated.set(key, {
        productId: item.productId,
        productSku: item.productSku!,
        productName: item.productName!,
        batch: item.batch, // ✅ Preservar lote
        expiryDate: item.expiryDate, // ✅ Preservar validade
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
): Promise<Array<ConsolidatedItem & { inventoryId: number; locationId: number; locationCode: string; allocatedQuantity: number }>> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const allocated: Array<ConsolidatedItem & { inventoryId: number; locationId: number; locationCode: string; allocatedQuantity: number }> = [];

  for (const item of consolidatedItems) {
    // Buscar TODOS os lotes disponíveis do produto ordenado por FIFO ou FEFO
    const orderBy = pickingRule === "FEFO" ? asc(inventory.expiryDate) : asc(inventory.createdAt);

    // ✅ CORREÇÃO: Filtrar também por lote específico do item
    const whereConditions = [
      eq(inventory.tenantId, tenantId),
      eq(inventory.productId, item.productId),
      eq(inventory.status, "available"),
      sql`${inventory.quantity} - ${inventory.reservedQuantity} > 0`,
    ];

    // Se o item tem lote definido, filtrar apenas por esse lote
    if (item.batch) {
      whereConditions.push(eq(inventory.batch, item.batch));
    }

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
      .where(and(...whereConditions))
      .orderBy(orderBy);

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

      // Garantir tipos corretos para batch e expiryDate (leftJoin retorna undefined, converter para null)
      const batchValue: string | null = location.batch !== undefined ? location.batch : (item.batch !== undefined ? item.batch : null);
      const expiryValue: Date | null = location.expiryDate !== undefined ? location.expiryDate : (item.expiryDate !== undefined ? item.expiryDate : null);

      allocated.push({
        productId: item.productId,
        productSku: item.productSku,
        productName: item.productName,
        batch: batchValue,
        expiryDate: expiryValue,
        totalQuantity: item.totalQuantity,
        orders: item.orders,
        inventoryId: location.inventoryId,
        locationId: location.locationId,
        locationCode: location.locationCode!,
        allocatedQuantity: quantityToAllocate,
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

  // 3. Buscar alocações dos pedidos (já criadas durante criação do pedido)
  const reservations = await db
    .select({
      pickingOrderId: pickingAllocations.pickingOrderId, // ID do pedido de origem
      productId: pickingAllocations.productId,
      inventoryId: sql<number>`NULL`.as('inventoryId'), // Não mais usado
      quantity: pickingAllocations.quantity,
      productSku: pickingAllocations.productSku,
      productName: products.description,
      locationId: pickingAllocations.locationId,
      locationCode: pickingAllocations.locationCode,
      batch: pickingAllocations.batch,
      expiryDate: pickingAllocations.expiryDate,
      unit: pickingOrderItems.unit, // Unidade do pedido original
      unitsPerBox: pickingOrderItems.unitsPerBox, // Unidades por caixa
    })
    .from(pickingAllocations)
    .leftJoin(products, eq(pickingAllocations.productId, products.id))
    .leftJoin(warehouseLocations, eq(pickingAllocations.locationId, warehouseLocations.id))
    .leftJoin(warehouseZones, eq(warehouseLocations.zoneId, warehouseZones.id))
    .leftJoin(pickingOrderItems, and(
      eq(pickingAllocations.pickingOrderId, pickingOrderItems.pickingOrderId),
      eq(pickingAllocations.productId, pickingOrderItems.productId),
      eq(pickingAllocations.batch, pickingOrderItems.batch) // ✅ Match por batch para evitar duplicação
    ))
    .where(
      and(
        inArray(pickingAllocations.pickingOrderId, params.orderIds),
        // Excluir zonas especiais (Expedição, Recebimento, Não Conformidades, Devoluções)
        sql`${warehouseZones.code} NOT IN ('EXP', 'REC', 'NCG', 'DEV')`
      )
    );

  if (reservations.length === 0) {
    throw new Error("Nenhuma reserva encontrada para os pedidos selecionados");
  }

  // 4. Transformar reservas em formato de allocatedItems E CONSOLIDAR por SKU+Lote
  // 🔄 CORREÇÃO: Consolidar por uniqueCode para evitar duplicação de pickingWaveItems
  const allocationsMap = new Map<string, {
    pickingOrderId: number;
    productId: number;
    productSku: string;
    productName: string;
    allocatedQuantity: number;
    locationId: number;
    locationCode: string;
    batch: string | undefined;
    expiryDate: Date | undefined;
    unit: string;
    unitsPerBox: number | undefined;
  }>();

  for (const r of reservations) {
    const uniqueCode = getUniqueCode(r.productSku!, r.batch);
    const existing = allocationsMap.get(uniqueCode);
    
    if (existing) {
      // Consolidar quantidade (somar múltiplos endereços do mesmo lote)
      existing.allocatedQuantity += r.quantity;
    } else {
      // Primeiro endereço deste lote
      allocationsMap.set(uniqueCode, {
        pickingOrderId: r.pickingOrderId,
        productId: r.productId,
        productSku: r.productSku!,
        productName: r.productName!,
        allocatedQuantity: r.quantity,
        locationId: r.locationId!, // Primeiro endereço (para referência)
        locationCode: r.locationCode!,
        batch: r.batch || undefined,
        expiryDate: r.expiryDate || undefined,
        unit: r.unit || "unit",
        unitsPerBox: r.unitsPerBox || undefined,
      });
    }
  }

  const allocatedItems = Array.from(allocationsMap.values());

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
    pickingOrderId: item.pickingOrderId, // Pedido de origem do item
    productId: item.productId,
    productSku: item.productSku,
    productName: item.productName,
    totalQuantity: item.allocatedQuantity, // Sempre em UNIDADES (vem das reservas)
    pickedQuantity: 0,
    unit: "unit" as const, // SEMPRE "unit" porque totalQuantity está em unidades
    unitsPerBox: item.unitsPerBox, // Mantido apenas para referência
    locationId: item.locationId,
    locationCode: item.locationCode,
    batch: item.batch,
    expiryDate: item.expiryDate,
    status: "pending" as const,
    uniqueCode: getUniqueCode(item.productSku, item.batch), // ✅ Adicionar uniqueCode
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
