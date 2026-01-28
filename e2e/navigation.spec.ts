import { test, expect } from '@playwright/test';

/**
 * Testes E2E: Navegação Básica
 * 
 * Valida que as páginas principais do sistema carregam corretamente
 * e que a navegação entre módulos funciona.
 */

test.describe('Navegação do Sistema', () => {
  test('deve carregar a página inicial', async ({ page }) => {
    await page.goto('/');
    
    // Verificar título da página
    await expect(page).toHaveTitle(/Med@x/);
    
    // Verificar que o cabeçalho está visível
    await expect(page.locator('h1')).toContainText('Sistema de Gerenciamento de Armazém');
  });

  test('deve navegar para o módulo de Recebimento', async ({ page }) => {
    await page.goto('/');
    
    // Clicar no botão "Acessar Módulo" do card de Recebimento
    await page.getByRole('button', { name: /Acessar Módulo/i }).first().click();
    
    // Verificar redirecionamento
    await expect(page).toHaveURL(/\/receiving/);
    
    // Verificar conteúdo da página
    await expect(page.locator('h1')).toContainText(/Recebimento/i);
  });

  test('deve navegar para o módulo de Separação', async ({ page }) => {
    await page.goto('/');
    
    // Encontrar e clicar no card de Separação
    const separacaoCard = page.locator('text=Separação').locator('..');
    await separacaoCard.getByRole('button', { name: /Acessar Módulo/i }).click();
    
    // Verificar redirecionamento
    await expect(page).toHaveURL(/\/picking/);
  });

  test('deve navegar para o módulo de Stage', async ({ page }) => {
    await page.goto('/');
    
    const stageCard = page.locator('text=Stage').locator('..');
    await stageCard.getByRole('button', { name: /Acessar Módulo/i }).click();
    
    await expect(page).toHaveURL(/\/stage/);
  });

  test('deve navegar para o módulo de Expedição', async ({ page }) => {
    await page.goto('/');
    
    const expedicaoCard = page.locator('text=Expedição').locator('..');
    await expedicaoCard.getByRole('button', { name: /Acessar Módulo/i }).click();
    
    await expect(page).toHaveURL(/\/shipping/);
  });

  test('deve voltar para home usando botão Voltar', async ({ page }) => {
    // Navegar para uma página interna
    await page.goto('/picking');
    
    // Clicar no botão Voltar
    await page.getByRole('button', { name: /Voltar/i }).click();
    
    // Verificar que voltou para home
    await expect(page).toHaveURL('/');
  });
});
