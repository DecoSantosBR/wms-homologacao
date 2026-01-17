import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection);

const results = await connection.execute(`
  SELECT 
    i.id,
    i.productId,
    p.sku,
    p.description,
    i.status,
    i.quantity,
    i.reservedQuantity,
    i.tenantId,
    t.name as tenantName,
    i.locationId,
    l.code as locationCode
  FROM inventory i
  LEFT JOIN products p ON i.productId = p.id
  LEFT JOIN tenants t ON i.tenantId = t.id
  LEFT JOIN warehouseLocations l ON i.locationId = l.id
  WHERE p.sku = '401460P'
`);

console.log(JSON.stringify(results[0], null, 2));
await connection.end();
