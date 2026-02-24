# Módulo de Separação - Análise e Design Técnico

## 1. Análise dos Requisitos (POPs)

### 1.1 Fluxo Operacional Identificado

**Etapas do Processo:**
1. **Recebimento de Pedidos** → Via e-mail ou área do cliente no WMS
2. **Validação e Lançamento** → Verificação de consistência e inserção no WMS
3. **Geração de Ondas (Wave Planning)** → Agrupamento otimizado de pedidos
4. **Abastecimento (Replenishment)** → Reposição de picking faces
5. **Separação (Picking)** → Coleta de itens com coletor de dados
6. **Conferência e Embalagem (Packing)** → Validação final e acondicionamento
7. **Emissão de Documentos** → NF-e e CT-e
8. **Expedição** → Movimentação para doca e carregamento

### 1.2 Requisitos Críticos Identificados

#### Regras de Negócio
- ✅ **FEFO obrigatório** (First Expired, First Out)
- ✅ **Proibição de fracionamento** - Caixas fechadas devem ser expedidas fechadas
- ✅ **Ajuste automático de quantidades** - Se não completa caixa, ajustar para volume fechado
- ✅ **Dupla conferência** - Separador ≠ Conferente (segregação de função)
- ✅ **Validação de UM** - Extrema atenção à unidade de medida (CAIXA vs UNIDADE)
- ✅ **Rastreabilidade total** - Bipagem de OS, endereço, item e lote

#### Riscos Operacionais Identificados
1. **Erro de UM** → Principal causa de divergências
2. **Picking sem estoque** → Necessidade de replenishment em tempo real
3. **Divergências de inventário** → Impacto direto na acurácia do picking
4. **Falta de segregação** → Mesmo operador separando e conferindo
5. **Pedidos incompletos** → Falta de validação de disponibilidade antes do picking

## 2. Arquitetura do Módulo

### 2.1 Entidades do Banco de Dados

```typescript
// Tabela: pickingOrders (Ordens de Separação)
- id, orderNumber, customerId, status, priority
- createdAt, scheduledDate, startedAt, completedAt
- totalItems, totalQuantity, pickerId, checkerId
- waveId, notes

// Tabela: pickingOrderItems (Itens da OS)
- id, pickingOrderId, productId, requestedQuantity
- requestedUM, pickedQuantity, locationId, batch
- status, pickerId, pickedAt

// Tabela: pickingWaves (Ondas de Separação)
- id, waveNumber, status, priority, createdAt
- scheduledStartTime, startedAt, completedAt
- totalOrders, totalItems, assignedPickerId

// Tabela: pickingTasks (Tarefas de Picking)
- id, waveId, pickingOrderId, pickerId, status
- locationId, productId, batch, quantity, UM
- startedAt, completedAt, sequence

// Tabela: packingStations (Estações de Conferência)
- id, stationNumber, status, currentOrderId
- checkerId, startedAt

// Tabela: shippingVolumes (Volumes de Expedição)
- id, pickingOrderId, volumeNumber, weight
- dimensions, trackingCode, carrierName
```

### 2.2 Estados e Transições

#### Status de Picking Order
- `pending` → Aguardando processamento
- `validated` → Validado e disponível para onda
- `in_wave` → Incluído em onda de separação
- `picking` → Em processo de separação
- `picked` → Separação concluída
- `checking` → Em conferência
- `packed` → Conferido e embalado
- `invoiced` → NF-e emitida
- `shipped` → Expedido
- `cancelled` → Cancelado

#### Status de Picking Task
- `pending` → Aguardando execução
- `in_progress` → Em execução
- `completed` → Concluída
- `exception` → Divergência (falta de estoque, avaria)

## 3. Fluxos Implementados

### 3.1 Fluxo de Criação de Pedido

```
Cliente → [Área do Cliente ou E-mail]
    ↓
Validação Automática:
  - Cliente existe?
  - Produtos existem?
  - Estoque disponível (FEFO)?
  - UM correta?
  - Fracionamento permitido?
    ↓
[SIM] → Criar pickingOrder (status: validated)
[NÃO] → Retornar erros específicos
```

**Validações Críticas:**
1. **Validação de Estoque FEFO** - Buscar lotes por validade ascendente
2. **Validação de Fracionamento** - Se quantidade < unidades por caixa, ajustar para caixa fechada
3. **Validação de UM** - Converter unidades corretamente (CAIXA → UNIDADES)

### 3.2 Fluxo de Geração de Ondas

```
Coordenador → Seleciona pedidos (status: validated)
    ↓
Critérios de Agrupamento:
  - Prioridade do cliente
  - Rota de entrega
  - Janela de coleta
  - Zona de armazenagem
    ↓
Criar pickingWave
Gerar pickingTasks (otimizadas por rota)
Atualizar pedidos (status: in_wave)
```

**Otimizações:**
- Agrupar itens da mesma zona
- Ordenar tarefas por proximidade de endereços
- Balancear carga entre separadores

### 3.3 Fluxo de Separação (Picking)

```
Separador → Aceita onda no coletor
    ↓
Para cada tarefa:
  1. Bipa código da OS
  2. Navega até endereço indicado
  3. Bipa código do endereço (validação)
  4. Bipa código do produto (validação)
  5. Bipa etiqueta do lote (rastreabilidade)
  6. Informa quantidade separada
  7. Sistema valida e debita estoque
    ↓
[Divergência?]
  → Registrar exceção
  → Notificar coordenador
  → Aguardar decisão
    ↓
Concluir onda (status: picked)
```

**Validações em Tempo Real:**
- Endereço correto?
- Produto correto?
- Lote correto (FEFO)?
- Quantidade disponível?
- UM correta?

### 3.4 Fluxo de Conferência

