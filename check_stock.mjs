import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

console.log("🔍 Verificando estoque do produto SKU 401460P...\n");

const [products] = await connection.execute(
  "SELECT id, sku, description FROM products WHERE sku = '401460P'"
);

if (products.length === 0) {
  console.log("❌ Produto não encontrado");
  process.exit(1);
}

const product = products[0];
console.log(`Produto: ${product.sku} - ${product.description} (ID: ${product.id})\n`);

const [stock] = await connection.execute(
  `SELECT 
    i.id,
    i.quantity,
    i.reservedQuantity,
    (i.quantity - i.reservedQuantity) as availableQuantity,
    i.batch,
    i.expiryDate,
    i.status,
    w.code as locationCode,
    w.id as locationId
  FROM inventory i
  LEFT JOIN warehouseLocations w ON i.locationId = w.id
  WHERE i.productId = ?
  ORDER BY i.expiryDate ASC`,
  [product.id]
);

console.log("📦 Posições de estoque:");
console.log("=".repeat(120));
stock.forEach((pos, index) => {
  console.log(`${index + 1}. Endereço: ${pos.locationCode} (ID: ${pos.locationId})`);
  console.log(`   Lote: ${pos.batch || 'SEM LOTE'} | Validade: ${pos.expiryDate ? pos.expiryDate.toISOString().split('T')[0] : 'N/A'}`);
  console.log(`   Quantidade: ${pos.quantity} | Reservado: ${pos.reservedQuantity} | Disponível: ${pos.availableQuantity}`);
  console.log(`   Status: ${pos.status}`);
  console.log("-".repeat(120));
});

console.log(`\n✅ Total: ${stock.length} posições`);

await connection.end();
