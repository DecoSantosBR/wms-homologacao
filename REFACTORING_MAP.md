# 🗺️ Mapeamento: pickingReservations → pickingAllocations

## 📊 Comparação de Campos

### pickingReservations (ANTIGA - será deletada)
```typescript
{
  id: int
  pickingOrderId: int
  productId: int
  inventoryId: int
  batch: varchar(50)
  uniqueCode: varchar(200)
  quantity: int
  createdAt: timestamp
}
```

### pickingAllocations (NOVA - tabela unificada)
```typescript
{
  id: int
  pickingOrderId: int
  productId: int
  productSku: varchar(100)        // ➕ NOVO
  locationId: int                 // ➕ NOVO (via inventoryId)
  locationCode: varchar(50)       // ➕ NOVO
  batch: varchar(100)             // ✅ JÁ EXISTE
  expiryDate: date                // ➕ NOVO
  uniqueCode: varchar(200)        // ✅ JÁ EXISTE
  quantity: int                   // ✅ MESMO NOME
  isFractional: boolean           // ➕ NOVO
  sequence: int                   // ➕ NOVO (ordem de rota)
  status: enum                    // ➕ NOVO (pending/in_progress/picked/short_picked)
  pickedQuantity: int             // ➕ NOVO
  createdAt: timestamp            // ✅ JÁ EXISTE
}
```

## 🔄 Mapeamento de Colunas

| pickingReservations | pickingAllocations | Ação |
|---------------------|-------------------|------|
| `id` | `id` | ✅ Mesmo nome |
| `pickingOrderId` | `pickingOrderId` | ✅ Mesmo nome |
| `productId` | `productId` | ✅ Mesmo nome |
| `inventoryId` | `locationId` | ⚠️ **ATENÇÃO:** Precisa JOIN com inventory para pegar locationId |
| `batch` | `batch` | ✅ Mesmo nome |
| `uniqueCode` | `uniqueCode` | ✅ Mesmo nome |
| `quantity` | `quantity` | ✅ Mesmo nome |
| - | `productSku` | ➕ Buscar de products |
| - | `locationCode` | ➕ Buscar de warehouseLocations |
| - | `expiryDate` | ➕ Buscar de inventory |
| - | `isFractional` | ➕ Default: false |
| - | `sequence` | ➕ Calcular ordem de rota |
| - | `status` | ➕ Default: 'pending' |
| - | `pickedQuantity` | ➕ Default: 0 |

## 📁 Arquivos a Refatorar (Prioridade)

### 🔴 CRÍTICOS (afetam fluxo principal)
1. **waveLogic.ts** (11 usos)
   - Linha 248-273: Lê pickingReservations para criar onda
   - **Ação:** Mudar para ler pickingAllocations

2. **stage.ts** (7 usos)
   - Linha 613-629: Busca reservas para conferência
   - Linha 757-758: Deleta reservas após conferência
   - **Ação:** Mudar para pickingAllocations

3. **routers.ts** (12 usos)
   - Linhas 1857, 2231, 3074: Cria pickingReservations
   - Linhas 2121-2137, 2318-2335: Deleta reservas ao cancelar
   - Linha 2359-2361: Calcula total reservado
   - **Ação:** Criar pickingAllocations ao invés de reservas

4. **clientPortalRouter.ts** (3 usos)
   - Linhas 1246, 1661: Cria pickingReservations
   - **Ação:** Criar pickingAllocations

### 🟡 IMPORTANTES (validações e cálculos)
5. **inventory.ts** (3 usos)
   - Linha 338-343: Calcula reservedQuantity
   - **Ação:** Somar pickingAllocations.quantity onde status != 'picked'

6. **movements.ts** (5 usos)
   - Linha 82-84: Valida movimentações
   - Linha 407-413: Calcula disponível
   - **Ação:** Usar pickingAllocations

7. **shippingRouter.ts** (4 usos)
   - Linha 637, 1433: Cria reservas
   - **Ação:** Criar pickingAllocations

### 🟢 TESTES (8 arquivos)
- Atualizar após refatoração principal

## 🎯 Estratégia de Migração

1. **Criar pickingAllocations no momento da criação do pedido** (routers.ts, clientPortalRouter.ts)
   - Ao reservar estoque, já criar alocação com locationCode, sequence, etc
   - Eliminar criação de pickingReservations

2. **waveLogic.ts: Ler pickingAllocations ao invés de reservas**
   - Buscar alocações pendentes (status = 'pending')
   - Agrupar por locationCode para otimizar rota

3. **stage.ts: Conferências usam pickingAllocations**
   - Verificar pickedQuantity vs quantity
   - Atualizar status para 'picked' após conferência

4. **inventory.ts: Calcular reservedQuantity de pickingAllocations**
   - SUM(quantity) WHERE status IN ('pending', 'in_progress')

## ⚠️ ATENÇÃO: Campos Adicionais Necessários

Para criar pickingAllocations, precisamos:
- `productSku`: JOIN com products
- `locationId` + `locationCode`: JOIN com inventory → warehouseLocations
- `expiryDate`: Copiar de inventory
- `sequence`: Calcular ordem de rota (pode ser 0 inicialmente)
- `isFractional`: Verificar se quantidade < unitsPerBox
