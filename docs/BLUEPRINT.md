# Multi-App Frontend Monorepo — Blueprint

A reusable specification for building a monorepo of **N standalone product apps** on top of one
shared package layer, one design system, one data-layer standard, and one set of machine-enforced
rules. It is the generalised form of this repository (`fms-web-app`), written so it can be applied
to a different product, a different brand, and a different number of apps.

> **How to use this file.** Hand it to an engineer or an AI agent with: *"bootstrap a monorepo
> following BLUEPRINT.md — apps: `<list>`, scope: `@<scope>`"*. Everything below is either a rule
> (non-negotiable, enforced by a gate) or a recipe (copy, rename, fill in). Nothing here depends on
> the app count: two apps and six apps produce the same structure.
>
> Concrete examples are Next.js + Tailwind flavoured because that is what this repo runs. Every
> such point is marked as a **substitution point** where another framework slots in without
> changing the architecture.

---

## 1. The principles

Everything in this document falls out of eight rules. When a new situation is ambiguous, decide it
by these, in this order.

1. **One direction of dependency.** Apps import packages. Packages import packages *below* them.
   Nothing ever imports upward, and **no app ever imports from another app.** A cycle is a design
   error, not a build error to be worked around.
2. **Shared means ≥2 real consumers.** Code moves into a package when a second app genuinely needs
   it — not when you predict it might. Premature sharing costs more than duplication.
3. **Packages are pure of app concerns.** No `process.env`, no app path aliases, no app config, no
   toast/auth/analytics singletons. Anything app-specific is **injected** through a factory
   (dependency injection). A package that reads the environment can only ever serve one app.
4. **One way to do each thing.** One HTTP layer. One cache-invalidation mechanism. One set of empty
   /error/loading screens. One token vocabulary. Variety in the *product* is good; variety in the
   *plumbing* is debt.
5. **The application never touches a raw value.** No hex colours, no hand-built API URLs, no
   hardcoded route strings, no ad-hoc date/money formatting. There is a token, a registry, or a
   helper for each — and a gate that fails the build when you bypass it.
6. **Rules that aren't enforced don't exist.** Every convention worth having is expressed as a lint
   rule, a type, or a CI script. Documentation is the *explanation*; the gate is the *rule*.
7. **Cross-cutting concerns live in exactly one place.** Cache invalidation, toasts, auth teardown,
   security headers, error shape. Never copied into each call site.
8. **Client-side access control is cosmetic.** The backend is the authority. UI gating exists so a
   user isn't offered a dead end — never as a security boundary. Write that down next to every
   guard so nobody mistakes it for one.

---

## 2. Repository topology

```
<repo>/
├── apps/                       # N standalone applications, one per audience
│   ├── <app-a>/                # e.g. admin dashboard        (port 3001)
│   ├── <app-b>/                # e.g. internal back-office   (port 3002)
│   └── <app-n>/                # …                           (port 300n)
├── packages/                   # the shared layer — the real product of the monorepo
│   ├── enums/  routes/  utils/  api-client/  auth/  toast/  query-kit/   ← leaves
│   ├── domain/  domain-api/  auth-state/                                 ← domain + state
│   ├── ui/  ui-shared/  components/                                      ← UI stack
│   ├── theme/  layouts-shared/  security-headers/                        ← chrome / infra
│   └── eslint-config/                                                    ← the gates
├── scripts/                    # repo-level gates and ops scripts
├── package.json                # workspaces + root task scripts only
├── turbo.json                  # task graph, cache inputs/outputs, globalEnv
├── docker-compose.yml          # one service per app
├── <ci>.yml                    # build matrix over apps → deploy → notify
├── README.md                   # what exists, how to run it, where it deploys
├── ARCHITECTURE.md             # the data-layer standard (the one everyone must read)
└── BLUEPRINT.md                # this file
```

**One app = one audience.** Split apps by *who is looking at the screen*, not by feature. An admin
console and a customer storefront have different auth boundaries, different performance budgets,
different release risk, and different design pressure — those are the seams. Two audiences that
share 90% of their screens are one app with a role switch, not two apps.

**Ports are assigned once**, sequentially (3001, 3002, …), and reused everywhere: dev script,
`EXPOSE`, compose mapping, health check. Never let an app's port be discovered by trial.

---

## 3. Toolchain baseline

| Concern | Choice | Why it matters to the structure |
| --- | --- | --- |
| Package manager | **One**, pinned, with a guard | A single lockfile at the root. A `preinstall` script that rejects the wrong manager prevents a second lockfile ever appearing. |
| Task runner | **Turborepo** (or Nx) | Gives you `--filter`, a dependency-aware task graph, and remote/local caching. Without it, "run one app" and "build only what changed" are shell scripts nobody maintains. |
| Language | TypeScript, `strict: true` | Cross-package contracts are only real if they're typed. |
| Framework | Next.js App Router *(substitution point)* | Anything with a per-app build works; the package layer is framework-agnostic by design. |
| Styling | Tailwind v4 CSS-first tokens *(substitution point)* | See §5 — the token pyramid maps onto any CSS-variable system. |
| Server state | TanStack Query | The data-layer standard in §6 is built on it. |
| Client state | Zustand, flat stores | Server state never goes in here. |
| Validation | Zod, shared schemas | One schema drives types, form validation, and required-field markers. |

