# Correção de Bug: Violação da Regra de Hooks em Reports.tsx

**Data:** 29/01/2026  
**Módulo:** Relatórios WMS  
**Arquivo:** `client/src/pages/Reports.tsx`

---

## 🐛 Problema Identificado

### Sintoma
Erro crítico na página `/reports` impedindo o uso do módulo de relatórios:

```
Error: Rendered more hooks than during the previous render.
React has detected a change in the order of Hooks called by Reports.
```

### Causa Raiz
**Violação da "Rules of Hooks" do React**: Queries tRPC estavam sendo chamadas condicionalmente usando operadores ternários encadeados baseados no estado `selectedReport`.

**Código Problemático (linhas ~148-180):**
```typescript
// ❌ ERRADO: Uso condicional de Hooks
const reportQuery = selectedReport === 'stockPosition'
  ? trpc.reports.stockPosition.useQuery(...)
  : selectedReport === 'stockByClient'
  ? trpc.reports.stockByClient.useQuery(...)
  : selectedReport === 'expiringProducts'
  ? trpc.reports.expiringProducts.useQuery(...)
  : ...
```

### Por Que Isso É Um Problema?

A **regra fundamental dos Hooks do React** determina que:
1. Hooks devem ser chamados **sempre na mesma ordem** em cada render
2. Hooks **não podem** ser chamados condicionalmente (dentro de `if`, `switch`, ternários, etc.)

Quando `selectedReport` mudava, diferentes queries eram chamadas, alterando a ordem dos Hooks e causando o erro.

---

## ✅ Solução Implementada

### Estratégia
Refatorar para **chamar TODAS as queries incondicionalmente**, mas controlar sua execução usando a opção `enabled` do TanStack Query (React Query).

### Código Corrigido

```typescript
// ✅ CORRETO: Todas as queries sempre chamadas
const defaultDateFilters = {
  startDate: filters.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  endDate: filters.endDate || new Date().toISOString().split('T')[0],
};

// Queries de Estoque (6)
const stockPositionQuery = trpc.reports.stockPosition.useQuery(
  { ...filters, page: currentPage },
  { enabled: selectedReport === 'stockPosition' }
);
const stockByTenantQuery = trpc.reports.stockByTenant.useQuery(
  { ...filters, page: currentPage },
  { enabled: selectedReport === 'stockByTenant' }
);
const stockByLocationQuery = trpc.reports.stockByLocation.useQuery(
  { ...filters, page: currentPage },
  { enabled: selectedReport === 'stockByLocation' }
);
const expiringProductsQuery = trpc.reports.expiringProducts.useQuery(
  { ...filters, page: currentPage },
  { enabled: selectedReport === 'expiringProducts' }
);
const productAvailabilityQuery = trpc.reports.productAvailability.useQuery(
  { ...filters, page: currentPage },
  { enabled: selectedReport === 'productAvailability' }
);
const inventoryMovementsQuery = trpc.reports.inventoryMovements.useQuery(
  { ...filters, ...defaultDateFilters, page: currentPage },
  { enabled: selectedReport === 'inventoryMovements' }
);

// Queries Operacionais (5)
const pickingProductivityQuery = trpc.reports.pickingProductivity.useQuery(
  { ...filters, ...defaultDateFilters, page: currentPage },
  { enabled: selectedReport === 'pickingProductivity' }
);
const pickingAccuracyQuery = trpc.reports.pickingAccuracy.useQuery(
  { ...filters, ...defaultDateFilters, page: currentPage },
  { enabled: selectedReport === 'pickingAccuracy' }
);
const averageCycleTimeQuery = trpc.reports.averageCycleTime.useQuery(
  { ...filters, ...defaultDateFilters, page: currentPage },
  { enabled: selectedReport === 'averageCycleTime' }
);
const ordersByStatusQuery = trpc.reports.ordersByStatus.useQuery(
  { ...filters },
  { enabled: selectedReport === 'ordersByStatus' }
);
const operatorPerformanceQuery = trpc.reports.operatorPerformance.useQuery(
  { ...filters, ...defaultDateFilters, page: currentPage },
  { enabled: selectedReport === 'operatorPerformance' }
);

// Selecionar query ativa baseado no relatório selecionado
const reportQuery = 
  selectedReport === 'stockPosition' ? stockPositionQuery :
  selectedReport === 'stockByTenant' ? stockByTenantQuery :
  selectedReport === 'stockByLocation' ? stockByLocationQuery :
  selectedReport === 'expiringProducts' ? expiringProductsQuery :
  selectedReport === 'productAvailability' ? productAvailabilityQuery :
  selectedReport === 'inventoryMovements' ? inventoryMovementsQuery :
  selectedReport === 'pickingProductivity' ? pickingProductivityQuery :
  selectedReport === 'pickingAccuracy' ? pickingAccuracyQuery :
  selectedReport === 'averageCycleTime' ? averageCycleTimeQuery :
  selectedReport === 'ordersByStatus' ? ordersByStatusQuery :
  selectedReport === 'operatorPerformance' ? operatorPerformanceQuery :
  { data: null, isLoading: false, error: null };
```

