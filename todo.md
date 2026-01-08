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


## Fase 17: Investigação de Exclusão em Massa
- [x] Verificar restrições de foreign key em warehouseLocations no schema
- [x] Verificar se inventory ou outras tabelas referenciam warehouseLocations
- [x] Implementar validação no endpoint deleteMany (verificar inventário antes de excluir)
- [x] Retornar erro informativo se houver inventário nos endereços
- [ ] Testar exclusão com e sem inventário


## Fase 18: Correção de Limitação de Listagem
- [x] Identificar limitação de 100 registros no endpoint locations.list
- [x] Remover limite para exibir todos os 1405 endereços


## Fase 19: Reestruturação do Módulo de Clientes (Tenants)
- [x] Adicionar campo "Regra de Picking" (FIFO | FEFO | Direcionado)
- [x] Adicionar campos de endereço completo (Endereço, Cidade, Estado, CEP)
- [x] Atualizar validações (CNPJ único, email válido)
- [x] Atualizar schema do banco (pickingRule adicionado)
- [x] Atualizar endpoint backend com todos os campos
- [ ] Testar CRUD completo com novos campos


## Fase 20: Exclusão em Massa de Clientes
- [x] Criar endpoint backend tenants.deleteMany com hard delete
- [x] Adicionar validação de dependências (produtos, contratos, usuários)
- [x] Adicionar checkboxes para seleção múltipla na tabela
- [x] Implementar botão "Excluir Selecionados" com contador
- [x] Adicionar modal de confirmação com avisos de segurança
- [x] Exibir resultado da exclusão (quantidade removida)


## Fase 21: Reestruturação do Módulo de Produtos
- [x] Verificar e atualizar schema de products (SKU, categoria, dispensingQuantity, unidade de medida)
- [x] Reestruturar Products.tsx com todos os campos conforme documentação
- [x] Adicionar validações (SKU único, quantidade mínima >= 0, dispensação >= 1)
- [x] Atualizar endpoints backend (create, update com novos campos: category, minQuantity, dispensingQuantity)
- [x] Implementar exclusão em massa de produtos (já no frontend)
- [x] Adicionar endpoint deleteMany no backend com validações (inventário, recebimento, picking)
- [x] Adicionar campos ao CreateProductDialog (category, unitOfMeasure, minQuantity, dispensingQuantity)
- [x] Testar modal de cadastro visualmente


## Fase 22: Cadastro Automático de Produtos via NF-e
- [x] Atualizar schema de products com campos supplierCode e customerCode
- [x] Adicionar status "pending_completion" ao enum de status
- [x] Aplicar migração no banco de dados (pnpm db:push)
- [x] Implementar parser de XML de NF-e (extrair dados de <det>, <xProd>, <cEAN>, etc.)
- [x] Criar endpoint nfe.importReceiving para importação de NF-e de entrada
- [x] Implementar lógica de cadastro automático de produtos não existentes
- [x] Criar página NFEImport.tsx com upload de XML
- [x] Implementar resultado detalhado da importação (produtos novos, existentes, erros)
- [x] Adicionar feedback visual (produtos novos vs existentes)
- [x] Adicionar rota /nfe-import no App.tsx

## Fase 23: Vinculação Inteligente de Produtos (NF-e de Saída)
- [ ] Implementar algoritmo de similaridade de strings (Levenshtein)
- [ ] Criar endpoint nfe.importShipping para NF-e de saída
- [ ] Implementar modal de vinculação com sugestões
- [ ] Exibir top 5 produtos mais similares
- [ ] Salvar customerCode após vinculação
- [ ] Testar fluxo de vinculação

## Fase 24: Complementação de Dados Durante Conferência
- [ ] Adicionar modal de edição rápida na conferência cega
- [ ] Campos: Quantidade por Caixa, Categoria, Fabricante
- [ ] Atualizar status de "pending_completion" para "active"
- [ ] Testar complementação durante conferência


## Fase 24: Correções na Lógica de Produtos e Códigos
- [x] Remover status "pending_completion" do schema de products
- [x] Aplicar migração no banco de dados (pnpm db:push)
- [x] Atualizar endpoint nfe.importReceiving para criar produtos com status "active"
- [x] Implementar lógica de atualização de SKU quando customerCode for vinculado
- [x] Criar endpoint products.updateCustomerCode para vinculação de código de saída
- [x] Testar fluxo: NF-e entrada (cria com supplierCode) → NF-e saída (vincula customerCode e atualiza SKU)
- [x] Documentar regras de códigos (implementado no código)


