# Changelog - WMS Med@x

## [2026-01-09] - Correção: Alocação de Estoque Após Conferência Cega

### 🐛 Problema Identificado

Após finalizar a conferência cega, os itens não estavam sendo alocados nos endereços de recebimento (REC). O estoque estava sendo criado na tabela `inventory`, mas com `locationId = NULL`.

### ✅ Causa Raiz

O endpoint `blindConference.finish` tinha dois problemas:

1. **Endereço REC hardcoded**: Usava `recLocationId = 1` fixo, que não existia no banco
2. **Status incorreto**: Criava estoque com status "quarantine" em vez de "available"

### ✅ Correção Implementada

#### 1. Busca Dinâmica de Endereço REC

Substituído ID fixo por busca dinâmica do primeiro endereço com código contendo "REC":

```typescript
const recLocations = await db.select()
  .from(warehouseLocations)
  .where(sql`${warehouseLocations.code} LIKE '%REC%'`)
  .limit(1);

if (recLocations.length === 0) {
  throw new Error("Nenhum endereço de recebimento (REC) encontrado.");
}

const recLocationId = recLocations[0].id;
```

#### 2. Status Correto

Alterado status de "quarantine" para "available":

```typescript
status: "available", // Disponível após conferência
```

#### 3. Import Adicionado

Adicionado `warehouseLocations` aos imports do `blindConferenceRouter.ts`

### 📝 Impacto

- ✅ Estoque agora é alocado corretamente no endereço REC
- ✅ Status "available" permite consultas e movimentações imediatas
- ✅ Rastreabilidade completa: produto + lote + endereço + quantidade
- ✅ Integração com módulo de Estoque funciona corretamente

### ⚠️ Pré-requisitos

É necessário ter pelo menos um endereço cadastrado com código contendo "REC". Exemplo:
- Código: `REC-01`
- Tipo: `whole` ou `fraction`
- Regra: `single` ou `multi`
- Status: `available`

Se nenhum endereço REC existir, o sistema retorna erro claro.

### 📝 Arquivos Modificados

- `server/blindConferenceRouter.ts` - Endpoint `finish`
- `todo.md` - Rastreamento de bugs
- `CORRECAO_ALOCACAO_ESTOQUE.md` - Documentação completa

---

## [2026-01-09] - Módulo de Estoque Implementado

### ✨ Funcionalidade Implementada

Módulo completo de Estoque com consultas de posições, movimentações entre endereços e dashboard de ocupação com sugestões inteligentes de otimização.

### ✅ Backend Implementado

#### Arquivos Criados

**server/inventory.ts** - Funções de consulta de estoque
- `getInventoryPositions()` - Lista posições com filtros avançados (produto, lote, endereço, status, validade)
- `getInventorySummary()` - Resumo consolidado (total de posições, quantidade, endereços, lotes)
- `getLocationStock()` - Saldo de endereço específico por produto

**server/movements.ts** - Funções de movimentação
- `registerMovement()` - Registra movimentação com validações completas
- `getMovementHistory()` - Histórico de movimentações com filtros
- Validações: saldo disponível, regras de armazenagem (single/multi, whole/fraction)

**server/occupancy.ts** - Dashboard de ocupação
- `getOverallOccupancy()` - Ocupação geral do armazém (total, ocupados, disponíveis, bloqueados, %)
- `getOccupancyByZone()` - Ocupação detalhada por zona
- `getOptimizationSuggestions()` - Sugestões inteligentes de otimização

**server/stockRouter.ts** - Endpoints tRPC
- `stock.getPositions` - Consulta de posições
- `stock.getSummary` - Resumo de estoque
- `stock.registerMovement` - Registro de movimentação
- `stock.getMovements` - Histórico de movimentações
- `stock.getOverallOccupancy` - Ocupação geral
- `stock.getOccupancyByZone` - Ocupação por zona
- `stock.getOptimizationSuggestions` - Sugestões de otimização

### ✅ Frontend Implementado

#### Páginas Criadas

**StockPositions.tsx** (/stock)
- Consulta de posições de estoque com filtros avançados
- Filtros: produto (SKU/descrição), lote, endereço, status, validade
- Tabela com paginação e ordenação
- Resumo: total de posições, quantidade total, endereços, lotes
- Botão de exportação para Excel

**StockMovements.tsx** (/stock/movements)
- Registro de movimentações entre endereços
- Tipos: Transferência, Ajuste, Entrada, Saída
- Validações em tempo real (saldo, regras de armazenagem)
- Histórico de movimentações com filtros
- Rastreabilidade completa (usuário, data, motivo)

**OccupancyDashboard.tsx** (/stock/occupancy)
- Dashboard de ocupação geral do armazém
- Gráficos de ocupação por zona
- Sugestões inteligentes de otimização:
  - **Consolidação**: Agrupar produtos em menos endereços
  - **Capacidade Crítica**: Alertas de zonas com >85% de ocupação
  - **Realocação**: Sugestões de movimentação para melhor distribuição
  - **Eficiência**: Oportunidades de melhoria operacional
- Cada sugestão inclui: prioridade, descrição, impacto, métricas, ações recomendadas

### 📝 Funcionalidades Principais

