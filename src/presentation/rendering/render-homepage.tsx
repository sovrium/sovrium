/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { renderToString } from 'react-dom/server'
import { checkPageAccess, type AccessDecision } from '@/domain/services/page-access-check'
import { findMatchingRoute } from '@/domain/utils/route-matcher'
import { logError } from '@/infrastructure/logging/logger'
import { buildIslands } from '@/infrastructure/server/route-setup/static-assets'
import { resolvePageDataSources } from '@/presentation/rendering/data-source-resolver'
import { DefaultHomePage } from '@/presentation/ui/pages/DefaultHomePage'
import { DynamicPage } from '@/presentation/ui/pages/DynamicPage'
import type { PageRenderResult } from '@/application/ports/services/page-renderer'
import type { App } from '@/domain/models/app'
import type { BuiltInAnalytics } from '@/domain/models/app/analytics'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { Component } from '@/domain/models/app/page/sections'
import type { Page } from '@/domain/models/app/pages'

/**
 * Extract session timeout from analytics config, defaulting to 30 minutes
 */
function extractSessionTimeout(analytics: BuiltInAnalytics | undefined): number {
  if (analytics === undefined || analytics === false || analytics === true) return 30
  return analytics.sessionTimeout ?? 30
}

/**
 * Check if built-in analytics tracking should be injected for a given page path
 *
 * Returns true when analytics is configured and enabled, and the page path
 * is not in the excludedPaths list.
 */