## Fase 25: Correção do Parser de XML da NF-e
- [x] Analisar estrutura do XML que está falhando
- [x] Corrigir parser para suportar diferentes estruturas (com/sem namespace, nfeProc, etc.)
- [x] Adicionar logs de debug para identificar estrutura do XML
- [x] Testar com XML real fornecido pelo usuário (4 produtos extraídos com sucesso)
- [ ] Salvar checkpoint com correção


## Fase 26: Implementação do Módulo de Recebimento
- [x] Revisar DOCUMENTACAO_02_RECEBIMENTO.md completamente
- [x] Revisar DOCUMENTACAO_08_CONFERENCIA_ETIQUETAS.md completamente
- [x] Verificar schema de receivingOrders (já existe)
- [x] Verificar schema de receivingOrderItems (já existe)
- [x] Verificar schema de receivingConferences (já existe)
- [x] Verificar schema of receivingDivergences (já existe)
- [x] Implementar endpoint receiving.getItems
- [x] Implementar endpoint receiving.create
- [x] Implementar endpoint receiving.delete
- [x] Implementar endpoint receiving.deleteBatch
- [x] Implementar endpoint receiving.checkItem
- [x] Implementar endpoint receiving.addressItem
- [x] Implementar endpoint receiving.getPendingAddressingBalance
- [x] Todos os 7 endpoints implementados com sucesso
- [x] Criar componente Receiving.tsx com tabela de ordens
- [x] Adicionar badges de status com cores (scheduled=azul, in_progress=amarelo, addressing=roxo, completed=verde)
- [x] Adicionar filtros (status, fornecedor, data)
- [x] Implementar ação de visualizar itens da ordem
- [x] Implementar ação de deletar ordem (validação de status)
- [x] Implementar seleção múltipla e deletar em lote
- [x] Implementar ação de agendar previsão de chegada do veículo
- [x] Criar modal de agendamento com seleção de data/hora
- [x] Criar endpoint receiving.schedule para atualizar scheduledDate
- [x] Modal de visualização de itens já implementado inline
- [x] Rota /receiving já existe no App.tsx
- [x] Testar listagem, filtros e ações (servidor reiniciado com sucesso)
- [x] Atualizar endpoint nfe.importReceiving para criar receivingOrder
- [x] Criar receivingOrderItems com dados do XML (expectedQuantity, expectedGtin, expectedSupplierCode)
- [x] Atualizar frontend NFEImport.tsx para exibir ordem criada
- [x] Adicionar botão de redirecionamento para página de Recebimento
- [ ] Testar fluxo completo: importar XML → criar ordem → visualizar
- [ ] Implementar página de Conferência Cega
- [ ] Implementar leitura de etiquetas (código de barras)
- [ ] Implementar gestão de divergências
- [ ] Implementar aprovação de divergências
- [ ] Implementar endereçamento de produtos
- [ ] Implementar finalização de recebimento
- [ ] Testar fluxo completo: Agendar → Conferir → Aprovar → Endereçar → Finalizar


## Fase 27: Implementação de Pré-Alocação de Endereços
- [x] Revisar PREALLOCACAO_DETALHADA.md completa
- [x] Verificar schema de receivingPreallocations existente
- [x] Instalar biblioteca xlsx para processar Excel
- [x] Criar função processPreallocationExcel() para ler arquivo
- [x] Criar função validatePreallocations() para validar contra banco
- [x] Criar função generatePreallocationTemplate() para gerar modelo
- [x] Criar endpoint receiving.downloadPreallocationTemplate
- [x] Criar endpoint receiving.uploadPreallocationFile
- [x] Criar endpoint receiving.savePreallocations
- [x] Criar endpoint receiving.getPreallocations
- [x] Criar endpoint receiving.getSuggestedLocation
- [x] Criar endpoint receiving.generateLabels
- [ ] Criar modal PreallocationDialog.tsx com upload de Excel
- [ ] Implementar tabela de validações com status (válido/inválido)
- [ ] Adicionar botão "Pré-Alocar" na página de Recebimento
- [ ] Testar upload de planilha e validações


## Fase 28: Correção do Fluxo de Recebimento - Alocação em REC + Transferência
- [x] Revisar DOCUMENTACAO_07_ESTOQUE.md sobre movimentações
- [x] Entender fluxo de Transferência (origem → destino)
- [x] Identificar que conferência deve criar inventário em REC, não em endereço final
- [x] Corrigir endpoint receiving.checkItem para criar inventário em endereço REC (não em endereço final)
- [x] Adicionar campo expiryDate ao input de checkItem
- [x] Criar movimentação tipo "receiving" automaticamente
- [x] Criar arquivo movements.ts com função registerMovement
- [x] Criar router stock com endpoint registerMovement
- [x] Criar endpoint stock.getAvailableStock para listar produtos em endereço
- [x] Implementar validações (saldo, regra de armazenagem)
- [x] Implementar atualização automática de status de endereços
- [ ] addressItem pode ser mantido para compatibilidade (opcional)
- [ ] Sugestão de endereço pré-alocado já existe em receiving.getSuggestedLocation
- [ ] Criar interface de transferência com origem (REC) e destino (pré-alocação ou livre)
- [ ] Testar fluxo: Conferir → Criar inventário em REC → Transferir para destino


