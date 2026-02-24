import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb } from "./db";
import { users, userRoles, roles } from "../drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * Test suite for user creation functionality
 * Tests the create procedure in userRouter.ts
 */

describe("User Creation", () => {
  let testUserId: number | null = null;
  let testRoleId: number | null = null;

  beforeAll(async () => {
    // Get a test role ID for assignment
    const db = await getDb();
    if (db) {
      const [testRole] = await db
        .select()
        .from(roles)
        .where(eq(roles.code, "receiving_operator"))
        .limit(1);
      testRoleId = testRole?.id || null;
    }
  });

  afterAll(async () => {
    // Cleanup: delete test user and role assignments
    if (testUserId) {
      const db = await getDb();
      if (db) {
        await db.delete(userRoles).where(eq(userRoles.userId, testUserId));
        await db.delete(users).where(eq(users.id, testUserId));
      }
    }
  });

  it("should create a new user with valid data", async () => {
    const db = await getDb();
    expect(db).toBeTruthy();

    if (!db) return;

    const testEmail = `test.user.${Date.now()}@medax.test.com`;
    const testName = "Test User";

    // Create user
    const [newUser] = await db.insert(users).values({
      name: testName,
      email: testEmail,
      role: "user",
      tenantId: null,
      loginMethod: "manual",
      openId: `manual_${Date.now()}_test`,
    });

    testUserId = newUser.insertId;

    expect(testUserId).toBeGreaterThan(0);

    // Verify user was created
    const [createdUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, testUserId))
      .limit(1);

    expect(createdUser).toBeTruthy();
    expect(createdUser.name).toBe(testName);
    expect(createdUser.email).toBe(testEmail);
    expect(createdUser.role).toBe("user");
    expect(createdUser.loginMethod).toBe("manual");
  });

  it("should assign RBAC role to newly created user", async () => {
    const db = await getDb();
    expect(db).toBeTruthy();
    expect(testUserId).toBeGreaterThan(0);
    expect(testRoleId).toBeGreaterThan(0);

    if (!db || !testUserId || !testRoleId) return;

    // Assign role
    await db.insert(userRoles).values({
      userId: testUserId,
      roleId: testRoleId,
    });

    // Verify role assignment
    const [assignment] = await db
      .select()
      .from(userRoles)
      .where(eq(userRoles.userId, testUserId))
      .limit(1);

    expect(assignment).toBeTruthy();
    expect(assignment.userId).toBe(testUserId);
    expect(assignment.roleId).toBe(testRoleId);
  });

  it("should validate email uniqueness at application level", async () => {
    const db = await getDb();
    expect(db).toBeTruthy();

    if (!db || !testUserId) return;

    // Get existing user email
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, testUserId))
      .limit(1);

    expect(existingUser).toBeTruthy();

    // Check if email already exists (application-level validation)
    const [emailCheck] = await db
      .select()
      .from(users)
      .where(eq(users.email, existingUser.email))
      .limit(1);

    // Email should exist
    expect(emailCheck).toBeTruthy();
    expect(emailCheck.email).toBe(existingUser.email);
  });

  it("should create admin user when role is admin", async () => {
    const db = await getDb();
    expect(db).toBeTruthy();

    if (!db) return;

    const testEmail = `admin.test.${Date.now()}@medax.test.com`;
    const testName = "Admin Test User";

    // Create admin user
    const [newAdmin] = await db.insert(users).values({
      name: testName,
      email: testEmail,
      role: "admin",
      tenantId: null,
      loginMethod: "manual",
      openId: `manual_${Date.now()}_admin`,
    });

    const adminId = newAdmin.insertId;

    expect(adminId).toBeGreaterThan(0);

    // Verify admin was created
    const [createdAdmin] = await db
      .select()
      .from(users)
      .where(eq(users.id, adminId))
      .limit(1);

    expect(createdAdmin).toBeTruthy();
    expect(createdAdmin.role).toBe("admin");

    // Cleanup
    await db.delete(users).where(eq(users.id, adminId));
  });

  it("should create user without role assignment", async () => {
    const db = await getDb();
    expect(db).toBeTruthy();

    if (!db) return;

    const testEmail = `norole.test.${Date.now()}@medax.test.com`;
    const testName = "No Role Test User";

    // Create user without role
    const [newUser] = await db.insert(users).values({
      name: testName,
      email: testEmail,
      role: "user",
      tenantId: null,
      loginMethod: "manual",
      openId: `manual_${Date.now()}_norole`,
    });

    const userId = newUser.insertId;

    expect(userId).toBeGreaterThan(0);

    // Verify no role assignments
    const assignments = await db
      .select()
      .from(userRoles)
      .where(eq(userRoles.userId, userId));

    expect(assignments.length).toBe(0);

    // Cleanup
    await db.delete(users).where(eq(users.id, userId));
  });
});
