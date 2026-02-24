# WMS Med@x - Sistema de Gerenciamento de Armazém Farmacêutico

Sistema completo de WMS (Warehouse Management System) especializado para o setor farmacêutico, com conformidade ANVISA e rastreabilidade total de lotes.

## 🚀 Funcionalidades Principais

### Módulos Operacionais
- **Recebimento**: Conferência cega, pré-alocação de endereços, validação de lotes e validades
- **Armazenagem**: Gestão de endereços multi-item e único-item, controle de temperatura
- **Picking**: Fluxo guiado com pré-alocação FEFO/FIFO, validação de lote, pausa/retomada
- **Stage (Conferência)**: Auto-preenchimento inteligente, validação de lote, detecção de divergências
- **Expedição**: Vinculação de NF-e, romaneios, cancelamento com estorno automático

### Recursos Técnicos
- **Multi-tenant**: Isolamento completo de dados por cliente
- **Rastreabilidade**: Auditoria completa de movimentações e operações
- **Portal do Cliente**: Acompanhamento em tempo real de estoques e pedidos
- **Coletor Mobile**: Interface otimizada para operação com scanner
- **Relatórios**: Posição de estoque, produtividade, divergências, auditoria

## 🛠️ Stack Tecnológica

### Backend
- **Node.js 22** + **Express 4**
- **tRPC 11** (type-safe API)
- **Drizzle ORM** (MySQL/TiDB)
- **Superjson** (serialização de Date, Map, Set)

### Frontend
- **React 19** + **TypeScript**
- **Tailwind CSS 4** + **shadcn/ui**
- **Wouter** (roteamento)
- **React Query** (via tRPC)

### Testes
- **Vitest** (unit + integration)
- Cobertura: módulos críticos (picking, stage, shipping)

## 📦 Instalação

### Pré-requisitos
- Node.js 22+
- pnpm 9+
- MySQL 8+ ou TiDB

### Configuração

1. Clone o repositório:
```bash
git clone https://github.com/seu-usuario/wms-medax.git
cd wms-medax
```

2. Instale dependências:
```bash
pnpm install
```

3. Configure variáveis de ambiente:
```bash
cp .env.example .env
```

Edite `.env` com suas credenciais:
```env
DATABASE_URL=mysql://user:password@localhost:3306/wms_medax
JWT_SECRET=your-secret-key
VITE_APP_TITLE=WMS Med@x
```

4. Execute migrações do banco:
```bash
pnpm db:push
```

5. Inicie o servidor de desenvolvimento:
```bash
pnpm dev
```

Acesse: `http://localhost:3000`

## 🗄️ Estrutura do Projeto

```
wms-medax/
├── client/                 # Frontend React
│   ├── src/
│   │   ├── pages/         # Páginas e rotas
│   │   ├── components/    # Componentes reutilizáveis
│   │   ├── contexts/      # Contextos React
│   │   ├── hooks/         # Custom hooks
│   │   └── lib/           # Utilitários e tRPC client
│   └── public/            # Assets estáticos
├── server/                # Backend Express + tRPC
│   ├── routers.ts         # Definição de procedures tRPC
│   ├── db.ts              # Query helpers
│   ├── *.ts               # Módulos de lógica de negócio
│   └── *.test.ts          # Testes Vitest
├── drizzle/               # Schema e migrações
│   ├── schema.ts          # Definição de tabelas
│   └── *.sql              # Arquivos de migração
├── shared/                # Tipos e constantes compartilhadas
└── storage/               # Helpers de S3
```

## 🧪 Testes

Execute todos os testes:
```bash
pnpm test
```

Execute testes específicos:
```bash
pnpm test -- picking
pnpm test -- stage
pnpm test -- shipping
```

### Regras de Teste
- ✅ 1 cliente-teste por suite (beforeAll/afterAll)
- ✅ Máximo 4 produtos por cliente
- ✅ Máximo 6 endereços (1 REC + 1 EXP + 4 armazenagem)
- ✅ Reutilizar zonas existentes (não criar)
- ✅ Limpeza automática após execução

## 📊 Banco de Dados

### Principais Tabelas
- `tenants`: Clientes (multi-tenant)
- `products`: Produtos com rastreabilidade de lote
- `warehouseLocations`: Endereços de armazenagem
- `inventory`: Estoque por endereço/lote/validade
- `pickingOrders`: Pedidos de separação
- `pickingAllocations`: Pré-alocações FEFO/FIFO
- `stageChecks`: Conferências de expedição
- `invoices`: Notas fiscais vinculadas

### Migrações
```bash
# Gerar migração após alterar schema
pnpm db:generate

# Aplicar migrações
pnpm db:push

# Visualizar banco (Drizzle Studio)
pnpm db:studio
```

## 🔐 Autenticação

O sistema usa **Manus OAuth** para autenticação:
- Login automático via `/api/oauth/callback`
- Session cookies com JWT
- Contexto `ctx.user` em procedures protegidas

## 📱 Coletor Mobile

Acesse `/collector` para interface mobile:
- `/collector/picking`: Separação guiada por endereço
- `/collector/stage`: Conferência com auto-preenchimento

## 🚢 Deploy

### Manus Platform (Recomendado)
```bash
# Criar checkpoint
pnpm db:push
# Clicar em "Publish" no painel Manus
```

### Deploy Manual
```bash
# Build
pnpm build

# Iniciar produção
NODE_ENV=production node server/index.js
```

## 🐛 Debugging

### Logs do Servidor
```bash
tail -f .manus-logs/server.log
```

### Logs do Banco
```bash
# Ver queries executadas
tail -f .manus/db/*.json
```

## 📝 Convenções de Código

### Backend (tRPC)
- Procedures em `server/routers.ts`
- Lógica de negócio em módulos separados (`server/*.ts`)
- Queries no banco via `server/db.ts`
- Testes em `server/*.test.ts`

### Frontend
- Páginas em `client/src/pages/`
- Componentes reutilizáveis em `client/src/components/`
- Hooks tRPC: `trpc.*.useQuery()` / `trpc.*.useMutation()`
- Estilos: Tailwind utilities + shadcn/ui components

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch: `git checkout -b feature/nova-funcionalidade`
3. Commit: `git commit -m 'Adiciona nova funcionalidade'`
4. Push: `git push origin feature/nova-funcionalidade`
5. Abra um Pull Request

### Checklist de PR
- [ ] Testes passando (`pnpm test`)
- [ ] TypeScript sem erros (`pnpm typecheck`)
- [ ] Código formatado (`pnpm format`)
- [ ] Documentação atualizada

## 📄 Licença

Este projeto é proprietário e confidencial.

## 📧 Contato

Para dúvidas ou suporte:
- Email: suporte@medax.com.br
- Website: https://medax.com.br

---

**Desenvolvido com ❤️ para o setor farmacêutico brasileiro**