## Fase 29: Interface de Conferência Cega
- [x] Criar componente BlindCheckModal.tsx
- [x] Adicionar input com foco automático para scanner de código de barras
- [x] Implementar lógica de busca de produto por GTIN/EAN e SKU
- [x] Implementar campos de lote, data de validade e quantidade
- [x] Adicionar feedback visual de sucesso/erro com toasts
- [x] Implementar detecção automática de divergências (sobra/falta)
- [x] Adicionar tabela de itens já conferidos nesta sessão
- [x] Adicionar tabela de resumo com progresso de cada item
- [x] Integrar botão "Conferir" na página de Recebimento
- [x] Adicionar query separada para buscar itens da ordem a conferir
- [x] Corrigir tipos para aceitar string | null nos campos opcionais
- [ ] Testar fluxo completo com scanner real


## Fase 30: Associação de Etiquetas e Scanner via Câmera
- [x] Revisar ASSOCIACAO_PRODUTOS_ETIQUETAS.md completamente
- [x] Identificar mudanças necessárias no fluxo de conferência
- [x] Criar router blindConference com 7 endpoints (start, readLabel, associateLabel, undoLastReading, adjustQuantity, getSummary, finish)
- [x] Tabelas já existem no schema (blindConferenceSessions, labelAssociations, labelReadings, blindConferenceAdjustments)
- [x] Instalar biblioteca html5-qrcode para scanner de código de barras
- [x] Criar componente BarcodeScanner com suporte webcam/mobile
- [x] Reescrever BlindCheckModal completo com sistema de sessões
- [x] Adicionar botão de scanner via câmera no BlindCheckModal
- [x] Implementar diálogo de associação de etiquetas
- [x] Adicionar funcionalidade de desfazer última leitura
- [ ] Testar scanner em desktop (webcam) e mobile
- [ ] Testar associação de etiquetas conforme documentação


## Fase 31: Correção de Associação Produto+Lote
- [x] Lógica já correta: busca por sessionId+labelCode (etiqueta única)
- [x] Múltiplas etiquetas para o mesmo produto funcionam (cada etiqueta = produto+lote específico)
- [x] Mesma etiqueta só pode ser associada uma vez (incrementa contagem ao reler)
- [x] Resumo agrupa por produto+lote (cada associação tem batch)
- [x] Campo "Lote" tornado obrigatório no diálogo de associação
- [x] Validação de lote obrigatório no handleAssociate
- [ ] Testar cenário: 1 produto com 2 lotes diferentes e 2 etiquetas


## Fase 32: Correção de Lógica de Etiquetas - Lote Opcional
- [x] Lógica readLabel mantida correta: busca por sessionId+labelCode (etiqueta trava no produto+lote)
- [x] Etiqueta fica "travada" na primeira associação (produto+lote ou produto sem lote)
- [x] Campo "Lote" tornado opcional no frontend
- [x] Validação de lote obrigatório removida do handleAssociate
- [x] getSummary já funciona corretamente (soma por produto, rastreia lotes separadamente)
- [ ] Testar cenário: SKU 123 com lote ABC (etiqueta VOL-001) e lote DEF (etiqueta VOL-002)
- [ ] Testar cenário: SKU 123 SEM informar lote (etiqueta VOL-001, 100 leituras)


## Fase 33: Reescrever BlindCheckModal com Layout Correto
- [x] Adicionar header com 3 métricas: Volumes Lidos, Unidades Totais, Produtos Distintos
- [x] Manter input de etiqueta + botão "Ler" + link "Escanear com Câmera"
- [x] Criar tabela "Produtos Conferidos" com colunas: Produto, Lote, Un/Volume, Volumes, Unidades, Ações
- [x] Remover barra de progresso (conferência cega não mostra progresso)
- [x] Remover seção "Resumo por Produto" da tela principal
- [x] Tela principal NÃO mostra comparação com quantidade esperada
- [x] Modal de finalização SIM mostra resumo com divergências
- [x] Adicionar botão "Desfazer Última" no rodapé
- [ ] Testar com dados reais: 401460P lote 22D08LB108 (1600) + lote 22D10LB111 (560)
