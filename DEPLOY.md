# 🚀 Guia de Deploy - WMS Med@x

Este guia fornece instruções para fazer deploy do WMS Med@x em produção usando a plataforma Manus.

## 📋 Pré-requisitos

- Projeto configurado e funcionando localmente (veja [INSTALL.md](./INSTALL.md))
- Conta Manus ativa
- Banco de dados MySQL/TiDB configurado
- Variáveis de ambiente configuradas

## 🌐 Deploy na Plataforma Manus

A plataforma Manus oferece hosting integrado com suporte a domínios customizados.

### Passo 1: Salvar Checkpoint

Antes de publicar, crie um checkpoint do projeto:

```bash
# No ambiente de desenvolvimento Manus
# Use o botão "Save Checkpoint" na interface
```

Ou via CLI (se disponível):
```bash
manus checkpoint save "Versão pronta para produção"
```

### Passo 2: Publicar

1. **Acesse o Management UI** no painel direito
2. **Clique em "Publish"** no header
3. **Aguarde o deploy** (geralmente 2-5 minutos)
4. **Acesse a URL gerada** (formato: `xxx.manus.space`)

### Passo 3: Configurar Domínio Customizado

1. **Acesse Settings → Domains** no Management UI
2. **Opção A: Comprar domínio na Manus**
   - Clique em "Purchase Domain"
   - Escolha o domínio desejado
   - Complete o pagamento
   - Domínio será automaticamente configurado

3. **Opção B: Usar domínio existente**
   - Clique em "Add Custom Domain"
   - Digite seu domínio (ex: `wms.suaempresa.com`)
   - Configure os registros DNS:
     ```
     Type: CNAME
     Name: wms (ou @)
     Value: xxx.manus.space
     TTL: 3600
     ```
   - Aguarde propagação DNS (até 48h)

### Passo 4: Configurar SSL

SSL é configurado automaticamente pela Manus:
- Certificado Let's Encrypt gratuito
- Renovação automática
- HTTPS forçado

## 🗄️ Banco de Dados em Produção

### Opção 1: TiDB Cloud (Recomendado)

1. **Crie um cluster** em [tidbcloud.com](https://tidbcloud.com)
2. **Configure a conexão:**
   ```env
   DATABASE_URL="mysql://user:pass@gateway.tidbcloud.com:4000/wms_medax?ssl={\"rejectUnauthorized\":true}"
   ```
3. **Execute as migrações:**
   ```bash
   pnpm db:push
   ```

**Vantagens:**
- Escalabilidade automática
- Backup automático
- Alta disponibilidade
- Compatível com MySQL

### Opção 2: MySQL Gerenciado

Provedores recomendados:
- **AWS RDS MySQL**
- **Google Cloud SQL**
- **Azure Database for MySQL**
- **DigitalOcean Managed MySQL**

Configuração similar ao TiDB Cloud.

## 🔐 Variáveis de Ambiente em Produção

### Configurar via Manus UI

1. **Acesse Settings → Secrets** no Management UI
2. **Adicione cada variável:**
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `BUILT_IN_FORGE_API_KEY`
   - Etc.

### Ou use o arquivo .env

O Manus automaticamente injeta variáveis do `.env` em produção. Certifique-se de que todas as variáveis necessárias estão configuradas.

## 📊 Monitoramento

### Analytics Integrado

O Manus fornece analytics automático:
- UV/PV (visitantes únicos / page views)
- Acesse via **Dashboard** no Management UI

### Logs

Acesse logs em tempo real:
- **Management UI → Dashboard → Logs**
- Ou via CLI: `manus logs tail`

### Health Checks

Endpoint de saúde disponível em:
```
GET https://seu-dominio.com/api/health
```

Retorna:
```json
{
  "status": "ok",
  "database": "connected",
  "uptime": 3600
}
```

## 🔄 Atualizações

### Deploy de Nova Versão

1. **Faça alterações** no código
2. **Teste localmente**
3. **Salve um novo checkpoint**
4. **Clique em "Publish"** novamente

### Rollback

Se algo der errado:

1. **Acesse Management UI → Settings → Checkpoints**
2. **Selecione um checkpoint anterior**
3. **Clique em "Rollback"**
4. **Publique novamente**

## 🛡️ Segurança em Produção

### Checklist de Segurança

- ✅ HTTPS habilitado (automático no Manus)
- ✅ Variáveis sensíveis em secrets (não no código)
- ✅ Banco de dados com SSL
- ✅ CORS configurado corretamente
- ✅ Rate limiting habilitado
- ✅ Validação de entrada em todas as APIs
- ✅ Logs de auditoria habilitados

### Configurar CORS

Edite `server/_core/server.ts`:

```typescript
app.use(cors({
  origin: [
    'https://seu-dominio.com',
    'https://www.seu-dominio.com'
  ],
  credentials: true
}));
```

### Rate Limiting

Adicione rate limiting para proteger APIs:

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100 // 100 requisições por IP
});

app.use('/api/', limiter);
```

## 📱 Configuração do Coletor em Produção

### Acesso Remoto

Para usar o coletor fora da rede local:

1. **Certifique-se de que HTTPS está habilitado**
2. **Acesse via domínio público:**
   ```
   https://seu-dominio.com/collector
   ```
3. **Configure WiFi do coletor** para acessar o servidor

### Otimizações para Mobile

- **Service Worker** para cache offline (opcional)
- **PWA** para instalação no dispositivo (opcional)
- **Compressão** de assets (automático no Manus)

## 🔧 Troubleshooting em Produção

### Erro: "Database connection failed"

**Causa:** Banco de dados inacessível

**Solução:**
1. Verifique se o banco está rodando
2. Confirme string de conexão
3. Verifique firewall/security groups
4. Teste conexão:
   ```bash
   mysql -h host -u user -p database
   ```

### Erro: "OAuth callback failed"

**Causa:** URL de callback incorreta

**Solução:**
1. Acesse dashboard do projeto Manus
2. Configure callback URL:
   ```
   https://seu-dominio.com/api/oauth/callback
   ```

### Performance Lenta

**Diagnóstico:**
1. Verifique logs de queries lentas
2. Analise uso de CPU/memória no dashboard
3. Verifique latência do banco de dados

**Otimizações:**
- Adicione índices no banco
- Implemente cache (Redis)
- Otimize queries N+1
- Use CDN para assets estáticos

## 📈 Escalabilidade

### Horizontal Scaling

O Manus suporta escalonamento automático:
- Múltiplas instâncias do servidor
- Load balancing automático
- Auto-scaling baseado em carga

### Database Scaling

**TiDB Cloud:**
- Escala automaticamente
- Suporta milhões de registros
- Replicação multi-região

**MySQL:**
- Read replicas para leitura
- Sharding para write scaling
- Connection pooling

## 💾 Backup e Recuperação

### Backup Automático

**TiDB Cloud:**
- Backup diário automático
- Retenção de 7 dias (padrão)
- Point-in-time recovery

**MySQL Gerenciado:**
- Configure backup automático no provedor
- Teste restauração regularmente

### Backup Manual

```bash
# Exportar banco de dados
mysqldump -h host -u user -p database > backup.sql

# Importar backup
mysql -h host -u user -p database < backup.sql
```

## 📞 Suporte

Para problemas em produção:

1. **Verifique logs** no Management UI
2. **Consulte documentação** do Manus
3. **Abra ticket** em [help.manus.im](https://help.manus.im)
4. **Issues críticas:** Entre em contato via email

---

**Próximos passos:**
- Configure monitoramento de uptime
- Implemente backup automático
- Configure alertas de erro
- Documente procedimentos de emergência
