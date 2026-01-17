import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection);

// Criar pedidos de teste
const orders = [
  { customerOrderNumber: '0001', tenantId: 1, status: 'pending' },
  { customerOrderNumber: '0002', tenantId: 1, status: 'pending' }
];

for (const order of orders) {
  await connection.execute(
    'INSERT INTO pickingOrders (customerOrderNumber, tenantId, status) VALUES (?, ?, ?)',
    [order.customerOrderNumber, order.tenantId, order.status]
  );
}

console.log('Pedidos criados com sucesso!');
await connection.end();
