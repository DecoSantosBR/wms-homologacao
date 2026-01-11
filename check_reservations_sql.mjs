import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

console.log("\n=== RESERVAS ATIVAS ===");
const [reservations] = await connection.execute(
  "SELECT * FROM pickingReservations"
);
console.log(`Total de reservas: ${reservations.length}`);
for (const res of reservations) {
  console.log(`- Pedido ${res.pickingOrderId}: ${res.quantity} un (inventoryId: ${res.inventoryId})`);
}

console.log("\n=== PEDIDOS PENDING ===");
const [pendingOrders] = await connection.execute(
  "SELECT id, orderNumber, status FROM pickingOrders WHERE status = 'pending'"
);
console.log(`Total de pedidos pending: ${pendingOrders.length}`);
for (const order of pendingOrders) {
  console.log(`- ${order.orderNumber} (ID: ${order.id})`);
}

console.log("\n=== ESTOQUE COM RESERVAS ===");
const [reservedStock] = await connection.execute(
  "SELECT id, productId, locationId, quantity, reservedQuantity FROM inventory WHERE reservedQuantity > 0"
);
console.log(`Posições com reservas: ${reservedStock.length}`);
for (const inv of reservedStock) {
  console.log(`- Inventory ID ${inv.id}: ${inv.reservedQuantity} reservadas de ${inv.quantity} total (produto: ${inv.productId}, local: ${inv.locationId})`);
}

await connection.end();
