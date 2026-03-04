# WMS Med@x - Todo de Migração

## Migração do Repositório wms-homologacao → wms-medax

- [x] Migrar package.json com dependências extras (bwip-js, exceljs, xlsx, pdfkit, multer, @zxing, html5-qrcode, idb, jsbarcode, qrcode, xml2js, etc.)
- [x] Migrar shared/ (const.ts, types.ts, utils.ts, _core/errors.ts)
- [x] Migrar drizzle/schema.ts com todas as 56 tabelas do WMS
- [x] Migrar drizzle.config.ts
- [x] Migrar server/_core/ (env.ts, context.ts, sdk.ts, oauth.ts, trpc.ts, cookies.ts, etc.)
- [x] Migrar server/db.ts com todos os helpers de banco
- [x] Migrar server/routers.ts e todos os routers tRPC
- [x] Migrar server/modules/ (addressing, conference, inventory, picking, receiving, etc.)
- [x] Migrar server/movements.ts, stage.ts, preallocation.ts, etc.
- [x] Migrar server/storage.ts
- [x] Migrar server/nfeParser.ts, locationCodeValidator.ts, locationValidation.ts
- [x] Migrar server/waveLogic.ts, waveDocument.ts, pickingLogic.ts, pickingAllocation.ts
- [x] Migrar server/syncReservations.ts, stockAlerts.ts, occupancy.ts, inventory.ts
- [x] Migrar todos os routers: blindConferenceRouter, clientPortalRouter, collectorPickingRouter, labelRouter, maintenanceRouter, pickingRouter, preallocationRouter, reportsRouter, roleRouter, shippingRouter, stageRouter, stockRouter, uploadRouter, userRouter, waveRouter
- [x] Migrar client/src/index.css (estilos globais)
- [x] Migrar client/src/App.tsx com todas as rotas
- [x] Migrar client/src/const.ts
- [x] Migrar client/src/main.tsx
- [x] Migrar client/src/lib/ (trpc.ts, utils.ts, dateUtils.ts, reportExport.ts, mobile-utils.ts, offlineQueue.ts)
- [x] Migrar client/src/hooks/ (useBackground, useBusinessError, useClientPortalAuth, useComposition, useMobile, useOfflineSync, usePersistFn)
- [x] Migrar client/src/contexts/ThemeContext.tsx
- [x] Migrar client/src/components/ (todos os componentes WMS)
- [x] Migrar client/src/pages/ (todas as páginas WMS)
- [x] Migrar vite.config.ts com aliases corretos
- [x] Migrar tsconfig.json
- [x] Instalar dependências extras com pnpm add
- [x] Aplicar migrations no TiDB Cloud (56 tabelas criadas)
- [x] Configurar variáveis de ambiente (injetadas automaticamente pelo Manus)
- [x] Corrigir erros de TypeScript (0 erros)
- [x] Validar build de produção (vite build + esbuild OK)
- [x] Testes vitest passando (1/1)
- [x] Criar checkpoint e publicar

## Bugs

- [x] CORRIGIDO: novo build com oauth.ts atualizado (campo detail no erro), env.ts simplificado sem Zod. Novo checkpoint criado para Publish.

- [x] Verificado: erro "OAuth callback failed" era esperado (código OAuth inválido no teste). Fluxo OAuth real funciona corretamente — página de login Manus exibida com sucesso
- [x] CORRIGIDO: env.ts com Zod estava no bundle de produção antigo (build de 07:10). Novo build gerado com env.ts simplificado (sem Zod). Checkpoint atualizado. (código OAuth inválido no teste). Fluxo OAuth real funciona corretamente — página de login Manus exibida com sucesso
- [x] CORRIGIDO: coluna tenantId ausente na tabela users do TiDB Cloud — adicionada via ALTER TABLE. Schema Drizzle e banco agora sincronizados. OAuth login deve funcionar.
- [x] Comparar schema Drizzle com todas as tabelas do TiDB Cloud e identificar colunas faltantes
- [x] Adicionada coluna status ao schema Drizzle de labelAssociations (estava no banco mas faltava no schema TypeScript)
- [x] CORRIGIDO: normalizar expiryDate para YYYY-MM-DD em todos os inserts de labelAssociations, productLabels, receivingOrderItems e blindConferenceItems (blindConferenceRouter, collectorPickingRouter, labelRouter, waveRouter, routers.ts)
- [x] CORRIGIDO: colunas associatedAt e status em labelAssociations agora passadas explicitamente (new Date() e 'RECEIVING'/'AVAILABLE') em todos os 5 inserts para evitar que Drizzle gere DEFAULT literal rejeitado pelo TiDB
- [x] CORRIGIDO: servidor reiniciado para carregar código novo com associatedAt/status explícitos. ENUM no banco aceita RECEIVING corretamente. Problema era cache do servidor de dev.
- [x] CORRIGIDO: status 'RECEIVING' trocado por 'AVAILABLE' em todos os inserts de labelAssociations (etiqueta não tem status de recebimento)
- [x] CORRIGIDO: dados de teste com tenantId=2 removidos da tabela labelAssociations (bloqueavam inserts por constraint UNIQUE global em labelCode)
- [x] CORRIGIDO: readLabel, associateLabel e registerNCG agora usam orderTenantId (tenant da ordem) em vez de activeTenantId (tenant do usuário) para buscar etiquetas em labelAssociations
- [x] CORRIGIDO: correção sistêmica — todas as procedures (undoLastReading, adjustQuantity, getSummary, prepareFinish, finish, closeReceivingOrder) agora usam orderTenantId (tenant da ordem) em vez de activeTenantId (tenant do usuário) para filtrar blindConferenceItems
- [x] BUG: finish falha com "Nenhum item encontrado para criar inventory" — receivingOrderItems filtrado por activeTenantId em vez de orderTenantId

