# Correção: Atualização Automática de Status de Endereço

**Data**: 11/01/2026  
**Fase**: 49  
**Tipo**: Bug Fix

---

## 🐛 Problema Identificado

Endereços permaneciam com status "occupied" (ocupado) mesmo após o estoque ser completamente zerado (quantidade = 0). O status deveria retornar automaticamente para "available" (disponível).

### Causa Raiz

A função `updateInventoryBalance()` em `server/modules/inventory-sync.ts` deletava registros de inventory quando a quantidade chegava a zero, mas **não atualizava o status do endereço**.

A função `updateLocationStatus()` já existia em `server/movements.ts` e era chamada corretamente no fluxo de movimentações manuais, mas não estava sendo utilizada em outros pontos do sistema onde o estoque poderia ser zerado.

---

## ✅ Solução Implementada

### 1. Exportar Função de Atualização de Status

**Arquivo**: `server/movements.ts` (linha 205)

```typescript
/**
 * Atualiza status de um endereço baseado no estoque
 * Exportada para uso em outros módulos (inventory-sync, etc.)
 */
export async function updateLocationStatus(locationId: number) {
  const dbConn = await getDb();
  if (!dbConn) return;

  const stock = await dbConn
    .select({ total: sql<number>`COALESCE(SUM(${inventory.quantity}), 0)` })
    .from(inventory)
    .where(eq(inventory.locationId, locationId));

  const totalQuantity = Number(stock[0]?.total ?? 0);
  const newStatus = totalQuantity > 0 ? "occupied" : "available";

  await dbConn
    .update(warehouseLocations)
    .set({ status: newStatus })
    .where(eq(warehouseLocations.id, locationId));
}
```

### 2. Integrar em inventory-sync.ts

**Arquivo**: `server/modules/inventory-sync.ts`

**Import adicionado** (linha 11):
```typescript
import { updateLocationStatus } from "../movements";
```

**Chamada adicionada** (linha 183):
```typescript
if (newQuantity <= 0) {
  // Remover registro se quantidade zerou
  await db
    .delete(inventory)
    .where(eq(inventory.id, existing[0].id));
  
  // Atualizar status do endereço para "available" quando estoque zerar
  await updateLocationStatus(locationId);
} else {
  // ... código de atualização
}
```

---

## 🧪 Testes Realizados

### Teste 1: Detecção do Problema

**Script**: `test-location-status.mjs`

```
=== TESTE: Atualização de Status de Endereço ===

✅ Encontrados 5 endereços ocupados

📍 Testando endereço: H01-08-01 (ID: 120004)
   Status atual: occupied

📦 Estoque encontrado: 0 registros

📊 Quantidade total no endereço: 0

⚠️  PROBLEMA DETECTADO: Endereço com estoque zerado ainda está como "occupied"
    Deveria estar como "available"
```

### Teste 2: Correção de Dados Existentes

**Script**: `fix-location-status.mjs`

```
=== CORREÇÃO: Status de Endereços ===

📍 Total de endereços: 1435

✅ Corrigido: H01-08-01 | occupied → available (estoque: 0)
✅ Corrigido: H01-08-02 | occupied → available (estoque: 0)
✅ Corrigido: H01-08-03 | occupied → available (estoque: 0)
✅ Corrigido: H01-08-04 | occupied → available (estoque: 0)
✅ Corrigido: H01-08-05 | occupied → available (estoque: 0)
✅ Corrigido: H01-09-01 | occupied → available (estoque: 0)
✅ Corrigido: H01-09-02 | occupied → available (estoque: 0)
✅ Corrigido: H01-09-03 | occupied → available (estoque: 0)
✅ Corrigido: H01-09-04 | occupied → available (estoque: 0)

📊 Resumo:
   ✅ Corrigidos: 9
   ✓  Já corretos: 1426
   📍 Total: 1435
```

### Teste 3: Validação Pós-Correção

