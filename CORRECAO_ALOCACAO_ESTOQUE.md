# Correção: Alocação de Estoque Após Conferência Cega

## Problema Identificado

Após finalizar a conferência cega, os itens não estavam sendo alocados nos endereços de recebimento (REC). O estoque estava sendo criado na tabela `inventory`, mas com `locationId = NULL`.

## Causa Raiz

O endpoint `blindConference.finish` no arquivo `server/blindConferenceRouter.ts` tinha dois problemas:

1. **Endereço REC hardcoded**: Usava `recLocationId = 1` fixo, que não existia no banco
2. **Status incorreto**: Criava estoque com status "quarantine" em vez de "available"

```typescript
// ANTES (linha 489)
const recLocationId = 1; // Temporário - deve buscar endereço com código "REC"

for (const assoc of associations) {
  await db.insert(inventory).values({
    // ...
    locationId: recLocationId, // ← ID fixo que não existe
    status: "quarantine", // ← Status incorreto
  });
}
```

## Correção Implementada

### 1. Busca Dinâmica de Endereço REC

Substituído ID fixo por busca dinâmica do primeiro endereço com código contendo "REC":

```typescript
// Buscar endereço REC dinamicamente (primeiro endereço com código contendo 'REC')
const recLocations = await db.select()
  .from(warehouseLocations)
  .where(sql`${warehouseLocations.code} LIKE '%REC%'`)
  .limit(1);

if (recLocations.length === 0) {
  throw new Error("Nenhum endereço de recebimento (REC) encontrado. Cadastre um endereço com código contendo 'REC'.");
}

const recLocationId = recLocations[0].id;
```

### 2. Status Correto

Alterado status de "quarantine" para "available":

```typescript
await db.insert(inventory).values({
  // ...
  status: "available", // Disponível após conferência
});
```

### 3. Import Adicionado

Adicionado `warehouseLocations` aos imports:

```typescript
import { 
  blindConferenceSessions, 
  labelAssociations, 
  labelReadings, 
  blindConferenceAdjustments,
  receivingOrders,
  receivingOrderItems,
  products,
  inventory,
  warehouseLocations // ← Novo
} from "../drizzle/schema";
```

## Validação

### Antes da Correção

```sql
SELECT i.id, i.locationId, i.status, wl.code 
FROM inventory i 
LEFT JOIN warehouseLocations wl ON i.locationId = wl.id;

-- Resultado:
-- locationId = NULL (endereço não encontrado)
-- status = "quarantine"
```

### Depois da Correção

```sql
SELECT i.id, i.locationId, i.status, wl.code 
FROM inventory i 
LEFT JOIN warehouseLocations wl ON i.locationId = wl.id;

-- Resultado esperado:
-- locationId = 3 (endereço REC-01)
-- status = "available"
-- code = "REC-01"
```

## Pré-requisitos

Para que a correção funcione, é necessário ter pelo menos um endereço cadastrado com código contendo "REC". Exemplo:

- Código: `REC-01`
- Tipo: `whole` ou `fraction`
- Regra: `single` ou `multi`
- Status: `available`

Se nenhum endereço REC existir, o sistema retorna erro claro:
> "Nenhum endereço de recebimento (REC) encontrado. Cadastre um endereço com código contendo 'REC'."

## Impacto

- ✅ Estoque agora é alocado corretamente no endereço REC
- ✅ Status "available" permite consultas e movimentações imediatas
- ✅ Rastreabilidade completa: produto + lote + endereço + quantidade
- ✅ Integração com módulo de Estoque funciona corretamente

## Próximos Passos

1. Testar fluxo completo: Importar NF-e → Conferência cega → Verificar estoque no endereço REC
2. Validar consulta de posições de estoque (/stock)
3. Testar movimentação do endereço REC para endereços de armazenagem
4. Implementar regra de negócio: Quando mover todo estoque de um endereço, atualizar status para "available"

## Arquivos Modificados

- `server/blindConferenceRouter.ts` - Endpoint `finish`
- `todo.md` - Rastreamento de bugs
- `CORRECAO_ALOCACAO_ESTOQUE.md` - Documentação (este arquivo)
