import { test as base } from '@playwright/test';
import path from 'path';

/**
 * Fixture de Autenticação
 * 
 * Extende o test do Playwright com página já autenticada.
 * O estado de autenticação é carregado automaticamente do arquivo .auth/user.json
 * que foi criado pelo setup global (e2e/auth.setup.ts).
 * 
 * Uso:
 * ```typescript
 * import { test, expect } from './fixtures/auth';
 * 
 * test('meu teste autenticado', async ({ page }) => {
 *   // page já está autenticada!
 *   await page.goto('/dashboard');
 *   await expect(page.getByText('Bem-vindo')).toBeVisible();
 * });
 * ```
 */

type AuthFixtures = {
  authenticatedPage: any;
};

export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ page }, use) => {
    // O estado de autenticação já foi carregado pelo playwright.config.ts
    // através da opção storageState: '.auth/user.json'
    
    // Página já está autenticada, apenas use
    await use(page);
  },
});

export { expect } from '@playwright/test';

/**
 * NOTA: Se você precisar de múltiplos usuários (admin, user comum, etc.),
 * crie múltiplos arquivos de setup e fixtures:
 * 
 * - e2e/auth.admin.setup.ts → salva em .auth/admin.json
 * - e2e/auth.user.setup.ts → salva em .auth/user.json
 * - e2e/fixtures/admin.ts → carrega .auth/admin.json
 * - e2e/fixtures/user.ts → carrega .auth/user.json
 */
