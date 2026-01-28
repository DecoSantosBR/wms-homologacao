import { test as setup, expect } from '@playwright/test';
import path from 'path';

/**
 * Setup Global de Autenticação
 * 
 * Este arquivo é executado UMA VEZ antes de todos os testes.
 * Ele realiza o login e salva o estado de autenticação em arquivo.
 * 
 * Os testes subsequentes reutilizam este estado, evitando login repetido.
 */

const authFile = path.join(__dirname, '../.auth/user.json');

setup('authenticate', async ({ page }) => {
  console.log('🔐 Iniciando autenticação para testes E2E...');

  // Navegar para a página inicial
  await page.goto('/');

  // OPÇÃO 1: Se o sistema permite acesso sem login (para testes)
  // Apenas navegar para a home já pode ser suficiente
  await expect(page).toHaveTitle(/Med@x/);

  // OPÇÃO 2: Se você tem credenciais de teste, faça login aqui
  // Descomente e ajuste conforme seu fluxo de login:
  /*
  // Clicar no botão de login
  await page.getByRole('button', { name: /Entrar|Login/i }).click();
  
  // Preencher credenciais
  await page.getByLabel(/Email|Usuário/i).fill(process.env.TEST_USER_EMAIL || 'test@example.com');
  await page.getByLabel(/Senha|Password/i).fill(process.env.TEST_USER_PASSWORD || 'senha123');
  
  // Submeter formulário
  await page.getByRole('button', { name: /Entrar|Login/i }).click();
  
  // Aguardar redirecionamento após login
  await page.waitForURL('/');
  
  // Verificar que login foi bem-sucedido
  await expect(page.getByText(/Bem-vindo/i)).toBeVisible();
  */

  // OPÇÃO 3: Injetar cookie de sessão diretamente (bypass OAuth)
  // Útil quando você tem um token de teste válido
  /*
  await page.context().addCookies([
    {
      name: 'session',
      value: process.env.TEST_SESSION_TOKEN || 'test-token-here',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ]);
  */

  // Salvar estado de autenticação (cookies, localStorage, sessionStorage)
  await page.context().storageState({ path: authFile });

  console.log('✅ Autenticação concluída e estado salvo em:', authFile);
});
