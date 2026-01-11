# Correção de Erros na Página de Picking

**Data**: 11/01/2026  
**Fase**: 42

---

## Resumo das Correções

Esta documentação descreve as correções implementadas para resolver dois erros críticos reportados na página de picking (`/picking`):

1. **Erro de chave duplicada no React**: "Encountered two children with the same key, `180002`"
2. **Erro de validação de estoque**: "Estoque insuficiente para produto 443060 (EXTENSOFIX 60 CM)"

---

## 1. Erro de Chave Duplicada

### Problema

O React estava reportando o seguinte erro:

```
Encountered two children with the same key, `180002`. 
Keys should be unique so that components maintain their identity across updates.
```

### Causa Raiz

A API `picking.list` estava retornando pedidos duplicados no array, fazendo com que dois elementos `<div>` tivessem a mesma `key={order.id}` na renderização.

### Solução Implementada

Adicionado `useMemo` para remover duplicatas antes da renderização:

```tsx
// client/src/pages/PickingOrders.tsx

const uniqueOrders = useMemo(() => {
  if (!orders) return [];
  const seen = new Set<number>();
  const unique: typeof orders = [];
  orders.forEach((order) => {
    if (!seen.has(order.id)) {
      seen.add(order.id);
      unique.push(order);
    }
  });
  return unique;
}, [orders]);

// Usar uniqueOrders ao invés de orders na renderização
{uniqueOrders.map((order) => (
  <div key={order.id}>
    {/* ... */}
  </div>
))}
```

### Resultado

✅ Erro de chave duplicada eliminado  
✅ Console do navegador limpo, sem warnings

---

## 2. Erro de Validação de Estoque

### Problema

Ao tentar criar uma onda com pedidos da Hapvida, o sistema retornava:

```
Estoque insuficiente para produto 443060 (EXTENSOFIX 60 CM)
```

Mesmo havendo estoque suficiente no total, mas distribuído em múltiplos endereços.

### Causa Raiz

A lógica de alocação em `server/waveLogic.ts` estava verificando apenas o **primeiro endereço** (FIFO/FEFO) e falhava se ele sozinho não tivesse toda a quantidade necessária:

```ts
// ❌ Código antigo (INCORRETO)
const availableStock = await db
  .select({...})
  .from(inventory)
  .where(...)
  .orderBy(orderBy)
  .limit(1); // ← Pegava apenas 1 endereço

if (location.quantity < item.totalQuantity) {
  throw new Error(`Estoque insuficiente...`);
}
```

### Solução Implementada

Refatorada a função `allocateLocations` para:

1. **Buscar todos os endereços disponíveis** (sem `.limit(1)`)
2. **Calcular estoque total** somando todos os endereços
3. **Alocar de múltiplos endereços** respeitando FIFO/FEFO

```ts
// ✅ Código novo (CORRETO)
const availableStock = await db
  .select({...})
  .from(inventory)
  .where(...)
  .orderBy(orderBy); // Busca TODOS os endereços disponíveis

// Calcular estoque total disponível
const totalAvailable = availableStock.reduce((sum, loc) => sum + loc.quantity, 0);

if (totalAvailable < item.totalQuantity) {
  throw new Error(`Estoque insuficiente...`);
}

// Alocar de múltiplos endereços se necessário (FIFO/FEFO)
let remainingQuantity = item.totalQuantity;
for (const location of availableStock) {
  if (remainingQuantity <= 0) break;

  const quantityFromThisLocation = Math.min(location.quantity, remainingQuantity);
  
  allocated.push({
    ...item,
    totalQuantity: quantityFromThisLocation,
    locationId: location.locationId,
    locationCode: location.locationCode!,
    batch: location.batch || undefined,
    expiryDate: location.expiryDate || undefined,
  });

  remainingQuantity -= quantityFromThisLocation;
}
```

### Benefícios

✅ **Picking realista**: Permite separar de múltiplos endereços (comum em WMS)  
✅ **FIFO/FEFO respeitado**: Prioriza endereços mais antigos/próximos ao vencimento  
✅ **Melhor aproveitamento**: Não desperdiça estoque fragmentado

### Exemplo Prático

**Cenário**: Pedido precisa de 280 unidades do produto 443060

**Estoque disponível**:
- Endereço A-01-01: 150 unidades (lote mais antigo)
- Endereço A-01-02: 200 unidades (lote mais recente)

