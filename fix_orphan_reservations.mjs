import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

console.log("\n🔧 Corrigindo reservas órfãs...\n");

// 1. Buscar estoque com reservas
const [reservedStock] = await connection.execute(
  "SELECT id, productId, locationId, quantity, reservedQuantity FROM inventory WHERE reservedQuantity > 0"
);

console.log(`Encontradas ${reservedStock.length} posições com reservas`);

// 2. Para cada posição, verificar se existem reservas ativas
for (const inv of reservedStock) {
  const [reservations] = await connection.execute(
    "SELECT SUM(quantity) as total FROM pickingReservations WHERE inventoryId = ?",
    [inv.id]
  );
  
  const activeReservations = reservations[0].total || 0;
  
  console.log(`\nInventory ${inv.id}:`);
  console.log(`  - reservedQuantity no inventory: ${inv.reservedQuantity}`);
  console.log(`  - Soma de reservas ativas: ${activeReservations}`);
  
  if (activeReservations === 0 && inv.reservedQuantity > 0) {
    console.log(`  ⚠️  ÓRFÃ! Liberando ${inv.reservedQuantity} unidades...`);
    
    await connection.execute(
      "UPDATE inventory SET reservedQuantity = 0 WHERE id = ?",
      [inv.id]
    );
    
    console.log(`  ✅ Liberado!`);
  } else if (activeReservations !== inv.reservedQuantity) {
    console.log(`  ⚠️  INCONSISTÊNCIA! Ajustando para ${activeReservations}...`);
    
    await connection.execute(
      "UPDATE inventory SET reservedQuantity = ? WHERE id = ?",
      [activeReservations, inv.id]
    );
    
    console.log(`  ✅ Ajustado!`);
  } else {
    console.log(`  ✅ OK (consistente)`);
  }
}

console.log("\n✅ Correção concluída!");

await connection.end();
