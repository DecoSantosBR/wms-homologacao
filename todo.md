# WMS Med@x - Lista de Funcionalidades

## Fase 1: Configuração e Estrutura Base
- [x] Definir schema completo do banco de dados (todas as entidades)
- [x] Integrar arquivos corrigidos do backend (db.ts, routers.ts, modules)
- [x] Configurar estrutura de pastas do projeto

## Fase 2: Módulos de Backend

### Gestão de Clientes (Tenants)
- [ ] CRUD de clientes/tenants
- [ ] Gestão de contratos com threshold de validade

### Gestão de Produtos
- [ ] CRUD de produtos
- [ ] Campos: código interno, descrição, EAN, quantidade por caixa
- [ ] Controle de status (active/discontinued)

### Gestão de Endereços (Warehouse Locations)
- [ ] CRUD de endereços de armazém
- [ ] Tipos: receiving, storage, shipping, quarantine
- [ ] Regras de armazenagem: single/multi item, whole/fraction
- [ ] Atualização automática de status (available/occupied)

### Recebimento (Receiving)
- [ ] Criar ordem de recebimento (manual ou importação NF-e)
- [ ] Listar ordens de recebimento com filtros
- [ ] Visualizar detalhes da ordem
- [ ] Mover item para quarentena
- [ ] Soft delete de ordens

### Conferência Cega (Conference)
- [ ] Registrar conferência cega por item
- [ ] Registrar divergências (quantidade, validade, danos)
- [ ] Endereçamento automático após conferência
- [ ] Criação de estoque em quarentena
- [ ] Atualização automática de status de endereço

### Gestão de Estoque (Inventory)
- [ ] Visualizar saldo de estoque por produto/lote/endereço
- [ ] Filtros por tenant, produto, status, endereço
- [ ] Sincronização automática de saldos
- [ ] Recálculo de inventário

### Movimentações (Inventory Movements)
- [ ] Registrar movimentações de estoque
- [ ] Tipos: receiving, picking, transfer, adjustment
- [ ] Rastreabilidade completa com logs
- [ ] Filtros por tipo, período, produto

### Picking (Separação)
- [ ] Criar ordem de picking
- [ ] Listar ordens com filtros por status
- [ ] Executar picking de item
- [ ] Finalizar ordem de picking
- [ ] Soft delete de ordens
- [ ] Atualização automática de status de endereço

### Aprovação de Qualidade
- [ ] Aprovar lote em quarentena
- [ ] Rejeitar lote em quarentena
- [ ] Alterar status de estoque (quarantine → available)
- [ ] Alterar status de ordem (in_quarantine → completed)

## Fase 3: Interface de Usuário

### Layout e Navegação
- [ ] Implementar DashboardLayout com sidebar
- [ ] Menu de navegação principal
- [ ] Header com informações do usuário
- [ ] Sistema de autenticação (login/logout)

### Dashboard Principal
- [ ] Visão geral de indicadores (KPIs)
- [ ] Ordens pendentes de recebimento
- [ ] Itens em quarentena aguardando aprovação
- [ ] Alertas de validade próxima ao vencimento

### Tela de Clientes
- [ ] Listagem de clientes
- [ ] Formulário de cadastro/edição
- [ ] Visualização de detalhes do contrato

### Tela de Produtos
- [ ] Listagem de produtos com busca
- [ ] Formulário de cadastro/edição
- [ ] Importação em lote (CSV/Excel)

### Tela de Endereços
- [ ] Mapa visual do armazém
- [ ] Listagem de endereços com filtros
- [ ] Formulário de cadastro/edição
- [ ] Indicador visual de status (disponível/ocupado)

### Tela de Recebimento
- [ ] Listagem de ordens de recebimento
- [ ] Formulário de criação de ordem
- [ ] Importação de NF-e (XML)
- [ ] Detalhes da ordem com itens
- [ ] Ações: iniciar conferência, cancelar

### Tela de Conferência Cega
- [ ] Interface de conferência por scanner/digitação
- [ ] Registro de divergências
- [ ] Sugestão de endereçamento
- [ ] Confirmação de endereçamento

### Tela de Estoque
- [ ] Visualização de saldo consolidado
- [ ] Filtros avançados (produto, lote, validade, endereço)
- [ ] Exportação de relatórios
- [ ] Alertas de validade

### Tela de Movimentações
- [ ] Histórico de movimentações
- [ ] Filtros por tipo, período, produto
- [ ] Rastreabilidade completa

### Tela de Picking
- [ ] Listagem de ordens de picking
- [ ] Criação de ordem de picking
- [ ] Interface de execução de picking
- [ ] Sugestão de endereço de origem (FEFO)

### Tela de Aprovação de Qualidade
- [ ] Listagem de lotes em quarentena
- [ ] Detalhes do lote (produto, quantidade, validade)
- [ ] Ações: aprovar, rejeitar
- [ ] Histórico de aprovações

## Fase 4: Funcionalidades Avançadas
- [ ] Relatórios e dashboards analíticos
- [ ] Auditoria e logs de sistema
- [ ] Notificações e alertas
- [ ] Integração com APIs externas (NF-e, SEFAZ)
- [ ] Impressão de etiquetas e documentos
- [ ] Gestão de usuários e permissões (RBAC)

## Conformidade e Qualidade
- [ ] Validação de regras de negócio em todos os endpoints
- [ ] Testes unitários (vitest) para módulos críticos
- [ ] Documentação de API
- [ ] Conformidade com ANVISA (RDC 430/2020)


