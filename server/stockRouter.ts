import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import {
  getInventoryPositions,
  getInventorySummary,
  getLocationStock,
  getLowStockProducts,
  getExpiringProducts,
  getLocationsWithStock,
  getDestinationLocations,
  getSuggestedDestination,
} from "./inventory";
import {
  registerMovement,
  getMovementHistory,
  getLocationProducts,
} from "./movements";
import {
  getOccupancyByZone,
  getOverallOccupancy,
  getOptimizationSuggestions,
} from "./occupancy";

// Schema de validação para filtros de estoque
const inventoryFiltersSchema = z.object({
  tenantId: z.number().optional().nullable(),
  productId: z.number().optional(),
  locationId: z.number().optional(),
  zoneId: z.number().optional(),
  batch: z.string().optional(),
  status: z.enum(["available", "quarantine", "blocked", "damaged", "expired"]).optional(),
  minQuantity: z.number().optional(),
  search: z.string().optional(),
  locationCode: z.string().optional(),
});

// Schema de validação para movimentação
const registerMovementSchema = z.object({
  productId: z.number(),
  fromLocationId: z.number(),
  toLocationId: z.number().optional(), // Opcional para descarte
  quantity: z.number().positive(),
  batch: z.string().optional(),
  movementType: z.enum(["transfer", "adjustment", "return", "disposal", "quality"]),
  notes: z.string().optional(),
  tenantId: z.number().optional().nullable(),
});

// Schema de validação para histórico de movimentações
const movementHistorySchema = z.object({
  productId: z.number().optional(),
  locationId: z.number().optional(),
  movementType: z.string().optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  limit: z.number().optional(),
});

export const stockRouter = router({
  // ============================================================================
  // CONSULTAS DE ESTOQUE
  // ============================================================================

  /**
   * Obtém posições de estoque com filtros avançados
   */
  getPositions: protectedProcedure
    .input(inventoryFiltersSchema)
    .query(async ({ input }) => {
      return await getInventoryPositions(input);
    }),

  /**
   * Obtém resumo de estoque (cards de métricas)
   */
  getSummary: protectedProcedure
    .input(inventoryFiltersSchema)
    .query(async ({ input }) => {
      return await getInventorySummary(input);
    }),

  /**
   * Obtém saldo disponível em um endereço
   */
  getLocationStock: protectedProcedure
    .input(
      z.object({
        locationId: z.number(),
        productId: z.number().optional(),
        batch: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      return await getLocationStock(
        input.locationId,
        input.productId,
        input.batch
      );
    }),

  /**
   * Obtém produtos com estoque abaixo do mínimo
   */
  getLowStock: protectedProcedure
    .input(z.object({ minQuantity: z.number().optional() }))
    .query(async ({ input }) => {
      return await getLowStockProducts(input.minQuantity);
    }),

  /**
   * Obtém produtos próximos do vencimento
   */
  getExpiring: protectedProcedure
    .input(z.object({ daysThreshold: z.number().optional() }))
    .query(async ({ input }) => {
      return await getExpiringProducts(input.daysThreshold);
    }),

  // ============================================================================
  // MOVIMENTAÇÕES DE ESTOQUE
  // ============================================================================

  /**
   * Registra movimentação de estoque
   */
  registerMovement: protectedProcedure
    .input(registerMovementSchema)
    .mutation(async ({ input, ctx }) => {
      return await registerMovement({
        ...input,
        performedBy: ctx.user.id,
      });
    }),

  /**
   * Obtém histórico de movimentações
   */
  getMovements: protectedProcedure
    .input(movementHistorySchema)
    .query(async ({ input }) => {
      return await getMovementHistory(input);
    }),

  /**
   * Obtém produtos disponíveis em um endereço
   */
  getLocationProducts: protectedProcedure
    .input(z.object({ locationId: z.number() }))
    .query(async ({ input }) => {
      return await getLocationProducts(input.locationId);
    }),

  /**
   * Lista endereços que possuem estoque alocado
   */
  getLocationsWithStock: protectedProcedure
    .query(async () => {
      return await getLocationsWithStock();
    }),

  /**
   * Lista endereços de destino válidos baseado no tipo de movimentação
   */
  getDestinationLocations: protectedProcedure
    .input(z.object({
      movementType: z.enum(["transfer", "adjustment", "return", "disposal", "quality"]),
      productId: z.number().optional(),
      batch: z.string().optional(),
      tenantId: z.number().optional().nullable(),
    }))
    .query(async ({ input }) => {
      return await getDestinationLocations(input);
    }),

  /**
   * Sugere endereço de destino baseado em pré-alocação (zona REC)
   */
  getSuggestedDestination: protectedProcedure
    .input(z.object({
      fromLocationId: z.number(),
      productId: z.number(),
      batch: z.string().nullable(),
      quantity: z.number(),
    }))
    .query(async ({ input }) => {
      return await getSuggestedDestination(input);
    }),

  // ============================================================================
  // DASHBOARD DE OCUPAÇÃO
  // ============================================================================

  /**
   * Obtém ocupação por zona
   */
  getOccupancyByZone: protectedProcedure.query(async () => {
    return await getOccupancyByZone();
  }),

  /**
   * Obtém ocupação geral do armazém
   */
  getOverallOccupancy: protectedProcedure.query(async () => {
    return await getOverallOccupancy();
  }),

  /**
   * Obtém sugestões de otimização
   */
  getOptimizationSuggestions: protectedProcedure.query(async () => {
    return await getOptimizationSuggestions();
  }),
});