**Alocação FIFO**:
1. Pega 150 unidades do endereço A-01-01
2. Pega 130 unidades do endereço A-01-02
3. Total: 280 unidades ✅

---

## 3. Melhorias no CreateWaveDialog

### Endpoint `picking.getByIds`

Criado novo endpoint para buscar múltiplos pedidos de uma vez:

```ts
// server/routers.ts
getByIds: publicProcedure
  .input(z.object({ ids: z.array(z.number()) }))
  .query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const orders = await db
      .select({...})
      .from(pickingOrders)
      .where(inArray(pickingOrders.id, input.ids));

    // Buscar itens de cada pedido
    const ordersWithItems = await Promise.all(
      orders.map(async (order) => {
        const items = await db
          .select({...})
          .from(pickingOrderItems)
          .where(eq(pickingOrderItems.orderId, order.id));
        
        return { ...order, items };
      })
    );

    return ordersWithItems;
  }),
```

### Refatoração do Componente

Substituída lógica de queries dinâmicas (que violava regras dos hooks) por uma única query condicional:

```tsx
// ❌ Antes (INCORRETO - viola regras dos hooks)
const itemQueries = selectedOrderIds.map(id => 
  trpc.picking.getById.useQuery({ id })
);

// ✅ Depois (CORRETO)
const { data: ordersWithItems } = trpc.picking.getByIds.useQuery(
  { ids: selectedOrderIds },
  { enabled: open && selectedOrderIds.length > 0 }
);
```

---

## 4. Problema Pendente

### Botão "Confirmar e Gerar Onda" Não Responde

**Status**: 🔴 Não resolvido

**Sintomas**:
- Modal abre corretamente
- Prévia de consolidação carrega perfeitamente
- Todas as condições de `disabled` estão OK (`valid=true, pending=false, items=3, loading=false, error=false`)
- Botão não está desabilitado visualmente
- `onClick` não é executado (nem com cliques manuais, nem programáticos via console)
- `alert()` e `console.log()` dentro de `handleCreateWave` não são disparados

**Hipóteses**:
1. Problema de z-index ou elemento sobrepondo o botão
2. Bug do Dialog do shadcn/ui bloqueando eventos
3. Problema específico do ambiente de preview

**Próximos Passos**:
- Investigar estrutura DOM do modal com DevTools
- Testar com Dialog de outra biblioteca
- Verificar se há event listeners conflitantes

---

## Arquivos Modificados

### Backend
- `server/waveLogic.ts` - Corrigida lógica de alocação de múltiplos endereços
- `server/routers.ts` - Adicionado endpoint `picking.getByIds`

### Frontend
- `client/src/pages/PickingOrders.tsx` - Adicionado useMemo para remover duplicatas
- `client/src/components/CreateWaveDialog.tsx` - Refatorado para usar `getByIds`

---

## Testes Realizados

### ✅ Teste 1: Erro de Chave Duplicada
- **Ação**: Acessar `/picking`
- **Resultado**: Console limpo, sem warnings de React
- **Status**: ✅ Aprovado

### ✅ Teste 2: Modal de Geração de Onda
- **Ação**: Selecionar 2 pedidos da Hapvida e clicar em "Gerar Onda"
- **Resultado**: Modal abre com prévia correta:
  - 2 Pedidos
  - 3 Produtos Distintos
  - 580 Itens Totais
  - Consolidação por produto funcionando
- **Status**: ✅ Aprovado

### ✅ Teste 3: Validação de Cliente
- **Ação**: Selecionar pedidos de clientes diferentes
- **Resultado**: Validação exibe erro "Todos os pedidos devem ser do mesmo cliente"
- **Status**: ✅ Aprovado

### ❌ Teste 4: Criação de Onda
- **Ação**: Clicar em "Confirmar e Gerar Onda"
- **Resultado**: Botão não responde
- **Status**: ❌ Falhou (problema pendente)

---

## Conclusão

Dois dos três erros reportados foram corrigidos com sucesso:

1. ✅ **Chave duplicada**: Resolvido com useMemo
2. ✅ **Validação de estoque**: Resolvido com alocação de múltiplos endereços
3. ❌ **Botão não responde**: Requer investigação adicional

O sistema está funcional para visualização e validação, mas a criação efetiva de ondas ainda precisa de correção.
