# WMS Med@x - Documentação Módulo Cadastros

**Data:** Janeiro 2026  
**Versão:** 1.0  
**Autor:** Manus AI  
**Sistema:** WMS Farmacêutico - Sistema de Gerenciamento de Armazém

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Submódulos](#submódulos)
3. [Estrutura de Dados](#estrutura-de-dados)
4. [Funcionalidades Comuns](#funcionalidades-comuns)
5. [Integração com Backend](#integração-com-backend)

---

## Visão Geral

O módulo de Cadastros é responsável pela gestão de dados mestre do sistema WMS. Inclui gerenciamento de clientes (tenants), produtos, usuários, localizações e zonas de armazém. Todos os submódulos seguem padrão consistente de CRUD com validações e auditoria.

**Submódulos:**
- Clientes (Tenants)
- Produtos
- Usuários
- Localizações
- Zonas

---

## Submódulos

### 1. Clientes (Tenants)

**Arquivo:** `client/src/pages/Tenants.tsx`

**Funcionalidades:**
- Listar clientes
- Criar novo cliente
- Editar dados do cliente
- Deletar cliente
- Visualizar histórico

**Campos:**
- Nome
- CNPJ
- Email
- Telefone
- Endereço
- Cidade
- Estado
- CEP
- Ativo (Sim/Não)

**Validações:**
- CNPJ único
- Email válido
- Campos obrigatórios preenchidos

### 2. Produtos

**Arquivo:** `client/src/pages/Products.tsx`

**Funcionalidades:**
- Listar produtos
- Criar novo produto
- Editar produto
- Deletar produto
- Importar produtos em lote
- Gerenciar categorias

**Campos:**
- SKU (código único)
- Nome
- Descrição
- Categoria
- Preço de custo
- Preço de venda
- Quantidade mínima
- Unidade de medida
- Ativo (Sim/Não)

**Validações:**
- SKU único
- Preço válido
- Quantidade mínima >= 0

### 3. Usuários

**Arquivo:** `client/src/pages/Users.tsx`

**Funcionalidades:**
- Listar usuários
- Criar novo usuário
- Editar usuário
- Deletar usuário
- Resetar senha
- Gerenciar permissões
- Ativar/Desativar usuário

**Campos:**
- Nome completo
- Email
- Login
- Senha
- Telefone
- Cargo
- Departamento
- Ativo (Sim/Não)
- Permissões (Roles)

**Validações:**
- Email único
- Login único
- Senha com requisitos mínimos

### 4. Localizações

**Arquivo:** `client/src/pages/Locations.tsx`

**Funcionalidades:**
- Listar localizações
- Criar localização
- Editar localização
- Deletar localização
- Visualizar ocupação
- Gerenciar capacidade

**Campos:**
- Código (Zona-Corredor-Prateleira-Posição)
- Zona
- Corredor
- Prateleira
- Posição
- Capacidade
- Tipo (Palete, Caixa, etc)
- Ativo (Sim/Não)

**Validações:**
- Código único
- Capacidade > 0
- Zona existe

### 5. Zonas

**Arquivo:** `client/src/pages/Zones.tsx` (se existir)

**Funcionalidades:**
- Listar zonas
- Criar zona
- Editar zona
- Deletar zona
- Visualizar localizações da zona

**Campos:**
- Nome
- Código
- Descrição
- Tipo (Recebimento, Armazenagem, Separação)
- Ativo (Sim/Não)

---

## Estrutura de Dados

### Tabelas do Banco de Dados

#### Tabela: tenants

```sql
CREATE TABLE tenants (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  cnpj VARCHAR(18) UNIQUE NOT NULL,
  email VARCHAR(320),
  phone VARCHAR(20),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(2),
  zipCode VARCHAR(10),
  active BOOLEAN DEFAULT true,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

#### Tabela: products

```sql
CREATE TABLE products (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenantId INT NOT NULL,
  sku VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  categoryId INT,
  costPrice DECIMAL(10, 2),
  salePrice DECIMAL(10, 2),
  minQuantity INT DEFAULT 0,
  unit VARCHAR(20),
  active BOOLEAN DEFAULT true,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (tenantId) REFERENCES tenants(id),
  UNIQUE KEY unique_sku_tenant (sku, tenantId)
);
```

#### Tabela: systemUsers

```sql
CREATE TABLE systemUsers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenantId INT NOT NULL,
  fullName VARCHAR(255) NOT NULL,
  login VARCHAR(100) NOT NULL,
  email VARCHAR(320) NOT NULL,
  passwordHash VARCHAR(255) NOT NULL,
  active BOOLEAN DEFAULT true,
  failedLoginAttempts INT DEFAULT 0,
  lockedUntil TIMESTAMP NULL,
  lastLogin TIMESTAMP NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  createdBy INT,
  FOREIGN KEY (tenantId) REFERENCES tenants(id),
  UNIQUE KEY unique_login_tenant (tenantId, login)
);
```

#### Tabela: warehouseLocations

```sql
CREATE TABLE warehouseLocations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenantId INT NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,
  zoneId INT NOT NULL,
  corridor INT,
  shelf INT,
  position INT,
  capacity INT,
  type VARCHAR(50),
  active BOOLEAN DEFAULT true,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (tenantId) REFERENCES tenants(id),
  FOREIGN KEY (zoneId) REFERENCES zones(id)
);
```

#### Tabela: zones

```sql
CREATE TABLE zones (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenantId INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20) UNIQUE NOT NULL,
  description TEXT,
  type VARCHAR(50),
  active BOOLEAN DEFAULT true,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (tenantId) REFERENCES tenants(id)
);
```

---

## Funcionalidades Comuns

Todos os submódulos de cadastro implementam:

### 1. Listagem com Paginação

```typescript
const { data: items, isLoading } = trpc.module.list.useQuery({
  page: 1,
  limit: 20,
  search: searchTerm,
});
```

### 2. Criar/Editar com Modal

```typescript
const [isModalOpen, setIsModalOpen] = useState(false);
const [editingItem, setEditingItem] = useState<Item | null>(null);
const [formData, setFormData] = useState<FormData>({});

const createMutation = trpc.module.create.useMutation({
  onSuccess: () => {
    toast.success("Item criado com sucesso!");
    refetch();
    setIsModalOpen(false);
  },
});

const updateMutation = trpc.module.update.useMutation({
  onSuccess: () => {
    toast.success("Item atualizado com sucesso!");
    refetch();
    setIsModalOpen(false);
  },
});
```

### 3. Deletar com Confirmação

```typescript
const deleteMutation = trpc.module.delete.useMutation({
  onSuccess: () => {
    toast.success("Item deletado com sucesso!");
    refetch();
  },
  onError: (error) => {
    toast.error(`Erro: ${error.message}`);
  },
});
```

### 4. Busca e Filtros

```typescript
const [searchTerm, setSearchTerm] = useState("");
const [filters, setFilters] = useState({
  active: true,
  category: null,
});

const { data: filteredItems } = trpc.module.list.useQuery({
  search: searchTerm,
  ...filters,
});
```

### 5. Exportar para CSV

```typescript
const handleExportCSV = () => {
  const csv = convertToCSV(items);
  downloadCSV(csv, "items.csv");
};
```

---

## Integração com Backend

### Procedures tRPC Necessárias

```typescript
export const appRouter = router({
  tenants: {
    list: publicProcedure
      .input(z.object({
        page: z.number().default(1),
        limit: z.number().default(20),
        search: z.string().optional(),
      }))
      .query(async ({ ctx, input }) => {
        // Retorna lista paginada de clientes
      }),
    
    create: protectedProcedure
      .input(z.object({
        name: z.string(),
        cnpj: z.string(),
        email: z.string().email(),
        phone: z.string(),
        address: z.string(),
        city: z.string(),
        state: z.string(),
        zipCode: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Cria novo cliente
      }),
    
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        // ... campos atualizáveis
      }))
      .mutation(async ({ ctx, input }) => {
        // Atualiza cliente
      }),
    
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        // Deleta cliente
      }),
  },

  products: {
    list: publicProcedure
      .input(z.object({
        page: z.number().default(1),
        limit: z.number().default(20),
        search: z.string().optional(),
        tenantId: z.number().optional(),
      }))
      .query(async ({ ctx, input }) => {
        // Retorna lista paginada de produtos
      }),
    
    create: protectedProcedure
      .input(z.object({
        tenantId: z.number(),
        sku: z.string(),
        name: z.string(),
        description: z.string(),
        categoryId: z.number(),
        costPrice: z.number(),
        salePrice: z.number(),
        minQuantity: z.number(),
        unit: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Cria novo produto
      }),
    
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        // ... campos atualizáveis
      }))
      .mutation(async ({ ctx, input }) => {
        // Atualiza produto
      }),
    
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        // Deleta produto
      }),
  },

  // ... similar para users, locations, zones
});
```

---

**Fim da Documentação - Módulo Cadastros**
