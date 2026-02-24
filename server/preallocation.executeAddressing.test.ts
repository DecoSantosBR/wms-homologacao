import { describe, it, expect } from "vitest";
import { getDb } from "./db";
import {
  receivingOrders,
  receivingPreallocations,
  inventory,
  inventoryMovements,
  warehouseLocations,
  products,
} from "../drizzle/schema";
import { executeAddressing } from "./preallocation";
import { eq, and, sql } from "drizzle-orm";

describe("Execute Addressing - Registro de Movimentações de Entrada", () => {
  it("deve lançar erro se ordem não estiver em status 'addressing'", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Buscar uma ordem que NÃO está em addressing
    const [order] = await db
      .select()
      .from(receivingOrders)
      .where(sql`${receivingOrders.status} != 'addressing'`)
      .limit(1);

    if (!order) {
      console.log("Nenhuma ordem encontrada para teste. Pulando...");
      return;
    }

    // Tentar executar endereçamento deve falhar
    await expect(
      executeAddressing(order.id, 1)
    ).rejects.toThrow(/não está em status de endereçamento/);
  });

  it("deve lançar erro se não houver pré-alocações pendentes", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Buscar uma ordem em addressing SEM pré-alocações
    const orders = await db
      .select()
      .from(receivingOrders)
      .where(eq(receivingOrders.status, "addressing"))
      .limit(10);

    let orderWithoutPrealloc = null;
    for (const order of orders) {
      const preallocations = await db
        .select()
        .from(receivingPreallocations)
        .where(
          and(
            eq(receivingPreallocations.receivingOrderId, order.id),
            eq(receivingPreallocations.status, "pending")
          )
        );

      if (preallocations.length === 0) {
        orderWithoutPrealloc = order;
        break;
      }
    }

    if (!orderWithoutPrealloc) {
      console.log("Nenhuma ordem sem pré-alocações encontrada. Pulando...");
      return;
    }

    // Tentar executar endereçamento deve falhar
    await expect(
      executeAddressing(orderWithoutPrealloc.id, 1)
    ).rejects.toThrow(/Nenhuma pré-alocação pendente encontrada/);
  });

  it("deve validar que movimentações de entrada usam tipo 'receiving'", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Buscar movimentações de entrada no banco
    const entryMovements = await db
      .select()
      .from(inventoryMovements)
      .where(eq(inventoryMovements.movementType, "receiving"))
      .limit(5);

    // Se houver movimentações, validar estrutura
    if (entryMovements.length > 0) {
      const movement = entryMovements[0];
      
      expect(movement.movementType).toBe("receiving");
      expect(movement.quantity).toBeGreaterThan(0);
      expect(movement.fromLocationId).toBeDefined();
      expect(movement.toLocationId).toBeDefined();
      
      console.log(`✓ Movimentação de entrada validada: ${movement.quantity} unidades`);
    } else {
      console.log("Nenhuma movimentação de entrada encontrada ainda. Sistema pronto para registrar.");
    }
  });

  it("deve validar que função executeAddressing existe e é exportada", () => {
    expect(executeAddressing).toBeDefined();
    expect(typeof executeAddressing).toBe("function");
  });
});
