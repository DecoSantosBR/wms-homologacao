/**
 * unitConversionRouter.ts
 *
 * Motor de Conversão Dinâmico de Unidades de Medida
 * Gerencia: packagingLevels, unitAliases, productConversions, unitPendingQueue
 *
 * Registrar em server/routers.ts:
 *   import { unitConversionRouter } from "./unitConversionRouter";
 *   // dentro do appRouter:
 *   unitConversion: unitConversionRouter,
 */

import { router, protectedProcedure, TRPCError } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import {
  packagingLevels,
  unitAliases,
  productConversions,
  unitPendingQueue,
  products,
} from "../drizzle/schema";
import { eq, and, desc, asc } from "drizzle-orm";

// ============================================================================
// HELPERS DO MOTOR DE CONVERSÃO
// ============================================================================

/**
 * Carrega em memória todos os aliases e fatores de conversão de um tenant.
 * Bulk Load O(1) para uso no nfeParser.
 */
export async function loadConversionContext(tenantId: number): Promise<{
  aliasMap: Map<string, string>; // alias.toUpperCase() → targetCode
  conversionMap: Map<string, number>; // `${productId}:${unitCode}` → factorToBase
  roundingMap: Map<string, "floor" | "ceil" | "round">; // `${productId}:${unitCode}` → strategy
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [aliases, conversions] = await Promise.all([
    db.select().from(unitAliases).where(eq(unitAliases.tenantId, tenantId)),
    db.select().from(productConversions).where(eq(productConversions.tenantId, tenantId)),
  ]);

  const aliasMap = new Map<string, string>();
  for (const a of aliases) {
    aliasMap.set(a.alias.toUpperCase().trim(), a.targetCode);
  }

  // Aliases padrão do sistema (fallback se não houver mapeamento do tenant)
  const defaultAliases: Record<string, string> = {
    "UN": "UN", "UNID": "UN", "UND": "UN", "UNIDADE": "UN",
    "PC": "UN", "PÇ": "UN", "PCS": "UN", "PECA": "UN", "PEÇA": "UN",
    "PCT": "PCT", "PACOTE": "PCT", "PAC": "PCT",
    "CX": "CX", "CXA": "CX", "CAIXA": "CX", "BOX": "CX",
    "FD": "FD", "FARDO": "FD",
    "PL": "PL", "PLT": "PL", "PALLET": "PL", "PALETE": "PL",
  };
  for (const [alias, code] of Object.entries(defaultAliases)) {
    if (!aliasMap.has(alias)) {
      aliasMap.set(alias, code);
    }
  }

  const conversionMap = new Map<string, number>();
  const roundingMap = new Map<string, "floor" | "ceil" | "round">();
  for (const c of conversions) {
    const key = `${c.productId}:${c.unitCode}`;
    conversionMap.set(key, parseFloat(String(c.factorToBase)));
    roundingMap.set(key, c.roundingStrategy);
  }

  return { aliasMap, conversionMap, roundingMap };
}

/**
 * Resolve a unidade do XML para o código normalizado.
 * Prioridade: uTrib > uCom. Se genérico, usa uCom.
 */
export function resolveUnit(
  uTrib: string | null | undefined,
  uCom: string,
  aliasMap: Map<string, string>
): { resolvedCode: string; source: "uTrib" | "uCom" } {
  const genericUnits = new Set(["UN", "UNID", "UND", "PC", "PÇ", "PCS"]);

  if (uTrib && uTrib.trim()) {
    const normalized = uTrib.toUpperCase().trim();
    const mapped = aliasMap.get(normalized);
    if (mapped && !genericUnits.has(mapped)) {
      return { resolvedCode: mapped, source: "uTrib" };
    }
  }

  const normalized = uCom.toUpperCase().trim();
  const mapped = aliasMap.get(normalized) ?? normalized;
  return { resolvedCode: mapped, source: "uCom" };
}

/**
 * Aplica o fator de conversão e a estratégia de arredondamento.
 * Trata erros de arredondamento de fornecedor (ex: 0.9999 → 1).
 */
