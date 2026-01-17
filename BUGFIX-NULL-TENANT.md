# 🐛 CORREÇÃO CRÍTICA: Inventory com tenantId NULL

## Problema

**Sintoma:** Pedidos de separação falham com erro "Estoque insuficiente" mesmo com estoque disponível visível na tela.

**Causa Raiz:** Registros de `inventory` criados com `tenantId = NULL`, fazendo com que a query de validação de pedidos (que filtra por `tenantId = X`) não encontre o estoque.

**Histórico:**
- **Primeira ocorrência:** Data desconhecida
- **Segunda ocorrência:** Data desconhecida  
- **Terceira ocorrência:** 11/01/2026 às 18:10
- **Correção permanente:** 11/01/2026 às 19:30

## Impacto

- ❌ Criação de pedidos de separação falha
- ❌ Importação de pedidos via Excel falha
- ❌ Estoque aparece como "0 disponível" mesmo existindo
- ✅ Visualização de estoque funciona (não filtra por tenant)

## Solução Implementada

### 1. Validações no Código

**Arquivo:** `server/movements.ts`
- Validação obrigatória de `tenantId` no início da função `registerMovement()`
- Lança erro se `tenantId` for `null` ou `undefined`
- Log de erro detalhado para debug

**Arquivo:** `server/modules/inventory-sync.ts`
- Validação obrigatória de `tenantId` antes de criar novo registro de inventory
- Lança erro se `tenantId` for `null` ou `undefined`
- Log de erro detalhado para debug

### 2. Script de Correção Automática

**Arquivo:** `server/fix-null-tenant.mjs`

**Execução manual:**
```bash
cd /home/ubuntu/wms-medax
node server/fix-null-tenant.mjs
```

**Lógica:**
1. Busca todos os registros de `inventory` com `tenantId = NULL`
2. Para cada registro, tenta obter `tenantId` do produto ou do endereço
3. Atualiza o registro com o `tenantId` correto
4. Registra logs detalhados de sucesso/erro

### 3. Como Prevenir

✅ **Sempre passar `tenantId` ao criar movimentações:**
```typescript
await registerMovement({
  productId: 123,
  fromLocationId: 456,
  toLocationId: 789,
  quantity: 100,
  tenantId: order.tenantId, // ← OBRIGATÓRIO
  // ...
});
```

✅ **Verificar que produtos e endereços têm `tenantId` configurado**

✅ **Executar script de correção periodicamente (opcional):**
```bash
# Adicionar ao crontab ou startup do servidor
node server/fix-null-tenant.mjs
```

## Como Detectar o Problema

### Sintomas:
1. Erro ao criar pedido: "Estoque insuficiente... Disponível: 0 unidades"
2. Console do navegador mostra: "Available stock: 1440" mas erro persiste
3. Tela de estoque mostra quantidade disponível

### Diagnóstico:
```sql
-- Verificar se há inventory com tenantId NULL
SELECT COUNT(*) as total
FROM inventory
WHERE tenantId IS NULL;

-- Ver detalhes
SELECT 
  i.id,
  p.sku,
  p.description,
  i.quantity,
  i.tenantId,
  p.tenantId as productTenantId
FROM inventory i
LEFT JOIN products p ON i.productId = p.id
WHERE i.tenantId IS NULL;
```

### Correção Rápida:
```bash
node server/fix-null-tenant.mjs
```

## Checklist de Verificação

Após implementar esta correção, verificar:

- [ ] Código de `movements.ts` tem validação de `tenantId`
- [ ] Código de `inventory-sync.ts` tem validação de `tenantId`
- [ ] Script `fix-null-tenant.mjs` existe e funciona
- [ ] Não há inventory com `tenantId = NULL` no banco
- [ ] Criação de pedidos funciona corretamente
- [ ] Importação de pedidos via Excel funciona

## Contato

Se o problema persistir, verificar:
1. Logs do servidor (`console.error` com tag `[MOVIMENTO CRÍTICO]` ou `[INVENTORY SYNC CRÍTICO]`)
2. Executar script de correção novamente
3. Verificar se há outros pontos no código que criam `inventory` sem passar `tenantId`
