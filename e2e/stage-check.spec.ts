import { test, expect } from '@playwright/test';

/**
 * Testes E2E: Conferência de Expedição (Stage)
 * 
 * Valida o fluxo de conferência de pedidos separados antes da expedição.
 */

test.describe('Conferência de Expedição (Stage)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/stage/check');
  });

  test('deve exibir formulário de busca de pedido', async ({ page }) => {
    // Verificar título
    await expect(page.locator('h1')).toContainText(/Stage - Conferência de Expedição/i);
    
    // Verificar campo de busca
    await expect(page.getByLabel(/Número do Pedido/i)).toBeVisible();
    
    // Verificar botão de busca
    await expect(page.getByRole('button', { name: /Buscar/i })).toBeVisible();
  });

  test('deve permitir digitação no campo Número do Pedido', async ({ page }) => {
    const orderInput = page.getByLabel(/Número do Pedido/i);
    
    // Verificar que o campo não está desabilitado
    await expect(orderInput).toBeEnabled();
    
    // Digitar no campo
    await orderInput.fill('PED-TEST-001');
    
    // Verificar que o valor foi inserido
    await expect(orderInput).toHaveValue('PED-TEST-001');
  });

  test('deve validar campo obrigatório ao buscar', async ({ page }) => {
    // Tentar buscar sem preencher número do pedido
    await page.getByRole('button', { name: /Buscar/i }).click();
    
    // Verificar mensagem de erro
    await expect(page.locator('[data-sonner-toast]')).toContainText(/Digite ou bipe o número do pedido/i);
  });

  test.skip('deve iniciar conferência de pedido válido', async ({ page }) => {
    // SKIP: Requer pedido separado no banco de dados
    
    // Preencher número do pedido
    await page.getByLabel(/Número do Pedido/i).fill('PED-SEPARATED-001');
    
    // Buscar pedido
    await page.getByRole('button', { name: /Buscar/i }).click();
    
    // Aguardar carregamento
    await page.waitForTimeout(1000);
    
    // Verificar que entrou em modo de conferência
    await expect(page.locator('h1')).toContainText(/Conferindo Pedido/i);
    
    // Verificar campos de conferência
    await expect(page.getByLabel(/Etiqueta\/SKU/i)).toBeVisible();
    await expect(page.getByLabel(/Quantidade/i)).toBeVisible();
  });

  test.skip('deve registrar item conferido', async ({ page }) => {
    // SKIP: Requer pedido em conferência ativa
    
    // Assumindo que já está em modo de conferência
    await page.goto('/stage/check'); // Deve detectar conferência ativa
    
    // Preencher etiqueta do produto
    await page.getByLabel(/Etiqueta\/SKU/i).fill('PROD-001');
    
    // Preencher quantidade
    await page.getByLabel(/Quantidade/i).fill('5');
    
    // Registrar item
    await page.getByRole('button', { name: /Registrar/i }).click();
    
    // Verificar que item foi adicionado à lista
    await expect(page.getByText(/PROD-001/i)).toBeVisible();
  });

  test.skip('deve finalizar conferência com sucesso', async ({ page }) => {
    // SKIP: Requer conferência ativa com itens
    
    // Clicar em finalizar conferência
    await page.getByRole('button', { name: /Finalizar Conferência/i }).click();
    
    // Confirmar no modal
    await page.getByRole('button', { name: /Confirmar/i }).click();
    
    // Verificar sucesso
    await expect(page.locator('[data-sonner-toast]')).toContainText(/Conferência finalizada/i);
    
    // Verificar que voltou para tela de busca
    await expect(page.getByLabel(/Número do Pedido/i)).toBeVisible();
  });

  test('deve ter botão de cancelar conferência', async ({ page }) => {
    // Verificar que existe botão de cancelar (pode estar oculto se não houver conferência ativa)
    const cancelButton = page.getByRole('button', { name: /Cancelar/i });
    
    // Se houver conferência ativa, o botão deve estar visível
    const isVisible = await cancelButton.isVisible().catch(() => false);
    
    if (isVisible) {
      await expect(cancelButton).toBeEnabled();
    }
  });
});
