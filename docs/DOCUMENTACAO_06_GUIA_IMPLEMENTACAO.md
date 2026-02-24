# WMS Med@x - Guia de Implementação e Replicação

**Data:** Janeiro 2026  
**Versão:** 1.0  
**Autor:** Manus AI  
**Sistema:** WMS Farmacêutico - Sistema de Gerenciamento de Armazém

---

## Como Replicar o Sistema do Zero

Este guia fornece instruções passo a passo para criar uma cópia perfeita do WMS Med@x.

---

## Pré-requisitos

- Node.js 22.13.0 ou superior
- pnpm (gerenciador de pacotes)
- MySQL 8.0 ou TiDB
- Git
- Conta Manus (para OAuth)

---

## Passo 1: Criar Novo Projeto Manus

1. Acesse a plataforma Manus
2. Clique em "Novo Projeto"
3. Selecione template: "Web App Template (tRPC + Manus Auth + Database)"
4. Nome: `wms-pharma`
5. Clique em "Criar"

---

## Passo 2: Configurar Ambiente

### Variáveis de Ambiente

Adicione as seguintes variáveis em **Settings > Secrets:**

```
DATABASE_URL=mysql://user:password@host:3306/wms_pharma
JWT_SECRET=seu_secret_jwt_aqui
VITE_APP_ID=seu_app_id_oauth
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://portal.manus.im
```

---

## Passo 3: Criar Schema do Banco de Dados

Copie o conteúdo de `drizzle/schema.ts` do projeto original para seu novo projeto.

**Principais tabelas:**
- tenants
- products
- systemUsers
- zones
- warehouseLocations
- receivingOrders
- receivingOrderItems
- pickingOrders
- pickingOrderItems
- inventoryMovements
- inventoryPositions
- auditLog
- cleanupHistory

### Executar Migrações

```bash
pnpm db:push
```

---

## Passo 4: Copiar Páginas e Componentes

### Páginas (client/src/pages/)

1. **Home.tsx** - Página inicial com grid de módulos
2. **AdminDashboard.tsx** - Painel administrativo
3. **AdminCleanupNew.tsx** - Interface de limpeza de dados
4. **Receiving.tsx** - Módulo de recebimento
5. **Picking.tsx** - Módulo de separação
6. **Tenants.tsx** - Gerenciamento de clientes
7. **Products.tsx** - Gerenciamento de produtos
8. **Users.tsx** - Gerenciamento de usuários
9. **Locations.tsx** - Gerenciamento de localizações
10. **Zones.tsx** - Gerenciamento de zonas
11. **Stock.tsx** - Controle de estoque
12. **Reports.tsx** - Relatórios e dashboards
13. **NFEImport.tsx** - Importação de NF-e
14. **Shipping.tsx** - Módulo de expedição

### Componentes (client/src/components/)

1. **BlindCheckModal.tsx** - Modal para conferência cega
2. **PickingWizard.tsx** - Wizard para picking
3. **Map.tsx** - Integração com Google Maps
4. **AIChatBox.tsx** - Chat com IA
5. **DashboardLayout.tsx** - Layout do dashboard
6. **DashboardLayoutSkeleton.tsx** - Skeleton loading

---

## Passo 5: Configurar Routers tRPC

Copie o conteúdo de `server/routers.ts` e implemente todos os procedures:

**Módulos:**
- auth (autenticação)
- tenants (clientes)
- products (produtos)
- receiving (recebimento)
- picking (separação)
- locations (localizações)
- zones (zonas)
- admin (admin)
- system (sistema)

---

## Passo 6: Configurar Roteamento

Atualize `client/src/App.tsx` com todas as rotas:

```typescript
<Route path="/" component={Home} />
<Route path="/admin" component={AdminDashboard} />
<Route path="/admin/cleanup" component={AdminCleanupNew} />
<Route path="/receiving" component={Receiving} />
<Route path="/picking" component={Picking} />
<Route path="/dashboard" component={Tenants} />
<Route path="/stock" component={Stock} />
<Route path="/reports" component={Reports} />
<Route path="/nfe-import" component={NFEImport} />
<Route path="/shipping" component={Shipping} />
```

---

## Passo 7: Estilo e Temas

### Tailwind CSS

Atualize `client/src/index.css` com:
- Cores da marca
- Tipografia
- Espaçamento
- Sombras

### Fontes

Adicione em `client/index.html`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

---

## Passo 8: Testes

Crie testes com Vitest em `server/*.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";

describe("Auth", () => {
  it("should logout user", async () => {
    // Teste de logout
  });
});
```

Executar testes:

```bash
pnpm test
```

---

## Passo 9: Validações e Conformidade

### ANVISA RDC 430/2020

Implemente:
- Rastreabilidade completa
- Auditoria de operações
- Controle de acesso
- Validação de dados
- Backup automático

### Segurança

- Validação de entrada
- Proteção contra SQL injection
- CORS configurado
- Rate limiting
- Logs de auditoria

---

## Passo 10: Deploy

### Criar Checkpoint

```bash
# Via interface Manus
1. Clique em "Save Checkpoint"
2. Adicione descrição
3. Clique em "Save"
```

### Publicar

```bash
# Via interface Manus
1. Clique em "Publish"
2. Escolha domínio
3. Clique em "Deploy"
```

---

## Checklist de Implementação

- [ ] Projeto criado no Manus
- [ ] Variáveis de ambiente configuradas
- [ ] Schema do banco de dados criado
- [ ] Migrações executadas (`pnpm db:push`)
- [ ] Todas as páginas copiadas
- [ ] Todos os componentes copiados
- [ ] Routers tRPC implementados
- [ ] Roteamento configurado em App.tsx
- [ ] Estilos Tailwind configurados
- [ ] Testes criados e passando
- [ ] Sem erros de compilação
- [ ] Checkpoint criado
- [ ] Publicado com sucesso

---

## Troubleshooting

### Erro: "Database connection failed"

Verifique:
- `DATABASE_URL` está correto
- Banco de dados está rodando
- Credenciais estão corretas

### Erro: "OAuth not configured"

Verifique:
- `VITE_APP_ID` está correto
- `OAUTH_SERVER_URL` está correto
- Aplicação está registrada no Manus

### Erro: "Module not found"

Verifique:
- Todos os arquivos foram copiados
- Caminhos de import estão corretos
- `pnpm install` foi executado

### Erro: "TypeScript compilation failed"

Verifique:
- Tipos estão corretos
- Imports estão corretos
- Não há erros de sintaxe

---

## Próximos Passos

1. **Customizar Layout:** Ajuste cores, fontes e espaçamento
2. **Adicionar Funcionalidades:** Implemente novos módulos conforme necessário
3. **Integrar APIs:** Conecte com sistemas externos
4. **Treinar Usuários:** Prepare documentação de uso
5. **Monitorar Performance:** Configure alertas e métricas

---

**Fim do Guia de Implementação**