## Manutenção

- [ ] Procedure tRPC cleanupOrphanInventory no backend com critérios de órfão
- [ ] UI de manutenção na tela de Inventário com botão de limpeza manual e relatório de resultado
- [x] Importação massiva de saldos via Excel (inventoryImportRouter): labelCode não-único, status por zona, uniqueCode=SKU-Lote, transação atômica, acesso restrito tenantId=1
- [x] CORRIGIDO: collectorPickingRouter.listOrders — Admin Global agora vê ondas de todos os tenants sem filtro de tenant; removido status inexistente 'in_progress' do filtro (apenas 'pending' e 'picking' são válidos)

## Reimpressão de Etiquetas

- [x] Backend: procedures tRPC para listar/reimprimir etiquetas de Recebimento
- [x] Backend: procedures tRPC para listar/reimprimir etiquetas de Pedidos de Separação
- [x] Backend: procedures tRPC para listar/reimprimir etiquetas de Volumes
- [x] Backend: procedures tRPC para listar/reimprimir etiquetas de Produtos
- [x] Backend: procedures tRPC para listar/reimprimir etiquetas de Endereços
- [x] Frontend: página /collector/label-reprint com menu de 5 tipos (design coletor)
- [x] Frontend: sub-páginas de cada tipo com busca e reimpressão
- [x] Frontend: card "Reimpressão de Etiquetas" na Home (/home)
- [x] Frontend: card "Reimpressão de Etiquetas" na tela /collector (coletor)
- [x] Registrar rotas no App.tsx

## Bugs

- [x] BUG CORRIGIDO: Global Admin não conseguia visualizar etiquetas — isGlobalAdmin no tenantGuard agora usa apenas role='admin' (sem restrição de tenantId)

## Reimpressão de Etiquetas de Endereços — Seleção em Lote

- [x] Backend: procedure reprintLocationsBatch (gera PDF com N etiquetas de uma vez)
- [x] Frontend: checkboxes individuais em cada linha de endereço
- [x] Frontend: botão "Selecionar Todas" (baseado no filtro atual)
- [x] Frontend: barra de ação flutuante com contador de selecionados e botão "Imprimir Selecionadas"
- [x] Frontend: preview modal antes da impressão em lote

## Etiquetas de Separação — Abas Pedidos e Ondas

- [x] Backend: procedure listPickingOrders para listar pedidos de picking com busca
- [x] Backend: procedure reprintPickingOrder para reimprimir etiqueta de pedido individual
- [x] Frontend: abas "Pedidos" e "Ondas" na WavesSubScreen
- [x] Frontend: aba Ondas lista pickingWaves (comportamento atual)
- [x] Frontend: aba Pedidos lista pickingOrders com busca por número/cliente

## Bugs

- [x] BUG CORRIGIDO: Cards de Pedidos de Separação agora exibem Nº do Pedido Cliente como título (cód. interno como subtexto)
- [x] BUG CORRIGIDO: Etiquetas de Separação (aba Pedidos) agora exibe Nº do Pedido Cliente como título

## Filtros em /products

- [x] Backend: atualizar procedure products.list para aceitar filtros tenantId, sku e category
- [x] Frontend: adicionar dropdowns/inputs de Cliente, SKU e Categoria na página Products
- [x] Frontend: aplicar filtros em tempo real (debounce) sem recarregar a página

## Importação de Produtos via Excel

- [x] Backend: instalar xlsx, criar procedure products.importFromExcel com validação e upsert
- [x] Backend: download de planilha modelo gerado no frontend (sem chamada ao servidor)
- [x] Frontend: componente ImportProductsDialog com upload drag-and-drop, preview de linhas e feedback de erros por linha
- [x] Frontend: botão "Importar Excel" na página /products
- [x] Frontend: exibir resumo pós-importação (X inseridos, Y atualizados, Z erros)
- [x] Adaptar template de importação de produtos para cabeçalhos em português
