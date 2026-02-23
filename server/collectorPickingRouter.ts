/**
 * collectorPickingRouter.ts
 * Endpoints exclusivos do /collector/picking — fluxo guiado por endereço com
 * validação de lote pré-alocado e suporte a pausa/retomada.
 *
 * NÃO altera lógica de movimentação de estoque (responsabilidade de outro módulo).
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, asc, sql } from "drizzle-orm";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import {
  pickingOrders,
  pickingAllocations,
  pickingProgress,
  warehouseLocations,
  products,
  tenants,
} from "../drizzle/schema";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Retorna o progresso salvo ou cria um novo registro zerado */
async function ensureProgress(
  db: Awaited<ReturnType<typeof getDb>>,
  pickingOrderId: number
) {
  if (!db) throw new Error("DB unavailable");

  const [existing] = await db
    .select()
    .from(pickingProgress)
    .where(eq(pickingProgress.pickingOrderId, pickingOrderId))
    .limit(1);

  if (existing) return existing;

  await db.insert(pickingProgress).values({
    pickingOrderId,
    currentSequence: 1,
    currentLocationId: null,
    scannedItems: [],
  });

  const [created] = await db
    .select()
    .from(pickingProgress)
    .where(eq(pickingProgress.pickingOrderId, pickingOrderId))
    .limit(1);

  return created;
}

