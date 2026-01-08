# Cadastramento Automático de Produtos via NF-e

## Visão Geral

O sistema WMS Med@x implementa cadastramento automático de produtos durante a importação de Notas Fiscais Eletrônicas (NF-e) de entrada (recebimento). Esta funcionalidade elimina a necessidade de cadastro manual prévio de produtos, agilizando o processo de recebimento.

---

## Fluxo de Cadastramento

### 1. Importação de NF-e de Entrada

Quando uma NF-e de entrada é importada:

1. **Sistema lê o XML** da nota fiscal
2. **Para cada item** (`<det>`) da NF-e:
   - Sistema busca produto existente por:
     * `supplierCode` (código do fornecedor)
     * `gtin` (código de barras EAN)
     * `sku` (código interno)
   - **Se produto existe**: vincula ao produto existente
   - **Se produto NÃO existe**: cria automaticamente com dados básicos do XML

### 2. Dados Extraídos Automaticamente do XML

Quando um produto é criado automaticamente, os seguintes campos são preenchidos:

| Campo | Origem no XML | Obrigatório | Observação |
|-------|---------------|-------------|------------|
| **Cliente** | Tenant selecionado no upload | ✅ Sim | Associa produto ao cliente |
| **SKU** | `<cProd>` | ✅ Sim | Código interno = código do fornecedor inicialmente |
| **supplierCode** | `<cProd>` | ✅ Sim | Código que o fornecedor usa |
| **Descrição** | `<xProd>` | ✅ Sim | Nome do produto no XML |
| **GTIN/EAN** | `<cEAN>` ou `<cEANTrib>` | ❌ Não | Código de barras padrão |
| **Unidade de Medida** | `<uCom>` | ❌ Não | UN, CX, KG, etc. |
| **Status** | - | ✅ Sim | Sempre "ativo" |

### 3. Campos Opcionais (Complementação Posterior)

Os seguintes campos ficam vazios e podem ser complementados posteriormente:

- Quantidade por Caixa
- Categoria
- Fabricante
- Classe Terapêutica
- Registro ANVISA
- Quantidade Mínima (estoque de segurança)
- Quantidade de Dispensação
- Condição de Armazenagem

---

## Dupla Referência de Códigos

O sistema suporta **dupla referência de códigos** para produtos:

### Estrutura de Códigos

```
┌─────────────────────────────────────────────────────────┐
│                    PRODUTO NO WMS                        │
├─────────────────────────────────────────────────────────┤
│ SKU (código interno único)                              │
│ supplierCode (código do fornecedor)                     │
│ customerCode (código do cliente/saída)                  │
│ GTIN (código de barras padrão)                          │
└─────────────────────────────────────────────────────────┘
```

### Regras de Preenchimento do SKU

#### Cenário 1: NF-e de Entrada (Recebimento)

```
Fornecedor envia produto com código "FORN-123"
↓
Sistema cria produto automaticamente:
  - SKU = "FORN-123"
  - supplierCode = "FORN-123"
  - customerCode = null
```

#### Cenário 2: NF-e de Saída (Separação) com Código Diferente

```
Cliente pede produto com código "CLI-ABC" (diferente do fornecedor)
↓
Sistema detecta código desconhecido
↓
Usuário vincula "CLI-ABC" ao produto existente
↓
Sistema atualiza:
  - SKU = "CLI-ABC" ← MUDA PARA O CÓDIGO DO CLIENTE
  - supplierCode = "FORN-123" (mantém histórico)
  - customerCode = "CLI-ABC"
```

**Regra importante**: Quando um `customerCode` é vinculado, o SKU passa a ser o código do cliente, mas o `supplierCode` original é mantido para histórico.

---

## Vinculação Inteligente (NF-e de Saída)

Quando uma NF-e de saída contém um código que o sistema não reconhece:

### 1. Detecção de Código Desconhecido

Sistema verifica se existe produto com:
- `customerCode` = código do XML
- `gtin` = código do XML

Se não encontrar, exibe modal de vinculação.

### 2. Sugestões Inteligentes

Sistema usa **algoritmo de similaridade de strings** (Levenshtein ou Jaro-Winkler) para sugerir produtos existentes:

- Compara `<xProd>` do XML com campo "Descrição / Nome do Produto" do cadastro
- Lista top 5 produtos mais similares
- Usuário seleciona o produto correto

### 3. Salvamento do Vínculo

Após seleção:
- Sistema salva `customerCode` no produto
- Sistema atualiza `SKU` para o `customerCode`
- Vínculo fica permanente para futuras NF-es

---

## Complementação de Dados

### Edição Manual

Usuário pode editar qualquer produto a qualquer momento através da página de **Cadastros > Produtos**:

1. Acessar lista de produtos
2. Clicar em "Editar" no produto desejado
3. Preencher campos opcionais
4. Salvar alterações