export function applyConversion(
  qty: number,
  factor: number,
  strategy: "floor" | "ceil" | "round"
): number {
  const raw = qty * factor;
  // Tolerância para erros de arredondamento de fornecedor (ex: 11.9999 → 12)
  const tolerance = 0.001;
  const rounded = Math.round(raw);
  if (Math.abs(raw - rounded) < tolerance) return rounded;

  switch (strategy) {
    case "floor": return Math.floor(raw);
    case "ceil": return Math.ceil(raw);
    case "round": return Math.round(raw);
    default: return Math.round(raw);
  }
}

// ============================================================================
// ROUTER
// ============================================================================

export const unitConversionRouter = router({

  // --------------------------------------------------------------------------
  // PACKAGING LEVELS (leitura global)
  // --------------------------------------------------------------------------
  getPackagingLevels: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    return db.select().from(packagingLevels).orderBy(asc(packagingLevels.rank));
  }),

  // --------------------------------------------------------------------------
  // UNIT ALIASES (por tenant)
  // --------------------------------------------------------------------------
  listAliases: protectedProcedure
    .input(z.object({ tenantId: z.number().optional() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const tenantId = input.tenantId ?? (ctx.user as any).tenantId ?? 1;
      return db
        .select()
        .from(unitAliases)
        .where(eq(unitAliases.tenantId, tenantId))
        .orderBy(asc(unitAliases.alias));
    }),

  createAlias: protectedProcedure
    .input(z.object({
      tenantId: z.number().optional(),
      alias: z.string().min(1).max(50),
      targetCode: z.string().min(1).max(20),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const tenantId = input.tenantId ?? (ctx.user as any).tenantId ?? 1;
      await db.insert(unitAliases).values({
        tenantId,
        alias: input.alias.toUpperCase().trim(),
        targetCode: input.targetCode.toUpperCase().trim(),
      });
      return { success: true };
    }),

  updateAlias: protectedProcedure
    .input(z.object({
      id: z.number(),
      alias: z.string().min(1).max(50),
      targetCode: z.string().min(1).max(20),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      await db.update(unitAliases)
        .set({
          alias: input.alias.toUpperCase().trim(),
          targetCode: input.targetCode.toUpperCase().trim(),
        })
        .where(eq(unitAliases.id, input.id));
      return { success: true };
    }),

  deleteAlias: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      await db.delete(unitAliases).where(eq(unitAliases.id, input.id));
      return { success: true };
    }),

  // --------------------------------------------------------------------------
  // PRODUCT CONVERSIONS (por tenant + produto)
  // --------------------------------------------------------------------------
  listConversions: protectedProcedure
    .input(z.object({
      tenantId: z.number().optional(),
      productId: z.number().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const tenantId = input.tenantId ?? (ctx.user as any).tenantId ?? 1;

      const query = db
        .select({
          id: productConversions.id,
          tenantId: productConversions.tenantId,
          productId: productConversions.productId,
          unitCode: productConversions.unitCode,
          factorToBase: productConversions.factorToBase,
          roundingStrategy: productConversions.roundingStrategy,
          notes: productConversions.notes,
          createdAt: productConversions.createdAt,
          updatedAt: productConversions.updatedAt,
          productSku: products.sku,
          productDescription: products.description,
        })
        .from(productConversions)
        .leftJoin(products, eq(productConversions.productId, products.id))
        .where(
          input.productId
            ? and(
                eq(productConversions.tenantId, tenantId),
                eq(productConversions.productId, input.productId)
              )
            : eq(productConversions.tenantId, tenantId)
        )
        .orderBy(asc(productConversions.productId), asc(productConversions.unitCode));

      return query;
    }),

  upsertConversion: protectedProcedure
    .input(z.object({
      tenantId: z.number().optional(),
      productId: z.number(),
      unitCode: z.string().min(1).max(20),
      factorToBase: z.number().positive(),
      roundingStrategy: z.enum(["floor", "ceil", "round"]).default("round"),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const tenantId = input.tenantId ?? (ctx.user as any).tenantId ?? 1;

      // Verificar se produto pertence ao tenant
      const [product] = await db
        .select({ id: products.id })
        .from(products)
        .where(and(eq(products.id, input.productId), eq(products.tenantId, tenantId)))
        .limit(1);

      if (!product) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Produto não encontrado para este tenant." });
      }

      // Upsert: inserir ou atualizar
      const existing = await db
        .select({ id: productConversions.id })
        .from(productConversions)
        .where(
          and(
            eq(productConversions.tenantId, tenantId),
            eq(productConversions.productId, input.productId),
            eq(productConversions.unitCode, input.unitCode.toUpperCase().trim())
          )
        )
        .limit(1);

      if (existing.length > 0) {
        await db.update(productConversions)
          .set({
            factorToBase: String(input.factorToBase),
            roundingStrategy: input.roundingStrategy,
            notes: input.notes ?? null,
          })
          .where(eq(productConversions.id, existing[0].id));
      } else {
        await db.insert(productConversions).values({
          tenantId,
          productId: input.productId,
          unitCode: input.unitCode.toUpperCase().trim(),
          factorToBase: String(input.factorToBase),
          roundingStrategy: input.roundingStrategy,
          notes: input.notes ?? null,
        });
      }

      return { success: true };
    }),

  deleteConversion: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      await db.delete(productConversions).where(eq(productConversions.id, input.id));
      return { success: true };
    }),

  // --------------------------------------------------------------------------
  // FILA DE PENDÊNCIAS
  // --------------------------------------------------------------------------
  listPendingQueue: protectedProcedure
    .input(z.object({
      tenantId: z.number().optional(),
      status: z.enum(["pending", "resolved", "ignored"]).optional(),
    }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const tenantId = input.tenantId ?? (ctx.user as any).tenantId ?? 1;

      return db
        .select()
        .from(unitPendingQueue)
        .where(
          input.status
            ? and(
                eq(unitPendingQueue.tenantId, tenantId),
                eq(unitPendingQueue.status, input.status)
              )
            : eq(unitPendingQueue.tenantId, tenantId)
        )
        .orderBy(desc(unitPendingQueue.createdAt));
    }),

  resolvePending: protectedProcedure
    .input(z.object({
      id: z.number(),
      action: z.enum(["resolved", "ignored"]),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      await db.update(unitPendingQueue)
        .set({
          status: input.action,
          resolvedBy: ctx.user?.id ?? null,
          resolvedAt: new Date(),
        })
        .where(eq(unitPendingQueue.id, input.id));
      return { success: true };
    }),

  // --------------------------------------------------------------------------
  // PREVIEW DE CONVERSÃO (para teste/validação)
  // --------------------------------------------------------------------------
  previewConversion: protectedProcedure
    .input(z.object({
      tenantId: z.number().optional(),
      productId: z.number(),
      xmlUnit: z.string(),
      xmlQty: z.number().positive(),
      uTrib: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const tenantId = input.tenantId ?? (ctx.user as any).tenantId ?? 1;
      const { aliasMap, conversionMap, roundingMap } = await loadConversionContext(tenantId);

      const { resolvedCode, source } = resolveUnit(input.uTrib, input.xmlUnit, aliasMap);

      // Se unidade base (UN), fator = 1
      if (resolvedCode === "UN") {
        return {
          originalUnit: input.xmlUnit,
          originalQty: input.xmlQty,
          resolvedUnit: "UN",
          conversionSource: source,
          factorToBase: 1,
          convertedQty: input.xmlQty,
          roundingStrategy: "none" as const,
          hasConversion: false,
          message: `${input.xmlQty} ${input.xmlUnit} → ${input.xmlQty} UN (sem conversão necessária)`,
        };
      }

      const key = `${input.productId}:${resolvedCode}`;
      const factor = conversionMap.get(key);
      const strategy = roundingMap.get(key) ?? "round";

      if (!factor) {
        return {
          originalUnit: input.xmlUnit,
          originalQty: input.xmlQty,
          resolvedUnit: resolvedCode,
          conversionSource: source,
          factorToBase: null,
          convertedQty: null,
          roundingStrategy: strategy,
          hasConversion: false,
          message: `⚠️ Fator de conversão não cadastrado para ${resolvedCode} neste produto.`,
        };
      }

      const convertedQty = applyConversion(input.xmlQty, factor, strategy);

      return {
        originalUnit: input.xmlUnit,
        originalQty: input.xmlQty,
        resolvedUnit: resolvedCode,
        conversionSource: source,
        factorToBase: factor,
        convertedQty,
        roundingStrategy: strategy,
        hasConversion: true,
        message: `${input.xmlQty} ${resolvedCode} × ${factor} = ${convertedQty} UN (${strategy})`,
      };
    }),
});
