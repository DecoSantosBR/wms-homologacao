import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

console.log("🔍 Verificando pickingWaveItems da onda OS-20260111-0001...\n");

const [waves] = await connection.execute(
  "SELECT id, waveNumber, totalItems FROM pickingWaves WHERE waveNumber = 'OS-20260111-0001'"
);

if (waves.length === 0) {
  console.log("❌ Onda não encontrada");
  process.exit(1);
}

const wave = waves[0];
console.log(`Onda: ${wave.waveNumber} (ID: ${wave.id})`);
console.log(`Total de itens registrados: ${wave.totalItems}\n`);

const [items] = await connection.execute(
  `SELECT 
    id,
    productSku,
    productName,
    totalQuantity,
    pickedQuantity,
    locationCode,
    batch,
    status
  FROM pickingWaveItems 
  WHERE waveId = ?
  ORDER BY locationCode, batch`,
  [wave.id]
);

console.log("📦 Itens da onda:");
console.log("=".repeat(120));
items.forEach((item, index) => {
  console.log(`${index + 1}. SKU: ${item.productSku} | Produto: ${item.productName}`);
  console.log(`   Endereço: ${item.locationCode} | Lote: ${item.batch || 'SEM LOTE'}`);
  console.log(`   Quantidade: ${item.totalQuantity} | Separado: ${item.pickedQuantity} | Status: ${item.status}`);
  console.log("-".repeat(120));
});

console.log(`\n✅ Total: ${items.length} registros em pickingWaveItems`);

await connection.end();