### Campos Editáveis

Todos os campos do produto podem ser editados, exceto:
- **ID** (gerado automaticamente)
- **Data de Criação** (timestamp automático)

---

## Endpoints Backend

### `nfe.importReceiving`

Importa NF-e de entrada e cria produtos automaticamente.

**Input:**
```typescript
{
  tenantId: number;
  xmlContent: string; // Conteúdo do XML da NF-e
}
```

**Output:**
```typescript
{
  nfeInfo: {
    accessKey: string;
    number: string;
    series: string;
    issueDate: string;
    supplier: {
      cnpj: string;
      name: string;
      tradeName: string;
    };
  };
  products: Array<{
    code: string;
    description: string;
    gtin: string;
    quantity: number;
    unitPrice: number;
    isNew: boolean; // true se foi criado automaticamente
  }>;
  newProductsCount: number;
  existingProductsCount: number;
}
```

### `products.updateCustomerCode`

Vincula código do cliente a um produto existente.

**Input:**
```typescript
{
  productId: number;
  customerCode: string;
}
```

**Output:**
```typescript
{
  success: boolean;
  updatedSku: string; // Novo SKU (agora é o customerCode)
}
```

---

## Página de Importação NF-e

### Localização

**Rota:** `/nfe-import`

**Acesso:** Dashboard Principal → Card "Importação NF"

### Funcionalidades

1. **Seleção de Cliente**
   - Dropdown com lista de clientes cadastrados
   - Campo obrigatório

2. **Upload de XML**
   - Interface drag-and-drop
   - Validação de formato (.xml)
   - Preview do nome do arquivo

3. **Resultado Detalhado**
   - **Informações da NF-e**: Número, série, fornecedor
   - **Produtos Novos** (verde): Lista de produtos cadastrados automaticamente
   - **Produtos Existentes** (azul): Lista de produtos que já estavam no sistema
   - **Erros** (vermelho): Lista de problemas encontrados

4. **Navegação**
   - Botão "Ver Produtos Cadastrados" → Redireciona para lista de produtos
   - Botão "Importar Outra NF-e" → Limpa formulário

---

## Exemplo Prático

### Passo 1: Importar NF-e de Entrada

```
Fornecedor: FARMACORP LTDA
NF-e: 12345
Itens:
  - Código: FARM-001, Descrição: DIPIRONA 500MG, EAN: 7891234567890
  - Código: FARM-002, Descrição: PARACETAMOL 750MG, EAN: 7891234567891
```

**Resultado:**
- 2 produtos criados automaticamente
- SKU = código do fornecedor
- supplierCode = código do fornecedor
- Descrição e EAN preenchidos

### Passo 2: NF-e de Saída com Código Diferente

```
Cliente: DROGARIA XYZ
NF-e Saída: 67890
Itens:
  - Código: DRG-A01 (desconhecido)
```

**Fluxo:**
1. Sistema não reconhece "DRG-A01"
2. Sistema sugere produtos similares pela descrição
3. Usuário seleciona "DIPIRONA 500MG" (FARM-001)
4. Sistema vincula:
   - SKU = "DRG-A01" (atualizado)
   - supplierCode = "FARM-001" (mantido)
   - customerCode = "DRG-A01" (novo)

### Passo 3: Próxima NF-e de Saída

```
Cliente: DROGARIA XYZ
NF-e Saída: 67891
Itens:
  - Código: DRG-A01
```

**Resultado:**
- Sistema reconhece automaticamente "DRG-A01"
- Não precisa de vinculação manual
- Produto já está mapeado

---

## Vantagens do Sistema

✅ **Agilidade**: Elimina cadastro manual prévio de produtos  
✅ **Precisão**: Dados vêm diretamente da NF-e oficial  
✅ **Rastreabilidade**: Mantém histórico de códigos (fornecedor + cliente)  
✅ **Flexibilidade**: Permite complementação posterior de dados  
✅ **Inteligência**: Sugere vinculações baseadas em similaridade  
✅ **Conformidade**: Garante que produtos recebidos estejam no sistema  

---

## Observações Importantes

⚠️ **Produtos criados automaticamente ficam com status "ativo"** - Não há status "pendente de complementação"

⚠️ **Apenas 3 campos são obrigatórios**: Cliente, SKU e Descrição

⚠️ **Lote e Data de Validade NÃO pertencem ao cadastro de produtos** - Esses dados são registrados no inventário durante o endereçamento

⚠️ **Preço NÃO é armazenado no cadastro de produtos** - Preços pertencem a contratos/pedidos, não ao produto mestre

---

## Próximas Implementações

🔄 **Em desenvolvimento:**
- Modal de vinculação inteligente para NF-e de saída
- Algoritmo de similaridade de strings (Levenshtein)
- Página de histórico de importações de NF-e
- Validação de duplicatas (evitar importar mesma NF-e duas vezes)