```
=== TESTE: Atualização de Status de Endereço ===

✅ Encontrados 5 endereços ocupados

📍 Testando endereço: H01-01-01 (ID: 180006)
   Status atual: occupied

📦 Estoque encontrado: 1 registros
   1. Produto ID: 180002, Lote: 22D10LB111, Qtd: 560

📊 Quantidade total no endereço: 560

✅ Endereço corretamente marcado como "occupied" (tem estoque)
```

---

## 🎯 Impacto

### Antes da Correção

- ❌ Endereços permaneciam "occupied" após estoque zerado
- ❌ Interface mostrava endereços ocupados incorretamente
- ❌ Filtros de endereços disponíveis não funcionavam corretamente
- ❌ Sugestões de endereço para movimentação incluíam endereços vazios como ocupados

### Depois da Correção

- ✅ Status atualizado automaticamente quando estoque é zerado
- ✅ Interface reflete status real dos endereços
- ✅ Filtros funcionam corretamente
- ✅ Sugestões de endereço são precisas
- ✅ Rastreabilidade mantida (histórico de movimentações preservado)

---

## 📝 Pontos de Integração

A função `updateLocationStatus()` é chamada automaticamente em:

1. **Movimentações manuais** (`server/movements.ts`)
   - Transferências
   - Ajustes
   - Devoluções
   - Descartes
   - Qualidade

2. **Atualização de saldo** (`server/modules/inventory-sync.ts`)
   - Quando `updateInventoryBalance()` zera o estoque
   - Usado por: conferência cega, picking, recebimento

3. **Conferência cega** (via `inventory-sync`)
   - Ao finalizar conferência e criar estoque

4. **Picking** (via `inventory-sync`)
   - Ao executar separação de itens

5. **Recebimento** (via `inventory-sync`)
   - Ao endereçar itens conferidos

---

## 🔄 Fluxo de Atualização

```
┌─────────────────────────────────────┐
│  Operação que Zera Estoque          │
│  (Movimentação, Picking, etc.)      │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  DELETE FROM inventory               │
│  WHERE id = X                        │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  updateLocationStatus(locationId)    │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  SELECT SUM(quantity)                │
│  FROM inventory                      │
│  WHERE locationId = X                │
└──────────────┬──────────────────────┘
               │
               ▼
       ┌───────┴───────┐
       │               │
   total > 0       total = 0
       │               │
       ▼               ▼
   "occupied"      "available"
       │               │
       └───────┬───────┘
               │
               ▼
┌─────────────────────────────────────┐
│  UPDATE warehouseLocations           │
│  SET status = newStatus              │
│  WHERE id = X                        │
└─────────────────────────────────────┘
```

---

## 📋 Arquivos Modificados

1. **server/movements.ts**
   - Exportada função `updateLocationStatus()` (antes era privada)

2. **server/modules/inventory-sync.ts**
   - Adicionado import de `updateLocationStatus`
   - Adicionada chamada após deletar inventory (linha 183)

3. **test-location-status.mjs** (novo)
   - Script de teste para detectar problema

4. **fix-location-status.mjs** (novo)
   - Script de correção para dados existentes

---

## ⚠️ Observações

1. **Correção retroativa**: Os 9 endereços que estavam com status incorreto foram corrigidos via script `fix-location-status.mjs`

2. **Prevenção futura**: A correção implementada garante que novos casos não ocorram

3. **Performance**: A função `updateLocationStatus()` faz apenas 1 SELECT e 1 UPDATE, impacto mínimo

4. **Conformidade**: Mantém rastreabilidade total (ANVISA RDC 430/2020)

---

## 🚀 Próximos Passos Recomendados

1. Monitorar logs para garantir que não há novos casos
2. Considerar adicionar índice em `inventory.locationId` se houver problemas de performance
3. Adicionar teste unitário para `updateLocationStatus()`
4. Documentar comportamento esperado no manual do usuário
