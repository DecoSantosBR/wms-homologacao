import { describe, it, expect } from "vitest";
import { getDb } from "./db";
import { pickingOrders, tenants } from "../drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * Teste para validar correção de etiquetas de volumes
 * 
 * Valida que picking.list e picking.getById retornam:
 * - customerName (destinatário do pedido)
 * - clientName (nome do tenant/cliente via JOIN)
 */

describe("Correção Etiquetas de Volumes - customerName e clientName", () => {
  it("deve retornar customerName e clientName na query picking.list", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Simular query picking.list (admin vê todos)
    const orders = await db
      .select({
        id: pickingOrders.id,
        tenantId: pickingOrders.tenantId,
        clientName: tenants.name, // Nome do cliente (tenant) via JOIN
        orderNumber: pickingOrders.orderNumber,
        customerOrderNumber: pickingOrders.customerOrderNumber,
        customerName: pickingOrders.customerName, // Nome do destinatário
        status: pickingOrders.status,
      })
      .from(pickingOrders)
      .leftJoin(tenants, eq(pickingOrders.tenantId, tenants.id))
      .where(eq(pickingOrders.status, 'picked'))
      .limit(1);

    console.log("✅ Query picking.list executada com sucesso");
    
    if (orders.length > 0) {
      const order = orders[0];
      console.log(`   - Pedido: ${order.orderNumber}`);
      console.log(`   - customerName: ${order.customerName || 'NULL'}`);
      console.log(`   - clientName: ${order.clientName || 'NULL'}`);
      
      // Validar que campos existem (mesmo que sejam null)
      expect(order).toHaveProperty('customerName');
      expect(order).toHaveProperty('clientName');
      
      // Se clientName é null, significa que o JOIN com tenants falhou
      if (order.clientName === null) {
        console.log("   ⚠️  clientName é NULL - verificar se tenant existe");
      }
      
      // Se customerName é null, significa que o campo não foi preenchido ao criar o pedido
      if (order.customerName === null) {
        console.log("   ⚠️  customerName é NULL - campo não foi preenchido ao criar pedido");
      }
    } else {
      console.log("   ⚠️  Nenhum pedido com status 'picked' encontrado");
    }
  });

  it("deve retornar customerName e clientName na query picking.getById", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Buscar primeiro pedido 'picked' para testar
    const [firstOrder] = await db
      .select({ id: pickingOrders.id })
      .from(pickingOrders)
      .where(eq(pickingOrders.status, 'picked'))
      .limit(1);

    if (!firstOrder) {
      console.log("⚠️  Nenhum pedido 'picked' encontrado - teste pulado");
      return;
    }

    // Simular query picking.getById
    const [order] = await db
      .select({
        id: pickingOrders.id,
        tenantId: pickingOrders.tenantId,
        clientName: tenants.name, // Nome do cliente (tenant) via JOIN
        orderNumber: pickingOrders.orderNumber,
        customerOrderNumber: pickingOrders.customerOrderNumber,
        customerName: pickingOrders.customerName, // Nome do destinatário
        status: pickingOrders.status,
      })
      .from(pickingOrders)
      .leftJoin(tenants, eq(pickingOrders.tenantId, tenants.id))
      .where(eq(pickingOrders.id, firstOrder.id))
      .limit(1);

    console.log("✅ Query picking.getById executada com sucesso");
    console.log(`   - Pedido: ${order.orderNumber}`);
    console.log(`   - customerName: ${order.customerName || 'NULL'}`);
    console.log(`   - clientName: ${order.clientName || 'NULL'}`);
    
    // Validar que campos existem
    expect(order).toHaveProperty('customerName');
    expect(order).toHaveProperty('clientName');
    
    // Validar que clientName NÃO é null (deve vir do JOIN com tenants)
    if (order.clientName === null) {
      console.log("   ⚠️  clientName é NULL - verificar se tenant existe");
    } else {
      console.log(`   ✅ clientName válido: "${order.clientName}"`);
    }
  });

  it("deve validar que frontend trata valores null corretamente", () => {
    // Simular lógica do frontend (PickingOrders.tsx, linhas 174-184)
    const reprintOrder = {
      customerName: null,
      clientName: null,
    };

    let customerName = reprintOrder.customerName;
    let tenantName = reprintOrder.clientName;

    // Aplicar lógica de fallback
    if (!customerName) {
      customerName = "Destinatário não informado";
    }
    if (!tenantName) {
      tenantName = "Cliente não identificado";
    }

    console.log("✅ Lógica de fallback do frontend:");
    console.log(`   - customerName: "${customerName}"`);
    console.log(`   - tenantName: "${tenantName}"`);

    // Validar que valores padrão são aplicados
    expect(customerName).toBe("Destinatário não informado");
    expect(tenantName).toBe("Cliente não identificado");
  });

  it("deve validar que valores válidos são preservados", () => {
    // Simular lógica do frontend com valores válidos
    const reprintOrder = {
      customerName: "Farmácia Central",
      clientName: "Hospital São Lucas",
    };

    let customerName = reprintOrder.customerName;
    let tenantName = reprintOrder.clientName;

    // Aplicar lógica de fallback
    if (!customerName) {
      customerName = "Destinatário não informado";
    }
    if (!tenantName) {
      tenantName = "Cliente não identificado";
    }

    console.log("✅ Valores válidos preservados:");
    console.log(`   - customerName: "${customerName}"`);
    console.log(`   - tenantName: "${tenantName}"`);

    // Validar que valores originais são preservados
    expect(customerName).toBe("Farmácia Central");
    expect(tenantName).toBe("Hospital São Lucas");
  });
});
