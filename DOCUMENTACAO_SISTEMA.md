# WMS Med@x - Documentação do Sistema

**Versão:** 1.0.0  
**Data:** Janeiro 2026  
**Desenvolvido com base nas especificações canônicas e correções críticas implementadas**

---

## 📋 Visão Geral

O **WMS Med@x** é um sistema de gerenciamento de armazém (Warehouse Management System) especializado para operadores logísticos da área da saúde (farmacêutico e hospitalar), desenvolvido com conformidade às normas da ANVISA (RDC 430/2020).

### Características Principais

- **Multi-tenant**: Suporte a múltiplos clientes em uma única instância
- **Rastreabilidade Total**: Controle completo de lotes, validades e movimentações
- **Conformidade Regulatória**: Aderência às normas ANVISA para produtos farmacêuticos
- **Soft Delete**: Exclusão lógica para manter histórico completo (auditoria)
- **Fluxo de Quarentena**: Produtos recebidos entram em quarentena antes de liberação
- **Atualização Automática**: Status de endereços atualizado automaticamente

---

## 🏗️ Arquitetura

### Stack Tecnológica

**Frontend:**
- React 19 + TypeScript
- TailwindCSS 4 + shadcn/ui
- tRPC para comunicação type-safe
- Wouter para roteamento

**Backend:**
- Node.js 22 + Express 4
- tRPC 11 (API type-safe)
- Drizzle ORM + MySQL
- Autenticação via Manus OAuth

### Estrutura de Diretórios

```
wms-medax/
├── client/                    # Frontend React
│   └── src/
│       ├── components/        # Componentes reutilizáveis
│       ├── pages/            # Páginas da aplicação
│       └── lib/              # Utilitários (tRPC client)
├── server/                   # Backend Node.js
│   ├── modules/              # Módulos de negócio
│   │   ├── conference.ts     # Conferência cega
│   │   ├── inventory.ts      # Gestão de estoque
│   │   ├── locations.ts      # Endereços
│   │   ├── picking.ts        # Separação
│   │   ├── products.ts       # Produtos
│   │   └── receiving.ts      # Recebimento
│   ├── db.ts                 # Funções de banco de dados
│   └── routers.ts            # Endpoints tRPC
└── drizzle/                  # Schema e migrações
    └── schema.ts             # 36 tabelas
```

---

## 📊 Modelo de Dados

### Entidades Principais

**36 Tabelas no Total:**

1. **tenants** - Clientes (multi-tenant)
2. **contracts** - Contratos com clientes
3. **products** - Produtos cadastrados
4. **warehouses** - Armazéns
5. **warehouseZones** - Zonas de armazenagem
6. **warehouseLocations** - Endereços de armazenagem
7. **receivingOrders** - Ordens de recebimento
8. **receivingOrderItems** - Itens das ordens
9. **receivingConferences** - Conferências cegas
10. **receivingDivergences** - Divergências encontradas
11. **pickingOrders** - Ordens de separação
12. **pickingOrderItems** - Itens de picking
13. **inventory** - Saldo de estoque
14. **inventoryMovements** - Movimentações de estoque
15. **auditLogs** - Logs de auditoria

*(E mais 21 tabelas auxiliares para controle completo)*

### Regras de Negócio Implementadas

#### ✅ Correção 1: Soft Delete
- Todas as exclusões são lógicas (campo `status`)
- Funções corrigidas: `deleteTenant`, `deleteProduct`, `deleteReceivingOrder`, `deletePickingOrder`
- **Impacto:** Conformidade ANVISA, rastreabilidade total

#### ✅ Correção 2: Fluxo de Quarentena Obrigatório
- Produtos recebidos entram automaticamente em quarentena
- Status inicial: `quarantine` (não `available`)
- Status da ordem: `in_quarantine` (não `completed`)
- **Impacto:** Conformidade regulatória, segurança sanitária

#### ✅ Correção 3: Atualização Automática de Status de Endereço
- Nova função: `updateLocationStatus()` em `locations.ts`
- Atualiza status para `occupied` quando estoque é criado
- Atualiza status para `available` quando estoque é zerado
- **Impacto:** Consistência de dados, operação confiável

---

## 🔌 API Endpoints

### Autenticação
- `auth.me` - Obter usuário atual
- `auth.logout` - Fazer logout

### Dashboard
- `dashboard.stats` - Estatísticas gerais do sistema

### Clientes (Tenants)
- `tenants.list` - Listar todos os clientes
- `tenants.getById` - Buscar cliente por ID
- `tenants.create` - Criar novo cliente

### Produtos
- `products.list` - Listar produtos (com filtros)
- `products.create` - Cadastrar novo produto

### Endereços (Locations)
- `locations.list` - Listar endereços (com filtros de zona e status)
- `locations.create` - Criar novo endereço

### Recebimento
- `receiving.list` - Listar ordens de recebimento
- `receiving.create` - Criar ordem de recebimento

### Picking
- `picking.list` - Listar ordens de picking
- `picking.create` - Criar ordem de picking

### Estoque
- `inventory.list` - Visualizar saldo de estoque (com filtros)

---

## 🎨 Interface de Usuário

### Páginas Implementadas

