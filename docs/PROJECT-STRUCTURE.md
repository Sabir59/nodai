# Project structure (as-built)

The current, actual tree — not the target spec (that's [root.md](./root.md)). One line per entry.

```
bare-next/
├── apps/
│   ├── matw/                      Next.js app — the main product, port 3001
│   │   ├── package.json           name, scripts, deps; includes the pnpm-only preinstall guard
│   │   ├── next.config.ts         transpiles @matw/ui
│   │   ├── tsconfig.json          extends @matw/typescript-config/nextjs, @/* → ./src/*
│   │   ├── eslint.config.js       extends @matw/eslint-config/next-js
│   │   ├── postcss.config.mjs     re-exports @matw/ui/postcss.config
│   │   ├── components.json        shadcn CLI config — css points at src/app/globals.css
│   │   ├── wrangler.jsonc         Cloudflare Pages/Workers readiness (compat date + nodejs_compat)
│   │   └── src/
│   │       ├── app/
│   │       │   ├── layout.tsx         root layout — fonts, ThemeProvider, imports ./globals.css
│   │       │   ├── page.tsx           home page — sample Button from @matw/ui
│   │       │   ├── globals.css        imports @matw/theme, per-app @source + override block
│   │       │   ├── favicon.ico
│   │       │   └── api/               BFF proxy routes land here (empty)
│   │       ├── components/providers/theme-provider.tsx   next-themes wrapper + `d` dark-mode hotkey
│   │       ├── config/env.ts          the ONLY file in the app that reads process.env
│   │       ├── lib/api/client.ts      DI wiring point — createApiClient({ baseUrl: BASE_URL })
│   │       ├── domains/README.md      app-local business logic / PSP orchestration — nothing built yet
│   │       ├── features/README.md     UMDA "dumb" views/components/hooks/constants — nothing built yet
│   │       └── services/_template/README.md   documents the 5-file data-layer shape — not wired yet
│   │
│   ├── clickfunnels/              Next.js app — identical shape to matw above, port 3002
│   │
│   └── matw-astro/                Astro app — same product, full peer of matw, port 3003
│       ├── package.json           astro + @astrojs/check, same pnpm guard
│       ├── astro.config.mjs       server.port = 3003
│       ├── tsconfig.json          extends astro/tsconfigs/strict, @/* → ./src/*
│       ├── wrangler.jsonc         same Cloudflare readiness as the Next apps
│       ├── turbo.json             package-level override: build outputs dist/** (not .next/**)
│       └── src/
│           ├── pages/index.astro      placeholder home page
│           ├── components/            empty — Astro-native layout pieces land here
│           ├── env.d.ts               Astro client-types reference
│           ├── lib/api/client.ts      createApi(cookies) — DI init per-request, passes Astro.cookies
│           ├── domains/README.md      same rule as matw
│           ├── features/README.md     same rule as matw
│           └── services/_template/README.md   same shape; notes Astro's server-rendered-by-default reads
│
├── packages/                      the shared layer, all under the @matw/* scope
│   ├── enums/                     Tier 0 — backend enum mirrors (empty stub)
│   ├── routes/                    Tier 0 — typed route registry (ROUTES.HOME stub)
│   ├── utils/                     Tier 0 — pure framework-free helpers (empty stub)
│   ├── api-client/                Tier 0 — real: createApiClient() fetch factory, ApiError, envelope unwrap
│   ├── theme/                     Tier 0 — CSS engine: contract.css (utilities) + base-theme.css (values) + themes.css (presets, empty)
│   ├── domain/                    Tier 1 — shared Zod schemas/DTOs (empty stub + README)
│   ├── domain-api/                Tier 1 — shared service contracts + DI holder (empty stub + README)
│   ├── auth-state/                Tier 1 — auth store/permission map, framework-auth-free (empty stub + README)
│   ├── ui/                        Tier 2 — shadcn/ui primitives (Button implemented, cn() helper)
│   ├── ui-shared/                 Tier 2 — composed widgets/state screens (empty stub + README)
│   ├── components/                Tier 2 — shared domain components (empty stub + README)
│   ├── eslint-config/             infra — base / react-internal / next-js flat ESLint configs
│   └── typescript-config/         infra — base / nextjs / react-library tsconfigs
│
├── docs/                          the spec — read before touching apps or packages
│   ├── root.md                        the original target topology this repo was bootstrapped from
│   ├── BLUEPRINT.md                   monorepo topology rules (tiers, DI, ports, gates)
│   ├── ARCHITECTURE.md                index into the 5 contracts below
│   ├── UMDA-architecture-contract.md      domain/feature split, fraud/PSP guardrails
│   ├── state-management-contract.md       Zustand vs TanStack Query rules
│   ├── shadcn-component-contract.md       semantic tokens, no raw color/pixel values
│   ├── layout-and-styling-contract.md     gap-first spacing, RTL logical properties
│   ├── form-and-validation-contract.md    RHF + Zod + shadcn form pattern
│   ├── monorepo-workspace-contract.md     Turborepo + Cloudflare Wrangler rules
│   └── PROJECT-STRUCTURE.md               this file
│
├── package.json                   workspaces root — pnpm guard, turbo script delegation
├── pnpm-workspace.yaml            workspace globs: apps/*, packages/*
├── turbo.json                     task graph — globalEnv, lint/typecheck inputs
├── tsconfig.json                  extends @matw/typescript-config/base
├── .eslintrc.js                   legacy root stub (ignorePatterns only; real rules live per-package)
├── .gitignore                     node_modules, .next/, .astro/, dist, .turbo, env files
├── .npmrc / .prettierrc / .prettierignore
├── AGENTS.md                      Next.js-version warning for AI agents
└── README.md                      apps/ports table, package tiers, commands
```

## What's real vs. stubbed right now

- **Real:** the workspace graph, all tsconfig/eslint/next/astro plumbing, `@matw/theme`'s CSS
  split, `@matw/api-client`'s fetch factory, `@matw/ui`'s Button.
- **Stubbed (empty `src/index.ts` + a README explaining the contract):** `enums`, `utils`,
  `domain`, `domain-api`, `auth-state`, `ui-shared`, `components`, and every app's `domains/`,
  `features/`, `services/_template/`.
- **Not started:** auth SDK wiring, TanStack Query provider, `check:ds` design-system gate,
  CI/Docker/compose. See BLUEPRINT.md §13 for the phase order these land in.
