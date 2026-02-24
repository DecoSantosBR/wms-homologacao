# 🚀 Guia de Instalação - WMS Med@x

Este guia fornece instruções detalhadas para instalar e configurar o WMS Med@x em seu ambiente local ou servidor.

## 📋 Requisitos do Sistema

### Software Necessário

- **Node.js** 22.x ou superior
- **pnpm** 9.x ou superior
- **MySQL** 8.0+ ou **TiDB** (recomendado para produção)
- **Git** para clonar o repositório

### Contas Necessárias

- **Conta Manus** - Para autenticação OAuth e storage S3
  - Crie uma conta em [https://manus.im](https://manus.im)
  - Crie um novo projeto no dashboard
  - Anote as credenciais fornecidas

## 📥 Passo 1: Clonar o Repositório

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/wms-medax.git

# Entre no diretório
cd wms-medax
```

## 📦 Passo 2: Instalar Dependências

```bash
# Instale as dependências com pnpm
pnpm install
```

Se você não tem o pnpm instalado:

```bash
# Instalar pnpm globalmente
npm install -g pnpm
```

## ⚙️ Passo 3: Configurar Variáveis de Ambiente

### 3.1. Criar arquivo .env

```bash
cp .env.example .env
```

### 3.2. Configurar Banco de Dados

Edite o arquivo `.env` e configure a conexão do banco:

```env
DATABASE_URL="mysql://usuario:senha@localhost:3306/wms_medax"
```

**Opções de banco:**

**MySQL Local:**
```env
DATABASE_URL="mysql://root:sua_senha@localhost:3306/wms_medax"
```

**TiDB Cloud (Recomendado para produção):**
```env
DATABASE_URL="mysql://usuario:senha@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/wms_medax?ssl={\"rejectUnauthorized\":true}"
```

### 3.3. Configurar Autenticação Manus OAuth

```env
# Credenciais do projeto Manus
VITE_APP_ID="seu_app_id"
JWT_SECRET="seu_jwt_secret"
OAUTH_SERVER_URL="https://api.manus.im"
VITE_OAUTH_PORTAL_URL="https://portal.manus.im"

# Informações do proprietário
OWNER_OPEN_ID="seu_open_id"
OWNER_NAME="Seu Nome"
```

### 3.4. Configurar Storage S3

```env
# APIs Manus (LLM, Storage, Notificações)
BUILT_IN_FORGE_API_URL="https://forge.manus.im"
BUILT_IN_FORGE_API_KEY="sua_api_key"
VITE_FRONTEND_FORGE_API_KEY="sua_frontend_key"
VITE_FRONTEND_FORGE_API_URL="https://forge.manus.im"
```

### 3.5. Configurar Analytics (Opcional)

```env
VITE_ANALYTICS_ENDPOINT="https://analytics.manus.im"
VITE_ANALYTICS_WEBSITE_ID="seu_website_id"
```

## 🗄️ Passo 4: Configurar Banco de Dados

### 4.1. Criar o banco de dados

**MySQL:**
```bash
mysql -u root -p
```

```sql
CREATE DATABASE wms_medax CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;
```

**TiDB Cloud:**
- Crie um cluster no dashboard do TiDB Cloud
- Anote a string de conexão fornecida

### 4.2. Executar migrações

```bash
# Gerar e aplicar migrações
pnpm db:push
```

Este comando irá:
1. Ler o schema em `drizzle/schema.ts`
2. Comparar com o banco de dados atual
3. Aplicar as alterações necessárias

### 4.3. (Opcional) Popular dados iniciais

```bash
# Se você tiver um script de seed
pnpm db:seed
```

## 🚀 Passo 5: Iniciar o Servidor

### Modo Desenvolvimento

```bash
# Inicia servidor com hot-reload
pnpm dev
```

O sistema estará disponível em:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3000/api

### Modo Produção

```bash
# Build do projeto
pnpm build

# Iniciar servidor de produção
pnpm start
```

## ✅ Passo 6: Verificar Instalação

### 6.1. Acessar o sistema

Abra o navegador e acesse: http://localhost:3000

### 6.2. Fazer login

1. Clique em "Entrar"
2. Faça login com sua conta Manus
3. Você será redirecionado para o dashboard

### 6.3. Verificar funcionalidades

- ✅ Dashboard carrega corretamente
- ✅ Módulos aparecem no menu (Recebimento, Separação, etc.)
- ✅ Posições de estoque carregam
- ✅ Coletor de dados está acessível

## 🔧 Solução de Problemas

### Erro: "Cannot connect to database"

**Causa:** String de conexão incorreta ou banco não acessível

**Solução:**
1. Verifique se o MySQL/TiDB está rodando
2. Confirme usuário e senha no `.env`
3. Teste a conexão:
   ```bash
   mysql -h localhost -u usuario -p wms_medax
   ```

### Erro: "OAuth callback failed"

**Causa:** Credenciais OAuth incorretas

**Solução:**
1. Verifique `VITE_APP_ID` e `JWT_SECRET` no `.env`
2. Confirme que o projeto Manus está ativo
3. Verifique se a URL de callback está configurada no dashboard Manus

### Erro: "Module not found"

**Causa:** Dependências não instaladas corretamente

**Solução:**
```bash
# Limpar cache e reinstalar
rm -rf node_modules
rm pnpm-lock.yaml
pnpm install
```

### Erro: "Port 3000 already in use"

**Causa:** Outra aplicação está usando a porta 3000

**Solução:**
```bash
# Encontrar processo usando a porta
lsof -i :3000

# Matar o processo (substitua PID pelo número retornado)
kill -9 PID

# Ou use outra porta
PORT=3001 pnpm dev
```

## 📱 Configuração do Coletor de Dados

### Requisitos
- Dispositivo Android ou iOS com câmera
- Navegador moderno (Chrome, Safari)
- Conexão com o servidor (WiFi ou rede local)

### Acesso
1. No dispositivo móvel, acesse: `http://seu-servidor:3000/collector`
2. Faça login com suas credenciais
3. Permita acesso à câmera quando solicitado
4. Selecione a operação desejada (Recebimento, Picking, etc.)

### Dicas
- Use o coletor em modo retrato (vertical)
- Ative o flash em ambientes escuros
- Mantenha o código de barras a 10-20cm da câmera

## 🔐 Configuração de Segurança

### Produção

1. **Use HTTPS:**
   ```env
   NODE_ENV=production
   ```

2. **Configure CORS:**
   Edite `server/_core/server.ts` para permitir apenas domínios autorizados

3. **Proteja variáveis sensíveis:**
   - Nunca commite o arquivo `.env`
   - Use secrets managers em produção (AWS Secrets, Azure Key Vault)

4. **Configure firewall:**
   - Permita apenas portas necessárias (80, 443)
   - Bloqueie acesso direto ao banco de dados

## 📊 Monitoramento

### Logs

Logs são salvos em:
- Desenvolvimento: Console
- Produção: `.manus-logs/devserver.log`

### Health Check

Endpoint de saúde disponível em:
```
GET /api/health
```

## 🆘 Suporte

Se você encontrar problemas não listados aqui:

1. Verifique as [Issues no GitHub](https://github.com/seu-usuario/wms-medax/issues)
2. Abra uma nova issue com:
   - Descrição do problema
   - Logs de erro
   - Passos para reproduzir
   - Versão do Node.js e sistema operacional

---

**Próximo passo:** Consulte o [DEPLOY.md](./DEPLOY.md) para instruções de deploy em produção.
