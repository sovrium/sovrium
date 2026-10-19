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
import { downloadDesignSystemBundle } from '@/application/use-cases/admin/design-system-bundle-read-operations'
import { provideDomain, runRequestEffect } from '@/infrastructure/logging/request-effect'
import { notFound } from '@/presentation/api/runtime/auth-helpers'
import { getSessionContext } from '@/presentation/api/runtime/context-helpers'
import { toErrorResponse } from '@/presentation/api/runtime/run-effect'
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

const handleZip = async (c: Context, app: App): Promise<Response> => {
  const userId = getSessionContext(c)?.userId
  if (userId === undefined) return notFound(c, 'Not found')
  const result = await runRequestEffect(
    c,
    Effect.result(provideDomain(c, downloadDesignSystemBundle(app, userId)))
  )
  if (result._tag === 'Failure') return toErrorResponse(c, result.failure)
  return c.body(result.success.slice().buffer, 200, zipResponseHeaders(app.name))
}

/**
 * Chain the bundle download onto a Hono app.
 *
 * @param honoApp - the app the admin routes are chained on.
 * @param resolveApp - the live config, read per request so a reload is honoured.
 */
export const chainAdminDesignSystemBundleRoutes = <T extends Hono>(
  honoApp: T,
  resolveApp: () => App
): T => honoApp.get(DESIGN_SYSTEM_ZIP_PATH, (c) => handleZip(c, resolveApp())) as T