---

## 🔍 Como Funciona a Solução

### 1. Todas as Queries São Chamadas
Todas as 11 queries tRPC são invocadas em **toda renderização**, mantendo a ordem dos Hooks consistente.

### 2. Controle de Execução via `enabled`
A opção `enabled` do TanStack Query controla se a query deve **executar a requisição**:
- `enabled: true` → Query executa normalmente
- `enabled: false` → Query **não faz requisição HTTP**, mas o Hook ainda é chamado

### 3. Seleção da Query Ativa
Após todas as chamadas de Hooks, um simples ternário seleciona qual query usar baseado em `selectedReport`.

---

## 📊 Impacto

### Performance
- **Sem impacto negativo**: Queries desabilitadas (`enabled: false`) não fazem requisições HTTP
- **Cache otimizado**: TanStack Query mantém cache de queries já executadas
- **Transições instantâneas**: Ao trocar entre relatórios já visitados, dados vêm do cache

### Manutenibilidade
- **Código mais claro**: Todas as queries visíveis em um único bloco
- **Fácil adicionar novos relatórios**: Basta adicionar nova query e atualizar o ternário final
- **Conformidade com React**: Segue as regras oficiais dos Hooks

---

## ✅ Validação

### Testes Realizados
1. ✅ Navegação entre abas (Estoque, Operacionais, Expedição, Auditoria)
2. ✅ Geração de relatório "Posição de Estoque" (com dados)
3. ✅ Geração de relatório "Produtividade de Separação" (sem dados)
4. ✅ Exportação para Excel funcionando
5. ✅ Console do navegador sem erros

### Resultado
- **Bug completamente resolvido**
- **Módulo de relatórios 100% funcional**
- **11 relatórios operacionais** (6 Estoque + 5 Operacionais)

---

## 📚 Lições Aprendidas

### Rules of Hooks (React)
1. **Sempre chame Hooks no nível superior** do componente
2. **Nunca chame Hooks dentro de condicionais**, loops ou funções aninhadas
3. **Mantenha a ordem dos Hooks consistente** entre renderizações

### TanStack Query (React Query)
1. Use `enabled` para controlar execução de queries, não renderização condicional
2. Queries desabilitadas não fazem requisições, mas mantêm estrutura de Hooks
3. Cache automático otimiza performance em navegações repetidas

### Padrão Recomendado para Múltiplas Queries Condicionais
```typescript
// ✅ Padrão correto
const query1 = useQuery({ enabled: condition1 });
const query2 = useQuery({ enabled: condition2 });
const query3 = useQuery({ enabled: condition3 });
const activeQuery = condition1 ? query1 : condition2 ? query2 : query3;

// ❌ Padrão incorreto
const activeQuery = condition1 ? useQuery() : condition2 ? useQuery() : useQuery();
```

---

## 🔗 Referências

- [React Rules of Hooks](https://react.dev/reference/rules/rules-of-hooks)
- [TanStack Query - Enabled Option](https://tanstack.com/query/latest/docs/framework/react/guides/disabling-queries)
- [Conditional Queries Best Practices](https://tkdodo.eu/blog/react-query-and-forms)