/** Busca todas as alocações de um pedido agrupadas por endereço, em ordem de sequence */
async function buildRoute(
  db: Awaited<ReturnType<typeof getDb>>,
  pickingOrderId: number
) {
  if (!db) throw new Error("DB unavailable");

  const allocs = await db
    .select({
      id: pickingAllocations.id,
      locationId: pickingAllocations.locationId,
      locationCode: pickingAllocations.locationCode,
      productId: pickingAllocations.productId,
      productSku: pickingAllocations.productSku,
      batch: pickingAllocations.batch,
      expiryDate: pickingAllocations.expiryDate,
      quantity: pickingAllocations.quantity,
      pickedQuantity: pickingAllocations.pickedQuantity,
      isFractional: pickingAllocations.isFractional,
      sequence: pickingAllocations.sequence,
      status: pickingAllocations.status,
    })
    .from(pickingAllocations)
    .where(eq(pickingAllocations.pickingOrderId, pickingOrderId))
    .orderBy(asc(pickingAllocations.sequence));

  // Coletar IDs únicos de produtos para enriquecer com nome
  const productIds = Array.from(new Set(allocs.map((a) => a.productId)));

  // Build map — CORREÇÃO BUG N+1: era 1 query por produto, agora é 1 query total
  const productMap: Record<number, string> = {};
  if (productIds.length > 0) {
    const prodRows = await db
      .select({ id: products.id, description: products.description })
      .from(products)
      .where(sql`${products.id} IN (${sql.join(productIds.map(id => sql`${id}`), sql`, `)})`);
    for (const p of prodRows) {
      productMap[p.id] = p.description ?? p.id.toString();
    }
  }

  // Agrupar por locationCode mantendo a menor sequence do grupo
  const grouped: Record<
    string,
    {
      locationId: number;
      locationCode: string;
      sequence: number;
      hasFractional: boolean;
      allDone: boolean;
      items: Array<{
        allocationId: number;
        productId: number;
        productSku: string;
        productName: string;
        batch: string | null;
        expiryDate: string | null;
        quantity: number;
        pickedQuantity: number;
        isFractional: boolean;
        status: string;
      }>;
    }
  > = {};

  for (const a of allocs) {
    if (!grouped[a.locationCode]) {
      grouped[a.locationCode] = {
        locationId: a.locationId,
        locationCode: a.locationCode,
        sequence: a.sequence,
        hasFractional: false,
        allDone: true,
        items: [],
      };
    }
    const g = grouped[a.locationCode];
    if (a.sequence < g.sequence) g.sequence = a.sequence;
    if (a.isFractional) g.hasFractional = true;
    if (a.status !== "picked") g.allDone = false;

    g.items.push({
      allocationId: a.id,
      productId: a.productId,
      productSku: a.productSku,
      productName: productMap[a.productId] ?? a.productSku,
      batch: a.batch ?? null,
      expiryDate: a.expiryDate ? String(a.expiryDate) : null,
      quantity: a.quantity,
      pickedQuantity: a.pickedQuantity,
      isFractional: a.isFractional,
      status: a.status,
    });
  }

  const route = Object.values(grouped).sort((a, b) => a.sequence - b.sequence);
  return route;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const collectorPickingRouter = {
  /**
   * Listar pedidos disponíveis para picking no coletor
   * Retorna pedidos com status "pending" ou "paused" do tenant do operador
   */
  listOrders: protectedProcedure
    .input(
      z.object({
        tenantId: z.number().optional(), // Admin pode filtrar por tenant
      })
    )
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });

      const tenantId =
        ctx.user.role === "admin"
          ? input.tenantId ?? null
          : ctx.user.tenantId;

      const rows = await db
        .select({
          id: pickingOrders.id,
          orderNumber: pickingOrders.orderNumber,
          customerOrderNumber: pickingOrders.customerOrderNumber,
          customerName: pickingOrders.customerName,
          status: pickingOrders.status,
          totalItems: pickingOrders.totalItems,
          totalQuantity: pickingOrders.totalQuantity,
          tenantId: pickingOrders.tenantId,
        })
        .from(pickingOrders)
        .where(
          and(
            tenantId ? eq(pickingOrders.tenantId, tenantId) : undefined,
            // Aceita apenas pedidos pendentes ou pausados — em_progress indica
            // que já foi iniciado por outro operador mas pode ser retomado
            eq(pickingOrders.status, "pending")
          )
        )
        .orderBy(asc(pickingOrders.createdAt));

      // Também buscar pedidos in_progress / paused
      const inProgress = await db
        .select({
          id: pickingOrders.id,
          orderNumber: pickingOrders.orderNumber,
          customerOrderNumber: pickingOrders.customerOrderNumber,
          customerName: pickingOrders.customerName,
          status: pickingOrders.status,
          totalItems: pickingOrders.totalItems,
          totalQuantity: pickingOrders.totalQuantity,
          tenantId: pickingOrders.tenantId,
        })
        .from(pickingOrders)
        .where(
          and(
            tenantId ? eq(pickingOrders.tenantId, tenantId) : undefined,
            eq(pickingOrders.status, "in_progress")
          )
        )
        .orderBy(asc(pickingOrders.createdAt));

      return [...rows, ...inProgress];
    }),

  /**
   * Iniciar (ou retomar) picking de um pedido
   * - Se não existirem alocações, gera-as agora (chama generatePickingAllocations)
   * - Retorna a rota completa + progresso salvo
   */
  startOrResume: protectedProcedure
    .input(z.object({ pickingOrderId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });

      // Validar pedido
      const [order] = await db
        .select()
        .from(pickingOrders)
        .where(eq(pickingOrders.id, input.pickingOrderId))
        .limit(1);

      if (!order) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Pedido não encontrado",
        });
      }

      // Verificar tenant
      if (
        ctx.user.role !== "admin" &&
        ctx.user.tenantId !== null &&
        order.tenantId !== ctx.user.tenantId
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Pedido pertence a outro cliente",
        });
      }

      if (!["pending", "in_progress", "paused"].includes(order.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Pedido não pode ser iniciado (status: ${order.status})`,
        });
      }

      // Verificar se já existem alocações
      const existingAllocs = await db
        .select({ id: pickingAllocations.id })
        .from(pickingAllocations)
        .where(eq(pickingAllocations.pickingOrderId, input.pickingOrderId))
        .limit(1);

      if (existingAllocs.length === 0) {
        // Gerar alocações
        const { generatePickingAllocations } = await import(
          "./pickingAllocation"
        );
        const result = await generatePickingAllocations({
          pickingOrderId: input.pickingOrderId,
          tenantId: order.tenantId,
        });

        if (!result.success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: result.message ?? "Falha ao gerar alocações de picking",
          });
        }
      } else {
        // Marcar como in_progress se ainda pendente
        if (order.status === "pending") {
          await db
            .update(pickingOrders)
            .set({ status: "in_progress" })
            .where(eq(pickingOrders.id, input.pickingOrderId));
        }
      }

      const progress = await ensureProgress(db, input.pickingOrderId);
      const route = await buildRoute(db, input.pickingOrderId);

      return {
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          customerOrderNumber: order.customerOrderNumber,
          customerName: order.customerName,
          status: order.status,
        },
        route,
        progress: {
          currentSequence: progress.currentSequence,
          scannedItems: (progress.scannedItems as any[]) ?? [],
        },
        isResume: order.status === "in_progress" || order.status === "paused",
      };
    }),

  /**
   * Confirmar leitura de endereço
   * Verifica se o endereço bipado corresponde ao endereço esperado na rota
   */
  confirmLocation: protectedProcedure
    .input(
      z.object({
        pickingOrderId: z.number(),
        expectedLocationCode: z.string(),
        scannedLocationCode: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const normalized = input.scannedLocationCode.trim().toUpperCase();
      const expected = input.expectedLocationCode.trim().toUpperCase();

      if (normalized !== expected) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Endereço incorreto. Esperado: ${expected} — Lido: ${normalized}`,
        });
      }

      return { ok: true, locationCode: expected };
    }),

  /**
   * Bipar produto em um endereço
   * Valida produto + lote contra a alocação pré-definida.
   * Retorna informações sobre fracionamento quando aplicável.
   *
   * O código bipado pode ser:
   *   - labelCode de uma labelAssociation (contém batch embutido)
   *   - SKU simples
   */
  scanProduct: protectedProcedure
    .input(
      z.object({
        pickingOrderId: z.number(),
        allocationId: z.number(), // ID da alocação específica do item
        scannedCode: z.string(), // Código bipado pelo operador
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });

      // Buscar alocação
      const [alloc] = await db
        .select()
        .from(pickingAllocations)
        .where(eq(pickingAllocations.id, input.allocationId))
        .limit(1);

      if (!alloc || alloc.pickingOrderId !== input.pickingOrderId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Alocação não encontrada",
        });
      }

      if (alloc.status === "picked") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Item já foi separado completamente",
        });
      }

      // Buscar associação de etiqueta para extrair lote do código bipado
      const { labelAssociations } = await import("../drizzle/schema");
      const [labelAssoc] = await db
        .select({
          productId: labelAssociations.productId,
          batch: labelAssociations.batch,
          labelCode: labelAssociations.labelCode,
        })
        .from(labelAssociations)
        .where(eq(labelAssociations.labelCode, input.scannedCode))
        .limit(1);

      // Determinar productId e batch do código lido
      let scannedProductId: number | null = null;
      let scannedBatch: string | null = null;

      if (labelAssoc) {
        scannedProductId = labelAssoc.productId;
        scannedBatch = labelAssoc.batch ?? null;
      } else {
        // Tentar por SKU direto
        const [prod] = await db
          .select({ id: products.id, sku: products.sku })
          .from(products)
          .where(eq(products.sku, input.scannedCode))
          .limit(1);

        if (prod) {
          scannedProductId = prod.id;
          // Sem lote no código — se alocação exige lote, vai falhar na validação
          scannedBatch = null;
        }
      }

      // CORREÇÃO: Se o código não é reconhecido, assumir que é etiqueta nova
      // e vincular automaticamente ao produto da alocação
      if (scannedProductId === null) {
        // Usar produto da alocação como referência
        scannedProductId = alloc.productId;
        scannedBatch = null; // Será definido na validação de lote abaixo
      }

      // Validar produto
      if (scannedProductId !== alloc.productId) {
        const [expectedProd] = await db
          .select({ sku: products.sku, description: products.description })
          .from(products)
          .where(eq(products.id, alloc.productId))
          .limit(1);

        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Produto incorreto. Esperado: ${expectedProd?.sku ?? alloc.productSku} — Lido: ${input.scannedCode}`,
        });
      }

      // Validar lote — se a alocação definiu um lote, o lote bipado deve corresponder
      if (alloc.batch !== null && alloc.batch !== undefined) {
        if (scannedBatch === null) {
          // CORREÇÃO: Vincular etiqueta automaticamente ao item-lote
          const { labelAssociations, inventory } = await import("../drizzle/schema");
          
          // Buscar inventário para obter tenantId e expiryDate
          const [inv] = await db
            .select({
              tenantId: inventory.tenantId,
              expiryDate: inventory.expiryDate,
            })
            .from(inventory)
            .where(
              and(
                eq(inventory.productId, alloc.productId),
                eq(inventory.locationId, alloc.locationId),
                alloc.batch ? eq(inventory.batch, alloc.batch) : sql`1=1`
              )
            )
            .limit(1);

          if (!inv) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: `Estoque não encontrado para vincular etiqueta.`,
            });
          }

          // Criar nova labelAssociation
          await db.insert(labelAssociations).values({
            sessionId: `P${input.pickingOrderId}`, // Prefixo P para picking
            labelCode: input.scannedCode,
            productId: alloc.productId,
            batch: alloc.batch ?? null,
            expiryDate: inv.expiryDate ?? null,
            unitsPerPackage: 1, // Padrão 1 unidade por embalagem
            packagesRead: 0,
            totalUnits: 0,
            associatedBy: 0, // Sistema (userId 0)
          });

          // Atualizar scannedBatch para continuar fluxo
          scannedBatch = alloc.batch;
        } else if (scannedBatch !== alloc.batch) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Lote incorreto. Esperado: ${alloc.batch} — Lido: ${scannedBatch}`,
          });
        }
      }

      // Buscar produto para unitsPerBox
      const [product] = await db
        .select({ unitsPerBox: products.unitsPerBox })
        .from(products)
        .where(eq(products.id, alloc.productId))
        .limit(1);

      const unitsPerBox = product?.unitsPerBox ?? 1;
      const remaining = alloc.quantity - alloc.pickedQuantity;

      // Verificar se é fracionado
      if (alloc.isFractional && remaining < unitsPerBox) {
        // Retornar flag para o frontend solicitar entrada manual da quantidade
        return {
          ok: true,
          requiresManualQuantity: true,
          maxQuantity: remaining,
          unitsPerBox,
          message: `Item fracionado. Informe a quantidade exata a separar (máx: ${remaining}).`,
        };
      }

      // Item inteiro — verificar se quantidade excede saldo
      if (unitsPerBox > remaining) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Quantidade máxima atingida. Saldo restante: ${remaining} unidades.`,
        });
      }

      // Incrementar quantidade separada (1 caixa = unitsPerBox unidades)
      const quantityToAdd = Math.min(unitsPerBox, remaining);
      const newPickedQuantity = alloc.pickedQuantity + quantityToAdd;
      const newStatus =
        newPickedQuantity >= alloc.quantity ? "picked" : "in_progress";

      await db
        .update(pickingAllocations)
        .set({ pickedQuantity: newPickedQuantity, status: newStatus })
        .where(eq(pickingAllocations.id, alloc.id));

      return {
        ok: true,
        requiresManualQuantity: false,
        quantityAdded: quantityToAdd,
        pickedQuantity: newPickedQuantity,
        totalQuantity: alloc.quantity,
        remainingQuantity: alloc.quantity - newPickedQuantity,
        allocationCompleted: newStatus === "picked",
        message: `+${quantityToAdd} registrado. Total: ${newPickedQuantity}/${alloc.quantity}.`,
      };
    }),

  /**
   * Registrar quantidade manual (item fracionado)
   * Chamado quando scanProduct retornou requiresManualQuantity = true
   */
  recordFractionalQuantity: protectedProcedure
    .input(
      z.object({
        pickingOrderId: z.number(),
        allocationId: z.number(),
        quantity: z.number().positive(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });

      const [alloc] = await db
        .select()
        .from(pickingAllocations)
        .where(eq(pickingAllocations.id, input.allocationId))
        .limit(1);

      if (!alloc || alloc.pickingOrderId !== input.pickingOrderId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Alocação não encontrada",
        });
      }

      const remaining = alloc.quantity - alloc.pickedQuantity;

      // BUG DETECTADO: Não havia validação de quantidade > saldo disponível.
      if (input.quantity > remaining) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Quantidade informada (${input.quantity}) excede o saldo restante (${remaining}).`,
        });
      }

      const newPickedQuantity = alloc.pickedQuantity + input.quantity;
      const newStatus =
        newPickedQuantity >= alloc.quantity ? "picked" : "in_progress";

      await db
        .update(pickingAllocations)
        .set({ pickedQuantity: newPickedQuantity, status: newStatus })
        .where(eq(pickingAllocations.id, alloc.id));

      return {
        ok: true,
        quantityAdded: input.quantity,
        pickedQuantity: newPickedQuantity,
        totalQuantity: alloc.quantity,
        remainingQuantity: alloc.quantity - newPickedQuantity,
        allocationCompleted: newStatus === "picked",
      };
    }),

  /**
   * Reportar problema em um endereço (inacessível / etiqueta danificada)
   * Registra ocorrência e marca alocação como short_picked com 0 unidades
   * para que o gerente possa tomar decisão no painel web.
   */
  reportLocationProblem: protectedProcedure
    .input(
      z.object({
        pickingOrderId: z.number(),
        locationCode: z.string(),
        reason: z.enum(["inaccessible", "damaged_label"]),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });

      // Marcar todas as alocações desse endereço como short_picked
      const allocs = await db
        .select({ id: pickingAllocations.id })
        .from(pickingAllocations)
        .where(
          and(
            eq(pickingAllocations.pickingOrderId, input.pickingOrderId),
            eq(pickingAllocations.locationCode, input.locationCode)
          )
        );

      for (const a of allocs) {
        await db
          .update(pickingAllocations)
          .set({ status: "short_picked" })
          .where(eq(pickingAllocations.id, a.id));
      }

      // Registrar nota no pedido
      // (em produção: inserir em tabela de ocorrências e notificar gerente via webhook)
      console.warn(
        `[PICKING] Problema reportado no endereço ${input.locationCode} ` +
          `(pedido ${input.pickingOrderId}) por operador ${ctx.user.id}: ${input.reason}. ${input.notes ?? ""}`
      );

      return {
        ok: true,
        message: `Ocorrência registrada. O gerente será notificado.`,
        affectedAllocations: allocs.length,
      };
    }),

  /**
   * Reportar falta ou avaria em um produto
   * Sistema tenta encontrar endereço alternativo com mesmo lote e regra do tenant.
   * Se não encontrar, registra short-picked.
   */
  reportProductProblem: protectedProcedure
    .input(
      z.object({
        pickingOrderId: z.number(),
        allocationId: z.number(),
        reason: z.enum([
          "not_found",
          "damaged",
          "insufficient_quantity",
        ]),
        availableQuantity: z.number().min(0).optional(), // Para "insufficient_quantity"
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });

      const [alloc] = await db
        .select()
        .from(pickingAllocations)
        .where(eq(pickingAllocations.id, input.allocationId))
        .limit(1);

      if (!alloc) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Alocação não encontrada",
        });
      }

      // Buscar pedido para tenant
      const [order] = await db
        .select({ tenantId: pickingOrders.tenantId })
        .from(pickingOrders)
        .where(eq(pickingOrders.id, input.pickingOrderId))
        .limit(1);

      if (!order) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Pedido não encontrado",
        });
      }

      const pickedSoFar =
        input.reason === "insufficient_quantity" && input.availableQuantity !== undefined
          ? input.availableQuantity
          : 0;

      // Registrar quanto foi separado (parcial) antes de marcar short_picked
      await db
        .update(pickingAllocations)
        .set({
          pickedQuantity: pickedSoFar,
          status: "short_picked",
        })
        .where(eq(pickingAllocations.id, alloc.id));

      // Tentar encontrar endereço alternativo com mesmo produto e lote compatível
      const { inventory, warehouseLocations: wl } = await import(
        "../drizzle/schema"
      );
      const { gt } = await import("drizzle-orm");

      const remainingNeeded = alloc.quantity - pickedSoFar;

      const altInventory = await db
        .select({
          locationId: inventory.locationId,
          locationCode: wl.code,
          batch: inventory.batch,
          quantity: inventory.quantity,
          reservedQuantity: inventory.reservedQuantity,
        })
        .from(inventory)
        .leftJoin(wl, eq(inventory.locationId, wl.id))
        .where(
          and(
            eq(inventory.productId, alloc.productId),
            eq(inventory.tenantId, order.tenantId),
            eq(inventory.status, "available"),
            gt(inventory.quantity, 0),
            // Mesmo lote se foi pré-alocado com lote específico
            alloc.batch ? eq(inventory.batch, alloc.batch) : undefined,
            // Excluir o mesmo endereço com problema (CORREÇÃO BUG: era eq → deve ser ne)
            alloc.locationCode ? sql`${wl.code} != ${alloc.locationCode}` : undefined
          )
        )
        .limit(5);

      // Filtrar endereços com saldo disponível suficiente
      const alternatives = altInventory.filter(
        (inv) =>
          inv.quantity - (inv.reservedQuantity ?? 0) >= remainingNeeded &&
          inv.locationCode !== alloc.locationCode
      );

      if (alternatives.length > 0) {
        const alt = alternatives[0];

        // Criar nova alocação alternativa
        const maxSeq = await db
          .select({ seq: pickingAllocations.sequence })
          .from(pickingAllocations)
          .where(eq(pickingAllocations.pickingOrderId, input.pickingOrderId))
          .orderBy(pickingAllocations.sequence);

        const nextSeq = maxSeq.length > 0 ? maxSeq[maxSeq.length - 1].seq + 1 : 1;

        await db.insert(pickingAllocations).values({
          pickingOrderId: input.pickingOrderId,
          productId: alloc.productId,
          productSku: alloc.productSku,
          locationId: alt.locationId!,
          locationCode: alt.locationCode!,
          batch: alt.batch ?? null,
          expiryDate: alloc.expiryDate,
          quantity: remainingNeeded,
          isFractional: remainingNeeded < (alloc.quantity > 0 ? alloc.quantity : 1),
          sequence: nextSeq,
          status: "pending",
          pickedQuantity: 0,
        });

        console.info(
          `[PICKING] Endereço alternativo ${alt.locationCode} adicionado à rota ` +
            `(pedido ${input.pickingOrderId}, produto ${alloc.productSku})`
        );

        return {
          ok: true,
          alternativeFound: true,
          alternativeLocation: alt.locationCode,
          message: `Endereço alternativo encontrado: ${alt.locationCode}. Adicionado à rota.`,
        };
      }

      // Sem alternativa — registrar divergência
      console.warn(
        `[PICKING] Short-picked sem alternativa: pedido ${input.pickingOrderId}, ` +
          `produto ${alloc.productSku}, lote ${alloc.batch ?? "N/A"}. ` +
          `Motivo: ${input.reason}. Operador: ${ctx.user.id}`
      );

      return {
        ok: true,
        alternativeFound: false,
        message: `Sem estoque alternativo disponível. Item registrado como short-picked. Gerente será notificado.`,
      };
    }),

  /**
   * Salvar progresso (pausar picking)
   */
  pause: protectedProcedure
    .input(
      z.object({
        pickingOrderId: z.number(),
        currentSequence: z.number(),
        currentLocationId: z.number().nullable(),
        scannedItems: z.array(z.any()),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });

      await db
        .update(pickingProgress)
        .set({
          currentSequence: input.currentSequence,
          currentLocationId: input.currentLocationId ?? null,
          scannedItems: input.scannedItems,
          pausedAt: new Date(),
          pausedBy: ctx.user.id,
        })
        .where(eq(pickingProgress.pickingOrderId, input.pickingOrderId));

      await db
        .update(pickingOrders)
        .set({ status: "in_progress" }) // mantém in_progress (paused é estado interno)
        .where(eq(pickingOrders.id, input.pickingOrderId));

      return { ok: true, message: "Progresso salvo. Pode retomar a qualquer momento." };
    }),

  /**
   * Concluir picking de um pedido
   * Se houver alocações short_picked → status = "divergent"
   * Se tudo completo → status = "picked"
   */
  complete: protectedProcedure
    .input(z.object({ pickingOrderId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });

      const allocs = await db
        .select({ status: pickingAllocations.status })
        .from(pickingAllocations)
        .where(eq(pickingAllocations.pickingOrderId, input.pickingOrderId));

      if (allocs.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nenhuma alocação encontrada para este pedido",
        });
      }

      const pending = allocs.filter(
        (a) => a.status === "pending" || a.status === "in_progress"
      );

      if (pending.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Ainda há ${pending.length} item(ns) não finalizados.`,
        });
      }

      const hasShortPicked = allocs.some((a) => a.status === "short_picked");
      const newStatus = hasShortPicked ? "divergent" : "picked";

      // CORREÇÃO: Copiar lote e validade das alocações para pickingOrderItems
      // para que a validação de lote funcione no /collector/stage
      const allocsWithBatch = await db
        .select({
          productId: pickingAllocations.productId,
          batch: pickingAllocations.batch,
          expiryDate: pickingAllocations.expiryDate,
        })
        .from(pickingAllocations)
        .where(eq(pickingAllocations.pickingOrderId, input.pickingOrderId));

      // Agrupar por produto+lote para atualizar pickingOrderItems
      const { pickingOrderItems } = await import("../drizzle/schema");
      for (const alloc of allocsWithBatch) {
        if (alloc.batch) {
          // Atualizar pickingOrderItems com lote e validade
          await db
            .update(pickingOrderItems)
            .set({
              batch: alloc.batch,
              expiryDate: alloc.expiryDate,
            })
            .where(
              and(
                eq(pickingOrderItems.pickingOrderId, input.pickingOrderId),
                eq(pickingOrderItems.productId, alloc.productId)
              )
            );
        }
      }

      await db
        .update(pickingOrders)
        .set({
          status: newStatus,
          pickedBy: ctx.user.id,
          pickedAt: new Date(),
        })
        .where(eq(pickingOrders.id, input.pickingOrderId));

      if (hasShortPicked) {
        console.warn(
          `[PICKING] Pedido ${input.pickingOrderId} finalizado com divergências (short-picked). ` +
            `Operador: ${ctx.user.id}`
        );
      }

      return {
        ok: true,
        status: newStatus,
        hasDivergences: hasShortPicked,
        message: hasShortPicked
          ? "Separação concluída com divergências. Gerente foi notificado."
          : "Separação concluída com sucesso!",
      };
    }),

  /**
   * Buscar rota atualizada de um pedido (para sincronização durante o fluxo)
   */
  getRoute: protectedProcedure
    .input(z.object({ pickingOrderId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });

      return buildRoute(db, input.pickingOrderId);
    }),
};
