import { describe, it, expect } from "vitest";
import { getDb } from "./db";
import { registerMovement } from "./movements";
import {
  inventory,
  pickingReservations,
  warehouseLocations,
  products,
} from "../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";

describe("Movements - Reserved Stock Validation", () => {
  it("deve bloquear movimentação de estoque reservado", async () => {
    const dbConn = await getDb();
    if (!dbConn) throw new Error("Database connection failed");

    // Buscar um endereço com estoque reservado
    const stockWithReservation = await dbConn
      .select({
        inventoryId: inventory.id,
        productId: inventory.productId,
        locationId: inventory.locationId,
        batch: inventory.batch,
        totalQuantity: inventory.quantity,
        tenantId: inventory.tenantId,
        reservedQuantity: sql<number>`COALESCE(SUM(${pickingReservations.quantity}), 0)`,
      })
      .from(inventory)
      .leftJoin(
        pickingReservations,
        eq(pickingReservations.inventoryId, inventory.id)
      )
      .groupBy(
        inventory.id,
        inventory.productId,
        inventory.locationId,
        inventory.batch,
        inventory.quantity,
        inventory.tenantId
      )
      .having(sql`COALESCE(SUM(${pickingReservations.quantity}), 0) > 0`)
      .limit(1);

    if (stockWithReservation.length === 0) {
      console.log("⚠️ Nenhum estoque com reserva encontrado. Pulando teste.");
      return;
    }

    const stock = stockWithReservation[0];
    const availableQuantity = stock.totalQuantity - stock.reservedQuantity;

    console.log(`
📦 Estoque encontrado:
   - Total: ${stock.totalQuantity}
   - Reservado: ${stock.reservedQuantity}
   - Disponível: ${availableQuantity}
    `);

    // Buscar um endereço destino diferente
    const toLocation = await dbConn
      .select()
      .from(warehouseLocations)
      .where(
        and(
          eq(warehouseLocations.tenantId, stock.tenantId),
          sql`${warehouseLocations.id} != ${stock.locationId}`
        )
      )
      .limit(1);

    if (toLocation.length === 0) {
      console.log("⚠️ Nenhum endereço destino encontrado. Pulando teste.");
      return;
    }

    // Buscar um usuário válido
    const users = await dbConn.execute(
      sql`SELECT id FROM systemUsers WHERE tenantId = ${stock.tenantId} LIMIT 1`
    );
    const userId = users[0]?.[0]?.id || 1;

    // Tentar movimentar MAIS que o disponível (deve falhar)
    const quantityToMove = availableQuantity + 10;

    try {
      await registerMovement({
        productId: stock.productId,
        fromLocationId: stock.locationId,
        toLocationId: toLocation[0].id,
        quantity: quantityToMove,
        batch: stock.batch || undefined,
        movementType: "transfer",
        notes: "Teste de validação de estoque reservado",
        tenantId: stock.tenantId,
        performedBy: userId,
      });

      // Se chegou aqui, o teste FALHOU (deveria ter lançado erro)
      expect(true).toBe(false);
    } catch (error: any) {
      // Verificar que o erro contém as informações corretas
      console.log(`✅ Erro esperado: ${error.message}`);
      expect(error.message).toContain("Saldo insuficiente");
      expect(error.message).toContain("Total:");
      expect(error.message).toContain("Reservado:");
      expect(error.message).toContain("Disponível:");
      expect(error.message).toContain("Solicitado:");
    }
  });

  it("deve permitir movimentar apenas quantidade disponível", async () => {
    const dbConn = await getDb();
    if (!dbConn) throw new Error("Database connection failed");

    // Buscar um endereço com estoque reservado E disponível
    const stockWithReservation = await dbConn
      .select({
        inventoryId: inventory.id,
        productId: inventory.productId,
        locationId: inventory.locationId,
        batch: inventory.batch,
        totalQuantity: inventory.quantity,
        tenantId: inventory.tenantId,
        reservedQuantity: sql<number>`COALESCE(SUM(${pickingReservations.quantity}), 0)`,
      })
      .from(inventory)
      .leftJoin(
        pickingReservations,
        eq(pickingReservations.inventoryId, inventory.id)
      )
      .groupBy(
        inventory.id,
        inventory.productId,
        inventory.locationId,
        inventory.batch,
        inventory.quantity,
        inventory.tenantId
      )
      .having(
        sql`COALESCE(SUM(${pickingReservations.quantity}), 0) > 0 AND ${inventory.quantity} - COALESCE(SUM(${pickingReservations.quantity}), 0) >= 10`
      )
      .limit(1);

    if (stockWithReservation.length === 0) {
      console.log(
        "⚠️ Nenhum estoque com disponibilidade suficiente encontrado. Pulando teste."
      );
      return;
    }

    const stock = stockWithReservation[0];
    const availableQuantity = stock.totalQuantity - stock.reservedQuantity;

    console.log(`
📦 Estoque encontrado:
   - Total: ${stock.totalQuantity}
   - Reservado: ${stock.reservedQuantity}
   - Disponível: ${availableQuantity}
    `);

    // Buscar um endereço destino diferente
    const toLocation = await dbConn
      .select()
      .from(warehouseLocations)
      .where(
        and(
          eq(warehouseLocations.tenantId, stock.tenantId),
          sql`${warehouseLocations.id} != ${stock.locationId}`
        )
      )
      .limit(1);

    if (toLocation.length === 0) {
      console.log("⚠️ Nenhum endereço destino encontrado. Pulando teste.");
      return;
    }

    // Buscar um usuário válido
    const users = await dbConn.execute(
      sql`SELECT id FROM systemUsers WHERE tenantId = ${stock.tenantId} LIMIT 1`
    );
    const userId = users[0]?.[0]?.id || 1;

    // Tentar movimentar MENOS que o disponível (deve funcionar)
    const quantityToMove = Math.min(10, availableQuantity);

    const result = await registerMovement({
      productId: stock.productId,
      fromLocationId: stock.locationId,
      toLocationId: toLocation[0].id,
      quantity: quantityToMove,
      batch: stock.batch || undefined,
      movementType: "transfer",
      notes: "Teste de movimentação permitida",
      tenantId: stock.tenantId,
      performedBy: userId,
    });

    console.log(`✅ Movimentação permitida: ${result.message}`);
    expect(result.success).toBe(true);
    expect(result.message).toContain("sucesso");
  });
});