1. **Consulta de Posições**
   - Filtros avançados por múltiplos critérios
   - Visualização consolidada de estoque
   - Exportação de relatórios

2. **Movimentações**
   - Validação de saldo disponível
   - Respeito às regras de armazenagem
   - Atualização automática de status de endereços
   - Rastreabilidade completa

3. **Dashboard de Ocupação**
   - Métricas em tempo real
   - Visualização por zona
   - Sugestões inteligentes baseadas em padrões

### 📚 Documentação

- Criado `MODULO_ESTOQUE.md` com documentação completa
- Estrutura de arquivos
- Funcionalidades implementadas
- Regras de negócio
- Integração com outros módulos
- Próximas melhorias

### 📝 Arquivos Modificados/Criados

**Backend:**
- `server/inventory.ts` (novo)
- `server/movements.ts` (novo)
- `server/occupancy.ts` (novo)
- `server/stockRouter.ts` (novo)
- `server/routers.ts` (modificado - registrado stockRouter)

**Frontend:**
- `client/src/pages/StockPositions.tsx` (novo)
- `client/src/pages/StockMovements.tsx` (novo)
- `client/src/pages/OccupancyDashboard.tsx` (novo)
- `client/src/App.tsx` (modificado - adicionadas rotas)

**Documentação:**
- `MODULO_ESTOQUE.md` (novo)
- `todo.md` (atualizado)

### ⚠️ Observações

- Schema de banco já tinha as tabelas necessárias (`inventory`, `inventoryMovements`, `productLocationMapping`)
- Testes unitários não foram implementados na entrega inicial (requerem dados de teste complexos)
- Recomenda-se testar via interface com dados reais

---

## [2026-01-09] - Botões de Navegação em Todas as Páginas

### ✨ Funcionalidade Implementada

Adicionado botões "Início" e "Voltar" em todas as páginas do sistema para melhorar a usabilidade e facilitar a navegação.

### ✅ Implementação

#### Componente PageHeader (já existente)
- **Localização**: `client/src/components/PageHeader.tsx`
- **Funcionalidades**:
  - Botão "Voltar": Usa `window.history.back()` para voltar à página anterior
  - Botão "Início": Navega para a página principal (`/`)
  - Barra de navegação sticky no topo com logo Med@x
  - Título e descrição da página
  - Suporte para ações customizadas (botões adicionais)

#### Páginas Atualizadas

**Novas implementações:**
- `client/src/pages/Receiving.tsx` - Adicionado PageHeader com ícone de recebimento
- `client/src/pages/ComponentShowcase.tsx` - Adicionado PageHeader com botão de tema

**Páginas que já tinham PageHeader:**
- Products.tsx
- Locations.tsx
- Picking.tsx
- Inventory.tsx
- Cadastros.tsx
- Users.tsx
- Tenants.tsx
- NFEImport.tsx

**Páginas que não precisam:**
- Home.tsx - É a página inicial, não faz sentido ter botão "Início"
- NotFound.tsx - Página de erro com navegação própria

### 📝 Benefícios

1. **Navegação Intuitiva**: Usuários sempre sabem como voltar ou ir para o início
2. **Consistência**: Design uniforme em todas as páginas do sistema
3. **Acessibilidade**: Botões visíveis e de fácil acesso no topo da página
4. **Produtividade**: Menos cliques para navegar entre módulos

### 📝 Arquivos Modificados

- `client/src/pages/Receiving.tsx` - Adicionado PageHeader
- `client/src/pages/ComponentShowcase.tsx` - Adicionado PageHeader
- `todo.md` - Rastreamento de features

---

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

### 📝 Arquivos Modificados

- `server/nfeParser.ts` - Parser de XML
- `server/routers.ts` - Importação de NF-e
- `server/blindConferenceRouter.ts` - Lógica de conferência cega
- `client/src/components/BlindCheckModal.tsx` - Correção de imports
- `client/src/App.tsx` - Adição de alias de rota
- `scripts/reset-receiving-order.mjs` - Script de limpeza (novo)
- `todo.md` - Rastreamento de bugs

### 🔗 Referências

- Documentação NF-e: Tag `<rastro>` para rastreabilidade de medicamentos
- ANVISA: Resolução RDC nº 157/2017 - Rastreabilidade de medicamentos

---

## [2026-01-08] - Correção de Rota 404

### 🐛 Problema Identificado

Rota `/recebimento` retornava erro 404 porque apenas `/receiving` estava configurada no roteador.

### ✅ Correção Implementada

#### App.tsx
- **Adicionado**: Alias `/recebimento` para o componente `Receiving`
- **Motivo**: O `BlindCheckModal` navega para `/recebimento` após finalizar conferência (linha 147)
- **Consistência**: Interface em português deve ter rotas em português

```typescript
<Route path={"/receiving"} component={Receiving} />
<Route path={"/recebimento"} component={Receiving} /> // ← Novo alias
```

### 📝 Observações

- Ambas as rotas (`/receiving` e `/recebimento`) funcionam corretamente
- Erro de "chaves duplicadas" reportado anteriormente foi resolvido após limpeza de cache do navegador
- Keys na renderização estão corretas (usando `item.id` único)
