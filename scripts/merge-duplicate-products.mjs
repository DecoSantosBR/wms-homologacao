#!/usr/bin/env node
/**
 * Script para mesclar produtos duplicados com mesmo SKU e tenantId
 * Mantém o produto mais antigo e atualiza todas as referências
 */

import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { eq, and } from 'drizzle-orm';
import { 
  products, 
  labelAssociations, 
  pickingWaveItems,
  pickingOrderItems,
  receivingOrderItems,
  inventory
} from '../drizzle/schema.ts';

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection);

console.log('🔍 Buscando produtos duplicados...\n');

// Buscar produtos com SKU 401460P e tenantId 60006
const duplicateProducts = await db
  .select()
  .from(products)
  .where(
    and(
      eq(products.sku, '401460P'),
      eq(products.tenantId, 60006)
    )
  )
  .orderBy(products.createdAt);

if (duplicateProducts.length < 2) {
  console.log('✅ Nenhum produto duplicado encontrado');
  await connection.end();
  process.exit(0);
}

console.log(`📦 Encontrados ${duplicateProducts.length} produtos duplicados:`);
duplicateProducts.forEach(p => {
  console.log(`  - ID ${p.id}: SKU ${p.sku}, criado em ${p.createdAt}`);
});

const keepProduct = duplicateProducts[0]; // Manter o mais antigo
const deleteProducts = duplicateProducts.slice(1); // Deletar os outros

console.log(`\n✅ Mantendo produto ID ${keepProduct.id} (mais antigo)`);
console.log(`❌ Deletando produto(s): ${deleteProducts.map(p => p.id).join(', ')}\n`);

// Atualizar referências
for (const oldProduct of deleteProducts) {
  console.log(`🔄 Atualizando referências do produto ID ${oldProduct.id} para ${keepProduct.id}...`);
  
  // 1. Atualizar labelAssociations
  const labelsUpdated = await db
    .update(labelAssociations)
    .set({ productId: keepProduct.id })
    .where(eq(labelAssociations.productId, oldProduct.id));
  console.log(`  ✓ ${labelsUpdated[0]?.affectedRows || 0} etiquetas atualizadas`);
  
  // 2. Atualizar pickingWaveItems
  const waveItemsUpdated = await db
    .update(pickingWaveItems)
    .set({ productId: keepProduct.id })
    .where(eq(pickingWaveItems.productId, oldProduct.id));
  console.log(`  ✓ ${waveItemsUpdated[0]?.affectedRows || 0} itens de onda atualizados`);
  
  // 3. Atualizar pickingOrderItems
  const pickingItemsUpdated = await db
    .update(pickingOrderItems)
    .set({ productId: keepProduct.id })
    .where(eq(pickingOrderItems.productId, oldProduct.id));
  console.log(`  ✓ ${pickingItemsUpdated[0]?.affectedRows || 0} itens de picking atualizados`);
  
  // 4. Atualizar receivingOrderItems
  const receivingItemsUpdated = await db
    .update(receivingOrderItems)
    .set({ productId: keepProduct.id })
    .where(eq(receivingOrderItems.productId, oldProduct.id));
  console.log(`  ✓ ${receivingItemsUpdated[0]?.affectedRows || 0} itens de recebimento atualizados`);
  
  // 5. Atualizar inventory
  const inventoryUpdated = await db
    .update(inventory)
    .set({ productId: keepProduct.id })
    .where(eq(inventory.productId, oldProduct.id));
  console.log(`  ✓ ${inventoryUpdated[0]?.affectedRows || 0} registros de inventário atualizados`);
  
  // 6. Deletar produto duplicado
  await db
    .delete(products)
    .where(eq(products.id, oldProduct.id));
  console.log(`  ✓ Produto ID ${oldProduct.id} deletado\n`);
}

console.log('✅ Mesclagem concluída com sucesso!\n');

// Verificar resultado
const remaining = await db
  .select()
  .from(products)
  .where(
    and(
      eq(products.sku, '401460P'),
      eq(products.tenantId, 60006)
    )
  );

console.log(`📊 Resultado final: ${remaining.length} produto(s) com SKU 401460P`);
remaining.forEach(p => {
  console.log(`  - ID ${p.id}: ${p.sku} - ${p.description}`);
});

await connection.end();
console.log('\n✨ Script finalizado!');
