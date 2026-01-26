import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { stageChecks, stageCheckItems } from './drizzle/schema.ts';
import { eq, desc } from 'drizzle-orm';

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection);

console.log('\n===== ÚLTIMA CONFERÊNCIA DIVERGENTE =====\n');

const checks = await db
  .select()
  .from(stageChecks)
  .where(eq(stageChecks.status, 'divergent'))
  .orderBy(desc(stageChecks.id))
  .limit(1);

if (checks.length === 0) {
  console.log('Nenhuma conferência divergente encontrada');
  process.exit(0);
}

const check = checks[0];
console.log(`Check ID: ${check.id}`);
console.log(`Pedido: ${check.customerOrderNumber}`);
console.log(`Status: ${check.status}`);
console.log(`\n===== ITENS =====\n`);

const items = await db
  .select()
  .from(stageCheckItems)
  .where(eq(stageCheckItems.stageCheckId, check.id));

items.forEach((item, index) => {
  const calculatedDiv = item.checkedQuantity - item.expectedQuantity;
  console.log(`Item ${index + 1}:`);
  console.log(`  SKU: ${item.productSku}`);
  console.log(`  Produto: ${item.productName}`);
  console.log(`  Esperado: ${item.expectedQuantity}`);
  console.log(`  Conferido: ${item.checkedQuantity}`);
  console.log(`  Divergência (BD): ${item.divergence}`);
  console.log(`  Divergência (Calc): ${calculatedDiv}`);
  console.log(`  Match: ${item.divergence === calculatedDiv ? '✓' : '✗ ERRO!'}`);
  console.log('');
});

await connection.end();
