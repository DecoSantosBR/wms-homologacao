import { eq, and, or, desc, sql, like } from "drizzle-orm";
import { getDb } from "./db";
import {
  pickingOrders,
  pickingOrderItems,
  stageChecks,
  stageCheckItems,
  products,
  inventory,
  pickingReservations,
  labelAssociations,
  tenants,
  warehouseLocations,
  inventoryMovements,
} from "../drizzle/schema";
import { TRPCError } from "@trpc/server";

/**
 * Busca pedido por customerOrderNumber para iniciar conferência
 * Apenas pedidos com status 'completed' podem ser conferidos
 */
export async function getOrderForStage(customerOrderNumber: string, tenantId: number | null) {
  const dbConn = await getDb();
  if (!dbConn) throw new Error("Database connection failed");

  const conditions: any[] = [
    eq(pickingOrders.customerOrderNumber, customerOrderNumber),
    sql`${pickingOrders.status} = 'picked'`,
  ];

  if (tenantId !== null) {
    conditions.push(eq(pickingOrders.tenantId, tenantId));
  }

  const orders = await dbConn
    .select({
      order: pickingOrders,
      tenantName: tenants.name,
    })
    .from(pickingOrders)
    .leftJoin(tenants, eq(pickingOrders.tenantId, tenants.id))
    .where(and(...conditions))
    .limit(1);

  if (orders.length === 0) {
    // Verificar se pedido existe com outro status para dar feedback específico
    const existingOrderConditions: any[] = [
      eq(pickingOrders.customerOrderNumber, customerOrderNumber),
    ];
    
    if (tenantId !== null) {
      existingOrderConditions.push(eq(pickingOrders.tenantId, tenantId));
    }
    
    const [existingOrder] = await dbConn
      .select({ status: pickingOrders.status })
      .from(pickingOrders)
      .where(and(...existingOrderConditions))
      .limit(1);
      
    if (existingOrder) {
      const statusMessages: Record<string, string> = {
        pending: 'ainda não foi confirmado para separação. Aguardando confirmação no módulo de Separação',
        completed: 'está pronto para picking. Acesse o módulo de Separação para realizar o picking',
        picked: 'já foi separado e está aguardando conferência no Stage',
        staged: 'já foi conferido no Stage e está aguardando expedição. Acesse o módulo de Expedição',
        shipped: 'já foi expedido e não pode ser conferido novamente',
      };
      
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Pedido ${customerOrderNumber} ${statusMessages[existingOrder.status] || 'não está disponível para conferência'}`,
      });
    }
    
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `Pedido ${customerOrderNumber} não encontrado`,
    });
  }

  const { order, tenantName } = orders[0];

  // Buscar itens do pedido
  const items = await dbConn
    .select({
      id: pickingOrderItems.id,
      productId: pickingOrderItems.productId,
      productSku: products.sku,
      productDescription: products.description,
      quantity: pickingOrderItems.requestedQuantity,
      unit: pickingOrderItems.requestedUM,
    })
    .from(pickingOrderItems)
    .leftJoin(products, eq(pickingOrderItems.productId, products.id))
    .where(eq(pickingOrderItems.pickingOrderId, order.id));

  return {
    order,
    items,
    tenantName: tenantName || "N/A",
  };
}

/**
 * Inicia conferência de Stage para um pedido
 * Cria registro de stageCheck e retorna itens (sem quantidades esperadas para conferência cega)
 */
export async function startStageCheck(params: {
  pickingOrderId: number;
  customerOrderNumber: string;
  operatorId: number;
  tenantId: number | null;
}) {
  const dbConn = await getDb();
  if (!dbConn) throw new Error("Database connection failed");

  // Buscar pedido para obter tenantId
  const order = await dbConn
    .select()
    .from(pickingOrders)
    .where(eq(pickingOrders.id, params.pickingOrderId))
    .limit(1);

  if (order.length === 0) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Pedido não encontrado",
    });
  }

  const orderTenantId = order[0].tenantId;

  // Verificar se já existe conferência ativa para este pedido
  const existingChecks = await dbConn
    .select()
    .from(stageChecks)
    .where(
      and(
        eq(stageChecks.pickingOrderId, params.pickingOrderId),
        eq(stageChecks.status, "in_progress")
      )
    )
    .limit(1);

  if (existingChecks.length > 0) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "Já existe uma conferência em andamento para este pedido",
    });
  }

  // Criar registro de conferência usando tenantId do pedido
  const [stageCheck] = await dbConn.insert(stageChecks).values({
    tenantId: orderTenantId,
    pickingOrderId: params.pickingOrderId,
    customerOrderNumber: params.customerOrderNumber,
    operatorId: params.operatorId,
    status: "in_progress",
    hasDivergence: false,
  });

  // Buscar itens do pedido para criar registros de conferência
  // CORREÇÃO: Incluir batch e expiryDate para agrupar corretamente por SKU+lote
  const orderItems = await dbConn
    .select({
      productId: pickingOrderItems.productId,
      productSku: products.sku,
      productDescription: products.description,
      quantity: pickingOrderItems.requestedQuantity,
      unit: pickingOrderItems.requestedUM,
      unitsPerBox: products.unitsPerBox,
      batch: pickingOrderItems.batch, // ✅ Incluir lote
      expiryDate: pickingOrderItems.expiryDate, // ✅ Incluir validade
    })
    .from(pickingOrderItems)
    .leftJoin(products, eq(pickingOrderItems.productId, products.id))
    .where(eq(pickingOrderItems.pickingOrderId, params.pickingOrderId));

  // CORREÇÃO: Agrupar itens por produto+lote (SKU+batch) ao invés de apenas produto
  // Itens com mesmo SKU mas lotes diferentes devem ser conferidos separadamente

  
  const groupedItems = orderItems.reduce((acc, item) => {
    // Normalizar quantidade para unidades
    let quantityInUnits = item.quantity;
    if (item.unit === 'box' && item.unitsPerBox) {
      quantityInUnits = item.quantity * item.unitsPerBox;

    }
    
    // ✅ Buscar por productId + batch (ao invés de apenas productId)
    const existing = acc.find(i => 
      i.productId === item.productId && 
      i.batch === item.batch
    );
    
    if (existing) {
      existing.quantity += quantityInUnits;
    } else {
      acc.push({
        productId: item.productId!,
        productSku: item.productSku!,
        productDescription: item.productDescription!,
        batch: item.batch || null, // ✅ Incluir lote
        expiryDate: item.expiryDate || null, // ✅ Incluir validade
        quantity: quantityInUnits,
      });
    }
    return acc;
  }, [] as Array<{ 
    productId: number; 
    productSku: string; 
    productDescription: string; 
    batch: string | null; 
    expiryDate: Date | null; 
    quantity: number 
  }>);



  // Criar registros de itens esperados (para comparação posterior)
  for (const item of groupedItems) {
    await dbConn.insert(stageCheckItems).values({
      stageCheckId: Number(stageCheck.insertId),
      productId: item.productId,
      productSku: item.productSku,
      productName: item.productDescription,
      expectedQuantity: item.quantity,
      checkedQuantity: 0,
      divergence: 0,
    });
  }

  return {
    stageCheckId: stageCheck.insertId,
    customerOrderNumber: params.customerOrderNumber,
    message: "Conferência iniciada. Bipe os produtos e informe as quantidades.",
  };
}

/**
 * Registra item conferido (produto bipado + quantidade informada)
 * Atualiza quantidade conferida do item
 * Busca produto pela etiqueta de lote (labelCode) gerada no recebimento
 */
export async function recordStageItem(params: {
  stageCheckId: number;
  labelCode: string;
  quantity: number;
  tenantId: number | null;
}) {
  const dbConn = await getDb();
  if (!dbConn) throw new Error("Database connection failed");

  // Buscar produto pela etiqueta de lote (labelAssociations)
  const labelResult = await dbConn
    .select({
      productId: labelAssociations.productId,
      batch: labelAssociations.batch,
      expiryDate: labelAssociations.expiryDate,
    })
    .from(labelAssociations)
    .where(eq(labelAssociations.labelCode, params.labelCode))
    .limit(1);

  const label = labelResult[0];

  if (!label) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `Etiqueta ${params.labelCode} não encontrada. Verifique se o produto foi recebido corretamente.`,
    });
  }

  // Buscar dados do produto
  const productsResult = await dbConn
    .select()
    .from(products)
    .where(eq(products.id, label.productId))
    .limit(1);

  const product = productsResult[0];

  if (!product) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `Produto associado à etiqueta ${params.labelCode} não encontrado`,
    });
  }

  // Validar tenantId se necessário
  if (params.tenantId !== null && product.tenantId !== params.tenantId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Produto não pertence ao tenant atual`,
    });
  }

  // Buscar item da conferência
  const items = await dbConn
    .select()
    .from(stageCheckItems)
    .where(
      and(
        eq(stageCheckItems.stageCheckId, params.stageCheckId),
        eq(stageCheckItems.productId, product.id)
      )
    )
    .limit(1);

  const item = items[0];

  if (!item) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `Produto ${product.sku} (etiqueta: ${params.labelCode}) não faz parte deste pedido`,
    });
  }

  // Atualizar quantidade conferida
  const newCheckedQuantity = item.checkedQuantity + params.quantity;
  const newDivergence = newCheckedQuantity - item.expectedQuantity;

  await dbConn
    .update(stageCheckItems)
    .set({
      checkedQuantity: newCheckedQuantity,
      divergence: newDivergence,
    })
    .where(eq(stageCheckItems.id, item.id));

  return {
    productSku: product.sku,
    labelCode: params.labelCode,
    batch: label.batch,
    productName: product.description,
    checkedQuantity: newCheckedQuantity,
    message: `Quantidade registrada: ${params.quantity}. Total conferido: ${newCheckedQuantity}`,
  };
}

