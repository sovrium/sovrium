/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The single lazy boundary between the server and the Better Auth package.
 *
 * ## Why this module exists
 *
 * Importing `better-auth` costs ~356 ms of a ~730 ms cold boot, and roughly
 * three apps in four declare no `auth:` block at all — yet every server used to
 * pay for it, because six modules on the static boot graph named the package
 * directly:
 *
 *   - `server.ts`            → `createAuthInstance`, `rekeyUnreadableJwks`
 *   - `route-setup/api-routes.ts`     → `createAuthInstance`
 *   - `route-setup/openapi-routes.ts` → `createAuthInstance`
 *   - `route-setup/auth-routes.ts`    → the `@better-auth/oauth-provider` metadata handlers
 *   - `route-setup/mcp/auth.ts`       → `createMcpProtectedRequestHandler`
 *
 * Each of those is now an `import type` (erased at transpile) plus a value that
 * arrives as a PARAMETER. This module is the one place that still names the
 * package as a value, and `createHonoApp` loads it with a single
 * `await import(...)` guarded by `app.auth`.
 *
 * ## The contract
 *
 * Load this at BOOT, never at first request: `createHonoApp` awaits it while
 * building routes, so an auth-enabled app has the whole graph resident before
 * the listener binds and no request pays an import. A no-auth app never touches
 * it, and `NoAuthLayer` (`./auth-service`) covers the `Auth` tag instead.
 *
 * Nothing here may be imported STATICALLY from outside
 * `src/infrastructure/auth/better-auth/` — that would restore exactly the eager
 * edge this removes. The laziness invariant is pinned by the probe test in
 * `src/infrastructure/layers/app-layer.test.ts`.
 */

import type { createAuthInstance as CreateAuthInstance } from './auth'
import type { rekeyUnreadableJwks as RekeyUnreadableJwks } from './jwks-rekey'
import type { createMcpProtectedRequestHandler as CreateMcpProtectedRequestHandler } from '@better-auth/mcp'
import type {
  oauthProviderAuthServerMetadata as OauthProviderAuthServerMetadata,
  oauthProviderOpenIdConfigMetadata as OauthProviderOpenIdConfigMetadata,
} from '@better-auth/oauth-provider'

export {
  oauthProviderAuthServerMetadata,
  oauthProviderOpenIdConfigMetadata,
} from '@better-auth/oauth-provider'
export { createMcpProtectedRequestHandler } from '@better-auth/mcp'
export { createAuthInstance } from './auth'
export { rekeyUnreadableJwks } from './jwks-rekey'

/**
 * The shape a caller receives from `await import('./server-runtime')`.
 *
 * Spelled out rather than written as `typeof import('./server-runtime')`:
 * `@typescript-eslint/consistent-type-imports` forbids `import()` type
 * annotations. Each member is typed as `typeof` its type-only import above, so
 * the signatures still track upstream and only the NAMES are duplicated — a
 * missing export here is a type error at the passing call site.
 *
 * `readonly` throughout because this is passed as a parameter and
 * `functional/prefer-immutable-types` requires at least `ReadonlyShallow`; a
 * raw module namespace object reads as `Mutable`.
 */
export interface AuthRuntime {
  readonly oauthProviderAuthServerMetadata: typeof OauthProviderAuthServerMetadata
  readonly oauthProviderOpenIdConfigMetadata: typeof OauthProviderOpenIdConfigMetadata
  readonly createMcpProtectedRequestHandler: typeof CreateMcpProtectedRequestHandler
  readonly createAuthInstance: typeof CreateAuthInstance
  readonly rekeyUnreadableJwks: typeof RekeyUnreadableJwks
}
