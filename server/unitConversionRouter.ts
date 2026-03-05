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
  tenants,
  auditLogs,
} from "../drizzle/schema";
import { eq, and, desc, asc, or, like, sql, ne, inArray } from "drizzle-orm";

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

  // Carregar aliases e conversões do tenant + fallback para Tenant 1 (Global)
  // Tenant 1 atua como repositório global; suas regras são herdadas por todos os tenants
  // mas podem ser sobrescritas por regras específicas do tenant.
  const tenantIds = tenantId === 1 ? [1] : [1, tenantId];

  const [aliases, conversions] = await Promise.all([
    db.select().from(unitAliases).where(inArray(unitAliases.tenantId, tenantIds)),
    db.select().from(productConversions).where(inArray(productConversions.tenantId, tenantIds)),
  ]);

  const aliasMap = new Map<string, string>();
  // Carregar aliases globais (Tenant 1) primeiro, depois sobrescrever com os do tenant específico
  for (const a of aliases.sort((x) => (x.tenantId === 1 ? -1 : 1))) {
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
  // Carregar conversões globais (Tenant 1) primeiro, depois sobrescrever com as do tenant específico
  // Isso garante que regras específicas do tenant sempre prevaleçam sobre as globais.
  for (const c of conversions.sort((a, b) => (a.tenantId === 1 ? -1 : 1) - (b.tenantId === 1 ? -1 : 1))) {
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
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const userTenantId = (ctx.user as any).tenantId as number;
      // Verificar que o alias pertence ao tenant do usuário (ou Global Admin pode deletar qualquer um)
      const [existing] = await db.select({ tenantId: unitAliases.tenantId })
        .from(unitAliases).where(eq(unitAliases.id, input.id)).limit(1);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Alias não encontrado." });
      if (userTenantId !== 1 && existing.tenantId !== userTenantId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado: este alias pertence a outro tenant." });
      }
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

       // ----------------------------------------------------------------
      // Buscar outros tenants que possuem o mesmo SKU (apenas Global Admin)
      // SEGURANÇA: Retornar apenas tenantName e impacto previsto.
      // IDs internos (tenantId, productId) NUNCA são expostos ao frontend.
      // ----------------------------------------------------------------
      let crossTenantSuggestions: Array<{
        tenantName: string;     // Nome do tenant (seguro para exibir)
        activeSKUs: number;     // Qtd de SKUs ativos afetados (impacto previsto)
        alreadyHasFactor: boolean; // Se já possui o mesmo fator cadastrado
      }> = [];

      if ((ctx.user as any).tenantId === 1) {
        // Buscar SKU do produto salvo
        const [savedProduct] = await db
          .select({ sku: products.sku })
          .from(products)
          .where(eq(products.id, input.productId))
          .limit(1);

        if (savedProduct?.sku) {
          // Produtos com mesmo SKU em outros tenants (excluindo Tenant 1)
          const otherProducts = await db
            .select({
              productId: products.id,
              productTenantId: products.tenantId,
              tenantName: tenants.name,
            })
            .from(products)
            .innerJoin(tenants, eq(products.tenantId, tenants.id))
            .where(
              and(
                eq(products.sku, savedProduct.sku),
                ne(products.tenantId, tenantId),
                ne(products.tenantId, 1), // Excluir o próprio Tenant 1
                eq(products.status, "active")
              )
            );

          // Agrupar por tenant e calcular impacto previsto
          const tenantMap = new Map<number, { tenantName: string; productIds: number[] }>();
          for (const op of otherProducts) {
            const tid = op.productTenantId!;
            if (!tenantMap.has(tid)) {
              tenantMap.set(tid, { tenantName: op.tenantName, productIds: [] });
            }
            tenantMap.get(tid)!.productIds.push(op.productId);
          }

          for (const [tid, info] of Array.from(tenantMap.entries())) {
            // Verificar se já possui o mesmo fator
            const existingFactors = await db
              .select({ id: productConversions.id })
              .from(productConversions)
              .where(
                and(
                  eq(productConversions.tenantId, tid),
                  inArray(productConversions.productId, info.productIds),
                  eq(productConversions.unitCode, input.unitCode.toUpperCase().trim())
                )
              );

            crossTenantSuggestions.push({
              tenantName: info.tenantName,
              activeSKUs: info.productIds.length,
              alreadyHasFactor: existingFactors.length === info.productIds.length,
            });
          }
        }
      }

      return { success: true, crossTenantSuggestions };
    }),

  /**
   * Replica um fator de conversão para outros tenants (apenas Global Admin)
   * SEGURANÇA: Aceita tenantNames (não IDs) para evitar enumeração de IDs internos.
   * O backend resolve os IDs a partir dos nomes.
   */
  replicateConversion: protectedProcedure
    .input(z.object({
      sourceProductId: z.number(),
      unitCode: z.string(),
      factorToBase: z.number().positive(),
      roundingStrategy: z.enum(["floor", "ceil", "round"]).default("round"),
      notes: z.string().optional(),
      targetTenantNames: z.array(z.string()), // Nomes em vez de IDs (mais seguro)
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Apenas Global Admin
      if ((ctx.user as any).tenantId !== 1) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Apenas o Global Admin pode replicar conversões." });
      }

      // Resolver IDs a partir dos nomes (o frontend nunca envia IDs)
      const targetTenantRows = await db
        .select({ id: tenants.id, name: tenants.name })
        .from(tenants)
        .where(inArray(tenants.name, input.targetTenantNames));
      const targetTenantIds = targetTenantRows.map((t) => t.id);

      // Buscar SKU do produto fonte
      const [sourceProduct] = await db
        .select({ sku: products.sku })
        .from(products)
        .where(eq(products.id, input.sourceProductId))
        .limit(1);

      if (!sourceProduct?.sku) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Produto fonte não encontrado." });
      }

      const unitCodeNorm = input.unitCode.toUpperCase().trim();
      const replicated: number[] = [];

      for (const targetTenantId of targetTenantIds) {
        // Buscar produto com mesmo SKU no tenant alvo
        const [targetProduct] = await db
          .select({ id: products.id })
          .from(products)
          .where(
            and(
              eq(products.sku, sourceProduct.sku),
              eq(products.tenantId, targetTenantId),
              eq(products.status, "active")
            )
          )
          .limit(1);

        if (!targetProduct) continue;

        // Upsert do fator no tenant alvo
        const existing = await db
          .select({ id: productConversions.id })
          .from(productConversions)
          .where(
            and(
              eq(productConversions.tenantId, targetTenantId),
              eq(productConversions.productId, targetProduct.id),
              eq(productConversions.unitCode, unitCodeNorm)
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
            tenantId: targetTenantId,
            productId: targetProduct.id,
            unitCode: unitCodeNorm,
            factorToBase: String(input.factorToBase),
            roundingStrategy: input.roundingStrategy,
            notes: input.notes ?? null,
          });
        }
        replicated.push(targetTenantId);
      }

      // Registrar no audit_log
      if (replicated.length > 0) {
        await db.insert(auditLogs).values({
          tenantId: 1,
          userId: (ctx.user as any).id,
          action: "replicate_unit_conversion",
          entityType: "product_conversions",
          entityId: input.sourceProductId,
          newValue: JSON.stringify({
            sku: sourceProduct.sku,
            unitCode: unitCodeNorm,
            factorToBase: input.factorToBase,
            roundingStrategy: input.roundingStrategy,
            replicatedToTenants: replicated,
          }),
        });
      }

      return { success: true, replicatedCount: replicated.length, replicatedTenants: replicated };
    }),

  deleteConversion: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const userTenantId = (ctx.user as any).tenantId as number;
      // Verificar que a conversão pertence ao tenant do usuário (ou Global Admin pode deletar qualquer uma)
      const [existing] = await db.select({ tenantId: productConversions.tenantId })
        .from(productConversions).where(eq(productConversions.id, input.id)).limit(1);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Conversão não encontrada." });
      if (userTenantId !== 1 && existing.tenantId !== userTenantId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado: esta conversão pertence a outro tenant." });
      }
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

  /**
   * Busca produtos por SKU ou descrição (autocomplete)
   */
  searchProducts: protectedProcedure
    .input(z.object({
      tenantId: z.number(),
      query: z.string().min(1).max(100),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const term = `%${input.query}%`;
      const rows = await db
        .select({
          id: products.id,
          sku: products.sku,
          description: products.description,
          unitOfMeasure: products.unitOfMeasure,
          gtin: products.gtin,
        })
        .from(products)
        .where(
          and(
            eq(products.tenantId, input.tenantId),
            eq(products.status, "active"),
            or(
              like(products.sku, term),
              like(products.description, term),
              like(products.gtin, term)
            )
          )
        )
        .orderBy(asc(products.sku))
        .limit(20);

      return rows;
    }),
});
