import { defineConfig, devices } from '@playwright/test';

/**
 * Configuração de Testes E2E com Playwright
 * 
 * Testes End-to-End simulam interações reais do usuário no navegador,
 * validando fluxos completos do sistema (login, criação de pedidos, etc.)
 */
export default defineConfig({
  // Diretório onde ficam os testes E2E
  testDir: './e2e',
  
  // Timeout global para cada teste (30 segundos)
  timeout: 30 * 1000,
  
  // Executar testes em paralelo
  fullyParallel: true,
  
  // Não permitir testes com .only() em CI
  forbidOnly: !!process.env.CI,
  
  // Número de tentativas em caso de falha
  retries: process.env.CI ? 2 : 0,
  
  // Número de workers (testes paralelos)
  workers: process.env.CI ? 1 : undefined,
  
  // Reporter: HTML para visualização local, GitHub Actions para CI
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list']
  ],
  
  // Configurações compartilhadas entre todos os testes
  use: {
    // URL base do aplicativo
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    
    // Capturar screenshot apenas em falhas
    screenshot: 'only-on-failure',
    
    // Capturar vídeo apenas em falhas
    video: 'retain-on-failure',
    
    // Capturar trace (debug detalhado) em falhas
    trace: 'on-first-retry',
  },

  // Projetos: diferentes navegadores e configurações
  projects: [
    // Setup: Executado UMA VEZ antes de todos os testes
    // Faz login e salva estado de autenticação
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },

    // Testes principais: Usam estado de autenticação salvo
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Carregar estado de autenticação salvo pelo setup
        storageState: '.auth/user.json',
      },
      dependencies: ['setup'], // Executar setup antes
    },

    // Descomente para testar em Firefox
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },

    // Descomente para testar em Safari (apenas macOS)
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },

    // Descomente para testar em mobile
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
  ],

  // Servidor de desenvolvimento (opcional)
  // Inicia o servidor automaticamente antes dos testes
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
