import { getDb } from "../db";
import { divergenceApprovals } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

export async function approveDivergence(divergenceId: number, userId: number, comments?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(divergenceApprovals).values({
    divergenceId,
    approvedBy: userId,
    approvalDate: new Date(),
    decision: "approved",
    comments,
  });
  
  return result;
}

export async function rejectDivergence(divergenceId: number, userId: number, comments?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(divergenceApprovals).values({
    divergenceId,
    approvedBy: userId,
    approvalDate: new Date(),
    decision: "rejected",
    comments,
  });
  
  return result;
}
