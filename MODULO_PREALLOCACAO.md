# Módulo de Pré-Alocação

## Visão Geral

O módulo de Pré-Alocação permite que o operador pré-defina os endereços de armazenagem para os produtos de uma ordem de recebimento **antes** de iniciar a conferência cega. Isso otimiza o fluxo operacional, reduzindo o tempo de decisão durante a conferência e garantindo que os produtos sejam endereçados corretamente desde o início.

## Funcionalidades Implementadas

### 1. Upload de Planilha Excel

- **Formato**: Arquivo `.xlsx` com colunas: Endereço, Cód. Interno, Descrição (opcional), Lote, Quantidade
- **Biblioteca**: `xlsx` para parser de arquivos Excel
- **Validação**: Arquivo deve ser `.xlsx` válido

### 2. Processamento e Validação

O sistema valida cada linha da planilha contra o banco de dados:

**Validações Implementadas:**
- ✅ Endereço existe no cadastro
- ✅ Produto existe no cadastro (por código interno/SKU)
- ✅ Lote corresponde ao esperado na NF-e
- ✅ Quantidade não excede o esperado na ordem
- ✅ Endereço está disponível (status: available)
- ✅ Regra de armazenagem do endereço permite o produto

**Resultado:**
- Linhas válidas: Podem ser salvas
- Linhas inválidas: Exibem erros específicos para correção

### 3. Visualização de Resultados

Interface com:
- **Resumo**: Total de linhas, válidas e inválidas
- **Tabela detalhada**: Cada linha com status visual (✓ ou ✗)
- **Mensagens de erro**: Específicas para cada problema encontrado

### 4. Salvamento

- Salva apenas linhas válidas no banco de dados (`receivingPreallocations`)
- Associa pré-alocações à ordem de recebimento
- Registra usuário que criou a pré-alocação

### 5. Integração com Importação de NF-e

- Botão "Pré-definir Endereços" aparece após importação bem-sucedida
- Dialog modal com todo o fluxo de upload e validação
- Feedback visual de sucesso/erro

## Arquitetura

### Backend

**Arquivo**: `server/preallocation.ts`
- `processPreallocationExcel(fileBuffer)`: Parser de Excel
- `validatePreallocations(rows, receivingOrderId, tenantId)`: Validação contra banco
- `savePreallocations(receivingOrderId, validations, userId)`: Salvamento
- `getPreallocations(receivingOrderId)`: Consulta
- `deletePreallocations(receivingOrderId)`: Exclusão

**Router**: `server/preallocationRouter.ts`
- `processFile`: Processa arquivo e retorna validações
- `save`: Salva pré-alocações válidas
- `list`: Lista pré-alocações de uma ordem
- `delete`: Remove pré-alocações de uma ordem

### Frontend

**Componente**: `client/src/components/PreallocationDialog.tsx`
- Upload de arquivo Excel
- Processamento e validação em tempo real
- Visualização de resultados em tabela
- Botões de ação (Salvar, Pular, Baixar Modelo)

**Integração**: `client/src/pages/NFEImport.tsx`
- Botão "Pré-definir Endereços" após importação
- Dialog modal com PreallocationDialog

## Fluxo de Uso

1. **Importar NF-e**: Usuário importa XML da nota fiscal
2. **Abrir Pré-Alocação**: Clica em "Pré-definir Endereços"
3. **Upload Excel**: Seleciona planilha com pré-alocações
4. **Validação Automática**: Sistema valida cada linha
5. **Revisar Resultados**: Usuário visualiza válidas/inválidas
6. **Salvar**: Confirma salvamento das linhas válidas
7. **Conferência Cega**: Endereços pré-definidos são usados automaticamente

## Formato da Planilha Excel

```
| Endereço    | Cód. Interno | Descrição        | Lote     | Quantidade |
|-------------|--------------|------------------|----------|------------|
| M01-01-02A  | 123456       | Produto Exemplo  | L001     | 100        |
| M01-01-03A  | 234567       | Outro Produto    | L002     | 50         |
```

**Colunas:**
- **Endereço** (obrigatório): Código do endereço de armazenagem
- **Cód. Interno** (obrigatório): SKU ou código interno do produto
- **Descrição** (opcional): Descrição do produto (apenas informativo)
- **Lote** (obrigatório): Número do lote
- **Quantidade** (obrigatório): Quantidade de unidades a alocar

## Regras de Negócio

1. **Endereço deve existir** e estar com status "available"
2. **Produto deve existir** no cadastro
3. **Lote deve corresponder** ao esperado na NF-e
4. **Quantidade não pode exceder** o esperado na ordem
5. **Regra de armazenagem** do endereço deve permitir o produto
6. **Múltiplas pré-alocações** podem ser feitas para o mesmo produto (lotes diferentes)

## Próximos Passos (Não Implementados)

- [ ] Integrar pré-alocações com conferência cega (usar endereços pré-definidos automaticamente)
- [ ] Permitir edição de pré-alocações após salvamento
- [ ] Exportar pré-alocações para Excel
- [ ] Validar capacidade do endereço (não exceder limite físico)
- [ ] Sugerir endereços alternativos quando pré-alocação falhar

## Tecnologias Utilizadas

- **Backend**: Node.js, tRPC, Drizzle ORM, xlsx
- **Frontend**: React 19, TypeScript, TanStack Query, shadcn/ui
- **Banco de Dados**: MySQL (tabela `receivingPreallocations`)

## Documentação de Referência

- `DOCUMENTACAO_10_PREALOCATION.md`: Especificação funcional
- `DOCUMENTACAO_14_PREALLOCACAO_DETALHADA.md`: Especificação técnica detalhada
