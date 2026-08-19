# 🏛️ Core Architecture & Development Standards

This repository strictly enforces 5 foundational development contracts. All code generation, feature additions, and refactoring MUST comply with these files:

1. [UMDA Protocol](./UMDA-architecture-contract.md) -> Domain/Feature split, JSDocs, readable naming, Carding/PSP fraud security.
2. [State Management Protocol](./state-management-contract.md) -> TanStack Query vs Zustand, atomic selectors, SSR hydration.
3. [shadcn UI Contract](./shadcn-component-contract.md) -> Semantic tokens, native variants, zero color scale hardcoding.
4. [Layout & Styling Contract](./layout-and-styling-contract.md) -> Flex/Grid gap supremacy, zero physical margins, RTL safety.
5. [Monorepo Workspace Contract](./monorepo-workspace-contract.md) -> Turborepo structure, Cloudflare Wrangler configuration, dependency isolation.
6. **`form-and-validation-contract.md`** -> React Hook Form + Zod + shadcn form components, explicit `defaultValues`, zero uncontrolled input warnings.

---
### Quick Task Prompt Template
When prompting AI for a task, reference this file:
"Follow the standards in `ARCHITECTURE.md` to implement [Task Name]."