function shouldInjectAnalytics(analytics: BuiltInAnalytics | undefined, pagePath: string): boolean {
  if (analytics === undefined || analytics === false) return false
  if (analytics === true) return true
  const { excludedPaths } = analytics
  if (!excludedPaths || excludedPaths.length === 0) return true
  return !excludedPaths.some((pattern: string) => {
    // Support simple glob patterns: * matches any segment, ** matches anything
    const regex = new RegExp('^' + pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*') + '$')
    return regex.test(pagePath)
  })
}

// ─── Auth action stripping ──────────────────────────────────────────────────

/**
 * Strips auth actions from form sections when auth is not configured.
 * This ensures auth forms render as empty (hidden) when the app has no auth strategies.
 */
function stripAuthActionsIfUnconfigured(
  sections: Page['sections'],
  hasAuth: boolean
): Page['sections'] {
  if (hasAuth || !sections) return sections

  return sections.map((section) => {
    if ('component' in section || '$ref' in section) return section
    const component = section as Component
    if (component.action && 'type' in component.action && component.action.type === 'auth') {
      const { action: _, ...rest } = component
      return rest as Component
    }
    return component
  })
}

/**
 * OAuth action shape used for provider-checking
 */
interface OAuthActionShape {
  readonly type: string
  readonly strategy?: string
  readonly provider?: string
}

/**
 * Strips OAuth form sections when the requested OAuth provider is not configured
 * in auth strategies. This prevents OAuth forms from rendering when the provider
 * is not available.
 */
function stripUnconfiguredOAuthForms(sections: Page['sections'], app: App): Page['sections'] {
  if (!sections) return sections

  const oauthStrategy = app.auth?.strategies?.find((s) => s.type === 'oauth') as
    | { readonly type: 'oauth'; readonly providers: readonly string[] }
    | undefined
  const configuredProviders = oauthStrategy?.providers ?? []

  return sections.map((section) => {
    if ('component' in section || '$ref' in section) return section
    const component = section as Component
    if (!component.action || !('type' in component.action)) return component

    const action = component.action as OAuthActionShape
    if (action.type !== 'auth' || action.strategy !== 'oauth') return component

    // If provider is not in configured providers, strip the action so form renders empty
    if (!action.provider || !configuredProviders.includes(action.provider)) {
      const { action: _, ...rest } = component
      return rest as Component
    }

    return component
  })
}

// ─── Section visibility filtering ───────────────────────────────────────────

/**
 * Visibility config shape as stored in component props
 */
interface VisibilityConfig {
  readonly when?: 'authenticated' | 'unauthenticated'
  readonly roles?: readonly string[]
}

/**
 * Determines if a section should be visible given the current session.
 *
 * Logic:
 * - No visibility config → always visible
 * - `when: 'authenticated'` → only visible when session exists (AND logic with roles)
 * - `when: 'unauthenticated'` → only visible when no session
 * - `roles: [...]` → only visible when session role matches one of the roles (OR logic)
 * - Both `when` and `roles` → both conditions must be met (AND logic)
 */
function isSectionVisible(visibility: VisibilityConfig, session: SessionInfo | undefined): boolean {
  const isAuthenticated = session !== undefined

  if (visibility.when === 'authenticated' && !isAuthenticated) return false
  if (visibility.when === 'unauthenticated' && isAuthenticated) return false

  if (visibility.roles && visibility.roles.length > 0) {
    if (!isAuthenticated) return false
    if (!visibility.roles.includes(session.role)) return false
  }

  return true
}

/**
 * Extracts visibility config from component props if present
 */
function extractVisibilityFromProps(
  props: Record<string, unknown> | undefined
): VisibilityConfig | undefined {
  if (!props || typeof props.visibility !== 'object' || props.visibility === null) return undefined
  return props.visibility as VisibilityConfig
}

/**
 * Applies visibility filtering to page sections based on the current session.
 *
 * Sections that should not be visible are hidden server-side by injecting
 * `display: none` into their style prop. This preserves the DOM structure
 * while hiding content from unauthorized users.
 */
function applyVisibilityToSections(
  sections: Page['sections'],
  session: SessionInfo | undefined
): Page['sections'] {
  if (!sections) return sections

  return sections.map((section) => {
    if ('component' in section || '$ref' in section) return section

    const component = section as Component
    const visibility = extractVisibilityFromProps(component.props)
    if (!visibility) return component

    if (isSectionVisible(visibility, session)) return component

    // Hide the section by injecting display:none into its style prop
    return {
      ...component,
      props: {
        ...(component.props ?? {}),
        style: {
          ...((component.props?.style as Record<string, unknown> | undefined) ?? {}),
          display: 'none',
        },
      },
    }
  })
}

/** Island section types that require the client-side React island runtime */
const ISLAND_TYPES = new Set(['data-table'])

/**
 * Builds the island bundle and returns the entry filename if the page has island sections
 */
async function resolveIslandEntryFile(page: Page): Promise<string | undefined> {
  const needsIslands = page.sections?.some((s) => ISLAND_TYPES.has(s.type)) ?? false
  if (!needsIslands) return undefined

  try {
    const result = await buildIslands()
    return result.entryFile
  } catch (error) {
    logError('[RENDER] Failed to build island bundle', error)
    return undefined
  }
}

/**
 * Converts an AccessDecision into a denial result (redirect, error, or undefined for 404).
 * Returns false if the page is allowed (access granted).
 */
function toAccessDeniedResult(decision: AccessDecision): PageRenderResult | false {
  if (decision.allowed) return false
  if (decision.action === 'redirect') return { redirect: decision.url }
  if (decision.action === 'error') return { error: decision.message }
  return undefined // 'not-found' → 404
}

/**
 * Renders a page by path to HTML string for server-side rendering
 *
 * Supports both static routes (exact match) and dynamic routes (with :param segments).
 * Enforces page access control before rendering.
 */
export async function renderPageByPath(
  app: App,
  path: string,
  detectedLanguage?: string,
  session?: SessionInfo
): Promise<PageRenderResult> {
  if (!app.pages || app.pages.length === 0) return undefined

  const pagePatterns = app.pages.map((p) => p.path)
  const match = findMatchingRoute(pagePatterns, path)
  if (!match) return undefined

  const rawPage = app.pages[match.index]
  if (!rawPage) return undefined

  // Check page access control — deny returns early with redirect, error, or 404
  const denied = toAccessDeniedResult(checkPageAccess(rawPage.access, app, session))
  if (denied !== false) return denied

  // Strip auth actions from forms when auth is not configured
  const authStrippedPage = {
    ...rawPage,
    sections: stripAuthActionsIfUnconfigured(rawPage.sections, !!app.auth),
  }

  // Strip OAuth form sections when the requested provider is not configured
  const oauthFilteredPage = {
    ...authStrippedPage,
    sections: stripUnconfiguredOAuthForms(authStrippedPage.sections, app),
  }

  // Apply visibility filtering: hide sections based on session state and roles
  const visibilityFilteredPage = {
    ...oauthFilteredPage,
    sections: applyVisibilityToSections(oauthFilteredPage.sections, session),
  }

  // Pre-process page sections: validate dataSource, fetch records, expand children
  // Returns undefined when a single-mode dataSource finds no matching record (→ 404)
  const page = await resolvePageDataSources(visibilityFilteredPage, app, match.params)
  if (page === undefined) return undefined

  const injectAnalytics = shouldInjectAnalytics(app.analytics, page.path)
  const sessionTimeout = extractSessionTimeout(app.analytics)

  // Build island bundle if page has island sections (data-table, etc.)
  const islandEntryFile = await resolveIslandEntryFile(page)

  const html = renderToString(
    <DynamicPage
      page={page}
      components={app.components}
      theme={app.theme}
      languages={app.languages}
      tables={app.tables}
      detectedLanguage={detectedLanguage}
      routeParams={match.params}
      builtInAnalyticsEnabled={injectAnalytics}
      builtInAnalyticsSessionTimeout={sessionTimeout}
      islandEntryFile={islandEntryFile}
    />
  )

  return `<!DOCTYPE html>\n${html}`
}

/**
 * Renders any page by path to HTML string for server-side rendering
 *
 * For the homepage ('/'), falls back to a default homepage when no custom page is configured.
 * For all other paths, returns undefined if no matching page is found.
 *
 * @param app - Validated application data from AppSchema
 * @param path - Page path to render (e.g., '/', '/about')
 * @param detectedLanguage - Optional detected language from Accept-Language header
 * @returns Complete HTML document as string with DOCTYPE, or undefined if page not found
 */
export async function renderPage(
  app: App,
  path: string,
  detectedLanguage?: string,
  session?: SessionInfo
): Promise<PageRenderResult> {
  const result = await renderPageByPath(app, path, detectedLanguage, session)
  if (result) return result

  // Fallback: render default homepage when path is '/' and no custom page exists
  if (path === '/') {
    const injectAnalytics = shouldInjectAnalytics(app.analytics, '/')
    const defaultSessionTimeout = extractSessionTimeout(app.analytics)
    const html = renderToString(
      <DefaultHomePage
        app={app}
        builtInAnalyticsEnabled={injectAnalytics}
        builtInAnalyticsSessionTimeout={defaultSessionTimeout}
      />
    )
    return `<!DOCTYPE html>\n${html}`
  }

  return undefined
}
