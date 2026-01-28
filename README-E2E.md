# Testes E2E (End-to-End) - WMS Med@x

Este documento explica como executar e criar testes E2E no sistema WMS Med@x usando Playwright.

## 📋 O que são Testes E2E?

Testes End-to-End simulam interações reais de usuários no navegador, validando fluxos completos do sistema:
- Navegação entre páginas
- Preenchimento de formulários
- Cliques em botões
- Validação de mensagens de erro/sucesso
- Integração entre frontend e backend

## 🚀 Executando Testes

### Pré-requisitos

1. Instalar dependências do Playwright (já feito):
   ```bash
   pnpm add -D @playwright/test playwright
   ```

2. Instalar navegadores do Playwright:
   ```bash
   pnpm exec playwright install
   ```

### Comandos Principais

```bash
# Executar todos os testes E2E
pnpm exec playwright test

# Executar testes em modo interativo (UI)
pnpm exec playwright test --ui

# Executar testes em modo debug
pnpm exec playwright test --debug

# Executar apenas um arquivo de teste
pnpm exec playwright test e2e/navigation.spec.ts

# Executar testes com relatório HTML
pnpm exec playwright test --reporter=html

# Ver relatório HTML após execução
pnpm exec playwright show-report
```

### Executar Testes com Servidor em Execução

Se o servidor de desenvolvimento já estiver rodando (`pnpm dev`), desabilite o `webServer` no `playwright.config.ts` ou use:

```bash
BASE_URL=http://localhost:3000 pnpm exec playwright test
```

## 📁 Estrutura de Arquivos

```
e2e/
├── fixtures/
│   └── auth.ts              # Helpers de autenticação
├── navigation.spec.ts       # Testes de navegação básica
├── picking-order.spec.ts    # Testes de pedidos de separação
└── stage-check.spec.ts      # Testes de conferência (Stage)

playwright.config.ts         # Configuração do Playwright
playwright-report/           # Relatórios HTML gerados
```

## ✍️ Criando Novos Testes

### Estrutura Básica

```typescript
import { test, expect } from '@playwright/test';

test.describe('Nome do Módulo', () => {
  test.beforeEach(async ({ page }) => {
    // Preparação antes de cada teste
    await page.goto('/sua-rota');
  });

  test('deve fazer algo específico', async ({ page }) => {
    // 1. Arrange: preparar dados
    const button = page.getByRole('button', { name: /Clique Aqui/i });
    
    // 2. Act: executar ação
    await button.click();
    
    // 3. Assert: verificar resultado
    await expect(page.locator('h1')).toContainText('Sucesso');
  });
});
```

### Seletores Recomendados

Priorize seletores por ordem de preferência:

1. **Por role** (mais resiliente):
   ```typescript
   page.getByRole('button', { name: /Salvar/i })
   page.getByRole('textbox', { name: /Nome/i })
   ```

2. **Por label**:
   ```typescript
   page.getByLabel(/Email/i)
   ```

3. **Por texto**:
   ```typescript
   page.getByText(/Bem-vindo/i)
   ```

4. **Por test-id** (adicione `data-testid` nos componentes):
   ```typescript
   page.getByTestId('submit-button')
   ```

5. **Evite**: seletores CSS/XPath frágeis

### Boas Práticas

#### 1. Use `.skip()` para testes que requerem dados específicos

```typescript
test.skip('deve criar pedido', async ({ page }) => {
  // Este teste requer cliente e produto no banco
  // Habilite após configurar fixtures de dados
});
```

#### 2. Aguarde elementos assincronamente

```typescript
// ❌ Ruim
await page.waitForTimeout(2000);

// ✅ Bom
await expect(page.getByText('Carregado')).toBeVisible();
```

#### 3. Isole testes (cada teste deve ser independente)

```typescript
test.beforeEach(async ({ page }) => {
  // Limpar estado antes de cada teste
  await page.goto('/');
});
```

