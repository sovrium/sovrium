/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
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

export interface AdminListLoadResult<I> {
  readonly items: ReadonlyArray<I>
  readonly nextCursor: string | null
}

export interface AdminListLoaderFailure {
  readonly _tag: 'AdminListLoaderError'
  readonly code: 'BAD_REQUEST' | 'INTERNAL_ERROR'
  readonly message: string
}

export interface AdminListEndpointConfig<Q extends z.ZodTypeAny, I extends z.ZodTypeAny> {
  readonly path: string
  readonly tags: ReadonlyArray<string>
  readonly filterSchema: Q
  readonly itemSchema: I
  readonly minRole?: ReadonlyArray<AdminRole>
  readonly runtimes?: ReadonlyArray<SovriumRuntime>
  readonly auditAction: AuditAction
  readonly resourceType?: string
  readonly load: (
    filters: z.infer<Q>,
    role: AdminRole,
    ctx: ContextWithAdminRole
  ) => Effect.Effect<AdminListLoadResult<z.infer<I>>, AdminListLoaderFailure>
}

export interface AdminListEndpoint {
  readonly middleware: ReadonlyArray<MiddlewareHandler>
  readonly handler: (ctx: Context) => Promise<Response>
}

const DEFAULT_MIN_ROLE: ReadonlyArray<AdminRole> = ['auditor']

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
  const issues = parsed.error.issues.map((issue) => {
    const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : ''
    return `${path}${issue.message}`
  })
  return { success: false, issues }
}

export interface AdminAuditEmitter {
  readonly emit: (params: {
    readonly action: AuditAction
    readonly role: AdminRole
    readonly actorId: string | null
    readonly resourceType: string
    readonly metadata?: Record<string, unknown>
  }) => Effect.Effect<void, never>
}

function buildMiddlewareChain(
  minRole: ReadonlyArray<AdminRole>,
  runtimes: ReadonlyArray<SovriumRuntime> | undefined
): ReadonlyArray<MiddlewareHandler> {
  if (runtimes && runtimes.length > 0) {
    return [requireAdminRole(minRole), requireRuntime(runtimes)]
  }
  return [requireAdminRole(minRole)]
}

function notFoundResponse(ctx: Context): Response {
  return ctx.json({ success: false, message: 'Not Found', code: 'NOT_FOUND' }, 404)
}

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

function loaderFailureResponse(ctx: Context, failure: AdminListLoaderFailure): Response {
  const status: 400 | 500 = failure.code === 'BAD_REQUEST' ? 400 : 500
  return ctx.json({ success: false, code: failure.code, message: failure.message }, status)
}

function buildHandler<Q extends z.ZodTypeAny, I extends z.ZodTypeAny>(
  config: AdminListEndpointConfig<Q, I>,
  emitter: AdminAuditEmitter
): (ctx: Context) => Promise<Response> {
  return async (ctx: Context): Promise<Response> => {
    const role = ctx.get('adminRole') as AdminRole | undefined
    if (!role) return notFoundResponse(ctx)

    const rawQuery = ctx.req.query()
    const queryResult = parseFilterQuery(config.filterSchema, rawQuery)
    if (!queryResult.success) return invalidFilterResponse(ctx, queryResult.issues)

    const session = ctx.get('session') as { readonly userId: string } | undefined
    const program = config
      .load(queryResult.data, role, ctx as unknown as ContextWithAdminRole)
      .pipe(
        Effect.tap(() =>
          emitter.emit({
            action: config.auditAction,
            role,
            actorId: session?.userId ?? null,
            resourceType: config.resourceType ?? deriveResourceType(config.auditAction),
            metadata: { hasCursor: typeof rawQuery.cursor === 'string' },
          })
        )
      )

    const exit = await Effect.runPromise(Effect.either(program))
    if (exit._tag === 'Left') return loaderFailureResponse(ctx, exit.left)

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

export function deriveResourceType(action: AuditAction): string {
  const segments = action.split('.')
  if (segments.length < 2) return action
  const isCollectionAction =
    segments.includes('list') || segments.includes('detail') || segments.includes('bulk')
  const resource = segments[1] ?? ''
  if (isCollectionAction && resource.endsWith('s')) {
    return `${segments[0]}.${resource.slice(0, -1)}`
  }
  return `${segments[0]}.${resource}`
}
