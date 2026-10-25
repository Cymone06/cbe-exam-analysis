import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E tests against the production build (vite preview).
 * Run locally:  npm run test:e2e
 * CI:           .github/workflows/ci.yml runs the same suite.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // single-learner app state; tests share one browser
  timeout: 60_000,
  retries: 0,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    // Empty-string env overrides force the LOCAL (offline) mode for the base
    // suite: process env beats .env.local in Vite's loadEnv, so the preview
    // build always boots signed-out offline regardless of local .env files.
    // The cloud journey spec (tests/e2e/cloud.spec.ts) is env-gated separately.
    command: 'VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= npm run build && VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
