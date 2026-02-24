# Script de Deploy - Correções Críticas WMS Med@x

## Visão Geral

Este documento descreve como usar o script `deploy-bug-fixes.sh` para aplicar as 4 correções críticas identificadas no relatório de análise técnica de 22/02/2026.

## Correções Incluídas

| Bug | Severidade | Arquivo | Descrição |
|-----|------------|---------|-----------|
| BUG 1 | 🔴 CRÍTICO | `server/waveRouter.ts` | Vazamento de dados multi-tenant em listagem de ondas |
| BUG 2 | 🟠 ALTO | `server/_core/authorization.ts` | N+1 queries no sistema RBAC |
| BUG 3 | 🟡 MÉDIO | `server/stage.ts`<br>`server/stockRouter.ts` | Console.logs de debug em produção |
| BUG 4 | 🟢 BAIXO | `.gitignore` | Scripts de debug expostos no repositório |

## Pré-requisitos

### 1. Preparar Arquivos Corrigidos

Extraia o arquivo `arquivos-corrigidos.zip` para um diretório chamado `corrections/` na raiz do projeto:

```bash
cd /caminho/do/projeto/wms-medax
unzip arquivos-corrigidos.zip -d corrections/
```

A estrutura deve ficar assim:

```
wms-medax/
├── corrections/
│   ├── server/
│   │   ├── waveRouter.ts
│   │   ├── stage.ts
│   │   ├── stockRouter.ts
│   │   └── _core/
│   │       └── authorization.ts
│   └── .gitignore
├── deploy-bug-fixes.sh
└── ...
```

### 2. Verificar Permissões

Certifique-se de que o script tem permissão de execução:

```bash
chmod +x deploy-bug-fixes.sh
```

### 3. Backup Manual (Opcional mas Recomendado)

Embora o script crie backups automáticos, é recomendado fazer um backup manual completo:

```bash
# Criar backup completo do projeto
tar -czf wms-medax-backup-$(date +%Y%m%d).tar.gz \
  --exclude=node_modules \
  --exclude=dist \
  --exclude=.git \
  .
```

## Uso

### Execução Básica

```bash
./deploy-bug-fixes.sh
```

O script irá:

1. ✅ Verificar pré-requisitos
2. 💾 Criar backup automático
3. 🔍 Validar arquivos corrigidos
4. 📝 Aplicar correções
5. ✓ Verificar integridade pós-deploy
6. 📊 Exibir resumo

### Fluxo Interativo

O script solicitará confirmação antes de prosseguir:

```
Este script aplicará as seguintes correções:

  • server/waveRouter.ts
    └─ BUG 1: Vazamento multi-tenant
  • server/_core/authorization.ts
    └─ BUG 2: N+1 queries RBAC
  • server/stage.ts
    └─ BUG 3: Console.logs de debug
  • server/stockRouter.ts
    └─ BUG 3: Console.logs de debug
  • .gitignore
    └─ BUG 4: Scripts de debug expostos

Deseja continuar? (s/n):
```

Digite `s` para continuar ou `n` para cancelar.

## Recursos de Segurança

### Backup Automático

O script cria automaticamente um backup timestamped antes de aplicar qualquer alteração:

```
backups/bug-fixes-20260222-143052/
├── server/
│   ├── waveRouter.ts
│   ├── stage.ts
│   ├── stockRouter.ts
│   └── _core/
│       └── authorization.ts
├── .gitignore
└── backup-info.txt
```

### Rollback Automático

Se qualquer erro ocorrer durante o deploy, o script automaticamente reverte todas as alterações:

```
✗ Erro detectado. Executando rollback...
⚠ Revertendo alterações...
ℹ Restaurando: server/waveRouter.ts
✓ Restaurado: server/waveRouter.ts
...
✓ Rollback concluído
```

### Validação de Integridade

Após aplicar as correções, o script verifica se os arquivos foram copiados corretamente:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Verificando Deploy
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ℹ Verificando integridade dos arquivos...
✓ Verificado: server/waveRouter.ts
✓ Verificado: server/_core/authorization.ts
✓ Verificado: server/stage.ts
✓ Verificado: server/stockRouter.ts
✓ Verificado: .gitignore
✓ Verificação de integridade concluída
```

## Logs

Todas as operações são registradas em `deploy-bug-fixes.log`:

```bash
# Visualizar log em tempo real
tail -f deploy-bug-fixes.log

