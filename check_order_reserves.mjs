import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

console.log("🔍 Verificando pedidos da onda OS-20260111-0001...\n");

const [waves] = await connection.execute(
  "SELECT id FROM pickingWaves WHERE waveNumber = 'OS-20260111-0001'"
);

const waveId = waves[0].id;

const [orders] = await connection.execute(
  "SELECT id, orderNumber FROM pickingOrders WHERE waveId = ?",
  [waveId]
);

console.log(`📦 Pedidos na onda:`);
orders.forEach(o => console.log(`  - ${o.orderNumber} (ID: ${o.id})`));

for (const order of orders) {
  console.log(`\n🔍 Reservas do pedido ${order.orderNumber}:`);
  
  const [reserves] = await connection.execute(
    `SELECT 
      pr.id,
      pr.quantity as reservedQty,
      p.sku,
      p.description,
      i.batch,
      w.code as locationCode,
      i.quantity as stockQty,
      i.reservedQuantity as totalReserved
    FROM pickingReservations pr
    LEFT JOIN inventory i ON pr.inventoryId = i.id
    LEFT JOIN products p ON pr.productId = p.id
    LEFT JOIN warehouseLocations w ON i.locationId = w.id
    WHERE pr.pickingOrderId = ?
    ORDER BY pr.id`,
    [order.id]
  );
  
  if (reserves.length === 0) {
    console.log("  ❌ Nenhuma reserva encontrada");
  } else {
    reserves.forEach((r, i) => {
      console.log(`  ${i+1}. ${r.sku} - ${r.description}`);
      console.log(`     Endereço: ${r.locationCode} | Lote: ${r.batch}`);
      console.log(`     Reservado neste pedido: ${r.reservedQty} | Total reservado na posição: ${r.totalReserved}`);
    });
  }
}

await connection.end();
