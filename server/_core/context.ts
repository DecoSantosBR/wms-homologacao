import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  // Desabilitar autenticação durante testes E2E
  if (process.env.E2E_TESTING === 'true') {
    // Criar usuário mock para testes
    user = {
      id: 1,
      openId: 'e2e-test-user',
      name: 'E2E Test User',
      role: 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as User;
  } else {
    try {
      user = await sdk.authenticateRequest(opts.req);
    } catch (error) {
      // Authentication is optional for public procedures.
      user = null;
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