1. **Dashboard** (`/`)
   - Estatísticas em tempo real
   - Cards com métricas principais
   - Visão geral do sistema

2. **Clientes** (`/tenants`)
   - Listagem de clientes
   - Informações de CNPJ, localização

3. **Produtos** (`/products`)
   - Listagem de produtos
   - Busca por SKU/descrição
   - Informações de EAN, unidades por caixa

4. **Endereços** (`/locations`)
   - Grid de endereços
   - Status visual (disponível, ocupado, bloqueado)
   - Informações de rua/prédio/andar

5. **Recebimento** (`/receiving`)
   - Ordens de recebimento
   - Status visual (pendente, em andamento, quarentena, concluído)
   - Informações de NF-e e fornecedor

6. **Picking** (`/picking`)
   - Ordens de separação
   - Status visual
   - Número do pedido

7. **Estoque** (`/inventory`)
   - Saldo por produto/lote/endereço
   - Status (disponível, quarentena, bloqueado, reservado)
   - Informações de validade

### Design System

- **Tema:** Light (profissional para ambiente corporativo)
- **Componentes:** shadcn/ui (sistema de design moderno)
- **Cores:** Semânticas por status (verde=ok, amarelo=atenção, vermelho=crítico)
- **Layout:** Sidebar fixa com navegação, área de conteúdo responsiva

---

## 🚀 Como Usar

### Acesso ao Sistema

1. Acesse a URL do sistema
2. Faça login com suas credenciais Manus OAuth
3. Navegue pelos módulos usando o menu lateral

### Fluxo Operacional Típico

#### 1. Cadastro Inicial
1. Cadastrar cliente (Tenant)
2. Cadastrar produtos
3. Configurar endereços de armazenagem

#### 2. Recebimento de Mercadoria
1. Criar ordem de recebimento (manual ou importar NF-e)
2. Realizar conferência cega
3. Sistema move automaticamente para quarentena
4. Após aprovação de qualidade, liberar estoque

#### 3. Separação de Pedidos
1. Criar ordem de picking
2. Sistema sugere endereços com estoque disponível
3. Operador realiza separação
4. Sistema atualiza estoque e status de endereços

---

## 🔒 Segurança e Conformidade

### Auditoria
- Todos os eventos críticos são registrados em `auditLogs`
- Informações capturadas: usuário, ação, entidade, valores antigos/novos, IP, user-agent

### Rastreabilidade
- Controle de lote obrigatório
- Controle de validade obrigatório
- Histórico completo de movimentações em `inventoryMovements`

### Soft Delete
- Nenhum registro é fisicamente excluído
- Registros "deletados" têm status alterado para `deleted` ou `cancelled`
- Histórico preservado para auditorias

### Conformidade ANVISA
- Fluxo de quarentena obrigatório
- Rastreabilidade de lote e validade
- Logs de auditoria completos
- Controle de temperatura (campo disponível no schema)

---

## 📝 Próximos Passos Recomendados

### Fase 2 - Melhorias Moderadas (Prioridade Média)

1. **Threshold de Validade Dinâmico**
   - Buscar do contrato do cliente ao invés de valor fixo
   - Alertas personalizados por cliente

2. **Busca Dinâmica de Zona de Quarentena**
   - Buscar zona configurada ao invés de ID fixo
   - Permitir múltiplas zonas de quarentena

3. **Validação de Regra de Armazenagem**
   - Validar single/multi item antes de criar estoque
   - Validar whole/fraction antes de movimentação

4. **Endpoint de Aprovação de Qualidade**
   - Liberar estoque de quarentena para disponível
   - Registrar responsável pela aprovação

### Fase 3 - Funcionalidades Avançadas (Futuro)

1. **Parser de NF-e XML**
   - Implementar parser real usando xml2js
   - Importação automática de ordens de recebimento

2. **Geração de Etiquetas**
   - Gerar etiquetas RFID/código de barras
   - Impressão direta

3. **Sugestão Inteligente de Endereçamento**
   - Algoritmo de otimização de espaço
   - Considerar FEFO (First Expire First Out)

4. **Importação de Ordens de Picking**
   - Importar de sistemas ERP
   - Integração via API

5. **Contagem de Inventário**
   - Módulo completo de inventário cíclico
   - Ajustes automáticos

---

## 🐛 Problemas Conhecidos

### Warnings de TypeScript (Não Críticos)
- Alguns warnings de tipagem do Drizzle ORM em queries com `and()`
- **Impacto:** Nenhum - sistema funciona normalmente
- **Solução:** Usar `any[]` para array de conditions (já implementado)

### Funcionalidades Parciais
- Parser de NF-e retorna erro (implementação futura)
- Módulos de etiquetas, endereçamento e importação de picking são stubs
- **Impacto:** Funcionalidades básicas estão operacionais

---

## 📞 Suporte

Para dúvidas ou suporte técnico, consulte:
- Documentação canônica: `DOCUMENTO_CANONICO_CONTEXTO.md`
- Guia de evolução: `GUIA_EVOLUCAO_CONTROLADA.md`
- Relatório de correções: `RELATORIO_CORRECOES.md`

---

**Desenvolvido com atenção às regras de negócio e conformidade regulatória.**
