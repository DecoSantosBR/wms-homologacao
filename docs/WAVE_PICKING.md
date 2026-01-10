# Módulo de Separação por Onda (Wave Picking)

## 📋 Visão Geral

O módulo de **Wave Picking** (Separação por Onda) otimiza o processo de separação agrupando múltiplos pedidos do mesmo cliente em uma única Ordem de Serviço (OS). Isso reduz deslocamentos, aumenta produtividade e melhora a acuracidade.

## 🎯 Benefícios

- **Redução de deslocamentos**: Operador visita cada endereço apenas uma vez
- **Maior produtividade**: Separação de múltiplos pedidos simultaneamente
- **Otimização de rotas**: Sistema define sequência ideal de endereços
- **Rastreabilidade**: Histórico completo de separação por onda
- **Flexibilidade**: Suporta regras FIFO, FEFO e Direcionado

## 🔄 Fluxo de Trabalho

### 1. Geração de Onda

**Responsável**: Supervisor ou Operador com permissão

**Processo**:
1. Cliente gera múltiplos pedidos de separação
2. Operador acessa listagem de pedidos pendentes
3. Seleciona pedidos do mesmo cliente para agrupar
4. Sistema valida:
   - Todos os pedidos são do mesmo cliente
   - Nenhum pedido já está em outra onda
   - Estoque disponível para todos os itens
5. Sistema consolida itens (soma quantidades de produtos iguais)
6. Sistema aplica regra de picking do cliente (FIFO/FEFO) para alocar endereços
7. Sistema gera número único da OS (formato: `OS-YYYYMMDD-XXXX`)
8. Sistema imprime:
   - **Pedidos individuais** com dados completos + código de barras Code 128
   - **Etiqueta da OS** com QR Code para identificação

**Exemplo de Consolidação**:

```
Pedido 1: 401460P (10 un), 443060 (20 un), 834207 (10 un)
Pedido 2: 401460P (20 un), 443060 (10 un), 834207 (10 un)
Pedido 3: 443060 (10 un), 834207 (20 un)

↓ Consolidação ↓

OS-20260110-0001:
  401460P: 30 un → Endereço H01-08-02 (FIFO)
  443060:  40 un → Endereço H01-08-04 (FIFO)
  834207:  40 un → Endereço H01-08-05 (FIFO)
```

### 2. Execução da OS

**Responsável**: Operador de Separação

**Processo**:
1. Operador seleciona OS disponível para separação
2. Sistema mostra roteiro de endereços otimizado
3. Operador cola etiqueta da OS no palete/cesto
4. Para cada endereço:
   - Operador escaneia código do endereço
   - Sistema mostra produtos e quantidades a separar
   - Operador realiza **conferência cega**:
     - Escaneia etiqueta do produto
     - Sistema identifica produto, lote e quantidade
     - Operador confirma separação
   - Sistema marca endereço como concluído
5. Após separar todos os endereços, operador finaliza OS
6. Sistema atualiza status para "picked"

### 3. Área de Stage (Segregação)

**Responsável**: Operador de Conferência

**Processo**:
1. Operador leva palete/cesto para área de Stage
2. Escaneia QR Code da OS
3. Sistema mostra itens consolidados
4. Operador segrega itens por pedido original:
   - Escaneia produto
   - Sistema indica a qual pedido pertence
   - Operador separa fisicamente
5. Após segregar todos os itens:
   - Sistema atualiza status dos pedidos para "picked"
   - Pedidos ficam prontos para expedição

## 🗄️ Estrutura de Banco de Dados

### Tabela: `pickingWaves`

Armazena informações das ondas de separação.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | INT | ID único da onda |
| `tenantId` | INT | Cliente proprietário |
| `waveNumber` | VARCHAR(50) | Número único da OS (ex: OS-20260110-0001) |
| `status` | ENUM | Status: pending, picking, picked, staged, completed, cancelled |
| `totalOrders` | INT | Quantidade de pedidos agrupados |
| `totalItems` | INT | Total de linhas consolidadas |
| `totalQuantity` | INT | Quantidade total de unidades |
| `pickingRule` | ENUM | Regra aplicada: FIFO, FEFO, Direcionado |
| `assignedTo` | INT | Separador atribuído |
| `pickedBy` | INT | Quem realmente separou |
| `pickedAt` | TIMESTAMP | Data/hora da separação |
| `stagedBy` | INT | Quem fez a segregação em stage |
| `stagedAt` | TIMESTAMP | Data/hora da segregação |
| `notes` | TEXT | Observações |
| `createdBy` | INT | Usuário que criou a onda |
| `createdAt` | TIMESTAMP | Data/hora de criação |
| `updatedAt` | TIMESTAMP | Data/hora de atualização |

### Tabela: `pickingWaveItems`

Armazena itens consolidados da onda com endereços alocados.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | INT | ID único do item |
| `waveId` | INT | ID da onda |
| `productId` | INT | ID do produto |
| `productSku` | VARCHAR(100) | SKU do produto |
| `productName` | VARCHAR(255) | Nome do produto |
| `totalQuantity` | INT | Quantidade consolidada |
| `pickedQuantity` | INT | Quantidade já separada |
| `locationId` | INT | Endereço alocado (FIFO/FEFO) |
| `locationCode` | VARCHAR(50) | Código do endereço (ex: H01-08-02) |
| `batch` | VARCHAR(100) | Lote sugerido |
| `expiryDate` | DATE | Validade do lote |
| `status` | ENUM | Status: pending, picking, picked |
| `pickedAt` | TIMESTAMP | Data/hora da separação |
| `createdAt` | TIMESTAMP | Data/hora de criação |