#### 4. Use Page Object Model para páginas complexas

```typescript
// e2e/pages/PickingPage.ts
export class PickingPage {
  constructor(private page: Page) {}

  async createOrder(customerName: string, orderNumber: string) {
    await this.page.getByRole('button', { name: /Novo Pedido/i }).click();
    await this.page.getByLabel(/Cliente/i).fill(customerName);
    await this.page.getByLabel(/Número/i).fill(orderNumber);
    await this.page.getByRole('button', { name: /Salvar/i }).click();
  }
}
```

## 🎯 Testes Existentes

### 1. `navigation.spec.ts`
- ✅ Carregamento da página inicial
- ✅ Navegação entre módulos
- ✅ Botão "Voltar" funciona

### 2. `picking-order.spec.ts`
- ✅ Exibição de lista de pedidos
- ✅ Abertura de modal de novo pedido
- ✅ Validação de campos obrigatórios
- ⏭️ Criação de pedido (skip - requer dados)
- ✅ Filtros e busca

### 3. `stage-check.spec.ts`
- ✅ Exibição do formulário de busca
- ✅ Digitação no campo "Número do Pedido"
- ✅ Validação de campo obrigatório
- ⏭️ Fluxo completo de conferência (skip - requer dados)

## 🔧 Configuração de Dados de Teste

Para habilitar testes marcados com `.skip()`, você deve:

1. **Criar fixtures de dados**:
   ```typescript
   // e2e/fixtures/test-data.ts
   export const testCustomer = {
     name: 'Cliente Teste E2E',
     code: 'CLI-E2E-001'
   };
   ```

2. **Popular banco antes dos testes**:
   ```typescript
   test.beforeAll(async () => {
     // Inserir dados de teste via API ou SQL
   });
   ```

3. **Limpar dados após os testes**:
   ```typescript
   test.afterAll(async () => {
     // Remover dados de teste
   });
   ```

## 📊 Relatórios e Debug

### Visualizar Relatório HTML

Após executar os testes, abra o relatório:

```bash
pnpm exec playwright show-report
```

O relatório mostra:
- ✅ Testes que passaram
- ❌ Testes que falharam (com screenshots e vídeos)
- ⏭️ Testes ignorados (.skip)
- 📊 Tempo de execução

### Debug de Testes Falhando

```bash
# Modo debug interativo
pnpm exec playwright test --debug

# Executar apenas testes que falharam
pnpm exec playwright test --last-failed

# Ver trace detalhado
pnpm exec playwright show-trace trace.zip
```

## 🔐 Autenticação

O arquivo `e2e/fixtures/auth.ts` contém helpers para autenticação. Para implementar:

1. Faça login programaticamente
2. Salve cookies/tokens em arquivo
3. Reutilize em todos os testes

Exemplo:
```typescript
// e2e/fixtures/auth.ts
export const test = base.extend({
  authenticatedPage: async ({ page }, use) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('admin@test.com');
    await page.getByLabel('Senha').fill('senha123');
    await page.getByRole('button', { name: /Entrar/i }).click();
    
    // Salvar estado de autenticação
    await page.context().storageState({ path: 'auth.json' });
    
    await use(page);
  },
});
```

## 📚 Recursos Adicionais

- [Documentação Oficial do Playwright](https://playwright.dev)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Seletores](https://playwright.dev/docs/selectors)
- [Assertions](https://playwright.dev/docs/test-assertions)

## 🎬 Próximos Passos

1. ✅ Instalar navegadores: `pnpm exec playwright install`
2. ✅ Executar testes básicos: `pnpm exec playwright test e2e/navigation.spec.ts`
3. 📝 Criar fixtures de dados de teste
4. 🔓 Implementar autenticação automática
5. ✨ Habilitar testes marcados com `.skip()`
6. 🚀 Integrar com CI/CD (GitHub Actions, GitLab CI, etc.)
