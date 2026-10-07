/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { stripHtmlToText } from '@/domain/kernel/sanitize/html-sanitization'
import type { createAuthMiddleware } from 'better-auth/api'

/**
 * The Better Auth `before`-hook context. Re-derived here (rather than imported
 * from `auth.ts`) so this guard module has no cycle back to the instance
 * factory that consumes it — same reasoning as `avatar-url-guard.ts`.
 */
type AuthMiddlewareCtx = Parameters<typeof createAuthMiddleware>[0] extends (
  ctx: infer C
) => unknown
  ? C
  : never

/**
 * Endpoints that write `auth.user.name`, and where in the body the name sits.
 *
 * Guarding sign-up alone left the other three open: a name refused at
 * registration could be set a minute later through `/update-user`, and an admin
 * could plant one through either admin route. The value lands in the same
 * column whichever path wrote it, so every path is guarded.
 *
 * - `/sign-up/email`, `/update-user` — `body.name`.
 * - `/admin/create-user` — `body.name`, AND `body.data.name`: the route spreads
 *   its `data` passthrough into the created row, so a name there wins.
 * - `/admin/update-user` — `body.data.name`, the mutation's only carrier.
 */
const NAME_LOCATIONS: ReadonlyMap<string, readonly ('body' | 'data')[]> = new Map([
  ['/sign-up/email', ['body']],
  ['/update-user', ['body']],
  ['/admin/create-user', ['body', 'data']],
  ['/admin/update-user', ['data']],
])

/** The object the name lives on — mutable, because the guard rewrites it in place. */
type NameHolder = { name?: unknown }

const target = (ctx: AuthMiddlewareCtx, location: 'body' | 'data'): NameHolder | undefined => {
  const body = ctx.body as { data?: unknown } | undefined
  const holder = location === 'body' ? body : body?.data
  return typeof holder === 'object' && holder !== null ? (holder as NameHolder) : undefined
}

/**
 * Strip every tag from a client-supplied `name` before Better Auth stores it.
 *
 * `stripHtmlToText` is the canonical parser-based stripper (no ad-hoc regex).
 * It also DECODES entities, so `&lt;b&gt;` is stored as the text `<b>`: a
 * stored name is plain text, never markup, and every HTML sink that prints it
 * must escape it — the email templates and the SSR renderers do. This guard
 * removes markup the client sent as markup; it does not make a name safe to
 * interpolate raw.
 */
export const applyDisplayNameGuard = (ctx: AuthMiddlewareCtx): void => {
  const locations = NAME_LOCATIONS.get(ctx.path)
  if (locations === undefined) return
  locations.forEach((location) => {
    const holder = target(ctx, location)
    if (typeof holder?.name === 'string') {
      holder.name = stripHtmlToText(holder.name)
    }
  })
}