### Relacionamentos

```
pickingWaves (1) ←→ (N) pickingWaveItems
pickingWaves (1) ←→ (N) pickingOrders (via waveId)
pickingWaveItems (N) → (1) products
pickingWaveItems (N) → (1) warehouseLocations
```

## 🔧 API Backend

### Arquivo: `server/waveLogic.ts`

Contém toda a lógica de negócio para ondas de separação.

#### Funções Principais

**`createWave(params: CreateWaveParams)`**

Cria onda consolidando múltiplos pedidos.

```typescript
interface CreateWaveParams {
  orderIds: number[]; // IDs dos pedidos a agrupar
  userId: number;     // Usuário que está criando a onda
}
```

**Validações**:
- Todos os pedidos existem
- Todos os pedidos são do mesmo cliente
- Nenhum pedido já está em outra onda
- Estoque disponível para todos os itens

**Retorno**:
```typescript
{
  waveId: number;
  waveNumber: string;
  totalOrders: number;
  totalItems: number;
  totalQuantity: number;
  items: Array<{
    productId: number;
    productSku: string;
    productName: string;
    totalQuantity: number;
    locationId: number;
    locationCode: string;
    batch?: string;
    expiryDate?: Date;
  }>;
}
```

**`getWaveById(waveId: number)`**

Busca detalhes completos de uma onda.

**Retorno**:
```typescript
{
  ...wave,           // Dados da onda
  items: [...],      // Itens consolidados
  orders: [...]      // Pedidos originais
}
```

**`generateWaveNumber()`**

Gera número único de onda no formato `OS-YYYYMMDD-XXXX`.

**`consolidateItems(orderIds: number[])`**

Consolida itens de múltiplos pedidos somando quantidades.

**`allocateLocations(tenantId, items, pickingRule)`**

Aloca endereços otimizados baseado em FIFO/FEFO.

## 📊 Estados e Transições

### Status da Onda

```
pending → picking → picked → staged → completed
   ↓
cancelled
```

- **pending**: Onda criada, aguardando início
- **picking**: Separação em andamento
- **picked**: Separação concluída, aguardando stage
- **staged**: Segregação concluída, pedidos prontos
- **completed**: Onda finalizada
- **cancelled**: Onda cancelada

### Status dos Pedidos

Quando pedidos entram em onda:
```
pending → in_wave → picking → picked → ...
```

## 🎨 Interface Frontend (A Implementar)

### Páginas Necessárias

1. **`/picking/waves`** - Listagem de ondas
2. **`/picking/waves/create`** - Geração de onda
3. **`/picking/waves/:id`** - Detalhes da onda
4. **`/picking/waves/:id/execute`** - Execução da OS
5. **`/picking/stage`** - Área de segregação

### Componentes Necessários

- `WaveCreationModal` - Seleção de pedidos e prévia
- `WaveLabelPrint` - Impressão de etiqueta com QR Code
- `WaveExecution` - Interface de separação por endereço
- `StageSegregation` - Interface de segregação por pedido

## 📝 Próximos Passos

- [ ] Criar endpoints tRPC (`picking.createWave`, `picking.getWaveById`, etc.)
- [ ] Implementar interface de geração de onda
- [ ] Adicionar impressão de etiquetas com QR Code
- [ ] Criar página de execução de OS com scanner
- [ ] Implementar área de Stage para segregação
- [ ] Adicionar relatórios de produtividade por onda
- [ ] Implementar otimização de rotas (algoritmo de caminho mais curto)

## 🔐 Permissões

- **Gerar Onda**: Supervisor, Manager, Admin
- **Executar OS**: Operator, Admin
- **Segregar em Stage**: Operator, Quality, Admin
- **Visualizar Ondas**: Todos os usuários autenticados do tenant

## 📈 Métricas e KPIs

O sistema deve rastrear:
- Tempo médio de separação por onda
- Produtividade (unidades/hora) por operador
- Taxa de acuracidade (divergências encontradas em stage)
- Economia de deslocamentos vs. separação individual
- Quantidade de pedidos por onda (média/máximo)

## 🚨 Tratamento de Erros

### Estoque Insuficiente

Se não houver estoque suficiente durante alocação:
- Sistema exibe mensagem clara indicando produto e quantidade faltante
- Onda não é criada
- Pedidos permanecem com status "pending"

### Pedido Já em Onda

Se tentar adicionar pedido que já está em outra onda:
- Sistema exibe erro indicando número da onda atual
- Operador pode cancelar onda anterior ou criar nova sem esse pedido

### Divergência em Stage

Se quantidade separada não bater com esperado:
- Sistema registra divergência
- Notifica supervisor para análise
- Permite ajuste manual com justificativa

## 📚 Referências

- [Wave Picking Best Practices](https://www.6rs.com/resources/wave-picking/)
- [FIFO vs FEFO in Warehouse Management](https://www.logiwa.com/blog/fifo-vs-fefo)
- [Optimizing Order Picking](https://www.mecalux.com/blog/order-picking-methods)
