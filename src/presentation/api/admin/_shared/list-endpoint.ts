/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `createAdminListEndpoint` — canonical list-endpoint helper for `/api/admin/*`.
 *
 * **Authored by `US-ADMIN-AUTOMATIONS-RUNS-LIST` (story #3 of seven Phase-0
 * read-API stories) per the plan §3.1.** Locks ADR-012 D9 — every subsequent
 * admin list endpoint (`forms`, `buckets`, `forms/:name/submissions`, etc.)
 * MUST consume this helper rather than hand-wiring its own
 * `requireAdminRole` + `requireRuntime` + audit-emit + cursor wrapping.
 *
 * The helper composes five primitives into a single callable:
 *
 *   1. `requireAdminRole(minRole)` — anti-enumeration RBAC gate (404 over 403)
 *   2. `requireRuntime(runtimes)`  — optional 501 gate for Postgres-only paths
 *   3. `zValidator('query', filterSchema)` — query-param parsing + 400s
 *   4. `auditEmit(auditAction)`    — single emit per cold-start call
 *   5. cursor envelope wrap        — `{ items, nextCursor }` shape on success
 *
 * The `load` callback is the **only** domain-specific seam: it receives the
 * parsed filter object and must return `{ items, nextCursor }`. The helper
 * does NOT auto-populate the `_admin` envelope — that is the loader's
 * responsibility (separation of concerns: the loader knows how to count
 * audit-trail entries per row; the helper knows how to gate, validate, and
 * emit).
 *
 * **Why a helper, not a base class?** Sovrium's API layer is strictly
 * functional (`feat:eslint-plugin-functional`). Class hierarchies are
 * forbidden; a factory function returning the runtime handler keeps the
 * call site declarative.
 *
 * **API additivity guarantee** (locked across stories #3-#7): new optional
 * fields may be added to `AdminListEndpointConfig` between story landings.
 * Existing fields' shapes are frozen by this story. If story #4 needs a
 * config field this helper does not expose, the answer is to add an
 * **optional** field — never a breaking change to a required one.
 *
 * @see ADR-012 D9 — canonical helper; do not hand-wire admin list endpoints
 * @see plan §3.2 — API contract sketch
 * @see plan §3.5 — additivity policy across Phase-0
 */

import { Effect } from 'effect'
import {
  requireAdminRole,
  type AdminRole,
  type ContextWithAdminRole,
} from '@/presentation/api/middleware/admin-rbac'
import { requireRuntime, type SovriumRuntime } from '@/presentation/api/openapi/runtimes'
import type { AuditAction } from '@/domain/models/api/admin/audit-log/action-catalog'
import type { z } from '@hono/zod-openapi'
import type { Context, MiddlewareHandler } from 'hono'

/**
 * Effect-typed loader output: a page of items ready for the cursor envelope.
 *
 * `items` is read-only (the helper does not mutate it). `nextCursor: null`
 * signals stream end; the helper returns it verbatim in the response body.
 */
export interface AdminListLoadResult<I> {
  readonly items: ReadonlyArray<I>
  readonly nextCursor: string | null
}

/**
 * Tagged failure paths the loader may surface to the helper.
 *
 * The helper maps these to HTTP responses (400 for invalid filter, 500 for
 * unknown failure). Loaders should use Effect's tagged errors so the helper
 * can pattern-match without inspecting strings — see `Data.TaggedError`
 * pattern in @docs/infrastructure/framework/effect.md.
 */
export interface AdminListLoaderFailure {
  readonly _tag: 'AdminListLoaderError'
  readonly code: 'BAD_REQUEST' | 'INTERNAL_ERROR'
  readonly message: string
}

/**
 * Configuration accepted by `createAdminListEndpoint`.
 *
 * Generic over the filter query schema `Q` (must extend cursor pagination)
 * and the response item schema `I` (the admin item shape, e.g. an
 * automation run with `_admin` envelope already extended).
 *
 * Field-level rationale:
 *
 * - `path`         — the Hono mount path (placeholders use `:name` syntax,
 *                    converted to `{name}` for OpenAPI by the OpenAPI helper).
 * - `tags`         — OpenAPI grouping (e.g. `['admin', 'automations']`).
 * - `filterSchema` — Zod schema validated against `?cursor`, `?limit`, plus
 *                    the per-domain filters. MUST extend `cursorPaginationQuerySchema`
 *                    (compile-time check via Zod's `.merge()` requirement).
 * - `itemSchema`   — single-item Zod schema. The helper wraps it in
 *                    `cursorPaginationResponseSchema(itemSchema)` for the
 *                    OpenAPI document and the runtime response validator.
 * - `minRole`      — minimum admin tier accepted (default `['auditor']`).
 *                    Auditor-default matches plan §6.7 RBAC default.
 * - `runtimes`     — optional Postgres-only / SQLite-only gate. Mounts
 *                    `requireRuntime(...)` middleware ahead of the handler.
 * - `auditAction`  — must be a member of `AUDIT_ACTIONS` (compile-time check
 *                    via `AuditAction` literal union). Emitted exactly once
 *                    per cold-start call (NOT once per cursor continuation —
 *                    the audit-log keystone's pagination de-dupe rule).
 * - `load`         — the only domain-specific seam. Receives the parsed
 *                    filter, the resolved admin role, and the Hono context.
 *                    Returns an Effect program; the helper handles
 *                    `Effect.runPromise` and result conversion to HTTP.
 *
 * **Type-flow constraint** (read carefully): both `Q` and `I` are Zod schema
 * type variables. The helper's load callback receives `z.infer<Q>` (NOT
 * `z.input<Q>`) because the schema's defaults are applied before the loader
 * runs. This avoids the Story-#1 cache regression where a transitive
 * `z.input` made consumers see optional-typed fields.
 */
export interface AdminListEndpointConfig<Q extends z.ZodTypeAny, I extends z.ZodTypeAny> {
  readonly path: string
  readonly tags: ReadonlyArray<string>
  readonly filterSchema: Q
  readonly itemSchema: I
  readonly minRole?: ReadonlyArray<AdminRole>
  readonly runtimes?: ReadonlyArray<SovriumRuntime>
  readonly auditAction: AuditAction
  /**
   * Override the canonical `resource.type` recorded in audit-log emits.
   *
   * `deriveResourceType()` (below) handles the common 4-segment shape
   * (`<domain>.<resource>s.<verb>.queried`) automatically — e.g.
   * `automation.runs.list.queried` → `automation.run`. For 3-segment
   * single-domain codes (`form.list.queried`, `bucket.list.queried`,
   * `automation.overview.queried`), the heuristic cannot distinguish the
   * verb from the resource, so consumers must pass `resourceType` explicitly:
   *
   *     resourceType: 'form'        // for form.list.queried, form.detail.queried
   *     resourceType: 'bucket'      // for bucket.list.queried, bucket.overview.queried
   *     resourceType: 'automation'  // for automation.overview.queried
   *
   * When set, the helper uses this verbatim and skips the heuristic. When
   * unset, the helper falls back to `deriveResourceType(auditAction)`.
   */
  readonly resourceType?: string
  readonly load: (
    filters: z.infer<Q>,
    role: AdminRole,
    ctx: ContextWithAdminRole
  ) => Effect.Effect<AdminListLoadResult<z.infer<I>>, AdminListLoaderFailure>
}

/**
 * Result of `createAdminListEndpoint`: a runtime Hono handler with all
 * cross-cutting concerns pre-composed.
 *
 * The caller registers it on a Hono app instance. The handler is async
 * (Hono's runtime contract); it returns a `Response` directly — never
 * throws on expected failure paths (filter validation, RBAC, runtime
 * mismatch); only unexpected exceptions propagate up to Hono's error
 * boundary.
 *
 * Two helper artifacts are returned:
 *
 * - `middleware` — the composed RBAC+runtime middleware chain. Use this
 *   when mounting on the OpenAPI Hono app (`app.use(path, ...middleware)`)
 *   while keeping the handler separate.
 * - `handler`    — the runtime callback. Mounts via `app.get(path, handler)`
 *   on a Hono instance that has already had `middleware` applied.
 */
export interface AdminListEndpoint {
  readonly middleware: ReadonlyArray<MiddlewareHandler>
  readonly handler: (ctx: Context) => Promise<Response>
}

/**
 * Default RBAC tier accepted by every Phase-0 admin list endpoint.
 *
 * `auditor` is the read-only minimum per plan §6.7; admin and operator are
 * implied via `ADMIN_ROLE_HIERARCHY`. Endpoints that need a stricter floor
 * (admin-only mutations) override `minRole` explicitly — list endpoints
 * never do, since list = read.
 */
const DEFAULT_MIN_ROLE: ReadonlyArray<AdminRole> = ['auditor']

/**
 * Extracted for unit-test seam: parses query params, returns either a
 * validated filter object or a 400 response. Declared as a top-level helper
 * so the test suite can exercise it without spinning up a Hono server.
 *
 * @internal
 */
export function parseFilterQuery<Q extends z.ZodTypeAny>(
  filterSchema: Q,
  rawQuery: Record<string, string | undefined>
):
  | { readonly success: true; readonly data: z.infer<Q> }
  | { readonly success: false; readonly issues: ReadonlyArray<string> } {
  const parsed = filterSchema.safeParse(rawQuery)
  if (parsed.success) {
    return { success: true, data: parsed.data as z.infer<Q> }
  }
  // Surface every issue as a flat string so the caller can return a 400
  // body without leaking the full Zod issue tree.
  const issues = parsed.error.issues.map((issue) => {
    const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : ''
    return `${path}${issue.message}`
  })
  return { success: false, issues }
}

/**
 * Audit emit dependency injected into the helper.
 *
 * Real production wiring resolves to the Effect-layer audit-log writer; tests
 * substitute a spy that records calls without touching the database. Passing
 * this as a parameter (NOT importing the writer at module scope) avoids the
 * `mock.module()` contamination problem documented in
 * `feedback_mock_module_contamination` — the helper unit tests inject a
 * plain function and assert call sequences.
 */
export interface AdminAuditEmitter {
  readonly emit: (params: {
    readonly action: AuditAction
    readonly role: AdminRole
    readonly actorId: string | null
    readonly resourceType: string
    readonly metadata?: Record<string, unknown>
  }) => Effect.Effect<void, never>
}

/**
 * Build a Hono runtime handler + middleware chain for an admin list endpoint.
 *
 * @param config — declarative endpoint definition (see `AdminListEndpointConfig`).
 * @param emitter — audit-log writer (injected for testability; see
 *   `AdminAuditEmitter`). Consumers in production pass the live writer wired
 *   via Effect's audit-log layer; unit tests pass a spy. NEVER mock the
 *   writer module via `mock.module()` — the function-parameter pattern is
 *   the only sanctioned approach.
 *
 * Returns the composed middleware chain plus the handler. The caller mounts
 * them on whatever Hono app variant they own (the runtime Hono app, the
 * OpenAPI Hono app, or both — the chain is idempotent across mounts).
 *
 * @example
 * ```typescript
 * import { createAdminListEndpoint } from '@/presentation/api/admin/_shared/list-endpoint'
 * import {
 *   automationsRunsListQuerySchema,
 *   automationRunAdminItemSchema,
 * } from '@/domain/models/api/admin/automations'
 *
 * const { middleware, handler } = createAdminListEndpoint(
 *   {
 *     path: '/api/admin/automations/runs',
 *     tags: ['admin', 'automations'],
 *     filterSchema: automationsRunsListQuerySchema,
 *     itemSchema: automationRunAdminItemSchema,
 *     auditAction: 'automation.runs.list.queried',
 *     load: (filters, role, ctx) => loadRuns(filters, role),
 *   },
 *   liveAuditEmitter
 * )
 *
 * app.use('/api/admin/automations/runs', ...middleware).get(
 *   '/api/admin/automations/runs',
 *   handler
 * )
 * ```
 */
/**
 * Compose the helper's middleware chain.
 *
 * Always includes `requireAdminRole(minRole)`; appends `requireRuntime(...)`
 * iff the caller specified a runtime gate. Extracted so the handler factory
 * stays under the project's 50-line-per-function ESLint cap.
 *
 * @internal
 */
function buildMiddlewareChain(
  minRole: ReadonlyArray<AdminRole>,
  runtimes: ReadonlyArray<SovriumRuntime> | undefined
): ReadonlyArray<MiddlewareHandler> {
  if (runtimes && runtimes.length > 0) {
    return [requireAdminRole(minRole), requireRuntime(runtimes)]
  }
  return [requireAdminRole(minRole)]
}

/**
 * Produce a 404 anti-enum response when the helper's handler is invoked
 * without a resolved admin role (the RBAC middleware short-circuited or
 * the test harness mounted the handler without it in front).
 *
 * @internal
 */
function notFoundResponse(ctx: Context): Response {
  return ctx.json({ success: false, message: 'Not Found', code: 'NOT_FOUND' }, 404)
}

/**
 * Produce a 400 response when query-parameter validation fails. The
 * `issues` array surfaces flat strings — the full Zod issue tree is NOT
 * leaked.
 *
 * @internal
 */
function invalidFilterResponse(ctx: Context, issues: ReadonlyArray<string>): Response {
  return ctx.json(
    {
      success: false,
      code: 'BAD_REQUEST',
      message: 'Invalid filter parameters',
      issues,
    },
    400
  )
}

/**
 * Map a loader-failure tag to an HTTP response. BAD_REQUEST → 400;
 * INTERNAL_ERROR → 500. The audit emit does NOT fire on either failure —
 * see comments in `createAdminListEndpoint` for the rationale.
 *
 * @internal
 */
function loaderFailureResponse(ctx: Context, failure: AdminListLoaderFailure): Response {
  const status: 400 | 500 = failure.code === 'BAD_REQUEST' ? 400 : 500
  return ctx.json({ success: false, code: failure.code, message: failure.message }, status)
}

/**
 * Build the runtime handler closure for the helper.
 *
 * Extracted so the public `createAdminListEndpoint` stays a thin factory
 * (under the 50-line ESLint cap). The closure captures `config` and
 * `emitter` from the call site so each handler instance is bound to a
 * single endpoint definition.
 *
 * @internal
 */
function buildHandler<Q extends z.ZodTypeAny, I extends z.ZodTypeAny>(
  config: AdminListEndpointConfig<Q, I>,
  emitter: AdminAuditEmitter
): (ctx: Context) => Promise<Response> {
  return async (ctx: Context): Promise<Response> => {
    // 1. Resolve the role attached by `requireAdminRole`. Absent means the
    // RBAC middleware short-circuited — but we defensively handle this so
    // the helper can be unit-tested without the middleware in front.
    const role = ctx.get('adminRole') as AdminRole | undefined
    if (!role) return notFoundResponse(ctx)

    // 2. Parse query params via the helper (factored out for testability).
    const rawQuery = ctx.req.query()
    const queryResult = parseFilterQuery(config.filterSchema, rawQuery)
    if (!queryResult.success) return invalidFilterResponse(ctx, queryResult.issues)

    // 3. Run the loader inside Effect with the audit emit chained on
    // success. Per the audit-log keystone's pagination rule, a single
    // `auditAction` is emitted regardless of cursor continuation depth —
    // the loader sees the SAME action code on every page. The de-dupe
    // policy is a write-time concern of the audit log itself, not the
    // helper's; we always emit and let the audit writer dedupe by
    // `(actorId, action, correlationId)` if it chooses to.
    const session = ctx.get('session') as { readonly userId: string } | undefined
    const program = config
      .load(queryResult.data, role, ctx as unknown as ContextWithAdminRole)
      .pipe(
        Effect.tap(() =>
          emitter.emit({
            action: config.auditAction,
            role,
            // eslint-disable-next-line unicorn/no-null -- Audit emitter contract: actorId is `string | null` (nullable per the actor schema where system actors have no userId)
            actorId: session?.userId ?? null,
            resourceType: config.resourceType ?? deriveResourceType(config.auditAction),
            metadata: { hasCursor: typeof rawQuery.cursor === 'string' },
          })
        )
      )

    const exit = await Effect.runPromise(Effect.either(program))
    if (exit._tag === 'Left') return loaderFailureResponse(ctx, exit.left)

    // 4. Wrap the loader's result in the canonical cursor envelope. The
    // shape `{ items, nextCursor }` is locked by
    // `cursorPaginationResponseSchema(...)` and matches every public list
    // endpoint Sovrium ships.
    return ctx.json({ items: exit.right.items, nextCursor: exit.right.nextCursor }, 200)
  }
}

export function createAdminListEndpoint<Q extends z.ZodTypeAny, I extends z.ZodTypeAny>(
  config: AdminListEndpointConfig<Q, I>,
  emitter: AdminAuditEmitter
): AdminListEndpoint {
  const minRole = config.minRole ?? DEFAULT_MIN_ROLE
  const middleware = buildMiddlewareChain(minRole, config.runtimes)
  const handler = buildHandler(config, emitter)
  return { middleware, handler }
}

/**
 * Derive the audit-log `resource.type` from the action code.
 *
 * The action code's `<domain>.<resource>.<verb>` shape encodes the resource
 * type as the first two segments. e.g. `automation.runs.list.queried` →
 * `automation.run` (singular form for the audit log's resource convention).
 * `form.submission.list.queried` → `form.submission`. The mapping handles
 * the singular/plural mismatch between action namespaces (where lists,
 * details, and bulk operations all use the plural collection noun) and
 * resource types (which always use the singular form to match `resource.id`
 * references in audit-log queries).
 *
 * Heuristic: when segment[1] is a collection noun (ends with 's' and the
 * verb segment is one of `list` / `detail` / `bulk` — operations that
 * naturally take a collection in their name), trim the trailing 's' on
 * the resource segment. `overview` is special: it is itself a noun, not a
 * collection of items, so it passes through unchanged.
 *
 * Pure function; exported so unit tests can verify the mapping without
 * spinning up a handler.
 *
 * @internal
 */
export function deriveResourceType(action: AuditAction): string {
  const segments = action.split('.')
  if (segments.length < 2) return action
  // `<domain>.<resource>` — pluralize-aware: trim a trailing 's' on
  // segment[1] when the action's verb segment marks a collection
  // operation (`list`, `detail`, `bulk`). `overview` is itself a resource
  // name (not a collection of items), so it passes through unchanged.
  const isCollectionAction =
    segments.includes('list') || segments.includes('detail') || segments.includes('bulk')
  const resource = segments[1] ?? ''
  if (isCollectionAction && resource.endsWith('s')) {
    return `${segments[0]}.${resource.slice(0, -1)}`
  }
  return `${segments[0]}.${resource}`
}
