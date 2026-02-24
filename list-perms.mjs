import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./drizzle/schema.js";

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(conn, { schema, mode: "default" });
const perms = await db.select().from(schema.permissions);
console.log(JSON.stringify(perms.map(p => p.code), null, 2));
await conn.end();
