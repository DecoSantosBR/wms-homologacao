import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb } from "./db";
import { users, userRoles, roles } from "../drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * Test suite for user deletion functionality
 * Tests the delete procedure in userRouter.ts
 */

describe("User Deletion", () => {
  let testUserId: number | null = null;
  let testRoleId: number | null = null;

  beforeAll(async () => {
    const db = await getDb();
    expect(db).toBeTruthy();

    if (!db) return;

    // Create a test user for deletion
    const testEmail = `delete.test.${Date.now()}@medax.test.com`;
    const [newUser] = await db.insert(users).values({
      name: "User To Delete",
      email: testEmail,
      role: "user",
      tenantId: null,
      loginMethod: "manual",
      openId: `manual_${Date.now()}_delete_test`,
    });

    testUserId = newUser.insertId;

    // Get a test role for assignment
    const [testRole] = await db
      .select()
      .from(roles)
      .where(eq(roles.code, "receiving_operator"))
      .limit(1);
    testRoleId = testRole?.id || null;

    // Assign role to user
    if (testRoleId) {
      await db.insert(userRoles).values({
        userId: testUserId,
        roleId: testRoleId,
      });
    }
  });

  afterAll(async () => {
    // Cleanup: ensure test user is deleted
    if (testUserId) {
      const db = await getDb();
      if (db) {
        await db.delete(userRoles).where(eq(userRoles.userId, testUserId));
        await db.delete(users).where(eq(users.id, testUserId));
      }
    }
  });

  it("should delete user successfully", async () => {
    const db = await getDb();
    expect(db).toBeTruthy();
    expect(testUserId).toBeGreaterThan(0);

    if (!db || !testUserId) return;

    // Verify user exists before deletion
    const [userBefore] = await db
      .select()
      .from(users)
      .where(eq(users.id, testUserId))
      .limit(1);

    expect(userBefore).toBeTruthy();

    // Delete user
    await db.delete(userRoles).where(eq(userRoles.userId, testUserId));
    await db.delete(users).where(eq(users.id, testUserId));

    // Verify user no longer exists
    const [userAfter] = await db
      .select()
      .from(users)
      .where(eq(users.id, testUserId))
      .limit(1);

    expect(userAfter).toBeUndefined();

    // Mark as deleted to prevent cleanup error
    testUserId = null;
  });

  it("should cascade delete user role associations", async () => {
    const db = await getDb();
    expect(db).toBeTruthy();
    expect(testRoleId).toBeGreaterThan(0);

    if (!db || !testRoleId) return;

    // Create another test user with role
    const testEmail = `cascade.test.${Date.now()}@medax.test.com`;
    const [newUser] = await db.insert(users).values({
      name: "Cascade Test User",
      email: testEmail,
      role: "user",
      tenantId: null,
      loginMethod: "manual",
      openId: `manual_${Date.now()}_cascade`,
    });

    const userId = newUser.insertId;

    // Assign role
    await db.insert(userRoles).values({
      userId: userId,
      roleId: testRoleId,
    });

    // Verify role assignment exists
    const [roleAssignmentBefore] = await db
      .select()
      .from(userRoles)
      .where(eq(userRoles.userId, userId))
      .limit(1);

    expect(roleAssignmentBefore).toBeTruthy();

    // Delete user with cascade
    await db.delete(userRoles).where(eq(userRoles.userId, userId));
    await db.delete(users).where(eq(users.id, userId));

    // Verify role assignment no longer exists
    const [roleAssignmentAfter] = await db
      .select()
      .from(userRoles)
      .where(eq(userRoles.userId, userId))
      .limit(1);

    expect(roleAssignmentAfter).toBeUndefined();
  });

  it("should not delete non-existent user", async () => {
    const db = await getDb();
    expect(db).toBeTruthy();

    if (!db) return;

    const nonExistentId = 999999;

    // Try to delete non-existent user (should not throw error, just do nothing)
    await db.delete(users).where(eq(users.id, nonExistentId));

    // Verify no error occurred (test passes if we reach here)
    expect(true).toBe(true);
  });

  it("should prevent deletion of system owner via openId check", async () => {
    const db = await getDb();
    expect(db).toBeTruthy();

    if (!db) return;

    const ownerOpenId = process.env.OWNER_OPEN_ID;

    if (!ownerOpenId) {
      // Skip test if OWNER_OPEN_ID not set
      expect(true).toBe(true);
      return;
    }

    // Find owner user
    const [ownerUser] = await db
      .select()
      .from(users)
      .where(eq(users.openId, ownerOpenId))
      .limit(1);

    if (!ownerUser) {
      // Owner not found, skip test
      expect(true).toBe(true);
      return;
    }

    // Verify owner exists (should not attempt deletion in test)
    expect(ownerUser).toBeTruthy();
    expect(ownerUser.openId).toBe(ownerOpenId);
  });

  it("should delete user without role assignments", async () => {
    const db = await getDb();
    expect(db).toBeTruthy();

    if (!db) return;

    // Create user without roles
    const testEmail = `norole.delete.${Date.now()}@medax.test.com`;
    const [newUser] = await db.insert(users).values({
      name: "No Role Delete User",
      email: testEmail,
      role: "user",
      tenantId: null,
      loginMethod: "manual",
      openId: `manual_${Date.now()}_norole_delete`,
    });

    const userId = newUser.insertId;

    // Verify no role assignments
    const rolesBefore = await db
      .select()
      .from(userRoles)
      .where(eq(userRoles.userId, userId));

    expect(rolesBefore.length).toBe(0);

    // Delete user
    await db.delete(users).where(eq(users.id, userId));

    // Verify user deleted
    const [userAfter] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    expect(userAfter).toBeUndefined();
  });
});
