import { getDb } from "../db";
import { receivingPreallocations } from "../../drizzle/schema";

export async function createPreallocation(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(receivingPreallocations).values(data);
}

export async function getPreallocationsByOrder(receivingOrderId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.select().from(receivingPreallocations).where((t: any) => t.receivingOrderId === receivingOrderId);
}
