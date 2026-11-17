# Workflow Observation

## Pixel Glitch first delivery (2026-11-17)

- Result: bare `npm run verify:delivery` passed: docs and code health checks, 738 Vitest contract and product tests, production build, and 23 functional browser tests on the preview build. Initial delivery receipt: `.toolcraft/verification/checkpoint.json`.
- Measured performance was not run; it needs an explicit request.
- Dependency fix: the generated lockfile resolved `csstype` 3.2.x, whose new CSS `pathLength` type clashes with `motion` 11's `MotionStyle` and broke `tsc` inside the protected runtime timeline code. `package.json` now pins `csstype` to 3.1.3 through `overrides`; no framework file changed.
- Environment notes: Playwright's headless Chromium was installed with `npx playwright install chromium`. `npm run test` still reports framework script-test failures unrelated to the product: two need `pnpm` (not installed), one timing threshold is load-sensitive, and one Infinity recipe fixture test fails on its own synthetic data.
- Dev-server note: browser specs open the app and wait for the runtime root before starting a proof session, because a cold Vite dev server can drop the first parallel page loads. The delivery run uses the preview build and is not affected.
