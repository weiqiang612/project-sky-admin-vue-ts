# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Sky Takeout Admin (苍穹外卖后台管理系统) — Vue 2 + TypeScript admin dashboard for restaurant/food delivery management. Built with Vue CLI 3, Element UI, and ECharts.

## Key Commands

```bash
# Development
npm run serve              # Start dev server at 0.0.0.0:8888, hot-reload enabled

# Build
npm run build              # Production build
npm run build:uat          # UAT/Staging build

# Testing
npm run test:unit          # Jest unit tests
npm run test:e2e           # Cypress e2e tests

# Lint & Tools
npm run lint               # ESLint
npm run svg                # Regenerate SVG icon components from src/icons/svg/
```

## Architecture

### Tech Stack
- **Vue 2** with TypeScript (class-component syntax via `vue-class-component` + `vue-property-decorators`)
- **Element UI** 2.x as the UI library
- **Vuex** with `vuex-module-decorators` for state management
- **Vue Router** for routing
- **Axios** for HTTP (wrapped in `src/utils/request.ts` with interceptors)
- **ECharts** for charts/dashboards
- **SCSS** for styling (global vars in `src/styles/_variables.scss`, mixins in `src/styles/_mixins.scss`)

### Directory Structure
- `src/api/` — API client modules (one file per domain: `dish.ts`, `order.ts`, `employee.ts`, etc.)
- `src/views/` — Page components, organized by domain feature
- `src/components/` — Shared/reusable Vue components
- `src/store/modules/` — Vuex modules (app, user, chat)
- `src/layout/` — App layout including sidebar, navbar, and main content shell
- `src/icons/svg/` — Raw SVG files; run `npm run svg` to regenerate TypeScript icon components
- `src/utils/` — Utilities: `request.ts` (axios instance), `validate.ts`, `cookies.ts`, `formValidate.ts`
- `src/styles/` — Global SCSS, Element UI theme overrides
- `src/router.ts` — Route definitions with lazy loading
- `src/permission.ts` — Navigation guards (auth check, role-based routing)
- `tests/unit/` — Jest unit tests

### Key Patterns
- **API layer**: Each domain module in `src/api/` exports typed functions that call an axios instance configured in `src/utils/request.ts`. The instance handles token injection, response unwrapping, and error handling via interceptors.
- **Vuex modules**: Use class-based decorators (`@Module`, `@Mutation`, `@Action`). State includes app UI state, user auth/profile, and chat.
- **Routing**: Routes defined in a single `src/router.ts` with `beforeEach` guard in `src/permission.ts` that checks auth token and user roles.
- **Styling**: SCSS with BEM-like conventions. Element UI variables overridden in `src/styles/element-variables.scss`.
- **Code style**: No semicolons, single quotes, 2-space indentation. Prettier config in `.prettierrc.json`.

### Environment Variables
- `VUE_APP_URL` — Backend API base URL (used by dev proxy)
- `VUE_APP_BASE_API` — API base path prefix
- Configuration at `src/config.json`: `{ "baseUrl": "/api" }`