**The manager guard** (root and every app `package.json`):

```json
"preinstall": "node -e \"if(!String(process.env.npm_config_user_agent).startsWith('<mgr>')){console.error('\\n  This project requires <mgr>.\\n');process.exit(1)}\""
```

**Root scripts are thin.** The root `package.json` contains workspaces, the guard, and one line per
task that delegates to the task runner (`dev`, `build`, `lint`, `test`, `typecheck`, plus custom
gates). No real logic lives at the root.

**`turbo.json` carries two things people forget:**

- `globalEnv` — **every** environment variable that must reach a build. A variable missing here is
  silently `undefined` in the bundle, which is the single most expensive five-minute bug in this
  kind of repo.
- Per-task `inputs` — so a docs edit doesn't invalidate the typecheck cache.

```jsonc
{
  "globalEnv": ["NEXT_PUBLIC_BASE_URL", "…every var, listed"],
  "tasks": {
    "build":     { "dependsOn": ["^build"], "outputs": [".next/**", "!.next/cache/**"] },
    "dev":       { "cache": false, "persistent": true },
    "lint":      { "inputs": ["src/**/*.{ts,tsx,js,jsx,mjs}", "eslint.config.*"] },
    "typecheck": { "inputs": ["src/**/*.{ts,tsx}", "tsconfig.json", "next-env.d.ts", "next.config.ts"] }
  }
}
```

**Run one app at a time.** `<mgr> run dev --filter=<app>`. Building all apps concurrently exhausts
memory on normal machines; CI parallelises across *runners*, not across cores. Put
`bunx turbo run build --concurrency=1` in the README for the "build everything locally" case.

---

## 4. The package layer

### 4.1 Tiers and dependency direction

Packages are organised in tiers. **A package may only import from a lower tier.** This is the whole
game — get it wrong once and the graph turns into a ball of mud that no lint rule can untangle
later.

```
Tier 0 — leaves (zero internal deps, or one)
  enums · routes · utils · api-client · auth · toast · query-kit · theme · security-headers
        ↓
Tier 1 — domain & state
  domain → domain-api → auth-state
        ↓
Tier 2 — UI stack
  ui → ui-shared → components
        ↓
Tier 3 — chrome
  layouts-shared
        ↓
Tier 4 — consumers
  apps/*
```

