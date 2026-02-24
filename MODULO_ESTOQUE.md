# Módulo de Estoque - WMS Med@x

## Visão Geral

O módulo de Estoque implementa funcionalidades completas de controle e rastreabilidade de inventário, incluindo consultas de posições, movimentações entre endereços e dashboard de ocupação com sugestões inteligentes de otimização.

## Estrutura de Arquivos

### Backend

- **server/inventory.ts** - Funções de consulta de estoque
  - `getInventoryPositions()` - Lista posições com filtros avançados
  - `getInventorySummary()` - Resumo consolidado de estoque
  - `getLocationStock()` - Saldo de endereço específico

- **server/movements.ts** - Funções de movimentação
  - `registerMovement()` - Registra movimentação com validações
  - `getMovementHistory()` - Histórico de movimentações
  - Validações: saldo disponível, regras de armazenagem

- **server/occupancy.ts** - Dashboard de ocupação
  - `getOverallOccupancy()` - Ocupação geral do armazém
  - `getOccupancyByZone()` - Ocupação por zona
  - `getOptimizationSuggestions()` - Sugestões inteligentes

- **server/stockRouter.ts** - Endpoints tRPC
  - `stock.getPositions` - Consulta de posições
  - `stock.getSummary` - Resumo de estoque
  - `stock.registerMovement` - Registro de movimentação
  - `stock.getMovements` - Histórico de movimentações
  - `stock.getOverallOccupancy` - Ocupação geral
  - `stock.getOccupancyByZone` - Ocupação por zona
  - `stock.getOptimizationSuggestions` - Sugestões de otimização

### Frontend

- **client/src/pages/StockPositions.tsx** (/stock)
  - Consulta de posições de estoque
  - Filtros: produto, lote, endereço, status, validade
  - Tabela com paginação
  - Exportação para Excel

- **client/src/pages/StockMovements.tsx** (/stock/movements)
  - Registro de movimentações
  - Tipos: transferência, ajuste, entrada, saída
  - Validações em tempo real
  - Histórico de movimentações

- **client/src/pages/OccupancyDashboard.tsx** (/stock/occupancy)
  - Ocupação geral do armazém
  - Ocupação por zona com gráficos
  - Sugestões inteligentes de otimização
  - Métricas e indicadores

## Funcionalidades Implementadas

### 1. Consulta de Posições de Estoque

**Filtros Disponíveis:**
- Produto (busca por SKU ou descrição)
- Lote
- Endereço
- Status (disponível, bloqueado, quarentena, contagem)
- Data de validade (próxima ao vencimento)

**Informações Exibidas:**
- SKU e descrição do produto
- Lote e validade
- Endereço e zona
- Quantidade disponível
- Status
- Tenant

### 2. Movimentações de Estoque

**Tipos de Movimentação:**
- **Transferência**: Entre endereços
- **Ajuste**: Correção de saldo
- **Entrada**: Recebimento
- **Saída**: Expedição

**Validações:**
- Saldo disponível no endereço origem
- Regras de armazenagem do endereço destino
- Produto e lote válidos
- Quantidade positiva

**Rastreabilidade:**
- Histórico completo de movimentações
- Usuário responsável
- Data e hora
- Motivo/observações

### 3. Dashboard de Ocupação

**Métricas Gerais:**
- Total de endereços
- Endereços ocupados
- Endereços disponíveis
- Endereços bloqueados
- Taxa de ocupação (%)

**Ocupação por Zona:**
- Gráficos de ocupação
- Comparação entre zonas
- Alertas de capacidade crítica

**Sugestões de Otimização:**
- **Consolidação**: Agrupar produtos em menos endereços
- **Capacidade Crítica**: Alertas de zonas com >85% de ocupação
- **Realocação**: Sugestões de movimentação para melhor distribuição
- **Eficiência**: Oportunidades de melhoria operacional

Cada sugestão inclui:
- Prioridade (alta, média, baixa)
- Descrição do problema
- Impacto esperado
- Métricas (atual vs meta)
- Ações recomendadas

## Regras de Negócio

### Movimentações

1. **Validação de Saldo**
   - Quantidade a movimentar ≤ saldo disponível no endereço origem
   - Considera apenas estoque com status "available"

2. **Regras de Armazenagem**
   - **Single Item**: Endereço aceita apenas um produto
   - **Multi Item**: Endereço aceita múltiplos produtos
   - **Whole**: Armazena unidades inteiras
   - **Fraction**: Aceita fracionamento

3. **Atualização de Status**
   - Endereço vazio: status → "available"
   - Endereço com estoque: status → "occupied"

### Sugestões de Otimização

1. **Consolidação** (Prioridade: Média)
   - Detecta: Produto em múltiplos endereços com baixa ocupação
   - Sugere: Consolidar em menos endereços
   - Benefício: Reduz picking time, libera endereços

2. **Capacidade Crítica** (Prioridade: Alta)
   - Detecta: Zona com >85% de ocupação
   - Sugere: Expandir capacidade ou realocar produtos
   - Benefício: Evita bloqueio operacional

3. **Realocação** (Prioridade: Baixa)
   - Detecta: Produtos de alta rotatividade em zonas distantes
   - Sugere: Mover para zonas de fácil acesso
   - Benefício: Reduz tempo de deslocamento

## Integração com Outros Módulos

- **Recebimento**: Cria estoque após conferência cega
- **Picking**: Consulta estoque disponível (FEFO)
- **Qualidade**: Altera status de quarentena para disponível
- **Endereços**: Atualiza status automaticamente

## Próximas Melhorias

- [ ] Exportação de relatórios em PDF
- [ ] Gráficos interativos de ocupação
- [ ] Alertas automáticos de validade próxima
- [ ] Sugestões de picking baseadas em ocupação
- [ ] Integração com inventário cíclico
- [ ] Análise preditiva de necessidade de espaço

## Testes

Os testes unitários foram planejados mas não implementados na entrega inicial devido à complexidade de criação de dados de teste. Recomenda-se:

1. Testar via interface com dados reais
2. Validar todos os filtros de consulta
3. Testar movimentações com diferentes cenários
4. Verificar sugestões de otimização
5. Validar exportação de relatórios

## Conformidade

O módulo segue as diretrizes da documentação DOCUMENTACAO_07_ESTOQUE.md e está em conformidade com:
- RDC 430/2020 (ANVISA)
- Boas práticas de rastreabilidade farmacêutica
- Princípios FEFO (First Expired, First Out)
