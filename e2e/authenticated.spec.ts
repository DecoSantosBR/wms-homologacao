import { test, expect } from '@playwright/test';

/**
 * Testes E2E com Autenticação Automática
 * 
 * Estes testes demonstram como usar o estado de autenticação salvo.
 * Não é necessário fazer login manualmente - o setup já fez isso!
 */

test.describe('Testes Autenticados', () => {
  test('deve acessar página inicial com autenticação', async ({ page }) => {
    // Navegar para home
    await page.goto('/');
    
    // Verificar que a página carregou
    await expect(page).toHaveTitle(/Med@x/);
    
    // Se houver indicador de usuário logado, verificar
    // Exemplo: await expect(page.getByText(/Bem-vindo/i)).toBeVisible();
  });

  test('deve navegar entre páginas sem redirecionamento', async ({ page }) => {
    // Navegar para diferentes páginas
    await page.goto('/picking');
    // Verificar que não foi redirecionado para login
    await expect(page).not.toHaveURL(/manus\.im/);
    await expect(page).toHaveURL(/\/picking/);
    
    await page.goto('/stage');
    await expect(page).not.toHaveURL(/manus\.im/);
    await expect(page).toHaveURL(/\/stage/);
    
    await page.goto('/shipping');
    await expect(page).not.toHaveURL(/manus\.im/);
    await expect(page).toHaveURL(/\/shipping/);
  });

  test.skip('deve acessar área restrita (exemplo)', async ({ page }) => {
    // SKIP: Ajuste conforme seu sistema
    // Este é um exemplo de como testar áreas que requerem autenticação
    
    await page.goto('/admin');
    
    // Não deve redirecionar para login
    await expect(page).not.toHaveURL(/login/);
    
    // Deve mostrar conteúdo da área restrita
    await expect(page.getByText(/Painel Administrativo/i)).toBeVisible();
  });
});
