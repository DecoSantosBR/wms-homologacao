import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { warehouseLocations, inventory } from './drizzle/schema.ts';
import { eq, sql } from 'drizzle-orm';

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection);

console.log('\n=== CORREÇÃO: Status de Endereços ===\n');

// 1. Buscar TODOS os endereços
const allLocations = await db.select({
  id: warehouseLocations.id,
  code: warehouseLocations.code,
  status: warehouseLocations.status
})
.from(warehouseLocations);

console.log(`📍 Total de endereços: ${allLocations.length}`);

let corrected = 0;
let alreadyCorrect = 0;

for (const location of allLocations) {
  // Calcular estoque total no endereço
  const stockResult = await db.select({
    total: sql`COALESCE(SUM(${inventory.quantity}), 0)`
  })
  .from(inventory)
  .where(eq(inventory.locationId, location.id));
  
  const totalStock = Number(stockResult[0]?.total ?? 0);
  const expectedStatus = totalStock > 0 ? 'occupied' : 'available';
  
  if (location.status !== expectedStatus) {
    // Corrigir status
    await db.update(warehouseLocations)
      .set({ status: expectedStatus })
      .where(eq(warehouseLocations.id, location.id));
    
    console.log(`✅ Corrigido: ${location.code} | ${location.status} → ${expectedStatus} (estoque: ${totalStock})`);
    corrected++;
  } else {
    alreadyCorrect++;
  }
}

console.log(`\n📊 Resumo:`);
console.log(`   ✅ Corrigidos: ${corrected}`);
console.log(`   ✓  Já corretos: ${alreadyCorrect}`);
console.log(`   📍 Total: ${allLocations.length}`);

await connection.end();
console.log('\n=== FIM DA CORREÇÃO ===\n');