/**
 * Finaliza conferência de Stage
 * Valida divergências, baixa estoque e atualiza status do pedido
 */
export async function completeStageCheck(params: {
  stageCheckId: number;
  notes?: string;
  force?: boolean;
  tenantId: number | null;
}) {
  const dbConn = await getDb();
  if (!dbConn) throw new Error("Database connection failed");

  // Buscar conferência
  const [stageCheck] = await dbConn
    .select()
    .from(stageChecks)
    .where(eq(stageChecks.id, params.stageCheckId))
    .limit(1);

  if (!stageCheck) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Conferência não encontrada",
    });
  }

  if (stageCheck.status !== "in_progress") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Conferência já foi finalizada",
    });
  }

  // Buscar itens conferidos
  const items = await dbConn
    .select()
    .from(stageCheckItems)
    .where(eq(stageCheckItems.stageCheckId, params.stageCheckId));

  // Verificar divergências
  
  // Verificar se há itens não conferidos (checkedQuantity = 0)
  const uncheckedItems = items.filter(item => item.checkedQuantity === 0);
  
  if (uncheckedItems.length > 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Conferência incompleta: ${uncheckedItems.length} item(ns) não foram conferidos`,
      cause: {
        uncheckedItems: uncheckedItems.map(item => ({
          productSku: item.productSku,
          productName: item.productName,
          expectedQuantity: item.expectedQuantity,
        })),
      },
    });
  }
  
  // Verificar divergências reais (quantidade conferida diferente da esperada)
  const hasDivergence = items.some(item => item.divergence !== 0);
  const divergentItems = items.filter(item => item.divergence !== 0);
  
  

  if (hasDivergence && !params.force) {
    // Atualizar status para divergent
    await dbConn
      .update(stageChecks)
      .set({
        status: "divergent",
        hasDivergence: true,
        completedAt: new Date(),
        notes: params.notes,
      })
      .where(eq(stageChecks.id, params.stageCheckId));

    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Divergências encontradas em ${divergentItems.length} item(ns)`,
      cause: {
        divergentItems: divergentItems.map(item => ({
          productSku: item.productSku,
          productName: item.productName,
          expected: item.expectedQuantity,
          checked: item.checkedQuantity,
          divergence: item.divergence,
        })),
      },
    });
  }

  // Buscar pedido de picking para obter tenantId
  const [pickingOrder] = await dbConn
    .select()
    .from(pickingOrders)
    .where(eq(pickingOrders.id, stageCheck.pickingOrderId))
    .limit(1);

  if (!pickingOrder) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Pedido de picking não encontrado",
    });
  }

  // Buscar endereço de expedição do cliente
  const [tenant] = await dbConn
    .select({ shippingAddress: tenants.shippingAddress })
    .from(tenants)
    .where(eq(tenants.id, pickingOrder.tenantId))
    .limit(1);

  let shippingLocation;

  // Se cliente não tem shippingAddress configurado, buscar automaticamente endereço EXP disponível
  if (!tenant || !tenant.shippingAddress) {
    const [autoShippingLocation] = await dbConn
      .select()
      .from(warehouseLocations)
      .where(
        and(
          like(warehouseLocations.code, 'EXP%'),
          eq(warehouseLocations.tenantId, pickingOrder.tenantId),
          or(
            eq(warehouseLocations.status, 'available'),
            eq(warehouseLocations.status, 'livre')
          )
        )
      )
      .limit(1);

    if (!autoShippingLocation) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Nenhum endereço de expedição disponível encontrado para este cliente",
      });
    }

    shippingLocation = autoShippingLocation;
  } else {
    // Buscar endereço de expedição configurado no sistema
    const [configuredLocation] = await dbConn
      .select()
      .from(warehouseLocations)
      .where(
        and(
          eq(warehouseLocations.code, tenant.shippingAddress),
          eq(warehouseLocations.tenantId, pickingOrder.tenantId)
        )
      )
      .limit(1);

    if (!configuredLocation) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `Endereço de expedição ${tenant.shippingAddress} não encontrado no sistema`,
      });
    }

    shippingLocation = configuredLocation;
  }

  // Movimentar para expedição (EXP)
  // Para cada item, movimentar quantidade conferida das reservas para endereço de expedição
  for (const item of items) {
    // Buscar reservas do produto para este pedido
    const reservations = await dbConn
      .select({
        id: pickingReservations.id,
        inventoryId: pickingReservations.inventoryId,
        quantity: pickingReservations.quantity,
      })
      .from(pickingReservations)
      .innerJoin(inventory, eq(pickingReservations.inventoryId, inventory.id))
      .where(
        and(
          eq(pickingReservations.pickingOrderId, stageCheck.pickingOrderId),
          eq(inventory.productId, item.productId)
        )
      );

    let remainingToShip = item.checkedQuantity;

    for (const reservation of reservations) {
      if (remainingToShip <= 0) break;

      const quantityToShip = Math.min(remainingToShip, reservation.quantity);

      // Buscar estoque origem
      const [sourceInventory] = await dbConn
        .select()
        .from(inventory)
        .where(eq(inventory.id, reservation.inventoryId))
        .limit(1);

      if (!sourceInventory) continue;

      // Validar se há estoque suficiente
      if (sourceInventory.quantity < quantityToShip) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Estoque insuficiente no endereço ${sourceInventory.locationId} para o produto ${item.productSku}. Disponível: ${sourceInventory.quantity}, Necessário: ${quantityToShip}. Isso indica inconsistência entre reservas e estoque real.`,
        });
      }

      // Subtrair do estoque origem
      await dbConn
        .update(inventory)
        .set({
          quantity: sourceInventory.quantity - quantityToShip,
        })
        .where(eq(inventory.id, reservation.inventoryId));

      // Verificar se já existe estoque no endereço de expedição para este produto/lote
      const conditions = [
        eq(inventory.locationId, shippingLocation.id),
        eq(inventory.productId, sourceInventory.productId),
        eq(inventory.tenantId, pickingOrder.tenantId),
      ];
      
      if (sourceInventory.batch) {
        conditions.push(eq(inventory.batch, sourceInventory.batch));
      }

      const [existingShippingInventory] = await dbConn
        .select()
        .from(inventory)
        .where(and(...conditions))
        .limit(1);

      if (existingShippingInventory) {
        // Adicionar ao estoque existente
        await dbConn
          .update(inventory)
          .set({
            quantity: existingShippingInventory.quantity + quantityToShip,
          })
          .where(eq(inventory.id, existingShippingInventory.id));
      } else {
        // ✅ VALIDAÇÃO: Verificar se endereço EXP pode receber este lote
        const { validateLocationForBatch } = await import("./locationValidation");
        const validation = await validateLocationForBatch(
          shippingLocation.id,
          sourceInventory.productId,
          sourceInventory.batch
        );

        if (!validation.allowed) {
          throw new Error(`Erro ao movimentar para expedição: ${validation.reason}`);
        }

        // Criar novo registro de estoque no endereço de expedição
        await dbConn.insert(inventory).values({
          locationId: shippingLocation.id,
          productId: sourceInventory.productId,
          batch: sourceInventory.batch,
          expiryDate: sourceInventory.expiryDate,
          quantity: quantityToShip,
          tenantId: pickingOrder.tenantId,
          status: "available",
        });
      }

      // Registrar movimentação
      await dbConn.insert(inventoryMovements).values({
        productId: sourceInventory.productId,
        batch: sourceInventory.batch,
        fromLocationId: sourceInventory.locationId,
        toLocationId: shippingLocation.id,
        quantity: quantityToShip,
        movementType: "picking",
        referenceType: "picking_order",
        referenceId: stageCheck.pickingOrderId,
        performedBy: stageCheck.operatorId,
        notes: `Movimentação automática após conferência Stage - Pedido ${pickingOrder.customerOrderNumber}`,
        tenantId: pickingOrder.tenantId,
      });

      // Remover reserva
      await dbConn
        .delete(pickingReservations)
        .where(eq(pickingReservations.id, reservation.id));

      remainingToShip -= quantityToShip;
    }
  }

  // Atualizar status da conferência
  await dbConn
    .update(stageChecks)
    .set({
      status: "completed",
      completedAt: new Date(),
      notes: params.notes,
    })
    .where(eq(stageChecks.id, params.stageCheckId));

  // Atualizar status do pedido para 'staged' (pronto para expedição)
  await dbConn
    .update(pickingOrders)
    .set({
      status: "staged",
    })
    .where(eq(pickingOrders.id, stageCheck.pickingOrderId));

  return {
    message: `Conferência finalizada com sucesso. Produtos movimentados para ${shippingLocation.code}.`,
    stageCheckId: params.stageCheckId,
    customerOrderNumber: stageCheck.customerOrderNumber,
    shippingAddress: shippingLocation.code,
  };
}

/**
 * Busca conferência ativa (in_progress) do operador
 */
export async function getActiveStageCheck(operatorId: number, tenantId: number | null) {
  const dbConn = await getDb();
  if (!dbConn) throw new Error("Database connection failed");

  const conditions = [
    eq(stageChecks.operatorId, operatorId),
    eq(stageChecks.status, "in_progress"),
  ];

  if (tenantId !== null) {
    conditions.push(eq(stageChecks.tenantId, tenantId));
  }

  const activeChecks = await dbConn
    .select()
    .from(stageChecks)
    .where(and(...conditions))
    .limit(1);

  const activeCheck = activeChecks[0];

  if (!activeCheck) {
    return null;
  }

  // Buscar itens conferidos
  const items = await dbConn
    .select()
    .from(stageCheckItems)
    .where(eq(stageCheckItems.stageCheckId, activeCheck.id));

  return {
    ...activeCheck,
    items,
  };
}

/**
 * Lista histórico de conferências de Stage
 */
export async function getStageCheckHistory(params: {
  tenantId: number | null;
  limit: number;
  offset: number;
}) {
  const dbConn = await getDb();
  if (!dbConn) throw new Error("Database connection failed");

  const conditions = [];

  if (params.tenantId !== null) {
    conditions.push(eq(stageChecks.tenantId, params.tenantId));
  }

  const checks = await dbConn
    .select()
    .from(stageChecks)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(stageChecks.createdAt))
    .limit(params.limit)
    .offset(params.offset);

  return checks;
}

/**
 * Cancela conferência de Stage em andamento
 * Deleta registros de stageCheck e stageCheckItems
 */
export async function cancelStageCheck(params: {
  stageCheckId: number;
  tenantId: number | null;
}) {
  const dbConn = await getDb();
  if (!dbConn) throw new Error("Database connection failed");

  // Buscar conferência
  const [stageCheck] = await dbConn
    .select()
    .from(stageChecks)
    .where(eq(stageChecks.id, params.stageCheckId))
    .limit(1);

  if (!stageCheck) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Conferência não encontrada",
    });
  }

  // Validar tenantId
  if (params.tenantId !== null && stageCheck.tenantId !== params.tenantId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Você não tem permissão para cancelar esta conferência",
    });
  }

  if (stageCheck.status !== "in_progress") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Apenas conferências em andamento podem ser canceladas",
    });
  }

  // Deletar itens da conferência
  await dbConn
    .delete(stageCheckItems)
    .where(eq(stageCheckItems.stageCheckId, params.stageCheckId));

  // Deletar conferência
  await dbConn
    .delete(stageChecks)
    .where(eq(stageChecks.id, params.stageCheckId));

  return {
    success: true,
    message: `Conferência do pedido ${stageCheck.customerOrderNumber} cancelada com sucesso`,
  };
}
