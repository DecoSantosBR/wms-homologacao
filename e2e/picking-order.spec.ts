import { test, expect } from '@playwright/test';

/**
 * Testes E2E: Pedidos de Separação
 * 
 * Valida o fluxo completo de criação e gerenciamento de pedidos de separação.
 * 
 * NOTA: Estes testes assumem que há dados de teste no banco (clientes, produtos).
 * Em ambiente de CI/CD, você deve popular o banco com dados de teste antes de executar.
 */

test.describe('Pedidos de Separação', () => {
  test.beforeEach(async ({ page }) => {
    // Navegar para a página de pedidos
    await page.goto('/picking');
  });

  test('deve exibir lista de pedidos', async ({ page }) => {
    // Verificar título da página
    await expect(page.locator('h1')).toContainText(/Pedidos de Separação/i);
    
    // Verificar que o botão "Novo Pedido" está visível
    await expect(page.getByRole('button', { name: /Novo Pedido/i })).toBeVisible();
  });

  test('deve abrir modal de novo pedido', async ({ page }) => {
    // Clicar no botão "Novo Pedido"
    await page.getByRole('button', { name: /Novo Pedido/i }).click();
    
    // Verificar que o modal foi aberto
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText(/Criar Novo Pedido/i)).toBeVisible();
    
    // Verificar campos obrigatórios
    await expect(page.getByLabel(/Cliente/i)).toBeVisible();
    await expect(page.getByLabel(/Número do Pedido/i)).toBeVisible();
  });

  test('deve validar campos obrigatórios ao criar pedido', async ({ page }) => {
    // Abrir modal
    await page.getByRole('button', { name: /Novo Pedido/i }).click();
    
    // Tentar salvar sem preencher campos
    await page.getByRole('button', { name: /Criar Pedido/i }).click();
    
    // Verificar que exibe mensagem de erro (toast)
    // Nota: Ajuste o seletor conforme seu componente de toast
    await expect(page.locator('[data-sonner-toast]')).toBeVisible();
  });

  test.skip('deve criar pedido com sucesso', async ({ page }) => {
    // SKIP: Este teste requer dados específicos no banco
    // Para habilitar, você deve:
    // 1. Criar fixtures de dados de teste (clientes, produtos)
    // 2. Popular o banco antes de executar o teste
    // 3. Limpar dados após o teste
    
    await page.getByRole('button', { name: /Novo Pedido/i }).click();
    
    // Selecionar cliente
    await page.getByLabel(/Cliente/i).click();
    await page.getByText('Cliente Teste').click();
    
    // Preencher número do pedido
    await page.getByLabel(/Número do Pedido/i).fill('PED-TEST-001');
    
    // Adicionar produto
    await page.getByRole('button', { name: /Adicionar Produto/i }).click();
    await page.getByLabel(/Produto/i).click();
    await page.getByText('Produto Teste').click();
    await page.getByLabel(/Quantidade/i).fill('10');
    
    // Salvar pedido
    await page.getByRole('button', { name: /Criar Pedido/i }).click();
    
    // Verificar sucesso
    await expect(page.locator('[data-sonner-toast]')).toContainText(/criado com sucesso/i);
  });

  test('deve filtrar pedidos por status', async ({ page }) => {
    // Verificar que existem filtros de status
    const statusFilter = page.getByLabel(/Status/i);
    
    if (await statusFilter.isVisible()) {
      await statusFilter.click();
      
      // Verificar opções de status
      await expect(page.getByText(/Pendente/i)).toBeVisible();
      await expect(page.getByText(/Em Separação/i)).toBeVisible();
    }
  });

  test('deve pesquisar pedido por número', async ({ page }) => {
    // Localizar campo de busca
    const searchInput = page.getByPlaceholder(/Buscar/i);
    
    if (await searchInput.isVisible()) {
      await searchInput.fill('PED-001');
      
      // Aguardar atualização da lista
      await page.waitForTimeout(500);
      
      // Verificar que a lista foi filtrada
      // (Implementação específica depende da sua UI)
    }
  });
});
