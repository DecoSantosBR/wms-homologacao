# Auditoria: Correção de tenantId

## Objetivo
Identificar todas as tabelas que usam `tenantId` do usuário quando deveriam herdar de ordens relacionadas.

## Regras de Herança de tenantId

### 1. Tabelas que HERDAM de receivingOrder
Devem usar `receivingOrder.tenantId`, não `ctx.user.tenantId`:

- ✅ **blindConferenceSessions** - Sessão de conferência da ordem de recebimento
- ✅ **blindConferenceItems** - Itens conferidos durante recebimento
- ✅ **labelAssociations** (contexto recebimento) - Etiquetas criadas durante recebimento
- ⚠️ **receivingOrderItems** - Itens da ordem de recebimento
- ⚠️ **nonConformities** - NCG relacionada a item de recebimento
- ⚠️ **inventory** - Estoque criado após recebimento
- ⚠️ **inventoryMovements** - Movimentações de entrada (recebimento)

### 2. Tabelas que HERDAM de pickingOrder
Devem usar `pickingOrder.tenantId`, não `ctx.user.tenantId`:

- ✅ **labelAssociations** (contexto picking) - Etiquetas lidas durante picking
- ⚠️ **pickingAllocations** - Alocações de picking
- ⚠️ **pickingWaves** - Ondas de picking
- ⚠️ **stageChecks** - Conferências de expedição
- ⚠️ **shipments** - Expedições
- ⚠️ **inventoryMovements** - Movimentações de saída (picking)

### 3. Tabelas que USAM tenantId do usuário (CORRETO)
Tabelas de cadastro mantêm tenantId do usuário que criou:

- ✅ **systemUsers** - Usuários do sistema
- ✅ **products** - Cadastro de produtos
- ✅ **warehouseLocations** - Endereços de armazém
- ✅ **contracts** - Contratos
- ✅ **receivingOrders** - Ordem de recebimento (cabeçalho)
- ✅ **pickingOrders** - Ordem de picking (cabeçalho)
- ✅ **inventoryCounts** - Inventários
- ✅ **recalls** - Recalls
- ✅ **returns** - Devoluções
- ✅ **invoices** - Notas fiscais

## Status de Correção

### ✅ JÁ CORRIGIDO
1. **blindConferenceSessions.start** (linha 91) - Usa `order[0].tenantId`

### ⚠️ PRECISA CORREÇÃO

#### Alta Prioridade (afeta operação atual)
1. **labelAssociations** (2 locais)
   - Linha 430: `associateLabel` (recebimento)
   - Linha 672: `registerNCG` (NCG)
   
2. **blindConferenceItems**
   - Verificar todos os INSERTs

3. **receivingOrderItems**
   - Deve herdar de `receivingOrders.tenantId`

4. **nonConformities**
   - Deve buscar `receivingOrderItems` → `receivingOrders.tenantId`

#### Média Prioridade (afeta relatórios/integridade)
5. **inventory**
   - Entrada: herda de `receivingOrder.tenantId`
   - Saída: herda de `pickingOrder.tenantId`
   - Ajuste: herda de `inventoryMovement.tenantId`

6. **inventoryMovements**
   - Tipo ENTRADA: herda de `receivingOrder.tenantId`
   - Tipo SAÍDA: herda de `pickingOrder.tenantId`

7. **pickingAllocations**
   - Herda de `pickingOrder.tenantId`

8. **stageChecks**
   - Herda de `pickingOrder.tenantId`

9. **shipments**
   - Herda de `pickingOrder.tenantId`

## Próximos Passos

1. Corrigir `labelAssociations` (2 locais)
2. Corrigir `blindConferenceItems`
3. Corrigir `receivingOrderItems`
4. Corrigir `nonConformities`
5. Corrigir `inventory` e `inventoryMovements`
6. Corrigir módulo de picking completo
7. Testar cada correção isoladamente
8. Salvar checkpoint após cada grupo de correções
