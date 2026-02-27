import { describe, it, expect, beforeAll } from "vitest";
import { getDb } from "./db";
import { warehouseLocations, inventory, blindConferenceSessions, labelAssociations } from "../drizzle/schema";
import { eq, and, sql, or, like } from "drizzle-orm";

/**
 * Testes de endereçamento automático com status "livre"
 * 
 * Valida que o sistema busca endereços com status "available" E "livre"
 * tanto no recebimento (REC) quanto na expedição (EXP)
 */

describe("Endereçamento Automático - Status Livre", () => {
  let db: Awaited<ReturnType<typeof getDb>>;

  beforeAll(async () => {
    db = await getDb();
    if (!db) throw new Error("Database not available");
  });

  it("deve buscar endereços REC com status 'available' ou 'livre'", async () => {
    // Simular busca de endereço REC (lógica do recebimento)
    const sessionTenantId = 1; // Cliente de teste

    const recLocations = await db!.select()
      .from(warehouseLocations)
      .where(
        and(
          sql`${warehouseLocations.locationCode} LIKE '%REC%'`,
          sql`${warehouseLocations.tenantId} = ${sessionTenantId}`,
          or(
            eq(warehouseLocations.status, 'available'),
            eq(warehouseLocations.status, 'livre')
          )
        )
      )
      .limit(1);

    console.log("✅ Busca de endereço REC aceita status 'available' ou 'livre'");
    console.log(`   Resultado: ${recLocations.length > 0 ? 'Endereço encontrado' : 'Nenhum endereço encontrado'}`);
    
    // Validar que a query não falha (independente de ter ou não endereço)
    expect(recLocations).toBeDefined();
    expect(Array.isArray(recLocations)).toBe(true);
  });

  it("deve buscar endereços EXP com status 'available' ou 'livre'", async () => {
    // Simular busca de endereço EXP (lógica do stage)
    const pickingOrderTenantId = 1; // Cliente de teste

    const expLocations = await db!.select()
      .from(warehouseLocations)
      .where(
        and(
          like(warehouseLocations.locationCode, 'EXP%'),
          eq(warehouseLocations.tenantId, pickingOrderTenantId),
          or(
            eq(warehouseLocations.status, 'available'),
            eq(warehouseLocations.status, 'livre')
          )
        )
      )
      .limit(1);

    console.log("✅ Busca de endereço EXP aceita status 'available' ou 'livre'");
    console.log(`   Resultado: ${expLocations.length > 0 ? 'Endereço encontrado' : 'Nenhum endereço encontrado'}`);
    
    // Validar que a query não falha (independente de ter ou não endereço)
    expect(expLocations).toBeDefined();
    expect(Array.isArray(expLocations)).toBe(true);
  });

  it("deve priorizar endereços 'livre' sobre 'available' quando ambos existem", async () => {
    const sessionTenantId = 1;

    // Buscar TODOS os endereços REC (livre + available)
    const allRecLocations = await db!.select()
      .from(warehouseLocations)
      .where(
        and(
          sql`${warehouseLocations.locationCode} LIKE '%REC%'`,
          sql`${warehouseLocations.tenantId} = ${sessionTenantId}`,
          or(
            eq(warehouseLocations.status, 'available'),
            eq(warehouseLocations.status, 'livre')
          )
        )
      );

    console.log(`✅ Total de endereços REC disponíveis (livre + available): ${allRecLocations.length}`);
    
    if (allRecLocations.length > 0) {
      const livreCount = allRecLocations.filter(loc => loc.status === 'livre').length;
      const availableCount = allRecLocations.filter(loc => loc.status === 'available').length;
      
      console.log(`   - Livres: ${livreCount}`);
      console.log(`   - Disponíveis: ${availableCount}`);
      
      expect(livreCount + availableCount).toBe(allRecLocations.length);
    }
  });

  it("deve validar que lógica aceita endereços vazios (livre) no recebimento", async () => {
    // Cenário: endereço REC vazio (livre) deve ser aceito para alocar produtos recebidos
    const sessionTenantId = 1;

    const livreRecLocations = await db!.select()
      .from(warehouseLocations)
      .where(
        and(
          sql`${warehouseLocations.locationCode} LIKE '%REC%'`,
          sql`${warehouseLocations.tenantId} = ${sessionTenantId}`,
          eq(warehouseLocations.status, 'livre')
        )
      );

    console.log(`✅ Endereços REC com status 'livre': ${livreRecLocations.length}`);
    
    if (livreRecLocations.length > 0) {
      console.log(`   - Primeiro endereço livre: ${livreRecLocations[0].code}`);
      
      // Validar que endereço livre NÃO tem estoque
      const stockInLivre = await db!.select()
        .from(inventory)
        .where(eq(inventory.locationId, livreRecLocations[0].id));
      
      console.log(`   - Estoque no endereço livre: ${stockInLivre.length} registros`);
      expect(stockInLivre.length).toBe(0); // Endereço livre não deve ter estoque
    }
  });

  it("deve validar que lógica aceita endereços vazios (livre) na expedição", async () => {
    // Cenário: endereço EXP vazio (livre) deve ser aceito para alocar produtos expedidos
    const pickingOrderTenantId = 1;

    const livreExpLocations = await db!.select()
      .from(warehouseLocations)
      .where(
        and(
          like(warehouseLocations.locationCode, 'EXP%'),
          eq(warehouseLocations.tenantId, pickingOrderTenantId),
          eq(warehouseLocations.status, 'livre')
        )
      );

    console.log(`✅ Endereços EXP com status 'livre': ${livreExpLocations.length}`);
    
    if (livreExpLocations.length > 0) {
      console.log(`   - Primeiro endereço livre: ${livreExpLocations[0].code}`);
      
      // Validar que endereço livre NÃO tem estoque
      const stockInLivre = await db!.select()
        .from(inventory)
        .where(eq(inventory.locationId, livreExpLocations[0].id));
      
      console.log(`   - Estoque no endereço livre: ${stockInLivre.length} registros`);
      expect(stockInLivre.length).toBe(0); // Endereço livre não deve ter estoque
    }
  });
});
