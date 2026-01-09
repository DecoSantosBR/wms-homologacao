# Changelog - WMS Med@x

## [2026-01-08] - Correção Crítica: Conferência Cega com Múltiplos Lotes

### 🐛 Problemas Identificados

1. **Lotes diferentes sendo tratados como um único lote**: Quando um mesmo produto tinha múltiplos lotes na NF-e (ex: INTRAFIX PRIMELINE AIR com lotes 22D10LB111 e 22D08LB108), o sistema somava todas as quantidades e comparava contra cada item esperado separadamente, gerando divergências incorretas.

2. **Parser de NF-e não extraía informações de lote**: O parser (`server/nfeParser.ts`) não estava lendo a tag `<rastro>` do XML, que contém o número do lote (`nLote`) e data de validade (`dVal`).

3. **Comparação incorreta no resumo**: O endpoint `getSummary` do `blindConferenceRouter.ts` comparava apenas por `productId`, ignorando o campo `batch`.

### ✅ Correções Implementadas

#### 1. Parser de NF-e (`server/nfeParser.ts`)
- **Adicionado**: Campos `lote` e `validade` na interface `NFEProduct`
- **Implementado**: Extração da tag `<rastro>` do XML para capturar:
  - `nLote` → `lote` (número do lote)
  - `dVal` → `validade` (data de validade)
- **Suporte**: Tratamento de `<rastro>` como array ou objeto único

```typescript
// Extrair dados de rastreabilidade (lote e validade)
const rastro = prod?.rastro;
let lote = null;
let validade = null;

if (rastro) {
  const rastroArray = Array.isArray(rastro) ? rastro : [rastro];
  if (rastroArray.length > 0) {
    lote = extractValue(rastroArray[0]?.nLote, null);
    validade = extractValue(rastroArray[0]?.dVal, null);
  }
}
```

#### 2. Importação de NF-e (`server/routers.ts`)
- **Modificado**: Endpoint `nfe.importReceiving` para salvar lote e validade no banco
- **Antes**: `batch: null, expiryDate: null`
- **Depois**: `batch: produtoNFE.lote || null, expiryDate: produtoNFE.validade ? new Date(produtoNFE.validade) : null`

#### 3. Conferência Cega - Resumo (`server/blindConferenceRouter.ts`)
- **Modificado**: Endpoint `getSummary` para incluir campo `batch` na query de `expectedItems`
- **Corrigido**: Lógica de comparação para filtrar por `productId + batch`:

```typescript
// ANTES: Comparava apenas por productId
const conferenced = associations
  .filter(a => a.productId === expected.productId)
  .reduce((sum, a) => sum + a.totalUnits, 0);

// DEPOIS: Compara por productId + batch
const conferenced = associations
  .filter(a => 
    a.productId === expected.productId && 
    (a.batch === expected.batch || (a.batch === null && expected.batch === null))
  )
  .reduce((sum, a) => sum + a.totalUnits, 0);
```

#### 4. Correção de Import React (`client/src/components/BlindCheckModal.tsx`)
- **Corrigido**: Adicionado import faltante: `import { useState, useEffect, useRef } from "react";`
- **Problema**: Causava 49 erros no console do navegador

#### 5. Script de Limpeza (`scripts/reset-receiving-order.mjs`)
- **Criado**: Script para limpar ordens de recebimento e suas dependências
- **Utilidade**: Permite reimportar NF-e para testar correções
- **Uso**: `npx tsx scripts/reset-receiving-order.mjs`

### 📋 Impacto

**Antes das correções:**
- Produto com 2 lotes diferentes → Sistema somava tudo e comparava contra cada item
- INTRAFIX PRIMELINE AIR Lote A (560 un) + Lote B (1600 un) = 2160 un
- Comparação: 2160 vs 560 = +1600 (divergência incorreta)
- Comparação: 2160 vs 1600 = +560 (divergência incorreta)

**Depois das correções:**
- Produto com 2 lotes diferentes → Sistema trata como itens separados
- INTRAFIX PRIMELINE AIR Lote A: 560 conferido vs 560 esperado = OK ✓
- INTRAFIX PRIMELINE AIR Lote B: 1600 conferido vs 1600 esperado = OK ✓

### ⚠️ Observações Importantes

1. **Ordens antigas**: Ordens de recebimento criadas antes desta correção têm `batch: null` no banco e não funcionarão corretamente. É necessário reimportar a NF-e.

2. **Dependência de XML**: A extração de lote depende da tag `<rastro>` estar presente no XML da NF-e. Caso a tag não exista, o campo `batch` será `null`.

3. **Rastreabilidade ANVISA**: Esta correção é essencial para conformidade com regulamentações da ANVISA que exigem rastreabilidade por lote de medicamentos.

### 🧪 Como Testar

1. Limpar ordem existente: `npx tsx scripts/reset-receiving-order.mjs`
2. Importar NF-e com produtos que tenham múltiplos lotes
3. Iniciar conferência cega
4. Associar etiquetas aos produtos
5. Verificar no modal de finalização que lotes diferentes aparecem como linhas separadas
6. Confirmar que divergências são calculadas corretamente por produto+lote

### 📁 Arquivos Modificados

- `server/nfeParser.ts` - Parser de XML
- `server/routers.ts` - Importação de NF-e
- `server/blindConferenceRouter.ts` - Lógica de conferência cega
- `client/src/components/BlindCheckModal.tsx` - Correção de imports
- `scripts/reset-receiving-order.mjs` - Script de limpeza (novo)
- `todo.md` - Rastreamento de bugs

### 🔗 Referências

- Documentação NF-e: Tag `<rastro>` para rastreabilidade de medicamentos
- ANVISA: Resolução RDC nº 157/2017 - Rastreabilidade de medicamentos
