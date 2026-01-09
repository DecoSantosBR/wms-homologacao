# Feature: Aprendizado Automático de Quantidade por Caixa

## Descrição

Sistema inteligente que aprende e memoriza a quantidade de unidades por caixa (unitsPerBox) durante a conferência cega, eliminando a necessidade de o operador informar esse valor repetidamente.

## Fluxo de Funcionamento

### 1. Primeira Associação de Etiqueta

Quando o operador associa uma etiqueta a um produto pela primeira vez:

1. **Operador bipa a etiqueta** → Sistema detecta que é uma etiqueta nova
2. **Operador seleciona o produto** → Sistema verifica se produto já tem `unitsPerBox` cadastrado
3. **Sistema preenche automaticamente**:
   - Se produto JÁ tem `unitsPerBox`: campo é preenchido automaticamente
   - Se produto NÃO tem `unitsPerBox`: operador informa manualmente
4. **Operador informa o lote** (opcional) → Sistema busca validade automaticamente do XML da NF-e
5. **Sistema salva `unitsPerBox` no cadastro do produto** (se não existia)

### 2. Próximas Associações do Mesmo Produto

Quando o operador bipa outra etiqueta do mesmo produto:

1. **Operador bipa a etiqueta** → Sistema detecta que é uma etiqueta nova
2. **Operador seleciona o produto** → Sistema busca `unitsPerBox` do cadastro
3. **Campo "Unidades por Embalagem" é preenchido automaticamente** com o valor aprendido
4. **Operador apenas confirma** (ou ajusta se necessário)

## Implementação Técnica

### Backend

#### 1. Schema (drizzle/schema.ts)

Campo `unitsPerBox` já existe na tabela `products`:

```typescript
export const products = mysqlTable("products", {
  // ... outros campos
  unitsPerBox: int("unitsPerBox"), // Quantidade de unidades por caixa/volume
  // ... outros campos
});
```

#### 2. Endpoint: associateLabel (server/blindConferenceRouter.ts)

Lógica de salvamento automático (linhas 228-234):

```typescript
// Atualizar unitsPerBox no produto se não existir
const product = await db.select().from(products).where(eq(products.id, input.productId)).limit(1);
if (product.length > 0 && product[0].unitsPerBox === null) {
  await db.update(products)
    .set({ unitsPerBox: input.unitsPerPackage })
    .where(eq(products.id, input.productId));
}
```

**Regra importante**: Só salva se `unitsPerBox` for `null`. Não sobrescreve valor existente.

#### 3. Novo Endpoint: products.getById (server/routers.ts)

Busca dados do produto para preencher automaticamente:

```typescript
getById: protectedProcedure
  .input(z.object({ id: z.number() }))
  .query(async ({ input }) => {
    const db = await getDb();
    if (!db) return null;
    const result = await db.select().from(products).where(eq(products.id, input.id)).limit(1);
    return result.length > 0 ? result[0] : null;
  }),
```

#### 4. Novo Endpoint: receiving.getItemByProductAndBatch (server/routers.ts)

Busca validade do lote do XML da NF-e:

```typescript
getItemByProductAndBatch: protectedProcedure
  .input(z.object({ 
    receivingOrderId: z.number(),
    productId: z.number(),
    batch: z.string(),
  }))
  .query(async ({ input }) => {
    const db = await getDb();
    if (!db) return null;
    const result = await db.select()
      .from(receivingOrderItems)
      .where(
        and(
          eq(receivingOrderItems.receivingOrderId, input.receivingOrderId),
          eq(receivingOrderItems.productId, input.productId),
          eq(receivingOrderItems.batch, input.batch)
        )
      )
      .limit(1);
    return result.length > 0 ? result[0] : null;
  }),
```

### Frontend

#### BlindCheckModal.tsx

**1. Query para buscar dados do produto:**

```typescript
// Buscar dados do produto selecionado
const { data: selectedProduct } = trpc.products.getById.useQuery(
  { id: selectedProductId! },
  { enabled: !!selectedProductId }
);
```

**2. useEffect para preencher unitsPerPackage automaticamente:**

```typescript
// Preencher unitsPerPackage automaticamente quando produto for selecionado
useEffect(() => {
  if (selectedProduct?.unitsPerBox) {
    setUnitsPerPackage(selectedProduct.unitsPerBox);
  } else {
    setUnitsPerPackage(1); // Valor padrão se não houver cadastrado
  }
}, [selectedProduct]);
```

**3. useEffect para preencher validade automaticamente ao informar lote:**

```typescript
// Preencher validade automaticamente quando lote for informado
useEffect(() => {
  if (selectedProductId && batch) {
    // Buscar item da ordem com mesmo produto e lote
    const matchingItem = items.find(item => 
      item.productId === selectedProductId
    );
    
    if (matchingItem) {
      // Buscar validade do receivingOrderItem via query
      utils.receiving.getItemByProductAndBatch.fetch({
        receivingOrderId,
        productId: selectedProductId,
        batch
      }).then(itemData => {
        if (itemData?.expiryDate) {
          // Converter timestamp para formato YYYY-MM-DD
          const date = new Date(itemData.expiryDate);
          const formattedDate = date.toISOString().split('T')[0];
          setExpiryDate(formattedDate);
        }
      }).catch(() => {
        // Ignorar erro se não encontrar
      });
    }
  }
}, [selectedProductId, batch, items, receivingOrderId, utils]);
```

## Benefícios

1. **Redução de Digitação**: Operador não precisa informar `unitsPerBox` repetidamente
2. **Redução de Erros**: Elimina erros de digitação em valores repetitivos
3. **Aumento de Produtividade**: Conferência mais rápida e eficiente
4. **Aprendizado Progressivo**: Sistema fica mais inteligente com o uso
5. **Preenchimento Automático de Validade**: Busca validade do XML da NF-e ao informar lote

## Exemplo de Uso

### Cenário: Recebimento de 10 caixas do produto "DIPIRONA 500MG"

**Primeira caixa:**
1. Operador bipa etiqueta `ETQ-001`
2. Seleciona produto "DIPIRONA 500MG"
3. Informa lote "25H04LB356" → Sistema preenche validade "31/12/2025" automaticamente
4. Informa "20 unidades por caixa"
5. Confirma → Sistema salva `unitsPerBox = 20` no cadastro

**Caixas 2 a 10:**
1. Operador bipa etiqueta `ETQ-002`, `ETQ-003`, ..., `ETQ-010`
2. Seleciona produto "DIPIRONA 500MG"
3. Informa lote "25H04LB356" → Sistema preenche validade "31/12/2025" automaticamente
4. **Campo "Unidades por Embalagem" já vem preenchido com "20"** ✨
5. Apenas confirma → Conferência concluída rapidamente

## Arquivos Modificados

- `server/routers.ts` - Adicionados endpoints `products.getById` e `receiving.getItemByProductAndBatch`
- `client/src/components/BlindCheckModal.tsx` - Adicionados useEffects para preenchimento automático
- `server/blindConferenceRouter.ts` - Lógica de salvamento já existia (linhas 228-234)
- `drizzle/schema.ts` - Campo `unitsPerBox` já existia

## Observações Importantes

1. **Não sobrescreve valores existentes**: Se produto já tem `unitsPerBox`, não é alterado
2. **Valor padrão é 1**: Se produto não tem `unitsPerBox` cadastrado, campo inicia com 1
3. **Operador pode ajustar**: Mesmo com preenchimento automático, operador pode alterar o valor
4. **Validade vem do XML**: Sistema busca validade do `receivingOrderItem` que foi extraído do XML da NF-e