| Package | Owns | Must NOT contain |
| --- | --- | --- |
| `enums` | Backend enum mirrors, constant unions | Anything with a dependency |
| `routes` | Path constants + nav config, typed route registry | Path strings duplicated anywhere else |
| `utils` | Pure helpers — dates, money, pagination, geo | React, framework imports |
| `api-client` | Framework-free HTTP primitive, error type, client factory, query-client factory | Any base URL or token — both are injected |
| `auth` | Auth SDK wiring as **factories**, browser/server split | Reading env; hardcoded cookie names |
| `toast` | Notification helpers over the toast lib | Direct calls to the underlying lib elsewhere in the repo |
| `query-kit` | Query-key factory + cache conventions | Domain knowledge |
| `theme` | The token engine + values (see §5) | Component code |
| `security-headers` | CSP + header builder, one function, options per app | Per-app hosts baked in as defaults |
| `domain` | Shared Zod schemas and types | Fetching |
| `domain-api` | Shared **service contracts** for entities several apps talk to (users, roles, orgs, permissions) + a DI holder for the configured client | Its own client instance |
| `auth-state` | Auth store, permission logic, route-permission map, guards. **Framework-auth-free** | Auth SDK imports (that's `auth`) |
| `ui` | Design-system primitives (`Button`, `Dialog`, `Input`…) + `cn` | Domain concepts |
| `ui-shared` | Composed widgets — data table, forms, modals, file picker, page header, state screens, skeletons — and their hooks | Entity knowledge |
| `components` | Shared **domain** components — user/role/org management, badges, dual-use views parameterised by config + scope | App-specific layout |
| `layouts-shared` | Nav tree, breadcrumbs, tab nav, locale middleware | App-specific nav data (that's `routes`) |
| `eslint-config` | `base` / `react` / `data-layer` flat configs | — |

### 4.2 The promotion test

Before moving code into a package, all four must hold:

1. **Two real consumers today.** Not "app B will need it."
2. **No app concerns inside.** If it reads `process.env` or an app alias, it is not portable — make
   the app pass those in.
3. **A name that isn't the first app's name.** If it can only be described as "the thing app A
   does", it belongs to app A.
4. **A stable surface.** If the second consumer needs a fork of the behaviour, you have one
   *pattern*, not one *component* — write it twice and revisit.

The reverse also applies: a package used by one app for six months is a mistake. Move it back.

### 4.3 Package anatomy

Packages ship **TypeScript source, no build step.** The consuming app transpiles them. This removes
an entire class of "did you rebuild the package?" problems, at the cost of one config line per app.

```jsonc
// packages/<name>/package.json
{
  "name": "@<scope>/<name>",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "lint": "eslint src --max-warnings 0",
    "test": "<runner> test",
    "typecheck": "tsc --noEmit"
  },
  "exports": {
    ".": "./src/index.ts",
    "./sub-module": "./src/sub-module.ts",
    "./*": "./src/*.ts"              // wildcard last; explicit entries win
  },
  "dependencies":     { "@<scope>/lower-tier": "workspace:*" },
  "peerDependencies": { "react": "^19", "next": "^16" },   // never bundle the framework
  "devDependencies":  { "@<scope>/eslint-config": "workspace:*" }
}
```

Rules that come with it:

- **Framework and React are `peerDependencies`**, always. A package that depends on them directly
  can produce a second copy of React at install time.
- **Explicit `exports` entries** define the public surface. Deep imports into internals should not
  resolve.
- **The app lists every consumed package** in its framework transpile config (Next:
  `transpilePackages: [...]`) *(substitution point: a bundler alias / `transpilePackages`
  equivalent)*.
- **Tests live next to the source** (`money.ts` + `money.test.ts`) and run through the root `test`
  task.

### 4.4 Dependency injection — the pattern that keeps packages pure

Every package that would otherwise need app configuration exposes a **factory** or a
**`configure*()`** call. The app wires it once at startup.

```ts
// packages/api-client — knows nothing about your app
export function createApiClient(opts: { baseUrl: string; timeoutMs: number; getToken(): Promise<string | undefined> }): ApiClient

// packages/auth — takes the SDK config in, never reads env
export function createFirebaseAuth(config: FirebaseOptions): { app, auth }

// packages/domain-api — holds the client the app hands it
export function configureDomainApi(client: ApiClient, opts?: { assetBaseUrl?: string }): void
```

```ts
// apps/<app>/src/lib/api/client.ts — the ONE place per app that reads env and wires everything
import { createApiClient } from "@<scope>/api-client";
import { configureDomainApi } from "@<scope>/domain-api";
import { BASE_URL, CDN_URL, REQUEST_TIMEOUT_MS } from "@/config/env";
import { auth } from "@/lib/firebase/client";

export const api = createApiClient({
  baseUrl: BASE_URL,
  timeoutMs: REQUEST_TIMEOUT_MS,
  getToken: async () => {
    await auth.authStateReady();            // don't fire the first request tokenless
    return (await auth.currentUser?.getIdToken()) ?? undefined;
  },
});

configureDomainApi(api, { assetBaseUrl: CDN_URL });
```

Same shape for toasts (`notify` injected into the query client), for analytics, for anything else
an app owns.

### 4.5 Migration facades (extracting a package from an existing app)

When you lift `src/components/ui/*` out of an app into `@<scope>/ui`, you do **not** rewrite
hundreds of import sites. Remap the alias in the app's `tsconfig.json` — more specific keys win, so
individual files can stay local:

```jsonc
"paths": {
  "@/components/ui/*":        ["../../packages/ui/src/*"],
  "@/components/shared/logo": ["./src/components/shared/logo.tsx"],  // stays app-local
  "@/components/shared/*":    ["../../packages/ui-shared/src/*"],
  "@/*":                      ["./src/*"]
}
```

Do the extraction in one commit, the import rewrite (if ever) in another. This is how you split a
single app into a monorepo without a two-week freeze.

---

## 5. The design system

### 5.1 Three layers, three files, one rule

> **The rule: the application never touches a hex.** Components speak only semantic tokens
> (`bg-primary`, `text-muted-foreground`, `border-border`, `bg-success-subtle`). Colour *values*
> live in exactly one file, so the whole product re-skins from one place.

```
packages/theme/src/
  contract.css     THE ENGINE  — publishes tokens as utilities, derives scales. NO colour values.
  base-theme.css   THE VALUES  — the palette + what each token means (light + dark).
  themes.css       THE PRESETS — optional alternate brand ramps (opt-in via [data-theme]).
```

| Layer | Contents | Who reads it |
| --- | --- | --- |
| **1 — Primitives** | Raw ramps `50→950`, named by **role** (`--brand-*`, `--neutral-*`, `--success-*`, `--accent-*`), never by hue | Nothing. Only layer 2. |
| **2 — Semantic** | What a value *means* in context (`--primary`, `--border`, `--ring`, `--muted-foreground`, `--success-subtle`) | Layer 3 only. Dark mode re-points **only** this layer. |
| **3 — Utilities** | `@theme inline` maps each token to a utility (`--color-primary` → `bg-primary`) | Every component |

Role-naming the primitives is what makes a rebrand one line. Hue-naming them (`--blue-500`) means
the rebrand touches every file that ever mentioned blue.

**Separate the knobs.** Keep the primary *action* colour, the *brand* colour, and any *accent*
colour as three independent tokens even when two are the same value today. The day marketing
changes the brand blue, you do not want the CTA to move with it.

**The contract must never diverge between apps.** Shared components compile against the utility
*names* in `contract.css`; if one app dropped a token, those components render unstyled with no
error. That is why the engine is a shared file, not a copy per app.

### 5.2 Per-app theming

Never fork the theme package. In the app's `globals.css`, after the imports, state only the delta —
later declarations win:

```css
@import "@<scope>/theme/contract.css";
@import "@<scope>/theme/base-theme.css";

/* PER-APP OVERRIDES — state only what differs */
:root { --brand-600: #0d9488; --ring: var(--brand-600); --radius: 0.5rem; }
.dark { --brand-500: #2dd4bf; }
```

### 5.3 The `@source` trap *(Tailwind-specific, substitution point)*

Tailwind v4 scans the app's own tree, **not** sibling workspace packages. Every package whose
components an app renders must be declared, or those components ship unstyled with no error:

```css
@source "../../../../packages/ui/src";
@source "../../../../packages/ui-shared/src";
@source "../../../../packages/components/src";
```

Add this to the app-creation checklist (§9.3). It is the second most common "why is this broken"
in a monorepo of this shape.

### 5.4 Enforcement

A shell gate, wired into CI and the root scripts, fails the build on a raw hex or an arbitrary
colour utility anywhere under `apps/*/src` or `packages/*/src`:

```bash
HEX_RE='#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b'
UTIL_RE='(bg|text|border|ring|fill|stroke|from|via|to|shadow|…)-\[(#|(rgb|hsl|oklch|color-mix)\()'
```

- **Exempt:** the theme package itself, and any `globals.css` (per-app override blocks legitimately
  pin values).
- **Escape hatches, each requiring a written justification on the line:**
  `ds-allow` (this line) and `ds-allow-file` (this file is colour *data*, e.g. a user-facing swatch
  picker).
- **The gate has a `--self-test` mode** with fixtures for every flagged and spared case. A gate
  nobody trusts gets disabled; a gate that proves itself gets kept.

---

## 6. The data layer (the most valuable standard in the repo)

This is the part to copy first and change last. Put it in its own `ARCHITECTURE.md` and make it
required reading.

### 6.1 Shape

```
endpoints.ts   URL strings — the ONLY file that knows backend paths
   ↓
types.ts       request/response DTOs
   ↓
index.ts       service object — thin wrappers over the app's api client, unwraps the envelope
   ↓
queries.ts     READS  — key factory + useQuery hooks
mutations.ts   WRITES — declarative commands (useMutation + meta)
   ↓
components     call hooks only; never api/fetch/invalidateQueries
```

Every backend domain lives at `src/services/<group>/<name>/` with exactly these files (plus an
optional `search-params.ts` for typed URL state). Group by bounded context —
`commerce/`, `operations/`, `workforce/`, `platform/` — not by page.

**Ship a `_template/` directory** with working boilerplate for all six files. `cp -r
src/services/_template src/services/<group>/<name>` is the entire scaffolding story; the template
*is* the standard, so it can't drift from the docs.

### 6.2 Command–Query Separation

**Reads** use one key factory so cache keys can never disagree:

```ts
export const xKeys = createCrudKeys<XFilters>("x");
// { all:["x"], lists:()→["x","list"], list:(f)→["x","list",f??{}],
//   details:()→["x","detail"], detail:(id)→["x","detail",id] }

export function useXList(f?: XFilters) {
  return useQuery({ queryKey: xKeys.list(f), queryFn: () => xService.list(f) });
}
```

**Writes are declarative commands.** A command states *what* it does; the infrastructure does it:

```ts
export function useCreateX() {
  return useMutation({
    mutationFn: (payload: CreateXPayload) => xService.create(payload),
    meta: { invalidates: [xKeys.lists()], successMessage: "X created" },
  });
}
```

Rules, all enforced:

- **No `useQueryClient`, `invalidateQueries`, or toast helpers inside a `mutations.ts`.**
- **Error toasts are automatic** for any command that declares `meta`. Opt out with
  `suppressErrorToast: true` when a form shows errors inline.
- **Success toast only when `successMessage` is set.** It may be a function of the response for
  server-supplied or translated messages.
- **Cross-domain invalidation is just more keys:** `invalidates: [stockKeys.all, xKeys.lists()]`.
- **`meta` is static** — it cannot see mutation variables. To invalidate an edited item, invalidate
  the `details()` *prefix*, which prefix-matches every `detail(id)`.
- **The variables shape is irrelevant.** `{ id, payload }`, a bare id, anything.
- **Exception:** a command needing a genuine non-invalidation side effect (seeding the cache, an
  auth-store write) keeps an `onSuccess` — but the *invalidation* still moves to `meta`.

### 6.3 The one central handler

```ts
// packages/api-client/src/query-client.ts
new MutationCache({
  onSuccess: (data, vars, _ctx, m) => {
    if (m.meta?.invalidates?.length)
      client.invalidateQueries({ predicate: q => m.meta.invalidates.some(k => matchQuery({ queryKey: k }, q)) });
    const msg = typeof m.meta?.successMessage === "function" ? m.meta.successMessage(data, vars) : m.meta?.successMessage;
    if (msg) notify?.success(msg);
  },
  onError: (err, _v, _c, m) => {
    if (isUnauthorized(err)) return onUnauthorized?.(client);       // session teardown, once
    if (m.meta && !m.meta.suppressErrorToast) notify?.error(err);
  },
})
```

`notify` and `onUnauthorized` are **injected per app**, so the package stays free of the toast
library and the auth implementation. Query defaults live here too: never retry 4xx, retry transient
failures twice, sane `staleTime`/`gcTime`, `refetchOnWindowFocus: false`.

**Type the `meta`.** Augment the query library's meta registry so a typo or a wrong key type fails
`tsc`. A declarative convention that isn't typed is a convention that silently stops working.

### 6.4 The HTTP contract

Decide these once, write them down, never revisit per endpoint:

- **Envelope-driven, not status-driven.** If the backend wraps responses (`{ success, data,
  message }`), success is read from the body. A `200` with `success: false` is an error, and the
  backend's `message` flows straight to the toast.
- **One error type** (`ApiError`) with a guaranteed usable `.message` and a `status`. Nothing else
  is ever thrown by the layer.
- **Browser client** attaches a fresh bearer token, `credentials: "omit"`. No same-origin cookies
  for the API — the cookie is for navigation only (§7).
- **Server client** (`serverFetch`) resolves the token from the session cookie, defaults to
  no-store, returns unwrapped data, and is marked server-only.
- **Downloads** go through a shared authenticated blob downloader, not a bare `<a href>`.

### 6.5 The gates

In `packages/eslint-config/data-layer.js`, spread into every app's config (and into shared packages
that define services):

```js
// commands are declarative
{ files: ["**/mutations.ts"], ignores: ["**/auth/mutations.ts"], rules: {
    "no-restricted-syntax":  [error, { selector: "CallExpression[callee.property.name='invalidateQueries']", message: "Use meta.invalidates — see ARCHITECTURE.md" }],
    "no-restricted-imports": [error, { paths: [{ name: "@<scope>/toast", importNames: ["showSuccess","showApiError"], message: "Use meta.successMessage + the central error toast" }] }],
}}
// components never touch the HTTP client
{ files: ["**/*.tsx"], ignores: ["**/services/**"], rules: {
    "no-restricted-imports": [error, { paths: [{ name: "@/lib/api", importNames: ["api"], message: "Components call query/mutation hooks" }] }],
}}
```

Document the exceptions **in the rule itself** (auth session lifecycle is not a CRUD command), so
the next person doesn't have to guess whether the exemption was deliberate.

---

## 7. Auth and access control

### 7.1 Two layers, two credentials

| Layer | Credential | Used for | Never used for |
| --- | --- | --- | --- |
| **Navigation** | httpOnly signed session cookie, verified at the edge | Deciding what page to serve/redirect | Authorising API calls |
| **API** | Fresh bearer token from the auth SDK | Every backend request | Persisting in JS state |

Tokens are **never** stored in a store or localStorage. The auth store holds the user *profile*,
not credentials.

**Per-app sessions:** each app gets its **own cookie name** but **shared signature secrets** — so
sessions are independent per app while remaining mutually verifiable. Sign-in to the admin app does
not silently authenticate the customer app.

### 7.2 The edge pipeline

The app's middleware/proxy file is a **thin orchestrator (~15 lines)**; every concern is a separate,
testable module, and the orchestration itself is shared:

```ts
export default createProxy({ localeMiddleware, authPipeline });
export const config = { matcher: [/* auth routes + everything except static assets */] };
```

1. **Locale step** — add the `/<locale>` prefix by redirect if missing; short-circuit API paths.
2. **Auth step** — verify the session cookie, then route by role (wrong-audience users bounce to
   their home, signed-in users on auth pages bounce forward, unauthenticated users on protected
   paths go to sign-in).

Constants the pipeline depends on (supported locales, public paths, role homes) live in **one**
constants module.

**Degrade, don't hard-fail, when auth env is absent.** With no credentials configured the auth step
becomes a warning-and-continue no-op, so a new developer can boot the app before secrets are wired.
Document that this is deliberate so nobody "fixes" it.

### 7.3 RBAC model

- Grants are encoded as `"RESOURCE:ACTION"` strings in a `Set`, so a check is two `Set.has()` calls
  — one exact, one for the `MANAGE` wildcard.
- The set is memoised from the profile; the store keeps the raw array (a `Set` doesn't survive
  JSON persistence).
- A **route → permission map** in the shared state package, keyed by paths taken *from the route
  registry* (never hand-written strings), with `*` matching one dynamic segment and the most
  specific rule winning.

> **Every write route needs its own rule.** A `/new` or `/:id/edit` route with no entry inherits its
> section's rule, which is only ever READ — so hiding the button stops nobody who types the URL.
> They get the full, working form. This is the single most common real vulnerability-shaped bug in
> this architecture. Add a test per module asserting a read-only user is *refused* the edit route,
> and that a sibling module's grant doesn't unlock it.

Three gate layers, in order of importance:

1. **Route rules** — the one that matters.
2. **Component gates** — every create button, row action, bulk action, sheet link, modal trigger,
   status toggle and inline editor. Use a declarative `<PermissionGate>` when it's pure visibility;
   use the hook when the answer changes *structure* (drop an overflow menu entirely rather than
   opening an empty popover; disable row-click navigation to a page they can't open).
3. **In-place access state** — mounted *inside* the app shell so a refusal keeps the nav, header and
   URL intact. A guard wrapping the shell can only blank the whole chrome, which is worse than the
   redirect it replaced.

Keep the session guard (is there a session?) and the permission guard (may they see this?)
**separate**. Merging them is how permission logic ends up running before the profile has loaded.

---

## 8. Security headers

One shared builder, options per app — because a CSP maintained per app diverges within a month:

```ts
buildSecurityHeaders({ apiOrigin, stripe: false, maps: true, extraImgHosts: [...], isDev, reportOnly })
```

- **Pass the API *origin*, never the full base URL with its path** — a typo here blocks every
  backend call.
- Keep image hosts **in step with the framework's image config**: the optimiser proxies through
  same-origin, so a host missing from the CSP but present in the image config fails only for raw
  `<img>` tags — which is exactly how file-picker previews break while cards keep working.
- Ship a `CSP_REPORT_ONLY` env flag so a new directive can be rolled out in report mode first.

---

## 9. App anatomy

### 9.1 Inside an app

```
apps/<app>/src/
├── app/                    # routes
│   ├── [locale]/           # locale segment validates + mounts the i18n provider
│   │   ├── (marketing)/    # route groups = one auth/layout posture each
│   │   ├── (auth)/
│   │   ├── (dashboard)/
│   │   └── (onboarding)/
│   ├── api/                # first-party routes only (login/logout) — never locale-prefixed
│   ├── globals.css         # theme imports + @source lines + per-app overrides
│   └── layout.tsx          # <html>/<body> + cross-cutting providers
├── components/
│   ├── domains/            # entity forms shared across route groups (onboarding + dashboard)
│   ├── guards/             # session guard, route access guard
│   ├── layout/ layouts/    # app shells
│   └── providers/          # query, theme, app providers
├── config/                 # env.ts (the ONLY env reader), site.ts, query-client.ts
├── hooks/ stores/ types/   # app-local; stores are flat and client-state only
├── lib/
│   ├── api/                # the DI wiring point (§4.4)
│   ├── middleware/         # locale + auth pipeline steps and their constants
│   └── <domain helpers>
├── services/               # the data layer (§6), grouped by bounded context
│   └── _template/          # the scaffold
└── proxy.ts                # thin orchestrator
```

**Route groups are auth/layout postures**, not features: public marketing, auth screens, the
authenticated shell, onboarding. Each has one layout and one guard posture, and every page inside
inherits it without thinking about it.

**Metadata comes from the route registry**, not hand-written per page:
`export const metadata = ROUTE_METADATA.PUBLIC.LOGIN;`

**`config/env.ts` is the only file in an app that reads `process.env`.** Everything else imports
named constants from it. This makes the "which variables does this app need" question answerable by
opening one file — and it is what keeps packages pure.

### 9.2 Module UX baseline

Feature modules drift visually unless "done" is written down. Define it once, apply it to every
module, and keep a status table of which modules have been brought up to standard. The baseline
that works:

- **A module means *every* surface it owns** — list, detail, create, edit, sheets, modals, wizard
  steps, sub-resource tabs, and the module's form (which usually lives in `components/domains/`,
  outside the module folder — the grep everyone runs misses it).
- **Six state screens, one frame:** empty · no-results · error · not-found · offline · no-access.
  **Empty and no-results are different states** — showing "nothing here yet" while a filter is
  active reads as data loss. Retry only where retrying can help. A `compact` variant for anything
  inside a dialog, sheet or picker.
- **Skeletons behind a `LoadingGate`, never spinners.** The gate owns *only* the pending state
  (error/empty live inside it), gates on `isPending` not `isFetching` (a background refetch must
  not tear the page down), takes an array for multi-query views (nested gates give a staggered
  reveal, which is worse than none), and enforces a minimum display floor so fast responses don't
  flash. An edit page gets a form skeleton — a centred spinner there merely *looks* deliberate.
- **One page-header component** that owns the title, actions and the toolbar slot. A toolbar
  rendered as a sibling gets whatever spacing the page happens to have, which is how every module
  ends up with a slightly different masthead.
- **Search inline, everything else behind one filter popover** — staged in a draft and committed on
  Apply (a number input wired to the URL fires a request per keystroke), re-seeded on open, with an
  `EMPTY_*` constant for Clear, and an **active-filter count on the trigger**. Once controls are
  collapsed, that badge is the only thing telling someone the list is narrowed. Sort is not a
  filter — exclude it from the count or people learn to distrust the number.
- **Table pagination sits inside the card, on its bottom edge**, which needs an unbroken
  `flex flex-1 flex-col` chain from the page root.
- **Every form wrapped in a required-fields provider** that derives asterisks from the Zod schema,
  so they cannot drift from what the backend rejects. Modals are missed most often and need it
  most, since their submit button lives outside the `<form>`.

Write this as a `MODULE-CHECKLIST.md` per app with a **Status** section (done / remaining, with
counts). It converts "the UI feels inconsistent" into a finite, assignable list.

### 9.3 Adding an app — the checklist

1. `apps/<app>/` with `package.json` (name, port, guard, scripts), framework config, `tsconfig.json`
   (`@/*` alias), lint config.
2. Framework config: standalone output, **file-tracing root pointed at the repo root** (otherwise
   the standalone bundle omits every workspace package), the transpile list, image hosts, and
   `buildSecurityHeaders(...)`.
3. `globals.css`: theme imports + **`@source` for every package it renders** + an empty per-app
   override block.
4. `config/env.ts`, `lib/api/` DI wiring, providers, `proxy.ts` + middleware steps.
5. `services/_template/` copied in.
6. Assign the port everywhere: dev script, `EXPOSE`, compose mapping, health check.
7. Add its variables to `turbo.json` `globalEnv`; add its cookie name.
8. `Dockerfile` (copy a sibling's, swap name + port), CI build-matrix entry, per-env domain entry,
   compose service.
9. `apps/<app>/README.md`: topology, where to add features, outstanding dependencies.

### 9.4 Adding a domain — the checklist

1. `cp -r src/services/_template src/services/<group>/<name>`.
2. Fill `endpoints.ts` → `types.ts` → `index.ts` → `queries.ts` → `mutations.ts`
   (+ `search-params.ts` if the list page has URL state).
3. Add route entries to the registry, and **a permission rule for every write route**.
4. Build the UI against the module baseline (§9.2).
5. Run the gates.

---

## 10. Quality gates

Four commands, all green in CI on every change, plus a per-app build:

```bash
<mgr> run typecheck     # per app: framework typegen && tsc --noEmit
<mgr> run lint          # eslint --max-warnings 0   (warnings are errors; there is no middle state)
<mgr> run test          # unit tests in packages
<mgr> run check:ds      # design-system gate
```

The shared lint configs are themselves a package with three entry points:

| Entry | For | Contents |
| --- | --- | --- |
| `base` | framework-free packages | JS + TS recommended, comment rules, `_`-prefix unused convention, `reportUnusedDisableDirectives: "error"` |
| `react` | packages with components | base + hooks rules, `exhaustive-deps` as **error** |
| `data-layer` | apps + service-defining packages | the §6.5 rules |

Two small rules with outsized value:

- **`require-description` on eslint-disable comments.** Every suppression must say why.
- **`ban-ts-comment` allowing `@ts-expect-error` only with a description.**

CI stages: **quality → build (matrix over apps) → deploy → notify.**

---

## 11. Build and deploy

**Per-app Docker image, built from a pruned monorepo.** The task runner's prune command emits a
sparse repo containing just that app, its workspace dependencies, and a pruned lockfile — so another
app's dependency bump doesn't bust this image's install cache.

```dockerfile
FROM ${BUN_IMAGE} AS pruner
COPY . . && RUN bunx turbo prune <app> --docker

FROM base AS installer
COPY --from=pruner /app/out/json/ ./          # manifests only → cached layer
RUN <mgr> install --frozen-lockfile

FROM ${NODE_IMAGE} AS builder
COPY --from=installer /app/ ./
COPY --from=pruner /app/out/full/ ./
ARG NEXT_PUBLIC_…                              # public vars are BUILD-time, inlined into the bundle
RUN cd apps/<app> && next build

FROM ${NODE_IMAGE} AS runner
COPY --from=builder …/.next/standalone ./      # non-root user, EXPOSE <port>, healthcheck
CMD ["node", "apps/<app>/server.js"]
```

Points that are easy to get wrong:

- **Public/inlined env vars are build args; server secrets stay runtime.** They are baked into the
  bundle, so a per-environment image is unavoidable.
- **Parametrise the base images** (`ARG BUN_IMAGE`, `ARG NODE_IMAGE`) so CI can pull from a registry
  mirror when the build daemon can't reach the public CDN.
- **Install and build may need different runtimes.** Native build plugins can fail under an
  alternative runtime — install with one, build with the other, and say so in a comment.
- **File-tracing root = repo root**, or the standalone output silently omits workspace packages.
- **Explicitly include** anything loaded by dynamic import at runtime (i18n message JSON is the
  classic) — tracers miss it.

**Deploy:** one compose file with one service per app, each mapped to a distinct loopback host port
behind the host's reverse proxy, each with a health check, all sharing a runtime env file. Branch →
environment mapping (`main` → production, `staging`, `development`), and one subdomain per app per
environment.

---

## 12. Documentation set

Four files, four jobs. More than this and none of them get read.

| File | Answers | Audience |
| --- | --- | --- |
| `README.md` | What exists, how to run it, what each package is for, where it deploys | Everyone, day one |
| `ARCHITECTURE.md` | The data-layer standard and its gates | Anyone touching a service |
| `BLUEPRINT.md` (this) | Why the repo is shaped this way; how to reproduce it | Whoever builds the next one |
| `apps/<app>/README.md` + `CLAUDE.md`/`AGENTS.md` | Per-app topology, the non-obvious parts, per-app commands | Someone working in that app (human or agent) |

Plus `MODULE-CHECKLIST.md` per app while modules are being standardised.

**Write the *why* next to the rule.** Every convention in this repo that survived did so because
the comment explaining it was in the file being edited. "Most of the rules below exist because we
got them wrong once already" is the most useful sentence in the checklist.

---

## 13. Bootstrapping order

Building this from zero in the wrong order costs weeks. This order works because each phase is
usable on its own.

| Phase | Deliverable | Done when |
| --- | --- | --- |
| **0 — Skeleton** | Workspaces, task runner, manager guard, TS base, root scripts, `eslint-config` package | `<mgr> install` + `lint` pass on an empty repo |
| **1 — First app, alone** | One app, no shared packages. Route groups, env module, providers | It runs and renders a page |
| **2 — The contract layer** | `enums`, `utils`, `routes`, `api-client`, `query-kit`, `toast`. The HTTP contract and the query-client factory | The first app fetches through the shared client |
| **3 — Data-layer standard** | `_template/`, `ARCHITECTURE.md`, the `data-layer` lint rules, one real domain end-to-end | A violation fails `lint` |
| **4 — Design system** | `theme` package (3 layers), the `check:ds` gate + self-test, `ui` primitives | The gate is green and the self-test passes |
| **5 — Auth** | `auth` (factories), `auth-state` (store, permissions, route map, guards), the proxy pipeline, per-app cookie names | Sign-in, role routing, and a refused route all work |
| **6 — Second app** | Follow §9.3. **This is the phase that proves the packages.** Anything that fights you here is app-coupling to fix now | Second app runs on the shared layer |
| **7 — Composition layers** | `ui-shared`, `components`, `layouts-shared` — populated by what phase 6 revealed as genuinely shared | Both apps render the same widgets |
| **8 — Ship** | `security-headers`, Dockerfiles, CI matrix, compose, per-env domains | A branch push deploys every app |
| **9 — Standardise** | Module UX baseline + checklist, permission rules for every write route, tests on the permission map | The checklist's Status section is empty |

Phases 1–5 on one app, then phase 6, is deliberate: **the second app is the only real test of the
package boundary.** Do not build three apps in parallel before the shared layer exists — you will
get three subtly different HTTP layers and no way to merge them.

---

## 14. Traps

Collected from things that actually cost time here. Each is cheap to avoid and expensive to
diagnose.

- **A missing `globalEnv` entry** — the variable is `undefined` in the build with no error.
- **A missing `@source`** — package components render completely unstyled with no error.
- **Missing file-tracing root** — the container starts and 500s on the first package import.
- **A write route with no permission rule** — the form is reachable by URL with read-only access.
- **`meta` reading mutation variables** — it can't; invalidate the `details()` prefix instead.
- **Gating a loading state on `isFetching`** — the page tears down to a skeleton on every background
  refetch.
- **Empty state shown for a filtered result** — reads as data loss to the user.
- **A stale framework type cache after a route restructure** — `tsc` fails on deleted pages;
  clearing the build dir is the fix, not a code change.
- **Trusting a cached green gate.** After an edit, force the verification run — a `FULL TURBO` result
  may never have looked at your file.
- **CRLF repos and scripted edits.** Node `replace()` with `\n` patterns matches nothing. Use
  `\r?\n` and verify the result rather than trusting "done".
- **Compiler-level React lint rules** (setState synchronously in an effect, reading a ref during
  render) are **build failures**, not warnings.
- **Removing an empty-state CTA orphans imports** — expect lint to catch a handful every time.
- **Batch your verification.** Run typecheck/lint/test/ds once at the end of a change set, not after
  each edit.

---

## 15. When *not* to use this shape

Be honest about the cost. This structure pays for itself when:

- there are **≥2 audiences** with genuinely different auth boundaries or release cadences, **and**
- they share substantial domain surface (entities, permissions, design language), **and**
- more than one or two people work on it.

It does **not** pay for a single app with a marketing page, for two apps that share nothing but a
logo, or for a prototype whose shape is still unknown. In those cases: one app, one `src/`, and this
document kept on file for the day the second audience appears.
