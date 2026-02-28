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
