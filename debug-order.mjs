import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { pickingOrders, pickingOrderItems, products } from './drizzle/schema.ts';
import { eq } from 'drizzle-orm';

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection);

console.log('\n===== PEDIDO PED-005 =====\n');

const orders = await db
  .select()
  .from(pickingOrders)
  .where(eq(pickingOrders.customerOrderNumber, 'PED-005'))
  .limit(1);

if (orders.length === 0) {
  console.log('Pedido não encontrado');
  process.exit(0);
}

const order = orders[0];
console.log(`Order ID: ${order.id}`);
console.log(`Número: ${order.orderNumber}`);
console.log(`Cliente: ${order.customerName}`);
console.log(`Status: ${order.status}`);
console.log(`\n===== ITENS DO PEDIDO =====\n`);

const items = await db
  .select({
    itemId: pickingOrderItems.id,
    productId: pickingOrderItems.productId,
    sku: products.sku,
    description: products.description,
    quantity: pickingOrderItems.requestedQuantity,
    unit: pickingOrderItems.requestedUM,
  })
  .from(pickingOrderItems)
  .leftJoin(products, eq(pickingOrderItems.productId, products.id))
  .where(eq(pickingOrderItems.pickingOrderId, order.id));

items.forEach((item, index) => {
  console.log(`Item ${index + 1}:`);
  console.log(`  Item ID: ${item.itemId}`);
  console.log(`  Product ID: ${item.productId}`);
  console.log(`  SKU: ${item.sku}`);
  console.log(`  Descrição: ${item.description}`);
  console.log(`  Quantidade: ${item.quantity}`);
  console.log(`  Unidade: ${item.unit}`);
  console.log('');
});

console.log(`Total de linhas: ${items.length}`);

// Agrupar por produto
const grouped = items.reduce((acc, item) => {
  const existing = acc.find(i => i.productId === item.productId);
  if (existing) {
    existing.quantity += item.quantity;
    existing.lines++;
  } else {
    acc.push({
      productId: item.productId,
      sku: item.sku,
      quantity: item.quantity,
      lines: 1
    });
  }
  return acc;
}, []);

console.log('\n===== AGRUPAMENTO POR PRODUTO =====\n');
grouped.forEach((item, index) => {
  console.log(`Produto ${index + 1}:`);
  console.log(`  SKU: ${item.sku}`);
  console.log(`  Quantidade total: ${item.quantity}`);
  console.log(`  Linhas no pedido: ${item.lines}`);
  console.log('');
});

await connection.end();
