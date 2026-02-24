import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import { getDb } from "./db";
import { users, tenants } from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe("User Management", () => {
  let testUserId: number;
  let testTenantId: number;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Criar tenant de teste
    const [tenant] = await db
      .insert(tenants)
      .values({
        name: "Test Tenant User",
        cnpj: `99999999999${Date.now().toString().slice(-3)}`,
        status: "active",
      })
      .$returningId();

    testTenantId = tenant.id;

    // Criar usuário de teste
    const [user] = await db
      .insert(users)
      .values({
        openId: `test-user-${Date.now()}`,
        name: "Test User",
        email: "test@example.com",
        loginMethod: "email",
        role: "user",
        tenantId: testTenantId,
      })
      .$returningId();

    testUserId = user.id;
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;

    // Limpar dados de teste
    await db.delete(users).where(eq(users.id, testUserId));
    await db.delete(tenants).where(eq(tenants.id, testTenantId));
  });

  describe("list", () => {
    it("deve listar todos os usuários para admin", async () => {
      const ctx = {
        user: {
          id: 1,
          openId: "admin-test",
          name: "Admin",
          email: "admin@test.com",
          role: "admin" as const,
          tenantId: null,
          loginMethod: "email",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        },
        req: {} as any,
        res: {} as any,
      };

      const caller = appRouter.createCaller(ctx);
      const result = await caller.users.list({});

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it("deve filtrar usuários por nome", async () => {
      const ctx = {
        user: {
          id: 1,
          openId: "admin-test",
          name: "Admin",
          email: "admin@test.com",
          role: "admin" as const,
          tenantId: null,
          loginMethod: "email",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        },
        req: {} as any,
        res: {} as any,
      };

      const caller = appRouter.createCaller(ctx);
      const result = await caller.users.list({ search: "Test User" });

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].name).toContain("Test");
    });

    it("deve filtrar usuários por role", async () => {
      const ctx = {
        user: {
          id: 1,
          openId: "admin-test",
          name: "Admin",
          email: "admin@test.com",
          role: "admin" as const,
          tenantId: null,
          loginMethod: "email",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        },
        req: {} as any,
        res: {} as any,
      };

      const caller = appRouter.createCaller(ctx);
      const result = await caller.users.list({ role: "admin" });

      expect(result).toBeDefined();
      expect(result.every((u) => u.role === "admin")).toBe(true);
    });

    it("deve rejeitar acesso de usuário comum", async () => {
      const ctx = {
        user: {
          id: testUserId,
          openId: "test-user",
          name: "Test User",
          email: "test@example.com",
          role: "user" as const,
          tenantId: testTenantId,
          loginMethod: "email",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        },
        req: {} as any,
        res: {} as any,
      };

      const caller = appRouter.createCaller(ctx);

      await expect(caller.users.list({})).rejects.toThrow("Apenas administradores");
    });
  });

  describe("getById", () => {
    it("deve buscar usuário por ID", async () => {
      const ctx = {
        user: {
          id: 1,
          openId: "admin-test",
          name: "Admin",
          email: "admin@test.com",
          role: "admin" as const,
          tenantId: null,
          loginMethod: "email",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        },
        req: {} as any,
        res: {} as any,
      };

      const caller = appRouter.createCaller(ctx);
      const result = await caller.users.getById({ id: testUserId });

      expect(result).toBeDefined();
      expect(result?.id).toBe(testUserId);
      expect(result?.name).toBe("Test User");
    });

    it("deve lançar erro para usuário inexistente", async () => {
      const ctx = {
        user: {
          id: 1,
          openId: "admin-test",
          name: "Admin",
          email: "admin@test.com",
          role: "admin" as const,
          tenantId: null,
          loginMethod: "email",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        },
        req: {} as any,
        res: {} as any,
      };

      const caller = appRouter.createCaller(ctx);
      await expect(caller.users.getById({ id: 999999 })).rejects.toThrow("Usuário não encontrado");
    });
  });

  describe("update", () => {
    it("deve atualizar informações do usuário", async () => {
      const ctx = {
        user: {
          id: 1,
          openId: "admin-test",
          name: "Admin",
          email: "admin@test.com",
          role: "admin" as const,
          tenantId: null,
          loginMethod: "email",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        },
        req: {} as any,
        res: {} as any,
      };

      const caller = appRouter.createCaller(ctx);
      const result = await caller.users.update({
        id: testUserId,
        name: "Updated Test User",
        email: "updated@example.com",
      });

      expect(result.success).toBe(true);

      // Verificar atualização
      const updated = await caller.users.getById({ id: testUserId });
      expect(updated?.name).toBe("Updated Test User");
      expect(updated?.email).toBe("updated@example.com");
    });

    it("deve permitir alterar role do usuário", async () => {
      const ctx = {
        user: {
          id: 1,
          openId: "admin-test",
          name: "Admin",
          email: "admin@test.com",
          role: "admin" as const,
          tenantId: null,
          loginMethod: "email",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        },
        req: {} as any,
        res: {} as any,
      };

      const caller = appRouter.createCaller(ctx);
      await caller.users.update({
        id: testUserId,
        role: "admin",
      });

      const updated = await caller.users.getById({ id: testUserId });
      expect(updated?.role).toBe("admin");

      // Reverter para user
      await caller.users.update({
        id: testUserId,
        role: "user",
      });
    });

    it("deve impedir admin de remover próprio privilégio", async () => {
      const ctx = {
        user: {
          id: 1,
          openId: "admin-test",
          name: "Admin",
          email: "admin@test.com",
          role: "admin" as const,
          tenantId: null,
          loginMethod: "email",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        },
        req: {} as any,
        res: {} as any,
      };

      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.users.update({
          id: 1,
          role: "user",
        })
      ).rejects.toThrow("não pode remover seu próprio privilégio");
    });

    it("deve rejeitar atualização por usuário comum", async () => {
      const ctx = {
        user: {
          id: testUserId,
          openId: "test-user",
          name: "Test User",
          email: "test@example.com",
          role: "user" as const,
          tenantId: testTenantId,
          loginMethod: "email",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        },
        req: {} as any,
        res: {} as any,
      };

      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.users.update({
          id: testUserId,
          name: "Hacked",
        })
      ).rejects.toThrow("Apenas administradores");
    });
  });

  describe("stats", () => {
    it("deve retornar estatísticas de usuários", async () => {
      const ctx = {
        user: {
          id: 1,
          openId: "admin-test",
          name: "Admin",
          email: "admin@test.com",
          role: "admin" as const,
          tenantId: null,
          loginMethod: "email",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        },
        req: {} as any,
        res: {} as any,
      };

      const caller = appRouter.createCaller(ctx);
      const result = await caller.users.stats();

      expect(result).toBeDefined();
      expect(result.totalUsers).toBeGreaterThan(0);
      expect(result.adminCount).toBeGreaterThan(0);
      expect(result.userCount).toBeGreaterThan(0);
      expect(result.usersWithTenant).toBeGreaterThan(0);
      expect(result.usersWithoutTenant).toBeGreaterThanOrEqual(0);
      expect(
        result.totalUsers ===
          result.adminCount + result.userCount
      ).toBe(true);
    });
  });
});
