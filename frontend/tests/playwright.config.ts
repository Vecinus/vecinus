import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  timeout: 1500000, 
  
  // Grabación de video
  use: {
    baseURL: 'http://localhost:8081', // URL de expo web
    trace: 'on-first-retry',
    video: 'retain-on-failure',        // Graba si falla
    screenshot: 'only-on-failure',
    navigationTimeout: 120000, // 2 minutos para navegaciones
    actionTimeout: 30000, // 30 segundos para acciones
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  // Servidor de desarrollo
  webServer: {
    command: 'npm run web',
    port: 8081,
    reuseExistingServer: !process.env.CI,
  },

  // Reportes
  reporter: 'html',
});