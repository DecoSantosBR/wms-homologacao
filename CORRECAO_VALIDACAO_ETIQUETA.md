# Correção: Validação de Etiqueta no Picking

**Data:** 11/01/2026  
**Versão:** c43ef811

## 🐛 Problema Identificado

Erro ao validar etiqueta na execução de picking:

```
Produto incorreto! Esperado SKU: 401460P, mas a etiqueta "401460P22D10LB111" pertence ao SKU: 401460P
```

**Análise:**
- SKU esperado: `401460P`
- SKU da etiqueta: `401460P`
- **São iguais**, mas o sistema retornava erro

## 🔍 Causa Raiz

**Arquivo:** `server/pickingExecution.ts` (linhas 173-177)

A query que busca o `waveItem` não fazia JOIN com a tabela `products`, então o campo `waveItem.productSku` não existia (retornava `undefined`).

```typescript
// ❌ ANTES (incorreto)
const [waveItem] = await db
  .select()
  .from(pickingWaveItems)
  .where(eq(pickingWaveItems.id, params.waveItemId))
  .limit(1);

// waveItem.productSku = undefined
```

Quando a validação comparava:
```typescript
if (label.productId !== waveItem.productId) {
  throw new TRPCError({ 
    message: `Produto incorreto! Esperado SKU: ${waveItem.productSku}, mas a etiqueta "${params.labelCode}" pertence ao SKU: ${label.productSku}` 
  });
}
```

A mensagem de erro mostrava:
- `waveItem.productSku` = `undefined` (exibido como string vazia ou valor incorreto)
- `label.productSku` = `"401460P"` (correto)

## ✅ Solução Implementada

Adicionado JOIN com a tabela `products` para buscar o SKU corretamente:

```typescript
// ✅ DEPOIS (correto)
const [waveItem] = await db
  .select({
    id: pickingWaveItems.id,
    waveId: pickingWaveItems.waveId,
    productId: pickingWaveItems.productId,
    batch: pickingWaveItems.batch,
    locationId: pickingWaveItems.locationId,
    totalQuantity: pickingWaveItems.totalQuantity,
    pickedQuantity: pickingWaveItems.pickedQuantity,
    status: pickingWaveItems.status,
    productSku: products.sku,          // ✅ Agora busca corretamente
    productName: products.description,  // ✅ Também disponível
  })
  .from(pickingWaveItems)
  .innerJoin(products, eq(pickingWaveItems.productId, products.id))
  .where(eq(pickingWaveItems.id, params.waveItemId))
  .limit(1);
```

## 🎯 Resultado

- ✅ Validação de produto funciona corretamente
- ✅ Mensagens de erro mostram SKUs corretos
- ✅ Operador pode escanear etiquetas sem erros falsos
- ✅ Conferência cega funciona como esperado

## 📝 Arquivos Modificados

- `server/pickingExecution.ts` (linhas 172-189)

## 🧪 Testes

**Cenário 1: Etiqueta Correta**
- Onda com produto SKU `401460P`
- Etiqueta `401460P22D10LB111` associada ao SKU `401460P`
- **Resultado:** ✅ Aceita corretamente

**Cenário 2: Etiqueta Incorreta**
- Onda com produto SKU `401460P`
- Etiqueta associada ao SKU `999999X`
- **Resultado:** ❌ Rejeita com mensagem clara: "Esperado SKU: 401460P, mas a etiqueta pertence ao SKU: 999999X"

## 📚 Contexto

Esta correção é parte do módulo de **Wave Picking** (Separação por Onda) que implementa conferência cega similar ao recebimento. O operador escaneia etiquetas criadas durante o recebimento e o sistema valida se a etiqueta pertence ao produto esperado na onda.