# Buscar erros no log
grep ERROR deploy-bug-fixes.log
```

## Pós-Deploy

### 1. Executar Testes

```bash
pnpm test
```

Verifique se todos os testes passam, especialmente:
- `authorization.test.ts` (RBAC)
- `waveRouter.test.ts` (Ondas de separação)
- `stage.test.ts` (Conferência)

### 2. Reiniciar Servidor

```bash
pnpm dev
```

Monitore o console para erros de inicialização.

### 3. Testes Manuais Críticos

#### a) Vazamento Multi-Tenant (BUG 1)

1. Login como usuário **não-admin** do Tenant A
2. Acesse `/waves` (ondas de separação)
3. ✅ Deve ver apenas ondas do Tenant A
4. ❌ NÃO deve ver ondas de outros tenants

#### b) Performance RBAC (BUG 2)

1. Abra as ferramentas de desenvolvedor (F12)
2. Vá para a aba "Network"
3. Execute uma operação que requer múltiplas permissões
4. ✅ Deve ver apenas 2 queries ao banco (não N×2)

#### c) Console Logs (BUG 3)

1. Abra o terminal do servidor
2. Execute operações de stage e consulta de estoque
3. ✅ NÃO deve aparecer logs `[DEBUG]`

### 4. Commit das Alterações

Se todos os testes passarem:

```bash
git add .
git commit -m "fix: aplicar correções críticas do relatório técnico

- BUG 1: Corrigir vazamento multi-tenant em waveRouter.ts
- BUG 2: Otimizar queries RBAC (eliminar N+1)
- BUG 3: Remover console.logs de debug em produção
- BUG 4: Adicionar scripts de debug ao .gitignore

Ref: Relatório de Análise Técnica - 22/02/2026"

git push origin main
```

## Rollback Manual

Se precisar reverter manualmente após o deploy:

### Opção 1: Usar Backup Automático

```bash
# Listar backups disponíveis
ls -la backups/

# Restaurar do backup mais recente
LATEST_BACKUP=$(ls -t backups/ | head -1)
cp -r backups/$LATEST_BACKUP/* .
```

### Opção 2: Usar Git

```bash
# Reverter último commit
git revert HEAD

# Ou descartar alterações não commitadas
git checkout -- server/waveRouter.ts
git checkout -- server/_core/authorization.ts
git checkout -- server/stage.ts
git checkout -- server/stockRouter.ts
git checkout -- .gitignore
```

## Troubleshooting

### Erro: "Diretório de correções não encontrado"

**Causa:** O diretório `corrections/` não existe ou está no local errado.

**Solução:**
```bash
unzip arquivos-corrigidos.zip -d corrections/
```

### Erro: "Arquivo corrigido não encontrado"

**Causa:** Estrutura de diretórios incorreta dentro de `corrections/`.

**Solução:** Verifique se a estrutura está correta:
```bash
tree corrections/
```

Deve mostrar:
```
corrections/
├── server/
│   ├── waveRouter.ts
│   ├── stage.ts
│   ├── stockRouter.ts
│   └── _core/
│       └── authorization.ts
└── .gitignore
```

### Erro: "Validação falhou"

**Causa:** Arquivo corrigido está vazio ou corrompido.

**Solução:**
1. Re-extraia o `arquivos-corrigidos.zip`
2. Verifique integridade do ZIP:
   ```bash
   unzip -t arquivos-corrigidos.zip
   ```

### Erro: "Verificação pós-deploy falhou"

**Causa:** Arquivo não foi copiado corretamente.

**Solução:** O script executará rollback automático. Verifique:
1. Permissões de escrita no diretório
2. Espaço em disco disponível
3. Integridade dos arquivos de origem

## Suporte

Para problemas ou dúvidas:

1. Verifique o log completo: `cat deploy-bug-fixes.log`
2. Consulte o relatório de análise técnica original
3. Entre em contato com a equipe de desenvolvimento

## Informações Adicionais

- **Versão do Script:** 1.0.0
- **Data de Criação:** 22/02/2026
- **Autor:** Equipe WMS Med@x
- **Compatibilidade:** Node.js 22.x, pnpm 9.x
