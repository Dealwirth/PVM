import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: process.env.PVM_E2E_BASE_URL ?? 'http://localhost:7001',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    video: false,
    screenshotOnRunFailure: true,
    retries: { runMode: 1, openMode: 0 },
    env: {
      PVM_API_SECRET: process.env.PVM_API_SECRET ?? 'e2e-secret',
    },
  },
});
