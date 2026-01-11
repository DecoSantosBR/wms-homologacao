import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { warehouseLocations, inventory } from './drizzle/schema.ts';
import { eq, sql } from 'drizzle-orm';

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection);

console.log('\n=== TESTE: Atualização de Status de Endereço ===\n');

// 1. Buscar endereços ocupados
const occupied = await db.select({
  id: warehouseLocations.id,
  code: warehouseLocations.code,
  status: warehouseLocations.status
})
.from(warehouseLocations)
.where(eq(warehouseLocations.status, 'occupied'))
.limit(5);

console.log(`✅ Encontrados ${occupied.length} endereços ocupados`);

if (occupied.length > 0) {
  const location = occupied[0];
  console.log(`\n📍 Testando endereço: ${location.code} (ID: ${location.id})`);
  console.log(`   Status atual: ${location.status}`);
  
  // 2. Verificar estoque neste endereço
  const stock = await db.select()
    .from(inventory)
    .where(eq(inventory.locationId, location.id));
  
  console.log(`\n📦 Estoque encontrado: ${stock.length} registros`);
  stock.forEach((item, idx) => {
    console.log(`   ${idx + 1}. Produto ID: ${item.productId}, Lote: ${item.batch || 'SEM LOTE'}, Qtd: ${item.quantity}`);
  });
  
  // 3. Calcular total de estoque
  const totalStock = await db.select({
    total: sql`COALESCE(SUM(${inventory.quantity}), 0)`
  })
  .from(inventory)
  .where(eq(inventory.locationId, location.id));
  
  const total = Number(totalStock[0]?.total ?? 0);
  console.log(`\n📊 Quantidade total no endereço: ${total}`);
  
  if (total === 0) {
    console.log('\n⚠️  PROBLEMA DETECTADO: Endereço com estoque zerado ainda está como "occupied"');
    console.log('    Deveria estar como "available"');
  } else {
    console.log('\n✅ Endereço corretamente marcado como "occupied" (tem estoque)');
  }
} else {
  console.log('\n✅ Nenhum endereço ocupado encontrado (todos disponíveis)');
  
  // Verificar se há endereços disponíveis com estoque (problema inverso)
  const available = await db.select({
    id: warehouseLocations.id,
    code: warehouseLocations.code,
    status: warehouseLocations.status
  })
  .from(warehouseLocations)
  .where(eq(warehouseLocations.status, 'available'))
  .limit(10);
  
  console.log(`\n📍 Verificando ${available.length} endereços disponíveis...`);
  
  for (const loc of available) {
    const stock = await db.select()
      .from(inventory)
      .where(eq(inventory.locationId, loc.id));
    
    if (stock.length > 0) {
      const total = stock.reduce((sum, item) => sum + item.quantity, 0);
      if (total > 0) {
        console.log(`\n⚠️  PROBLEMA: Endereço ${loc.code} está "available" mas tem estoque: ${total} unidades`);
      }
    }
  }
}

await connection.end();
console.log('\n=== FIM DO TESTE ===\n');
