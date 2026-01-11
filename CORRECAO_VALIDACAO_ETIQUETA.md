# Correção: Validação de Etiqueta no Picking

**Data:** 11/01/2026  
**Versão:** a1b2f6f9 → (nova versão)

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

**Problema Real: Produtos Duplicados no Banco de Dados**

Investigação revelou que existem **2 produtos diferentes** com o **mesmo SKU** no banco:

```sql
SELECT id, sku, description FROM products WHERE sku = '401460P';
```

| id     | sku      | description |
|--------|----------|-------------|
| 180001 | 401460P  | Produto X   |
| 180002 | 401460P  | Produto X   |

**Fluxo do erro:**
1. Etiqueta `401460P22D10LB111` foi criada associada ao produto ID `180001`
2. Onda de picking foi criada com produto ID `180002` (mesmo SKU, ID diferente)
3. Validação comparava `productId` (180001 ≠ 180002) → **ERRO**
4. Mas ambos têm SKU `401460P` → mensagem confusa

**Arquivo:** `server/pickingExecution.ts` (linha 196)

```typescript
// ❌ ANTES (comparava productId)
if (label.productId !== waveItem.productId) {
  throw new TRPCError({ 
    message: `Produto incorreto! Esperado SKU: ${waveItem.productSku}, mas a etiqueta "${params.labelCode}" pertence ao SKU: ${label.productSku}` 
  });
}
```

Logs do servidor confirmaram:
```
label.productId: 180001 number
label.productSku: 401460P
waveItem.productId: 180002 number
waveItem.productSku: 401460P
São iguais? false  ← IDs diferentes, mas SKUs iguais!
```

## ✅ Solução Implementada

**Alterada validação para comparar SKU ao invés de productId:**

```typescript
// ✅ DEPOIS (compara SKU)
// Nota: Comparamos SKU porque podem existir produtos duplicados no banco com mesmo SKU mas IDs diferentes
if (label.productSku !== waveItem.productSku) {
  throw new TRPCError({ 
    code: "BAD_REQUEST", 
    message: `Produto incorreto! Esperado SKU: ${waveItem.productSku}, mas a etiqueta "${params.labelCode}" pertence ao SKU: ${label.productSku}` 
  });
}
```

**Justificativa:**
- No contexto de picking, o que importa é o **SKU do produto** (código visível na etiqueta)
- Operador não sabe e não precisa saber o `productId` interno do banco
- SKU é a chave de negócio, productId é chave técnica
- Mesmo com produtos duplicados, a validação funciona corretamente

## 🎯 Resultado

- ✅ Validação de produto funciona corretamente mesmo com produtos duplicados
- ✅ Mensagens de erro mostram SKUs corretos
- ✅ Operador pode escanear etiquetas sem erros falsos
- ✅ Conferência cega funciona como esperado
- ✅ Sistema tolerante a dados duplicados (problema de qualidade de dados, não de lógica)

## 📝 Arquivos Modificados

- `server/pickingExecution.ts` (linhas 195-202)

## 🧪 Testes

**Cenário 1: Etiqueta Correta (mesmo com produtos duplicados)**
- Onda com produto SKU `401460P` (ID 180002)
- Etiqueta `401460P22D10LB111` associada ao SKU `401460P` (ID 180001)
- **Resultado:** ✅ Aceita corretamente (SKUs iguais)

**Cenário 2: Etiqueta Incorreta**
- Onda com produto SKU `401460P`
- Etiqueta associada ao SKU `999999X`
- **Resultado:** ❌ Rejeita com mensagem clara: "Esperado SKU: 401460P, mas a etiqueta pertence ao SKU: 999999X"

## 🔧 Recomendação Adicional

**Problema de Qualidade de Dados:**
Existem produtos duplicados no banco com mesmo SKU. Recomenda-se:

1. **Adicionar constraint UNIQUE no campo `sku`** (por tenant):
```sql
ALTER TABLE products ADD UNIQUE KEY unique_sku_per_tenant (tenantId, sku);
```

2. **Limpar dados duplicados** antes de aplicar constraint:
```sql
-- Identificar duplicatas
SELECT sku, tenantId, COUNT(*) as count
FROM products
GROUP BY sku, tenantId
HAVING count > 1;

-- Manter apenas o registro mais antigo e atualizar referências
```

3. **Validar SKU único** nos endpoints de criação/edição de produtos

## 📚 Contexto

Esta correção é parte do módulo de **Wave Picking** (Separação por Onda) que implementa conferência cega similar ao recebimento. O operador escaneia etiquetas criadas durante o recebimento e o sistema valida se a etiqueta pertence ao produto esperado na onda.
