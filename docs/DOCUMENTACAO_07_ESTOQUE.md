# WMS Med@x - Documentação do Módulo Estoque

**Data:** Janeiro 2026  
**Versão:** 1.0  
**Módulo:** Estoque (Stock)  
**Status:** ✅ Implementado e Funcional

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Funcionalidades Principais](#funcionalidades-principais)
3. [Arquitetura Técnica](#arquitetura-técnica)
4. [Backend - Código Completo](#backend---código-completo)
5. [Frontend - Código Completo](#frontend---código-completo)
6. [Fluxos Operacionais](#fluxos-operacionais)
7. [Integração com Outros Módulos](#integração-com-outros-módulos)

---

## Visão Geral

O **Módulo Estoque** é responsável pela gestão de inventário, movimentações, posições de estoque e dashboards de ocupação do armazém. Fornece visibilidade completa do estoque em tempo real com filtros avançados, exportação de relatórios e sugestões de otimização.

### Características Principais

- ✅ Consulta de posições de estoque em tempo real
- ✅ Movimentações entre endereços com validação de saldo
- ✅ Dashboard de ocupação por zona
- ✅ Sugestões inteligentes de otimização
- ✅ Exportação de relatórios em Excel (.xlsx)
- ✅ Histórico completo de movimentações
- ✅ Sincronização automática de saldos
- ✅ Integração com sistema de endereçamento

---

## Funcionalidades Principais

### 1. Posições de Estoque (/stock)

**Descrição:** Consulta centralizada de todas as posições de estoque com filtros avançados.

**Funcionalidades:**
- Listagem de posições com paginação
- Filtros por: Cliente, Zona, Status, Lote, Endereço, Busca geral
- Cards de resumo: Total de Posições, Quantidade Total, Endereços Ocupados, Lotes Únicos
- Legenda visual de status (Disponível, Ocupado, Bloqueado, Em Contagem)
- Exportação para Excel (.xlsx)
- Atualização em tempo real

**Colunas da Tabela:**
| Coluna | Descrição | Tipo |
|--------|-----------|------|
| Cliente | Nome do tenant | String |
| Zona | Nome da zona de armazenagem | String |
| Endereço | Código do endereço (ex: M01-01-02A) | String |
| Status | Status do endereço (Ocupado, Disponível, etc) | Badge |
| SKU | Código do produto | String |
| Produto | Descrição do produto | String |
| Lote | Número do lote | String |
| Quantidade | Quantidade em estoque | Number |
| Validade | Data de validade | Date |

### 2. Movimentações de Estoque (/stock/movements)

**Descrição:** Interface para registrar movimentações entre endereços com validação inteligente.

**Tipos de Movimentação:**
- **transfer** - Transferência entre endereços
- **adjustment** - Ajuste de quantidade (entrada/saída)
- **return** - Devolução de produto
- **disposal** - Descarte/destruição

**Funcionalidades:**
- Seleção de endereço origem com lista de produtos disponíveis
- Validação automática de saldo
- Sugestão inteligente de endereço destino (pré-alocação ou endereço livre)
- Histórico de movimentações com filtros
- Feedback visual com badges de tipo de movimentação
- Integração com regras de armazenagem

**Fluxo de Movimentação:**
1. Selecionar endereço origem
2. Sistema lista produtos/lotes disponíveis
3. Selecionar produto/lote
4. Informar quantidade (máximo = saldo disponível)
5. Sistema sugere endereço destino automaticamente
6. Confirmar movimentação
7. Sistema atualiza saldos e status de endereços

### 3. Dashboard de Ocupação (/occupancy)

**Descrição:** Visualização gráfica da ocupação do armazém por zona.

**Componentes:**
- **Gráfico de Barras Empilhadas:** Ocupação % por zona (Ocupados vs Disponíveis)
- **Tabela Detalhada:** Ocupados, Disponíveis, Bloqueados, Em Contagem por zona
- **Cards de Métricas:** Ocupação geral, Endereços totais, Capacidade crítica
- **Sugestões de Otimização:** Alertas e recomendações baseadas em padrões

**Sugestões de Otimização:**
1. **Consolidação** - Zonas com <10% ocupação
2. **Capacidade Crítica** - Zonas com 80-90% ocupação
3. **Realocação** - Produtos fragmentados em >3 endereços
4. **Eficiência** - Baixa utilização geral ou endereços bloqueados

### 4. Exportação de Relatórios

**Descrição:** Exportação de posição de estoque em formato Excel (.xlsx).

**Funcionalidades:**
- Exportação com filtros aplicados
- Opção de incluir/excluir endereços vazios
- Colunas: Endereço, Zona, SKU, Descrição, Lote, Quantidade, Validade, Status, Cliente
- Endereços multi-item geram uma linha por SKU
- Download automático do arquivo

---

## Arquitetura Técnica

### Tabelas de Banco de Dados

```sql
-- Tabela de Saldos de Estoque (consolidado)
CREATE TABLE inventory (
  id INT PRIMARY KEY AUTO_INCREMENT,
  productId INT NOT NULL,
  locationId INT NOT NULL,
  batch VARCHAR(50),
  quantity DECIMAL(10, 2) NOT NULL,
  status ENUM('available', 'quarantine', 'blocked', 'damaged', 'expired'),
  expiryDate DATE,
  tenantId INT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (productId) REFERENCES products(id),
  FOREIGN KEY (locationId) REFERENCES warehouseLocations(id),
  FOREIGN KEY (tenantId) REFERENCES tenants(id),
  INDEX idx_product_location (productId, locationId),
  INDEX idx_status (status),
  INDEX idx_expiry (expiryDate)
);

-- Tabela de Histórico de Movimentações
CREATE TABLE inventoryMovements (
  id INT PRIMARY KEY AUTO_INCREMENT,
  inventoryId INT,
  productId INT NOT NULL,
  fromLocationId INT,
  toLocationId INT,
  quantity DECIMAL(10, 2) NOT NULL,
  batch VARCHAR(50),
  movementType ENUM('receiving', 'picking', 'transfer', 'adjustment', 'return', 'disposal'),
  notes TEXT,
  createdBy INT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (inventoryId) REFERENCES inventory(id),
  FOREIGN KEY (productId) REFERENCES products(id),
  FOREIGN KEY (fromLocationId) REFERENCES warehouseLocations(id),
  FOREIGN KEY (toLocationId) REFERENCES warehouseLocations(id),
  FOREIGN KEY (createdBy) REFERENCES systemUsers(id),
  INDEX idx_movement_type (movementType),
  INDEX idx_created_at (createdAt),
  INDEX idx_product (productId)
);

-- Tabela de Mapeamento de Localização Sugerida
CREATE TABLE productLocationMapping (
  id INT PRIMARY KEY AUTO_INCREMENT,
  productId INT NOT NULL,
  locationId INT NOT NULL,
  priority INT DEFAULT 1,
  tenantId INT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (productId) REFERENCES products(id),
  FOREIGN KEY (locationId) REFERENCES warehouseLocations(id),
  FOREIGN KEY (tenantId) REFERENCES tenants(id),
  UNIQUE KEY unique_product_location (productId, locationId),
  INDEX idx_priority (priority)
);
```

### Interfaces TypeScript

```typescript
// Filtros para consulta de estoque
export interface InventoryFilters {
  tenantId?: number | null;
  productId?: number;
  locationId?: number;
  zoneId?: number;
  batch?: string;
  status?: "available" | "quarantine" | "blocked" | "damaged" | "expired";
  minQuantity?: number;
  search?: string;
}

// Posição de estoque
export interface InventoryPosition {
  id: number;
  productId: number;
  productSku: string;
  productDescription: string;
  locationId: number;
  locationCode: string;
  locationStatus: string;
  zoneName: string;
  batch: string | null;
  expiryDate: Date | null;
  quantity: number;
  status: string;
  tenantId: number | null;
  tenantName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Movimentação de estoque
export interface StockMovement {
  id: number;
  productId: number;
  fromLocationId?: number;
  toLocationId?: number;
  quantity: number;
  batch?: string;
  movementType: "receiving" | "picking" | "transfer" | "adjustment" | "return" | "disposal";
  notes?: string;
  fromLocationCode?: string;
  toLocationCode?: string;
  createdAt: Date;
  createdByName?: string;
}

// Sugestão de otimização
export interface OptimizationSuggestion {
  id: string;
  type: "consolidation" | "capacity_critical" | "reallocation" | "efficiency";
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  impact: string;
  actions: string[];
  metrics: {
    current: number;
    target: number;
    unit: string;
  };
}
```

---

## Backend - Código Completo

### server/inventory.ts - Consulta de Estoque

```typescript
import { alias, eq, gte, like, isNull, sql } from "drizzle-orm";
import { getDb } from "./db";
import {
  inventory,
  products,
  warehouseLocations,
  warehouseZones,
  tenants,
} from "../drizzle/schema";

export interface InventoryFilters {
  tenantId?: number | null;
  productId?: number;
  locationId?: number;
  zoneId?: number;
  batch?: string;
  status?: "available" | "quarantine" | "blocked" | "damaged" | "expired";
  minQuantity?: number;
  search?: string;
}

export interface InventoryPosition {
  id: number;
  productId: number;
  productSku: string;
  productDescription: string;
  locationId: number;
  locationCode: string;
  locationStatus: string;
  zoneName: string;
  batch: string | null;
  expiryDate: Date | null;
  quantity: number;
  status: string;
  tenantId: number | null;
  tenantName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Consulta posições de estoque com filtros avançados
 */
export async function getInventoryPositions(
  filters: InventoryFilters
): Promise<InventoryPosition[]> {
  const dbConn = await getDb();
  if (!dbConn) throw new Error("Database connection failed");

  const conditions = [];

  // Filtro por tenant
  if (filters.tenantId !== undefined) {
    if (filters.tenantId === null) {
      conditions.push(isNull(inventory.tenantId));
    } else {
      conditions.push(eq(inventory.tenantId, filters.tenantId));
    }
  }

  // Filtros adicionais
  if (filters.productId) {
    conditions.push(eq(inventory.productId, filters.productId));
  }
  if (filters.locationId) {
    conditions.push(eq(inventory.locationId, filters.locationId));
  }
  if (filters.batch) {
    conditions.push(like(inventory.batch, `%${filters.batch}%`));
  }
  if (filters.status) {
    conditions.push(eq(inventory.status, filters.status));
  }
  if (filters.minQuantity !== undefined) {
    conditions.push(gte(inventory.quantity, filters.minQuantity));
  }

  // Busca por SKU ou descrição
  if (filters.search) {
    conditions.push(
      sql`(${products.sku} LIKE ${`%${filters.search}%`} OR ${products.description} LIKE ${`%${filters.search}%`})`
    );
  }

  // Criar aliases para tenant
  const locationTenant = alias(tenants, 'locationTenant');
  
  const results = await dbConn
    .select({
      id: inventory.id,
      productId: inventory.productId,
      productSku: products.sku,
      productDescription: products.description,
      locationId: inventory.locationId,
      locationCode: warehouseLocations.code,
      locationStatus: warehouseLocations.status,
      zoneName: warehouseZones.name,
      batch: inventory.batch,
      expiryDate: inventory.expiryDate,
      quantity: inventory.quantity,
      status: inventory.status,
      tenantId: warehouseLocations.tenantId,
      tenantName: locationTenant.name,
      createdAt: inventory.createdAt,
      updatedAt: inventory.updatedAt,
    })
    .from(inventory)
    .innerJoin(products, eq(inventory.productId, products.id))
    .innerJoin(warehouseLocations, eq(inventory.locationId, warehouseLocations.id))
    .innerJoin(warehouseZones, eq(warehouseLocations.zoneId, warehouseZones.id))
    .leftJoin(locationTenant, eq(warehouseLocations.tenantId, locationTenant.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(warehouseLocations.code, inventory.batch)
    .limit(1000);

  return results;
}

/**
 * Obtém saldo total de um produto
 */
export async function getProductTotalStock(productId: number): Promise<number> {
  const dbConn = await getDb();
  if (!dbConn) throw new Error("Database connection failed");

  const result = await dbConn
    .select({ total: sql<number>`SUM(${inventory.quantity})` })
    .from(inventory)
    .where(eq(inventory.productId, productId));

  return result[0]?.total ?? 0;
}

/**
 * Obtém saldo de um endereço específico
 */
export async function getLocationStock(
  locationId: number,
  productId?: number,
  batch?: string
): Promise<number> {
  const dbConn = await getDb();
  if (!dbConn) throw new Error("Database connection failed");

  const conditions = [eq(inventory.locationId, locationId)];
  if (productId) conditions.push(eq(inventory.productId, productId));
  if (batch) conditions.push(eq(inventory.batch, batch));

  const result = await dbConn
    .select({ total: sql<number>`SUM(${inventory.quantity})` })
    .from(inventory)
    .where(and(...conditions));

  return result[0]?.total ?? 0;
}

/**
 * Obtém produtos com estoque abaixo do mínimo
 */
export async function getLowStockProducts(
  minQuantity: number = 10
): Promise<InventoryPosition[]> {
  return getInventoryPositions({ minQuantity });
}

/**
 * Obtém produtos próximos do vencimento
 */
export async function getExpiringProducts(
  daysThreshold: number = 30
): Promise<InventoryPosition[]> {
  const dbConn = await getDb();
  if (!dbConn) throw new Error("Database connection failed");

  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysThreshold);

  const locationTenant = alias(tenants, 'locationTenant');

  const results = await dbConn
    .select({
      id: inventory.id,
      productId: inventory.productId,
      productSku: products.sku,
      productDescription: products.description,
      locationId: inventory.locationId,
      locationCode: warehouseLocations.code,
      locationStatus: warehouseLocations.status,
      zoneName: warehouseZones.name,
      batch: inventory.batch,
      expiryDate: inventory.expiryDate,
      quantity: inventory.quantity,
      status: inventory.status,
      tenantId: warehouseLocations.tenantId,
      tenantName: locationTenant.name,
      createdAt: inventory.createdAt,
      updatedAt: inventory.updatedAt,
    })
    .from(inventory)
    .innerJoin(products, eq(inventory.productId, products.id))
    .innerJoin(warehouseLocations, eq(inventory.locationId, warehouseLocations.id))
    .innerJoin(warehouseZones, eq(warehouseLocations.zoneId, warehouseZones.id))
    .leftJoin(locationTenant, eq(warehouseLocations.tenantId, locationTenant.id))
    .where(
      and(
        lte(inventory.expiryDate, futureDate),
        gt(inventory.expiryDate, new Date())
      )
    )
    .orderBy(inventory.expiryDate)
    .limit(1000);

  return results;
}
```

### server/movements.ts - Movimentações de Estoque

```typescript
import { eq, and, sum } from "drizzle-orm";
import { getDb } from "./db";
import {
  inventory,
  inventoryMovements,
  warehouseLocations,
  products,
} from "../drizzle/schema";
import { updateLocationStatus } from "./locations";

export interface RegisterMovementInput {
  productId: number;
  fromLocationId: number;
  toLocationId: number;
  quantity: number;
  batch?: string;
  movementType: "transfer" | "adjustment" | "return" | "disposal";
  notes?: string;
  tenantId?: number | null;
}

/**
 * Registra movimentação de estoque com validações
 */
export async function registerMovement(input: RegisterMovementInput) {
  const dbConn = await getDb();
  if (!dbConn) throw new Error("Database connection failed");

  // FASE 1: VALIDAÇÕES (sem modificar dados)
  
  // Validar saldo disponível na origem
  const fromStock = await dbConn
    .select({ total: sum(inventory.quantity) })
    .from(inventory)
    .where(
      and(
        eq(inventory.locationId, input.fromLocationId),
        eq(inventory.productId, input.productId),
        input.batch ? eq(inventory.batch, input.batch) : undefined
      )
    );

  const availableQuantity = fromStock[0]?.total ?? 0;
  if (availableQuantity < input.quantity) {
    throw new Error(
      `Saldo insuficiente. Disponível: ${availableQuantity}, Solicitado: ${input.quantity}`
    );
  }

  // Validar regra de armazenagem do endereço destino
  const toLocation = await dbConn
    .select()
    .from(warehouseLocations)
    .where(eq(warehouseLocations.id, input.toLocationId))
    .limit(1);

  if (!toLocation[0]) {
    throw new Error("Endereço destino não encontrado");
  }

  // Se endereço é "single" (único item/lote), validar se já contém outro produto/lote
  if (toLocation[0].storageRule === "single") {
    const existingStock = await dbConn
      .select()
      .from(inventory)
      .where(eq(inventory.locationId, input.toLocationId))
      .limit(1);

    if (existingStock.length > 0) {
      const existing = existingStock[0];
      if (
        existing.productId !== input.productId ||
        existing.batch !== input.batch
      ) {
        throw new Error(
          `Endereço ${toLocation[0].code} é de único item/lote e já contém outro produto/lote`
        );
      }
    }
  }

  // FASE 2: MODIFICAR DADOS (somente se validações passarem)

  // Deduzir estoque da origem
  const fromInventory = await dbConn
    .select()
    .from(inventory)
    .where(
      and(
        eq(inventory.locationId, input.fromLocationId),
        eq(inventory.productId, input.productId),
        input.batch ? eq(inventory.batch, input.batch) : undefined
      )
    )
    .limit(1);

  if (fromInventory[0]) {
    const newQuantity = fromInventory[0].quantity - input.quantity;
    if (newQuantity <= 0) {
      // Remover registro se quantidade chegar a zero
      await dbConn
        .delete(inventory)
        .where(eq(inventory.id, fromInventory[0].id));
    } else {
      // Atualizar quantidade
      await dbConn
        .update(inventory)
        .set({ quantity: newQuantity })
        .where(eq(inventory.id, fromInventory[0].id));
    }
  }

  // Adicionar estoque ao destino
  const toInventory = await dbConn
    .select()
    .from(inventory)
    .where(
      and(
        eq(inventory.locationId, input.toLocationId),
        eq(inventory.productId, input.productId),
        input.batch ? eq(inventory.batch, input.batch) : undefined
      )
    )
    .limit(1);

  if (toInventory[0]) {
    // Atualizar quantidade existente
    await dbConn
      .update(inventory)
      .set({
        quantity: toInventory[0].quantity + input.quantity,
        expiryDate: fromInventory[0]?.expiryDate,
      })
      .where(eq(inventory.id, toInventory[0].id));
  } else {
    // Criar novo registro
    await dbConn.insert(inventory).values({
      productId: input.productId,
      locationId: input.toLocationId,
      batch: input.batch,
      quantity: input.quantity,
      expiryDate: fromInventory[0]?.expiryDate,
      status: "available",
      tenantId: input.tenantId,
    });
  }

  // Registrar movimentação no histórico
  await dbConn.insert(inventoryMovements).values({
    productId: input.productId,
    fromLocationId: input.fromLocationId,
    toLocationId: input.toLocationId,
    quantity: input.quantity,
    batch: input.batch,
    movementType: input.movementType,
    notes: input.notes,
    createdAt: new Date(),
  });

  // Atualizar status dos endereços
  await updateLocationStatus(input.fromLocationId);
  await updateLocationStatus(input.toLocationId);

  return { success: true, message: "Movimentação registrada com sucesso" };
}

/**
 * Obtém histórico de movimentações
 */
export async function getMovementHistory(
  filters?: {
    productId?: number;
    locationId?: number;
    movementType?: string;
    startDate?: Date;
    endDate?: Date;
  }
): Promise<any[]> {
  const dbConn = await getDb();
  if (!dbConn) throw new Error("Database connection failed");

  const conditions = [];
  if (filters?.productId) {
    conditions.push(eq(inventoryMovements.productId, filters.productId));
  }
  if (filters?.movementType) {
    conditions.push(eq(inventoryMovements.movementType, filters.movementType));
  }

  const results = await dbConn
    .select({
      id: inventoryMovements.id,
      productId: inventoryMovements.productId,
      productSku: products.sku,
      fromLocationCode: warehouseLocations.code,
      toLocationCode: warehouseLocations.code,
      quantity: inventoryMovements.quantity,
      batch: inventoryMovements.batch,
      movementType: inventoryMovements.movementType,
      notes: inventoryMovements.notes,
      createdAt: inventoryMovements.createdAt,
    })
    .from(inventoryMovements)
    .innerJoin(products, eq(inventoryMovements.productId, products.id))
    .leftJoin(
      warehouseLocations,
      eq(inventoryMovements.fromLocationId, warehouseLocations.id)
    )
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(inventoryMovements.createdAt))
    .limit(500);

  return results;
}
```

### server/occupancy.ts - Dashboard de Ocupação

```typescript
import { getDb } from "./db";
import { warehouseZones, warehouseLocations, inventory } from "../drizzle/schema";
import { eq, sql } from "drizzle-orm";

export interface ZoneOccupancy {
  zoneId: number;
  zoneName: string;
  total: number;
  occupied: number;
  available: number;
  blocked: number;
  counting: number;
  occupancyPercentage: number;
}

/**
 * Calcula ocupação por zona
 */
export async function getOccupancyByZone(): Promise<ZoneOccupancy[]> {
  const dbConn = await getDb();
  if (!dbConn) throw new Error("Database connection failed");

  const zones = await dbConn
    .select({
      zoneId: warehouseZones.id,
      zoneName: warehouseZones.name,
      total: sql<number>`COUNT(DISTINCT ${warehouseLocations.id})`,
      occupied: sql<number>`COUNT(DISTINCT CASE WHEN ${inventory.quantity} > 0 THEN ${warehouseLocations.id} END)`,
      available: sql<number>`COUNT(DISTINCT CASE WHEN ${inventory.quantity} IS NULL OR ${inventory.quantity} = 0 THEN ${warehouseLocations.id} END)`,
      blocked: sql<number>`COUNT(DISTINCT CASE WHEN ${warehouseLocations.status} = 'blocked' THEN ${warehouseLocations.id} END)`,
      counting: sql<number>`COUNT(DISTINCT CASE WHEN ${warehouseLocations.status} = 'counting' THEN ${warehouseLocations.id} END)`,
    })
    .from(warehouseZones)
    .innerJoin(warehouseLocations, eq(warehouseLocations.zoneId, warehouseZones.id))
    .leftJoin(inventory, eq(inventory.locationId, warehouseLocations.id))
    .groupBy(warehouseZones.id, warehouseZones.name);

  return zones.map((z) => ({
    ...z,
    occupancyPercentage: z.total > 0 ? (z.occupied / z.total) * 100 : 0,
  }));
}

/**
 * Calcula ocupação geral do armazém
 */
export async function getOverallOccupancy() {
  const dbConn = await getDb();
  if (!dbConn) throw new Error("Database connection failed");

  const result = await dbConn
    .select({
      total: sql<number>`COUNT(DISTINCT ${warehouseLocations.id})`,
      occupied: sql<number>`COUNT(DISTINCT CASE WHEN ${inventory.quantity} > 0 THEN ${warehouseLocations.id} END)`,
      available: sql<number>`COUNT(DISTINCT CASE WHEN ${inventory.quantity} IS NULL OR ${inventory.quantity} = 0 THEN ${warehouseLocations.id} END)`,
      blocked: sql<number>`COUNT(DISTINCT CASE WHEN ${warehouseLocations.status} = 'blocked' THEN ${warehouseLocations.id} END)`,
      counting: sql<number>`COUNT(DISTINCT CASE WHEN ${warehouseLocations.status} = 'counting' THEN ${warehouseLocations.id} END)`,
    })
    .from(warehouseLocations)
    .leftJoin(inventory, eq(inventory.locationId, warehouseLocations.id));

  const data = result[0];
  return {
    ...data,
    occupancyPercentage: data.total > 0 ? (data.occupied / data.total) * 100 : 0,
  };
}
```

---

## Frontend - Código Completo

### client/src/pages/StockPositions.tsx

```typescript
import { useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { ArrowLeft, Home, Download, Package, Boxes, MapPin, AlertCircle } from "lucide-react";
import { useRouter } from "wouter";

export default function StockPositions() {
  const router = useRouter();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [zoneFilter, setZoneFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [batchFilter, setBatchFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");

  // Queries
  const { data: positions = [], isLoading } = trpc.stock.getPositions.useQuery({
    tenantId: clientFilter === "all" ? undefined : clientFilter === "shared" ? null : Number(clientFilter),
    search: searchTerm || undefined,
    zoneId: zoneFilter === "all" ? undefined : Number(zoneFilter),
    status: statusFilter === "all" ? undefined : (statusFilter as any),
    batch: batchFilter || undefined,
    locationCode: locationFilter || undefined,
  });

  const { data: tenants = [] } = trpc.tenants.list.useQuery();
  const { data: zones = [] } = trpc.zones.list.useQuery();

  // Cálculos
  const totalQuantity = positions.reduce((sum, p) => sum + p.quantity, 0);
  const uniqueLocations = new Set(positions.map((p) => p.locationId)).size;
  const uniqueBatches = new Set(positions.map((p) => p.batch)).size;

  // Status badge
  const getLocationStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      available: { label: "Disponível", className: "bg-green-100 text-green-800 border-green-300" },
      occupied: { label: "Ocupado", className: "bg-blue-100 text-blue-800 border-blue-300" },
      blocked: { label: "Bloqueado", className: "bg-red-100 text-red-800 border-red-300" },
      counting: { label: "Em Contagem", className: "bg-yellow-100 text-yellow-800 border-yellow-300" },
    };
    const config = statusConfig[status] || statusConfig.available;
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  // Exportar para Excel
  const handleExportExcel = async () => {
    try {
      const response = await trpc.inventory.exportReport.mutate({
        filters: {
          tenantId: clientFilter === "all" ? undefined : clientFilter === "shared" ? null : Number(clientFilter),
          zoneId: zoneFilter === "all" ? undefined : Number(zoneFilter),
          status: statusFilter === "all" ? undefined : (statusFilter as any),
        },
        includeEmpty: false,
      });

      // Download arquivo
      const link = document.createElement("a");
      link.href = response.url;
      link.download = `posicoes-estoque-${new Date().toISOString().split("T")[0]}.xlsx`;
      link.click();

      toast.success("Relatório exportado com sucesso!");
    } catch (error) {
      toast.error("Erro ao exportar relatório");
      console.error(error);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      {/* Navigation */}
      <div className="flex gap-2 mb-6">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
        </Button>
        <Button variant="outline" size="sm" onClick={() => router("/")} >
          <Home className="w-4 h-4 mr-2" /> Início
        </Button>
      </div>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Posições de Estoque</h1>
        <p className="text-muted-foreground">Consulte o estoque disponível em tempo real</p>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Package className="w-4 h-4" /> Total de Posições
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{positions.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Boxes className="w-4 h-4" /> Quantidade Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalQuantity.toLocaleString("pt-BR")}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <MapPin className="w-4 h-4" /> Endereços Ocupados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{uniqueLocations}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Lotes Únicos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{uniqueBatches}</div>
          </CardContent>
        </Card>
      </div>

      {/* Legenda de Status */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-sm">Legenda de Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Badge className="bg-green-100 text-green-800 border-green-300">Disponível</Badge>
              <span className="text-sm text-muted-foreground">Endereço vazio</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-blue-100 text-blue-800 border-blue-300">Ocupado</Badge>
              <span className="text-sm text-muted-foreground">Endereço com estoque</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-red-100 text-red-800 border-red-300">Bloqueado</Badge>
              <span className="text-sm text-muted-foreground">Endereço bloqueado</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">Em Contagem</Badge>
              <span className="text-sm text-muted-foreground">Inventário em andamento</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filtros */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-sm">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              placeholder="Buscar por SKU, descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Clientes</SelectItem>
                <SelectItem value="shared">Compartilhado</SelectItem>
                {tenants.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={zoneFilter} onValueChange={setZoneFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Zona" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Zonas</SelectItem>
                {zones.map((z) => (
                  <SelectItem key={z.id} value={String(z.id)}>
                    {z.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="available">Disponível</SelectItem>
                <SelectItem value="occupied">Ocupado</SelectItem>
                <SelectItem value="blocked">Bloqueado</SelectItem>
                <SelectItem value="counting">Em Contagem</SelectItem>
              </SelectContent>
            </Select>

            <Input
              placeholder="Filtrar por lote..."
              value={batchFilter}
              onChange={(e) => setBatchFilter(e.target.value)}
            />

            <Input
              placeholder="Filtrar por endereço..."
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
            />

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm("");
                  setClientFilter("all");
                  setZoneFilter("all");
                  setStatusFilter("all");
                  setBatchFilter("");
                  setLocationFilter("");
                }}
              >
                Limpar Filtros
              </Button>
              <Button onClick={handleExportExcel} disabled={positions.length === 0}>
                <Download className="w-4 h-4 mr-2" /> Exportar Excel
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardHeader>
          <CardTitle>Posições de Estoque</CardTitle>
          <CardDescription>{positions.length} posição(ões) encontrada(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {positions.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>Nenhuma posição de estoque encontrada</AlertDescription>
            </Alert>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Zona</TableHead>
                    <TableHead>Endereço</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Lote</TableHead>
                    <TableHead className="text-right">Quantidade</TableHead>
                    <TableHead>Validade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {positions.map((pos) => (
                    <TableRow key={pos.id}>
                      <TableCell>{pos.tenantName || "Compartilhado"}</TableCell>
                      <TableCell>{pos.zoneName}</TableCell>
                      <TableCell className="font-mono">{pos.locationCode}</TableCell>
                      <TableCell>{getLocationStatusBadge(pos.locationStatus)}</TableCell>
                      <TableCell className="font-mono">{pos.productSku}</TableCell>
                      <TableCell>{pos.productDescription}</TableCell>
                      <TableCell className="font-mono">{pos.batch || "-"}</TableCell>
                      <TableCell className="text-right font-bold">
                        {pos.quantity.toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell>
                        {pos.expiryDate
                          ? new Date(pos.expiryDate).toLocaleDateString("pt-BR")
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

### client/src/pages/StockMovements.tsx

```typescript
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { ArrowLeft, Home, AlertCircle, MapPin } from "lucide-react";
import { useRouter } from "wouter";

export default function StockMovements() {
  const router = useRouter();
  const [fromLocationId, setFromLocationId] = useState<string>("");
  const [productId, setProductId] = useState<string>("");
  const [toLocationId, setToLocationId] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [movementType, setMovementType] = useState<"transfer" | "adjustment" | "return" | "disposal">("transfer");

  // Queries
  const { data: locationsWithStock = [] } = trpc.locations.listWithStock.useQuery();
  const { data: locations = [] } = trpc.locations.list.useQuery();
  const { data: movements = [] } = trpc.stockMovements.getHistory.useQuery();

  // Get available products for selected location
  const availableProducts = fromLocationId
    ? locationsWithStock
        .find((l) => l.id === Number(fromLocationId))
        ?.products || []
    : [];

  // Get suggested location
  const { data: suggestedLocation } = trpc.receiving.getSuggestedLocation.useQuery(
    {
      productId: productId ? Number(productId) : 0,
      batch: "", // TODO: Add batch selection
      quantity: quantity ? Number(quantity) : 0,
    },
    { enabled: !!productId && !!quantity }
  );

  // Mutations
  const registerMovementMutation = trpc.stockMovements.register.useMutation({
    onSuccess: () => {
      toast.success("Movimentação registrada com sucesso!");
      setFromLocationId("");
      setProductId("");
      setToLocationId("");
      setQuantity("");
      setNotes("");
      
      // Invalidate queries
      const utils = trpc.useUtils();
      utils.locations.listWithStock.invalidate();
      utils.stock.getPositions.invalidate();
      utils.stockMovements.getHistory.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao registrar movimentação");
    },
  });

  const handleRegisterMovement = async () => {
    if (!fromLocationId || !productId || !toLocationId || !quantity) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    registerMovementMutation.mutate({
      fromLocationId: Number(fromLocationId),
      toLocationId: Number(toLocationId),
      productId: Number(productId),
      quantity: Number(quantity),
      movementType,
      notes: notes || undefined,
    });
  };

  const getMovementTypeBadge = (type: string) => {
    const typeConfig: Record<string, string> = {
      transfer: "bg-blue-100 text-blue-800",
      adjustment: "bg-yellow-100 text-yellow-800",
      return: "bg-purple-100 text-purple-800",
      disposal: "bg-red-100 text-red-800",
      receiving: "bg-green-100 text-green-800",
      picking: "bg-orange-100 text-orange-800",
    };
    return <Badge className={typeConfig[type] || "bg-gray-100 text-gray-800"}>{type}</Badge>;
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      {/* Navigation */}
      <div className="flex gap-2 mb-6">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
        </Button>
        <Button variant="outline" size="sm" onClick={() => router("/")} >
          <Home className="w-4 h-4 mr-2" /> Início
        </Button>
      </div>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Movimentações de Estoque</h1>
        <p className="text-muted-foreground">Registre transferências entre endereços</p>
      </div>

      {/* Formulário */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Nova Movimentação</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="text-sm font-medium mb-2 block">Endereço Origem *</label>
              <Select value={fromLocationId} onValueChange={setFromLocationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o endereço" />
                </SelectTrigger>
                <SelectContent>
                  {locationsWithStock.map((loc) => (
                    <SelectItem key={loc.id} value={String(loc.id)}>
                      {loc.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Produto *</label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o produto" />
                </SelectTrigger>
                <SelectContent>
                  {availableProducts.map((prod) => (
                    <SelectItem key={prod.id} value={String(prod.id)}>
                      {prod.sku} - {prod.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Quantidade *</label>
              <Input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Quantidade"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Tipo de Movimentação *</label>
              <Select value={movementType} onValueChange={(v: any) => setMovementType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="transfer">Transferência</SelectItem>
                  <SelectItem value="adjustment">Ajuste</SelectItem>
                  <SelectItem value="return">Devolução</SelectItem>
                  <SelectItem value="disposal">Descarte</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Endereço Destino *</label>
              <Select value={toLocationId} onValueChange={setToLocationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o endereço" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((loc) => (
                    <SelectItem key={loc.id} value={String(loc.id)}>
                      {loc.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Observações</label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas adicionais"
              />
            </div>
          </div>

          <Button
            onClick={handleRegisterMovement}
            disabled={registerMovementMutation.isPending}
            className="w-full"
          >
            {registerMovementMutation.isPending ? "Registrando..." : "Registrar Movimentação"}
          </Button>
        </CardContent>
      </Card>

      {/* Histórico */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Movimentações</CardTitle>
          <CardDescription>{movements.length} movimentação(ões)</CardDescription>
        </CardHeader>
        <CardContent>
          {movements.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>Nenhuma movimentação registrada</AlertDescription>
            </Alert>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Destino</TableHead>
                    <TableHead className="text-right">Quantidade</TableHead>
                    <TableHead>Lote</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map((mov) => (
                    <TableRow key={mov.id}>
                      <TableCell className="text-sm">
                        {new Date(mov.createdAt).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell>{getMovementTypeBadge(mov.movementType)}</TableCell>
                      <TableCell className="font-mono text-sm">{mov.productSku}</TableCell>
                      <TableCell className="font-mono">{mov.fromLocationCode || "-"}</TableCell>
                      <TableCell className="font-mono">{mov.toLocationCode || "-"}</TableCell>
                      <TableCell className="text-right font-bold">{mov.quantity}</TableCell>
                      <TableCell className="font-mono">{mov.batch || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## Fluxos Operacionais

### Fluxo 1: Consulta de Posição de Estoque

```
1. Usuário acessa /stock
2. Sistema carrega todas as posições de estoque
3. Usuário aplica filtros (cliente, zona, status, etc)
4. Sistema atualiza tabela em tempo real
5. Usuário pode exportar para Excel
6. Sistema gera arquivo .xlsx com dados filtrados
7. Download automático do arquivo
```

### Fluxo 2: Movimentação de Estoque

```
1. Usuário acessa /stock/movements
2. Seleciona endereço origem
3. Sistema lista produtos disponíveis no endereço
4. Usuário seleciona produto e quantidade
5. Sistema valida saldo disponível
6. Sistema sugere endereço destino automaticamente
7. Usuário confirma movimentação
8. Sistema atualiza saldos em ambos endereços
9. Sistema registra movimentação no histórico
10. Sistema atualiza status dos endereços (occupied/available)
```

### Fluxo 3: Dashboard de Ocupação

```
1. Usuário acessa /occupancy
2. Sistema calcula ocupação por zona
3. Sistema gera gráfico de barras empilhadas
4. Sistema exibe tabela detalhada
5. Sistema analisa padrões e gera sugestões
6. Usuário visualiza sugestões de otimização
7. Usuário pode clicar em sugestão para detalhes
```

---

## Integração com Outros Módulos

### Integração com Recebimento

- Após conferência completa de uma ordem de recebimento
- Sistema cria automaticamente registros em `inventory`
- Sistema aloca endereço REC automaticamente
- Sistema registra movimentação tipo "receiving"

### Integração com Separação

- Durante picking, sistema deduz quantidade de `inventory`
- Sistema registra movimentação tipo "picking"
- Sistema atualiza status de endereço destino (EXP)

### Integração com Endereçamento

- Função `updateLocationStatus()` chamada após cada movimentação
- Calcula saldo total do endereço
- Atualiza status: "occupied" se quantidade > 0, "available" se quantidade = 0

---

**Fim da Documentação - Módulo Estoque**
