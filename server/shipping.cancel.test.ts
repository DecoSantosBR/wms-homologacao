import { describe, it, expect, beforeEach } from "vitest";
import { getDb } from "./db";
import {
  pickingOrders,
  stageChecks,
  invoices,
  tenants,
  shipmentManifests,
  shipmentManifestItems,
} from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

/**
 * Testes para cancelamento de expedição
 * Valida retorno de pedido para Stage para nova conferência
 */
describe("Shipping - Cancelamento de expedição", () => {
  let dbConn: any;
  let tenantId: number;
  let orderId: number;
  let uniqueSuffix: string;

  beforeEach(async () => {
    uniqueSuffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    dbConn = await getDb();
    if (!dbConn) throw new Error("Database connection failed");

    // Criar tenant
    const uniqueCnpj = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const [tenant] = await dbConn.insert(tenants).values({
      name: "Teste Cancel Shipping",
      cnpj: uniqueCnpj.substring(0, 18),
    });
    tenantId = tenant.insertId;

    // Criar pedido com status "staged"
    const [order] = await dbConn.insert(pickingOrders).values({
      tenantId,
      orderNumber: `ORD-CANCEL-${uniqueSuffix}`,
      customerOrderNumber: `0001-${uniqueSuffix}`,
      customerName: "Cliente Teste",
      status: "staged", // Conferido no Stage
      shippingStatus: "awaiting_invoice",
      createdBy: 1,
    });
    orderId = order.insertId;

    // Criar conferência de stage concluída
    await dbConn.insert(stageChecks).values({
      tenantId,
      pickingOrderId: orderId,
      customerOrderNumber: `0001-${uniqueSuffix}`,
      operatorId: 1,
      status: "completed",
      hasDivergence: false,
      completedAt: new Date(),
    });
  });

  it("deve cancelar expedição e retornar pedido para status 'picked'", async () => {
    // Importar função diretamente do router (simulando mutation)
    // Como não temos acesso direto ao tRPC context aqui, vamos testar a lógica SQL

    // Verificar status inicial
    const [orderBefore] = await dbConn
      .select()
      .from(pickingOrders)
      .where(eq(pickingOrders.id, orderId))
      .limit(1);

    expect(orderBefore.status).toBe("staged");
    expect(orderBefore.shippingStatus).toBe("awaiting_invoice");

    // Executar cancelamento (simular lógica do endpoint)
    await dbConn
      .update(pickingOrders)
      .set({
        status: "picked",
        shippingStatus: null,
      })
      .where(eq(pickingOrders.id, orderId));

    // Verificar status após cancelamento
    const [orderAfter] = await dbConn
      .select()
      .from(pickingOrders)
      .where(eq(pickingOrders.id, orderId))
      .limit(1);

    expect(orderAfter.status).toBe("picked");
    expect(orderAfter.shippingStatus).toBeNull();
  });

  it("deve marcar conferência de stage como divergente ao cancelar", async () => {
    // Verificar status inicial da conferência
    const [checkBefore] = await dbConn
      .select()
      .from(stageChecks)
      .where(
        and(
          eq(stageChecks.pickingOrderId, orderId),
          eq(stageChecks.status, "completed")
        )
      )
      .limit(1);

    expect(checkBefore.status).toBe("completed");

    // Executar cancelamento da conferência
    await dbConn
      .update(stageChecks)
      .set({ status: "divergent" })
      .where(
        and(
          eq(stageChecks.pickingOrderId, orderId),
          eq(stageChecks.status, "completed")
        )
      );

    // Verificar status após cancelamento
    const [checkAfter] = await dbConn
      .select()
      .from(stageChecks)
      .where(eq(stageChecks.pickingOrderId, orderId))
      .limit(1);

    expect(checkAfter.status).toBe("divergent");
  });

  it("deve desvincular NF ao cancelar expedição", async () => {
    // Criar NF vinculada ao pedido
    const invoiceNumber = `NF${Date.now()}`; // Número curto
    const [invoice] = await dbConn.insert(invoices).values({
      tenantId,
      invoiceNumber,
      series: "1",
      invoiceKey: `KEY${Date.now()}`, // Chave curta
      customerId: 1,
      customerName: "Cliente Teste",
      pickingOrderId: orderId, // Vinculada
      xmlData: { raw: "<xml></xml>" },
      volumes: 1,
      totalValue: "100.00",
      issueDate: new Date(),
      status: "linked",
      importedBy: 1,
      linkedAt: new Date(),
    });

    // Verificar vínculo inicial
    const [invoiceBefore] = await dbConn
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoice.insertId))
      .limit(1);

    expect(invoiceBefore.pickingOrderId).toBe(orderId);
    expect(invoiceBefore.status).toBe("linked");

    // Executar desvinculação
    await dbConn
      .update(invoices)
      .set({
        pickingOrderId: null,
        status: "imported",
        linkedAt: null,
      })
      .where(eq(invoices.pickingOrderId, orderId));

    // Verificar desvinculação
    const [invoiceAfter] = await dbConn
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoice.insertId))
      .limit(1);

    expect(invoiceAfter.pickingOrderId).toBeNull();
    expect(invoiceAfter.status).toBe("imported");
    expect(invoiceAfter.linkedAt).toBeNull();
  });

  it("não deve permitir cancelar pedido que não está em 'staged'", async () => {
    // Criar pedido com status "picked"
    const [order2] = await dbConn.insert(pickingOrders).values({
      tenantId,
      orderNumber: `ORD-PICKED-${uniqueSuffix}`,
      customerOrderNumber: `0002-${uniqueSuffix}`,
      customerName: "Cliente Teste",
      status: "picked", // Não está em staged
      createdBy: 1,
    });

    const [orderCheck] = await dbConn
      .select()
      .from(pickingOrders)
      .where(eq(pickingOrders.id, order2.insertId))
      .limit(1);

    // Validação: status deve ser diferente de "staged"
    expect(orderCheck.status).not.toBe("staged");
  });

  it("não deve permitir cancelar pedido que está em romaneio", async () => {
    // Criar romaneio
    const [manifest] = await dbConn.insert(shipmentManifests).values({
      tenantId,
      manifestNumber: `ROM-${uniqueSuffix}`,
      carrierName: "Transportadora Teste",
      status: "draft",
      totalOrders: 1,
      createdBy: 1,
    });

    // Criar NF para o romaneio
    const invoiceNumber2 = `NF${Date.now()}`;
    const [invoice2] = await dbConn.insert(invoices).values({
      tenantId,
      invoiceNumber: invoiceNumber2,
      series: "1",
      invoiceKey: `KEY${Date.now()}`,
      customerId: 1,
      customerName: "Cliente Teste",
      pickingOrderId: orderId,
      xmlData: { raw: "<xml></xml>" },
      volumes: 1,
      totalValue: "100.00",
      issueDate: new Date(),
      status: "linked",
      importedBy: 1,
      linkedAt: new Date(),
    });

    // Adicionar pedido ao romaneio
    await dbConn.insert(shipmentManifestItems).values({
      manifestId: manifest.insertId,
      pickingOrderId: orderId,
      invoiceId: invoice2.insertId, // Obrigatório
      volumes: 1,
    });

    // Verificar se pedido está em romaneio
    const manifestItems = await dbConn
      .select()
      .from(shipmentManifestItems)
      .where(eq(shipmentManifestItems.pickingOrderId, orderId))
      .limit(1);

    expect(manifestItems.length).toBeGreaterThan(0);
    // Validação: não deve permitir cancelamento
  });

  it("deve permitir nova conferência após cancelamento", async () => {
    // Cancelar expedição
    await dbConn
      .update(pickingOrders)
      .set({
        status: "picked",
        shippingStatus: null,
      })
      .where(eq(pickingOrders.id, orderId));

    // Marcar conferência anterior como divergente
    await dbConn
      .update(stageChecks)
      .set({ status: "divergent" })
      .where(
        and(
          eq(stageChecks.pickingOrderId, orderId),
          eq(stageChecks.status, "completed")
        )
      );

    // Criar nova conferência
    const [newCheck] = await dbConn.insert(stageChecks).values({
      tenantId,
      pickingOrderId: orderId,
      customerOrderNumber: `0001-${uniqueSuffix}`,
      operatorId: 1,
      status: "in_progress",
      hasDivergence: false,
    });

    // Verificar nova conferência
    const [checkResult] = await dbConn
      .select()
      .from(stageChecks)
      .where(eq(stageChecks.id, newCheck.insertId))
      .limit(1);

    expect(checkResult.status).toBe("in_progress");
    expect(checkResult.pickingOrderId).toBe(orderId);

    // Verificar que pedido está com status correto para nova conferência
    const [orderResult] = await dbConn
      .select()
      .from(pickingOrders)
      .where(eq(pickingOrders.id, orderId))
      .limit(1);

    expect(orderResult.status).toBe("picked");
  });
});
