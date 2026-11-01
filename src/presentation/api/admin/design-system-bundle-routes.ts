/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `GET /api/admin/design-system.zip` — the portable design-system bundle as one
 * download ([internal ref] A11).
 *
 * Hand-chained rather than a registry entry: the body is binary, so it has no
 * MCP tool. It is classified an ARCHIVE in `admin-read-registry.ts`, whose MCP
 * equivalent is the bundle manifest read plus the per-file read; the parity
 * gate holds that both exist. GET only, by registration: a write verb falls
 * through to the admin 404, and the bundle is never accepted back.
 *
 * The gate is mounted upstream (`admin-route-guards.ts`): a caller who is not
 * an admin gets the same 404 as for a path that does not exist.
 */

import { Effect } from 'effect'
import {
  decodePagesLens,
  downloadDesignSystemBundle,
} from '@/application/use-cases/design/bundle-read-operations'
import { notFound } from '@/presentation/api/runtime/auth-helpers'
import { getSessionContext } from '@/presentation/api/runtime/context-helpers'
import { runHandlerEffect, toErrorResponse } from '@/presentation/api/runtime/run-effect'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'

/** Where an admin downloads the bundle. */
export const DESIGN_SYSTEM_ZIP_PATH = '/api/admin/design-system.zip'

/** The download headers: an attachment named after the app, never cached. */
export const zipResponseHeaders = (appName: string): Readonly<Record<string, string>> => ({
  'Content-Type': 'application/zip',
  'Content-Disposition': `attachment; filename="${appName.replaceAll(/[^A-Za-z0-9._-]/g, '-')}-design-system.zip"`,
  'Cache-Control': 'no-store',
})

const handleZip = (c: Context, app: App): Promise<Response> | Response => {
  const userId = getSessionContext(c)?.userId
  if (userId === undefined) return notFound(c, 'Not found')
  // `?pages=true` adds the app's pages ([internal ref] A13); any other value is refused by name.
  const lens = decodePagesLens(c.req.query('pages'))
  if (lens._tag === 'InvalidInput') {
    return c.json({ success: false, message: lens.message, code: lens.code }, 400)
  }
  if (lens._tag !== 'Ok') return notFound(c, 'Not found')
  return runHandlerEffect(
    c,
    Effect.match(downloadDesignSystemBundle(app, userId, lens.input), {
      onFailure: (failure) => toErrorResponse(c, failure),
      onSuccess: (bundle) => c.body(bundle.slice().buffer, 200, zipResponseHeaders(app.name)),
    })
  )
}

/**
 * Chain the bundle download onto a Hono app.
 *
 * @param honoApp - the app the admin routes are chained on.
 * @param app - the app whose design system the bundle exports.
 */
export const chainAdminDesignSystemBundleRoutes = <T extends Hono>(honoApp: T, app: App): T =>
  honoApp.get(DESIGN_SYSTEM_ZIP_PATH, (c) => handleZip(c, app)) as T
