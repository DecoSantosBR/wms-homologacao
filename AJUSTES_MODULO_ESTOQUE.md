# Ajustes Necessários no Módulo de Estoque

## Resumo Executivo

A implementação atual do módulo de Estoque cobre **40% da especificação**. Faltam funcionalidades críticas de contagem de inventário e alertas automáticos.

## Divergências Identificadas

### 1. Schema de Banco de Dados

#### ✅ Implementado
- `inventory` - Posições de estoque
- `inventoryMovements` - Histórico de movimentações
- `productLocationMapping` - Mapeamento de localização sugerida

#### ❌ Faltando
- `inventoryCounts` - Contagens de inventário (full blind, cyclic, spot)
- `inventoryCountItems` - Itens de contagem com divergências

### 2. Backend (Endpoints tRPC)

#### ✅ Implementado (3/8 endpoints)
- `stock.getPositions` - Consulta de posições com filtros
- `stock.getSummary` - Resumo consolidado
- `stock.registerMovement` - Registro de movimentação
- `stock.getMovements` - Histórico de movimentações
- `stock.getOverallOccupancy` - Ocupação geral
- `stock.getOccupancyByZone` - Ocupação por zona
- `stock.getOptimizationSuggestions` - Sugestões de otimização

#### ❌ Faltando (5/8 endpoints)
- `stock.getProductStock` - Saldo total consolidado por produto (soma de todas as posições)
- `stock.getExpiring` - Produtos com validade próxima (<90 dias)
- `stock.getLowStock` - Produtos com estoque abaixo do mínimo
- `stockCount.start` - Iniciar contagem de inventário
- `stockCount.registerCount` - Registrar contagem física
- `stockCount.approveAdjustment` - Aprovar ajuste de divergência
- `stockCount.getCountItems` - Listar itens de contagem
- `stockCount.getDivergences` - Listar divergências pendentes

### 3. Frontend (Páginas)

#### ✅ Implementado (2/3 páginas)
- `StockPositions.tsx` - Consulta de posições
- `StockMovements.tsx` - Registro de movimentações
- `OccupancyDashboard.tsx` - Dashboard de ocupação (EXTRA - não estava na spec original)

#### ❌ Faltando (1/3 páginas)
- `StockAlerts.tsx` ou `Dashboard.tsx` - Dashboard de alertas (estoque baixo, vencendo)
- `InventoryCount.tsx` - Módulo completo de contagem de inventário

### 4. Funcionalidades

#### ✅ Implementado
- Consulta de posições com filtros avançados
- Registro de movimentações com validações
- Dashboard de ocupação por zona
- Sugestões inteligentes de otimização

#### ❌ Faltando
- **Contagem de Inventário Completa**:
  - Iniciar contagem (full blind, cyclic, spot)
  - Registrar contagens físicas
  - Detectar divergências automaticamente
  - Aprovar ajustes de divergências
  - Atualizar estoque após aprovação

- **Alertas Automáticos**:
  - Produtos com validade próxima (<90 dias)
  - Produtos com estoque baixo (< mínimo)
  - Dashboard de alertas

- **Consulta de Saldo Total**:
  - Saldo consolidado por produto (soma de todas as posições)
  - Agrupamento por lote
  - Filtros por status (available, quarantine, etc.)

## Priorização de Implementação

### Prioridade ALTA (Crítica)
1. **Endpoint `stock.getProductStock`** - Necessário para consultas básicas de saldo
2. **Tabelas de contagem** - Base para inventário
3. **Endpoints de contagem básicos** - start, registerCount

### Prioridade MÉDIA (Importante)
4. **Alertas de validade** - getExpiring, Dashboard
5. **Alertas de estoque baixo** - getLowStock
6. **Página de contagem** - InventoryCount.tsx

### Prioridade BAIXA (Desejável)
7. **Aprovação de divergências** - approveAdjustment
8. **Dashboard de alertas completo** - StockAlerts.tsx

## Estimativa de Esforço

- **Schema**: 30 minutos (2 tabelas)
- **Backend**: 2 horas (8 endpoints + funções auxiliares)
- **Frontend**: 2 horas (2 páginas + componentes)
- **Testes**: 1 hora
- **Total**: ~5-6 horas

## Plano de Implementação

### Fase 1: Schema (30min)
1. Adicionar `inventoryCounts` ao schema
2. Adicionar `inventoryCountItems` ao schema
3. Executar migração (`pnpm db:push`)

### Fase 2: Backend - Alertas (1h)
1. Criar `server/stockAlerts.ts`
2. Implementar `getExpiring()`
3. Implementar `getLowStock()`
4. Implementar `getProductStock()`
5. Adicionar endpoints no `stockRouter.ts`

### Fase 3: Backend - Contagem (1h)
1. Criar `server/inventoryCount.ts`
2. Implementar `startCount()`
3. Implementar `registerCount()`
4. Implementar `approveAdjustment()`
5. Criar `server/inventoryCountRouter.ts`
6. Registrar no `routers.ts`

### Fase 4: Frontend - Alertas (1h)
1. Criar `StockAlerts.tsx`
2. Implementar cards de alertas
3. Implementar tabelas de produtos vencendo e estoque baixo
4. Adicionar rota no `App.tsx`

### Fase 5: Frontend - Contagem (1h)
1. Criar `InventoryCount.tsx`
2. Implementar formulário de início de contagem
3. Implementar interface de contagem física
4. Implementar aprovação de divergências
5. Adicionar rota no `App.tsx`

### Fase 6: Testes e Validação (1h)
1. Testar fluxo completo de contagem
2. Testar alertas
3. Testar saldo consolidado
4. Validar conformidade com documentação

## Decisão de Escopo

Dado o volume de trabalho, sugiro implementar em **duas entregas**:

**Entrega 1 (Imediata - 2h):**
- Alertas (getExpiring, getLowStock, getProductStock)
- Dashboard de alertas

**Entrega 2 (Posterior - 3h):**
- Módulo completo de contagem de inventário
- Tabelas, endpoints e interface

Aguardo aprovação do usuário para prosseguir.
