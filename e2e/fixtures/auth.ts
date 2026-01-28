import { test as base } from '@playwright/test';

/**
 * Fixture de Autenticação
 * 
 * Extende o test do Playwright com estado de autenticação persistente.
 * Evita fazer login em cada teste, melhorando performance.
 */

type AuthFixtures = {
  authenticatedPage: any;
};

export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ page }, use) => {
    // TODO: Implementar lógica de autenticação
    // Por enquanto, apenas navega para a página inicial
    // 
    // Em produção, você deve:
    // 1. Fazer login programaticamente via API ou UI
    // 2. Salvar cookies/tokens em arquivo
    // 3. Reutilizar em outros testes
    
    await page.goto('/');
    
    // Usar a página autenticada
    await use(page);
  },
});

export { expect } from '@playwright/test';
