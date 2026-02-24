# WMS Med@x - Documentação Infraestrutura e Schema

**Data:** Janeiro 2026  
**Versão:** 1.0  
**Autor:** Manus AI  
**Sistema:** WMS Farmacêutico - Sistema de Gerenciamento de Armazém

---

## Visão Geral

Este documento descreve a infraestrutura técnica, schema de banco de dados, configuração de routers tRPC e autenticação do WMS Med@x.

---

## Arquitetura

### Stack Tecnológico

**Frontend:**
- React 19
- TypeScript
- Tailwind CSS 4
- shadcn/ui
- Wouter (roteamento)
- tRPC (comunicação com backend)

**Backend:**
- Express 4
- tRPC 11
- Node.js
- MySQL/TiDB (banco de dados)
- Drizzle ORM

**Autenticação:**
- Manus OAuth
- JWT (sessão)
- Cookies

---

## Schema de Banco de Dados

### Tabelas Principais

**1. tenants** - Clientes do sistema
**2. products** - Catálogo de produtos
**3. systemUsers** - Usuários do sistema
**4. zones** - Zonas de armazenagem
**5. warehouseLocations** - Posições no armazém
**6. receivingOrders** - Ordens de recebimento
**7. receivingOrderItems** - Itens de recebimento
**8. pickingOrders** - Ordens de separação
**9. pickingOrderItems** - Itens de separação
**10. inventoryMovements** - Movimentações de estoque
**11. inventoryPositions** - Posições de estoque
**12. auditLog** - Auditoria de operações
**13. cleanupHistory** - Histórico de limpezas

---

## Configuração de Routers tRPC

### Estrutura de Routers

```typescript
export const appRouter = router({
  // Módulo de Autenticação
  auth: {
    me: publicProcedure.query(...),
    logout: protectedProcedure.mutation(...),
  },
  
  // Módulo de Tenants
  tenants: {
    list: publicProcedure.query(...),
    create: protectedProcedure.mutation(...),
    update: protectedProcedure.mutation(...),
    delete: protectedProcedure.mutation(...),
  },
  
  // Módulo de Produtos
  products: {
    list: publicProcedure.query(...),
    create: protectedProcedure.mutation(...),
    update: protectedProcedure.mutation(...),
    delete: protectedProcedure.mutation(...),
  },
  
  // Módulo de Recebimento
  receiving: {
    list: publicProcedure.query(...),
    getItems: publicProcedure.query(...),
    importNFe: protectedProcedure.mutation(...),
    addressItem: protectedProcedure.mutation(...),
    delete: protectedProcedure.mutation(...),
    deleteBatch: protectedProcedure.mutation(...),
    create: protectedProcedure.mutation(...),
    checkItem: protectedProcedure.mutation(...),
    getPendingAddressingBalance: publicProcedure.query(...),
  },
  
  // Módulo de Separação
  picking: {
    list: publicProcedure.query(...),
    getItems: publicProcedure.query(...),
    getItemByBarcode: publicProcedure.query(...),
    startPicking: protectedProcedure.mutation(...),
    confirmItem: protectedProcedure.mutation(...),
    completePicking: protectedProcedure.mutation(...),
    createReturn: protectedProcedure.mutation(...),
    delete: protectedProcedure.mutation(...),
  },
  
  // Módulo de Admin
  admin: {
    cleanup: {
      preview: protectedProcedure.query(...),
      execute: protectedProcedure.mutation(...),
      getHistory: protectedProcedure.query(...),
    },
  },
  
  // Módulo de Sistema
  system: {
    notifyOwner: protectedProcedure.mutation(...),
  },
});
```

---

## Autenticação e Autorização

### Fluxo de Autenticação

1. Usuário clica em "Entrar"
2. Redireciona para Manus OAuth
3. Usuário autentica
4. Retorna para `/api/oauth/callback`
5. Sistema cria sessão JWT
6. Armazena em cookie
7. Redireciona para Home

### Verificação de Permissões

**publicProcedure:** Acessível sem autenticação  
**protectedProcedure:** Requer autenticação (user.id)  
**adminProcedure:** Requer role === "admin"

```typescript
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user?.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return next({ ctx });
});
```

---

## Variáveis de Ambiente

**Obrigatórias:**
- `DATABASE_URL` - String de conexão MySQL
- `JWT_SECRET` - Chave para assinar JWT
- `VITE_APP_ID` - ID da aplicação OAuth
- `OAUTH_SERVER_URL` - URL do servidor OAuth
- `VITE_OAUTH_PORTAL_URL` - URL do portal de login

**Opcionais:**
- `NODE_ENV` - Ambiente (development/production)
- `PORT` - Porta do servidor (padrão: 3000)

---

## Estrutura de Pastas

```
wms-pharma/
├── client/
│   ├── src/
│   │   ├── pages/          # Páginas principais
│   │   ├── components/     # Componentes reutilizáveis
│   │   ├── lib/            # Utilitários
│   │   ├── App.tsx         # Router principal
│   │   └── main.tsx        # Entrada
│   ├── public/             # Arquivos estáticos
│   └── index.html          # HTML principal
├── server/
│   ├── routers.ts          # Definição de routers tRPC
│   ├── db.ts               # Helpers de banco de dados
│   ├── auth.logout.test.ts # Testes
│   └── _core/              # Infraestrutura
├── drizzle/
│   └── schema.ts           # Schema do banco de dados
├── shared/                 # Código compartilhado
└── package.json            # Dependências
```

---

## Deployment

### Preparação

1. Criar checkpoint com `webdev_save_checkpoint`
2. Configurar variáveis de ambiente
3. Executar migrações: `pnpm db:push`
4. Clicar em "Publish" na interface Manus

### Checklist

- [ ] Todas as variáveis de ambiente configuradas
- [ ] Banco de dados migrado
- [ ] Testes passando
- [ ] Sem erros de compilação
- [ ] Checkpoint criado

---

**Fim da Documentação - Infraestrutura**
