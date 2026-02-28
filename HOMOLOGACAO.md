# WMS Med@x — Ambiente de Homologação

## Visão Geral

Este documento descreve a configuração e uso do ambiente de homologação do sistema **WMS Med@x**, configurado a partir do repositório [`DecoSantosBR/wms-homologacao`](https://github.com/DecoSantosBR/wms-homologacao).

---

## Stack Tecnológica

| Componente | Tecnologia |
|---|---|
| Frontend | React 19 + TypeScript + TailwindCSS |
| Backend | Node.js + Express + tRPC |
| ORM | Drizzle ORM |
| Banco de Dados | MySQL 8.0 |
| Build | Vite 7 |
| Runtime | tsx (TypeScript execution) |

---

## Configuração do Ambiente

### Variáveis de Ambiente (`.env`)

```env
# Banco de Dados MySQL (Homologação)
DATABASE_URL=mysql://wms_user:wms_homolog_2024@localhost:3306/wms_medax_homolog

# Segredo JWT para sessões
JWT_SECRET=wms-medax-homolog-secret-key-2024-super-seguro

# Configurações do Manus OAuth (modo homologação)
VITE_APP_ID=wms-medax-homolog
OAUTH_SERVER_URL=http://localhost:3000
BUILT_IN_FORGE_API_URL=http://localhost:3000
BUILT_IN_FORGE_API_KEY=homolog-forge-key-placeholder

# Modo E2E/Homologação (bypassa OAuth externo)
E2E_TESTING=true
NODE_ENV=development
PORT=3000
```

> **Importante:** O modo `E2E_TESTING=true` bypassa a autenticação OAuth externa do Manus e injeta automaticamente um usuário administrador (`E2E Test User`, role: `admin`) em todas as requisições. Isso permite testar todos os fluxos sem necessidade de login.

---

## Banco de Dados

### Credenciais

| Parâmetro | Valor |
|---|---|
| Host | `localhost:3306` |
| Banco | `wms_medax_homolog` |
| Usuário | `wms_user` |
| Senha | `wms_homolog_2024` |

### Tabelas Criadas (56 tabelas)

O banco de dados contém todas as tabelas necessárias para os fluxos do WMS:

- `tenants` — Clientes/inquilinos
- `users` / `systemUsers` — Usuários do sistema
- `roles` / `permissions` / `rolePermissions` — RBAC
- `warehouses` / `warehouseZones` / `warehouseLocations` — Estrutura do armazém
- `products` / `productBarcodes` / `productLabels` — Produtos
- `receivingOrders` / `receivingOrderItems` — Ordens de recebimento
- `blindConferenceSessions` / `blindConferenceItems` — Conferência cega
- `labelAssociations` / `labelReadings` — Rastreabilidade de etiquetas
- `inventory` / `inventoryMovements` — Estoque e movimentações
- `pickingOrders` / `pickingWaves` / `pickingAllocations` — Picking
- `shipments` / `stageChecks` — Expedição e conferência de saída
- `nonConformities` — Não conformidades (NCG)
- E muitas outras...

---

## Inicialização

### Pré-requisitos

```bash
# Instalar dependências
cd /home/ubuntu/wms-homologacao
pnpm install

# Garantir MySQL rodando
sudo service mysql start
```

### Aplicar Migrations

```bash
python3 apply-migrations.py
```

### Iniciar Servidor

```bash
# Usando o script de inicialização
./start-homolog.sh

# Ou manualmente
DATABASE_URL="mysql://wms_user:wms_homolog_2024@localhost:3306/wms_medax_homolog" \
JWT_SECRET="wms-medax-homolog-secret-key-2024-super-seguro" \
VITE_APP_ID="wms-medax-homolog" \
OAUTH_SERVER_URL="http://localhost:3000" \
BUILT_IN_FORGE_API_URL="http://localhost:3000" \
BUILT_IN_FORGE_API_KEY="homolog-forge-key" \
E2E_TESTING="true" \
NODE_ENV="development" \
pnpm run dev
```

O servidor estará disponível em `http://localhost:3000`.

---

## Acesso ao Sistema

### Modo de Autenticação

No ambiente de homologação, a autenticação é **automática**. O sistema injeta um usuário administrador em todas as requisições:

```json
{
  "id": 1,
  "openId": "e2e-test-user",
  "name": "E2E Test User",
  "role": "admin"
}
```

### Endpoints Principais

| Endpoint | Descrição |
|---|---|
| `GET /` | Interface web principal |
| `GET /api/trpc/auth.me` | Usuário autenticado |
| `GET /api/trpc/dashboard.stats` | Estatísticas do dashboard |
| `POST /api/trpc/[router].[procedure]` | Endpoints tRPC |

---

## Fluxos de Teste

Consulte a skill `wms-test-flow` para roteiros completos de teste, incluindo:

1. **Cadastros Básicos** — Tenants, Zonas, Endereços, Produtos
2. **Recebimento** — Ordens de recebimento e conferência cega
3. **Movimentação** — Transferências de estoque entre endereços
4. **Picking** — Criação de ondas e separação de pedidos
5. **NCG** — Registro de não conformidades

### Validações SQL Importantes

Após cada operação, verificar:

```sql
-- Rastreabilidade de etiquetas
SELECT labelCode, uniqueCode, status FROM labelAssociations WHERE labelCode = '[CODIGO]';

-- Estoque com labelCode preenchido
SELECT productId, locationId, quantity, labelCode, uniqueCode FROM inventory WHERE tenantId = [ID];

-- Movimentações com labelCode
SELECT productId, fromLocationId, toLocationId, quantity, labelCode FROM inventoryMovements ORDER BY id DESC LIMIT 5;
```

---

## Estrutura do Projeto

```
wms-homologacao/
├── client/src/          # Frontend React
│   ├── components/      # Componentes reutilizáveis
│   ├── pages/           # Páginas da aplicação
│   └── hooks/           # Custom hooks
├── server/              # Backend Node.js
│   ├── _core/           # Infraestrutura (auth, env, trpc)
│   ├── routers.ts       # Router principal
│   ├── db.ts            # Conexão com banco
│   └── *.ts             # Routers específicos
├── drizzle/             # Schema e migrations
│   ├── schema.ts        # Definição das tabelas
│   └── *.sql            # Arquivos de migration
├── .env                 # Variáveis de ambiente (homologação)
├── apply-migrations.py  # Script de migrations
├── start-homolog.sh     # Script de inicialização
└── HOMOLOGACAO.md       # Este documento
```

---

## Solução de Problemas

### Servidor não inicia

```bash
# Verificar se MySQL está rodando
sudo service mysql status

# Verificar conexão com banco
mysql -u wms_user -pwms_homolog_2024 wms_medax_homolog -e "SELECT 1;"

# Verificar logs do servidor
cat /tmp/wms-server.log
```

### Banco de dados sem tabelas

```bash
# Reaplicar migrations
python3 apply-migrations.py
```

### Porta em uso

O servidor detecta automaticamente a próxima porta disponível a partir da porta 3000. Verificar qual porta está sendo usada:

```bash
ss -tlnp | grep -E "300[0-9]"
```

---

## Notas de Segurança

> **Atenção:** Este ambiente de homologação utiliza credenciais simplificadas e modo de bypass de autenticação (`E2E_TESTING=true`). **Nunca utilize estas configurações em produção.**

- O modo `E2E_TESTING` desabilita completamente a verificação de sessão OAuth
- As credenciais do banco de dados são fixas e não devem ser usadas em produção
- O JWT_SECRET deve ser gerado aleatoriamente para ambientes de produção