```
Conferente → Recebe volumes na estação
    ↓
Para cada item:
  1. Bipa código do produto
  2. Valida quantidade
  3. Inspeciona integridade
  4. Confirma no sistema
    ↓
[Divergência?]
  → Registrar não-conformidade
  → Notificar coordenador
  → Aguardar correção
    ↓
Embalar volumes
Gerar etiquetas de volume
Atualizar status (packed)
```

**Segregação de Função:**
- Separador ≠ Conferente (obrigatório)
- Sistema valida e bloqueia se mesmo usuário

### 3.5 Fluxo de Expedição

```
Administrativo → Emite NF-e
    ↓
Transporte → Gera CT-e
    ↓
Expedição → Confere volumes
    ↓
Carrega veículo
Obtém assinatura do transportador
Atualiza status (shipped)
Notifica cliente
```

## 4. Riscos e Mitigações

### 4.1 Riscos Técnicos

| Risco | Impacto | Probabilidade | Mitigação |
|-------|---------|---------------|-----------|
| Erro de UM (CAIXA vs UN) | ALTO | ALTA | Validação dupla + alerta visual |
| Picking sem estoque | ALTO | MÉDIA | Validação em tempo real + replenishment automático |
| Divergência de inventário | ALTO | MÉDIA | Inventário cíclico diário + auditoria |
| Mesmo operador separando/conferindo | MÉDIO | BAIXA | Bloqueio sistêmico |
| Fracionamento indevido | MÉDIO | BAIXA | Validação automática + ajuste de quantidade |
| Lote incorreto (não-FEFO) | ALTO | BAIXA | Ordenação automática por validade |

### 4.2 Impactos no Sistema

#### Impacto em Estoque
- **Débito automático** após bipagem confirmada
- **Rollback** em caso de cancelamento de pedido
- **Reserva de estoque** ao criar pickingOrder (evitar overselling)

#### Impacto em Movimentações
- Criar registro em `inventoryMovements` (tipo: "picking")
- Manter rastreabilidade completa (quem, quando, onde, quanto)

#### Impacto em Pré-Alocação
- **Priorizar endereços pré-alocados** na geração de tarefas
- Atualizar status de pré-alocação após picking

## 5. Métricas (KPIs)

### 5.1 KPIs Operacionais
- **Acurácia do Pedido** - % pedidos sem erros
- **Tempo de Ciclo** - Tempo médio de criação até expedição
- **Picking Rate** - Itens/hora por separador
- **Taxa de Exceções** - % tarefas com divergência
- **OTIF** - On-Time, In-Full delivery

### 5.2 KPIs de Qualidade
- **Acurácia de Inventário** - % SKUs com estoque correto
- **Taxa de Devolução** - % pedidos devolvidos por erro
- **Taxa de Avarias** - % itens avariados no picking

## 6. Fases de Implementação

### Fase 1: Backend e Validações (Crítico)
- Criar schema de tabelas
- Implementar validações de pedido (FEFO, UM, fracionamento)
- Criar endpoints tRPC para CRUD de pedidos
- Implementar lógica de reserva de estoque

### Fase 2: Geração de Ondas e Tarefas
- Implementar algoritmo de wave planning
- Criar lógica de otimização de rotas
- Gerar picking tasks ordenadas

### Fase 3: Interface de Separação (Coletor)
- Criar interface mobile-first para separadores
- Implementar fluxo de bipagem
- Validações em tempo real

### Fase 4: Conferência e Embalagem
- Criar interface de conferência
- Implementar segregação de função
- Gerar etiquetas de volume

### Fase 5: Expedição e Integração
- Emissão de NF-e
- Integração com transporte (CT-e)
- Notificações ao cliente

### Fase 6: Dashboards e Relatórios
- Dashboard de produtividade
- Relatórios de acurácia
- Análise de exceções

## 7. Decisões Arquiteturais

### 7.1 Reserva de Estoque
**Decisão:** Implementar reserva de estoque ao criar pickingOrder

**Justificativa:**
- Evita overselling (vender mais do que tem)
- Garante disponibilidade durante o picking
- Permite cancelamento sem impacto em outros pedidos

**Implementação:**
- Adicionar campo `reservedQuantity` na tabela `inventory`
- Debitar `reservedQuantity` ao criar pedido
- Debitar `availableQuantity` ao confirmar picking
- Liberar `reservedQuantity` ao cancelar pedido

### 7.2 Validação de FEFO
**Decisão:** Ordenação automática por validade + validação no picking

**Justificativa:**
- Garante conformidade regulatória (ANVISA)
- Reduz perdas por vencimento
- Evita erro humano

**Implementação:**
- Buscar lotes ordenados por `expirationDate ASC`
- Sugerir lote correto no coletor
- Alertar se separador bipar lote incorreto

### 7.3 Fracionamento
**Decisão:** Proibir fracionamento + ajuste automático de quantidade

**Justificativa:**
- Reduz complexidade operacional
- Evita avarias e perdas
- Mantém integridade da embalagem original

**Implementação:**
- Validar se `requestedQuantity % unitsPerBox === 0`
- Se não, ajustar para `Math.floor(requestedQuantity / unitsPerBox) * unitsPerBox`
- Notificar cliente do ajuste

## 8. Próximos Passos

1. ✅ Criar schema de tabelas no `drizzle/schema.ts`
2. ✅ Implementar funções de validação em `server/picking.ts`
3. ✅ Criar endpoints tRPC em `server/pickingRouter.ts`
4. ✅ Implementar interface de criação de pedidos
5. ✅ Implementar interface de geração de ondas
6. ✅ Implementar interface de separação (coletor)
7. ✅ Implementar interface de conferência
8. ✅ Implementar dashboard de produtividade
9. ✅ Testes end-to-end do fluxo completo
10. ✅ Documentação e treinamento
