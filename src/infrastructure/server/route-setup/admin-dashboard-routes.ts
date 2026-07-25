/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Schema } from 'effect'
import { buildDashboardSurfaceApp } from '@/application/use-cases/admin/dashboard-surface-builder'
import { isDataObjectRedirect } from '@/application/use-cases/admin/dashboard-surfaces/data-object-rail'
import { AppSchema, isAdminTier } from '@/domain/models/app'
import { readEmbeddedDashboardConfig } from '@/infrastructure/assets/embedded-static-assets'
import { isEmailConfigured } from '@/infrastructure/email/email-config'
import { logError } from '@/infrastructure/logging/logger'
import { extractSurfaceContent, isPartialRequest } from './admin-dashboard-partial'
import type { HonoAppConfig } from './page-routes'
import type { PageRenderResult } from '@/application/ports/services/page-renderer'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'

const ADMIN_PREFIX = '/_admin'

const ADMIN_LOGIN_PATH = '/_admin/login'

const ADMIN_FORGOT_PASSWORD_PATH = '/_admin/forgot-password'

const ADMIN_RESET_PASSWORD_PATH = '/_admin/reset-password'

const ADMIN_PUBLIC_PATHS: ReadonlySet<string> = new Set([
  ADMIN_LOGIN_PATH,
  ADMIN_FORGOT_PASSWORD_PATH,
  ADMIN_RESET_PASSWORD_PATH,
])

const ADMIN_SIGNED_IN_REDIRECT_PATHS: ReadonlySet<string> = new Set([
  ADMIN_LOGIN_PATH,
  ADMIN_FORGOT_PASSWORD_PATH,
])

const isPublicAdminPath = (path: string): boolean => {
  if (!ADMIN_PUBLIC_PATHS.has(path)) return false
  return path === ADMIN_LOGIN_PATH || isEmailConfigured()
}

interface DashboardAppCache {
  readonly tried: boolean
  readonly app?: App
}

let dashboardAppCache: DashboardAppCache = { tried: false }

interface PrunableNode {
  readonly type?: string
  readonly props?: Readonly<Record<string, unknown>>
  readonly children?: readonly unknown[]
}

const asNode = (value: unknown): PrunableNode | undefined =>
  typeof value === 'object' && value !== null ? (value as PrunableNode) : undefined

const isRecoveryLink = (value: unknown): boolean => {
  const node = asNode(value)
  return node?.type === 'link' && node.props?.['href'] === ADMIN_FORGOT_PASSWORD_PATH
}

const pruneRecoveryLinks = (value: unknown): unknown => {
  const node = asNode(value)
  if (node === undefined || !Array.isArray(node.children)) return value
  return {
    ...node,
    children: node.children.filter((child) => !isRecoveryLink(child)).map(pruneRecoveryLinks),
  }
}

const pruneRecoveryEntryPoints = (app: App): App => {
  if (isEmailConfigured() || app.pages === undefined) return app
  const pages = app.pages.map((page) =>
    page.components === undefined
      ? page
      : {
          ...page,
          components: page.components
            .filter((component) => !isRecoveryLink(component))
            .map(pruneRecoveryLinks),
        }
  )
  return { ...app, pages } as App
}

const resolveDashboardApp = async (): Promise<App | undefined> => {
  if (dashboardAppCache.tried) {
    return dashboardAppCache.app
  }
  try {
    const yaml = await readEmbeddedDashboardConfig()
    if (yaml === undefined) {
      dashboardAppCache = { tried: true }
      return undefined
    }
    const decoded = Schema.decodeUnknownSync(AppSchema)(Bun.YAML.parse(yaml)) as App
    const app: App = pruneRecoveryEntryPoints({ ...decoded, badge: false })
    dashboardAppCache = { tried: true, app }
    return app
  } catch (error) {
    logError('[ADMIN-DASHBOARD] Failed to load the embedded dashboard config', error)
    dashboardAppCache = { tried: true }
    return undefined
  }
}

const toDashboardPath = (requestPath: string): string => {
  const stripped = requestPath.slice(ADMIN_PREFIX.length)
  if (stripped === '' || stripped === '/') return '/'
  return stripped
}

const resolveCallerHasAccess = async (
  config: HonoAppConfig,
  c: Context
): Promise<boolean> => {
  const session = config.getSession ? await config.getSession(c.req.raw.headers) : undefined
  if (!session) return false
  return isAdminTier(session.role, config.app)
}

const resolveAccess = async (
  config: HonoAppConfig,
  c: Context
): Promise<Response | { readonly canEdit: boolean }> => {
  const hasAccess = await resolveCallerHasAccess(config, c)
  const { path } = c.req
  if (hasAccess && ADMIN_SIGNED_IN_REDIRECT_PATHS.has(path)) {
    return c.redirect(ADMIN_PREFIX, 302)
  }
  if (!hasAccess && !isPublicAdminPath(path)) {
    return c.html(await config.renderNotFoundPage(config.app), 404)
  }
  return { canEdit: true }
}

const renderDashboardSurface = async (
  config: HonoAppConfig,
  c: Context,
  dashboardApp: App,
  canEdit: boolean
): Promise<Response> => {
  const dashboardPath = toDashboardPath(c.req.path)
  const surface = await buildDashboardSurfaceApp(dashboardApp, config.app, dashboardPath, canEdit)
  if (surface !== undefined && isDataObjectRedirect(surface)) {
    return c.redirect(surface.redirect, 302)
  }
  const surfaceApp = surface ?? dashboardApp
  const result: PageRenderResult = await config.renderPage(surfaceApp, dashboardPath)
  if (typeof result === 'string') {
    if (isPartialRequest(c)) {
      const content = extractSurfaceContent(result)
      if (content !== undefined) {
        return c.html(content, 200)
      }
    }
    return c.html(result, 200)
  }
  if (result && typeof result === 'object' && 'redirect' in result) {
    return c.redirect(result.redirect, 302)
  }
  return c.html(await config.renderNotFoundPage(dashboardApp), 404)
}

const handleAdminDashboard =
  (config: HonoAppConfig) =>
  async (c: Context): Promise<Response> => {
    const access = await resolveAccess(config, c)
    if (access instanceof Response) return access

    const dashboardApp = await resolveDashboardApp()
    if (dashboardApp === undefined) {
      return c.html(await config.renderNotFoundPage(config.app), 404)
    }

    try {
      return await renderDashboardSurface(config, c, dashboardApp, access.canEdit)
    } catch (error) {
      logError(`[ADMIN-DASHBOARD] ${c.req.method} ${c.req.path} → 500`, error)
      return c.html(await config.renderErrorPage(dashboardApp), 500)
    }
  }

export function setupAdminDashboardRoutes(
  honoApp: Readonly<Hono>,
  config: HonoAppConfig
): Readonly<Hono> {
  const handler = handleAdminDashboard(config)
  return honoApp.get(ADMIN_PREFIX, handler).get(`${ADMIN_PREFIX}/*`, handler)
}
