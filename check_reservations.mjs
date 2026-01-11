import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { inventory, pickingReservations, pickingOrders } from "./drizzle/schema.js";
import { eq } from "drizzle-orm";

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection);

console.log("\n=== RESERVAS ATIVAS ===");
const reservations = await db.select().from(pickingReservations);
console.log(`Total de reservas: ${reservations.length}`);
for (const res of reservations) {
  console.log(`- Pedido ${res.pickingOrderId}: ${res.quantity} un (inventoryId: ${res.inventoryId})`);
}

console.log("\n=== PEDIDOS PENDING ===");
const pendingOrders = await db.select().from(pickingOrders).where(eq(pickingOrders.status, "pending"));
console.log(`Total de pedidos pending: ${pendingOrders.length}`);
for (const order of pendingOrders) {
  console.log(`- ${order.orderNumber} (ID: ${order.id})`);
}

console.log("\n=== ESTOQUE COM RESERVAS ===");
const reservedStock = await db.select().from(inventory);
const withReservations = reservedStock.filter(inv => inv.reservedQuantity > 0);
console.log(`Posições com reservas: ${withReservations.length}`);
for (const inv of withReservations) {
  console.log(`- Inventory ID ${inv.id}: ${inv.reservedQuantity} reservadas de ${inv.quantity} total`);
}

await connection.end();