## Fase 4: Redesign do Sistema (Baseado em Referência)
- [x] Analisar design do sistema de referência (pharmwms)
- [x] Remover sidebar e implementar layout centralizado
- [x] Criar novo dashboard com grid de cards de módulos
- [x] Atualizar cores (azul vibrante #0066FF)
- [x] Implementar header simples (logo + início + perfil)
- [ ] Recriar páginas de Recebimento com novo design
- [ ] Recriar página de Importação NF-e
- [ ] Recriar página de Conferência Cega
- [x] Atualizar componentes (botões, cards, tabelas)
- [ ] Adicionar empty states com ilustrações
- [ ] Validar consistência visual em todas as páginas


## Fase 5: Formulários de Cadastro
- [x] Criar endpoint de criação de clientes (tenants.create)
- [x] Criar endpoint de criação de produtos (products.create)
- [x] Criar endpoint de criação de endereços (locations.create)
- [x] Implementar validações no backend (CNPJ, ANVISA, etc.)
- [x] Criar componente Dialog para formulário de cliente
- [x] Criar componente Dialog para formulário de produto
- [x] Criar componente Dialog para formulário de endereço
- [x] Adicionar validações de formulário com react-hook-form + zod
- [ ] Integrar formulários com mutations tRPC
- [ ] Implementar feedback visual (loading, success, error)
- [ ] Testar criação de clientes
- [ ] Testar criação de produtos
- [ ] Testar criação de endereços


## Fase 6: Funcionalidades Avançadas (Baseado em Capturas de Tela)

- [x] Criar dashboard intermediário de Cadastros (cards: Clientes, Produtos, Endereços, Usuários)
- [ ] Implementar modal de Cadastro em Lote de Endereços
- [ ] Implementar modal de Importação de Endereços via Excel
- [x] Implementar gestão de Zonas integrada em Locations (tabs)
- [x] Criar página de Gerenciamento de Usuários
- [x] Implementar modal de Novo Usuário com perfis de acesso
- [x] Adicionar perfis: Administrador do Sistema, Supervisor, Operador, Farmacêutico, Auditor
- [x] Atualizar tabelas com mais colunas e dados detalhados
- [x] Adicionar botões de ação (editar, excluir) nas tabelas
- [ ] Implementar filtros avançados nas páginas de listagem
## Fase 7: Edição e Exclusão de Registros
- [x] Implementar endpoints de atualização (tenants.update, products.update, locations.update)
- [x] Adicionar botões de ação (editar, excluir) nas tabelas
- [x] Criar modal de edição de clientes com dados pré-preenchidos
- [x] Criar modal de edição de produtos com dados pré-preenchidos
- [x] Criar modal de edição de endereços com dados pré-preenchidos
- [x] Implementar confirmação de exclusão (AlertDialog)
- [x] Usar soft delete nos endpoints de exclusão
- [x] Atualizar listagens após edição/exclusão


## Fase 8: Reestruturação Completa (Baseada em Documentação)
- [x] Reestruturar Home.tsx com grid de 8 módulos (Recebimento, Separação, Expedição, Cadastros, Importação NF, Estoque, Relatórios, Admin)
- [x] Criar página Users.tsx para gerenciamento de usuários
- [x] Integrar gestão de Zonas em Locations.tsx com tabs
- [x] Adicionar rotas no App.tsx
- [ ] Criar páginas faltantes: Stock.tsx, Reports.tsx, AdminDashboard.tsx, AdminCleanup.tsx, NFEImport.tsx, Shipping.tsx
- [ ] Reestruturar Receiving.tsx conforme documentação
- [ ] Reestruturar Picking.tsx conforme documentação
- [ ] Implementar todos os endpoints tRPC necessários
- [ ] Testar sistema completo


## Fase 9: Correções de Bugs
- [x] Implementar endpoints zones.create, zones.update, zones.delete no backend


## Fase 10: Importação de Endereços via Excel
- [x] Criar endpoint backend locations.importExcel para processar arquivo .xlsx
- [x] Copiar arquivo modelo para client/public/templates/
- [x] Adicionar botão "Importar Excel" na página Locations
- [x] Criar modal de upload com preview dos dados
- [x] Implementar botão de download do template modelo
- [x] Validar dados antes de importar (zona existe, campos obrigatórios)
- [x] Exibir resultado da importação (sucessos e erros)


## Fase 11: Correções de Bugs
- [x] Corrigir erro de elementos <a> aninhados na página Locations


## Fase 12: Filtros e Ordenação
- [x] Adicionar campo de busca por texto (código, rua, prédio) na tabela de endereços
- [x] Adicionar filtros dropdown por zona, status e tipo
- [x] Implementar ordenação clicável nas colunas da tabela
- [x] Adicionar contador de resultados filtrados
- [x] Implementar botão "Limpar Filtros"


## Fase 13: Correções de Bugs
- [x] Corrigir erro de elementos <a> aninhados que voltou na página Locations (não reproduzível após correção anterior)


## Fase 14: Correção de Importação Excel
- [x] Corrigir limitação de 100 registros no endpoint locations.importExcel
- [x] Processar todos os registros do arquivo Excel (testado com 1405 endereços)
- [x] Implementar batch inserts (lotes de 500) para melhor performance


## Fase 15: Exclusão em Massa de Endereços
- [x] Criar endpoint backend locations.deleteMany com hard delete
- [x] Adicionar checkboxes para seleção múltipla na tabela
- [x] Implementar botão "Excluir Selecionados" com contador
- [x] Adicionar modal de confirmação com dupla verificação
- [x] Exibir resultado da exclusão (quantidade removida)


## Fase 16: Correções de Erros Críticos
- [x] Corrigir query SQL malformada no endpoint locations.deleteMany (usar inArray)
- [x] Corrigir estrutura HTML do modal (usar asChild e div em vez de p aninhados)
