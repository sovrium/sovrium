/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { SQL } from 'bun'
import { renderToString } from 'react-dom/server'
import { checkPageAccess, type AccessDecision } from '@/domain/services/page-access-check'
import { findMatchingRoute } from '@/domain/utils/route-matcher'
import { sanitizeTableName } from '@/infrastructure/database/field-utils'
import { logError } from '@/infrastructure/logging/logger'
import { buildIslands } from '@/infrastructure/server/route-setup/static-assets'
import { DefaultHomePage } from '@/presentation/ui/pages/DefaultHomePage'
import { DynamicPage } from '@/presentation/ui/pages/DynamicPage'
import type { PageRenderResult } from '@/application/ports/services/page-renderer'
import type { App } from '@/domain/models/app'
import type { BuiltInAnalytics } from '@/domain/models/app/analytics'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type {
  ComponentReference,
  SimpleComponentReference,
} from '@/domain/models/app/component/common/component-reference'
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

/**
 * Injects a _dataSourceError prop into a component's props
 */
function withDataSourceError(component: Component, errorMessage: string): Component {
  return {
    ...component,
    props: {
      ...(component.props ?? {}),
      _dataSourceError: errorMessage,
    },
  }
}

/**
 * Validates dataSource fields against a table's field definitions
 *
 * Returns an error-injected component if any requested fields are not found,
 * or the original component if all fields are valid.
 */
function validateDataSourceFields(
  component: Component,
  tableName: string,
  requestedFields: readonly string[],
  tableFieldNames: Set<string>
): Component | undefined {
  const missingFields = requestedFields.filter((f) => !tableFieldNames.has(f))
  if (missingFields.length === 0) return undefined
  return withDataSourceError(
    component,
    `Error: fields not found in table "${tableName}": ${missingFields.join(', ')}`
  )
}

// ─── $record.* substitution helpers ─────────────────────────────────────────

/**
 * Replaces $record.fieldName placeholders with actual field values from a record
 */
function substituteRecordVars(text: string, record: Record<string, unknown>): string {
  return text.replace(/\$record\.([a-zA-Z0-9_]+)/g, (_, fieldName: string) => {
    const value = record[fieldName]
    return value !== undefined ? String(value) : ''
  })
}

/**
 * Recursively substitutes $record.* variables in a component's props and content
 */
function substituteRecordInComponent(
  component: Component,
  record: Record<string, unknown>
): Component {
  return {
    ...component,
    props: component.props ? substituteRecordInProps(component.props, record) : component.props,
    content:
      typeof component.content === 'string'
        ? substituteRecordVars(component.content, record)
        : component.content,
    children: component.children?.map((child: Component | string) =>
      typeof child === 'string'
        ? substituteRecordVars(child, record)
        : substituteRecordInComponent(child, record)
    ),
  }
}

/**
 * Substitutes $record.* variables in all string values of a props object
 */
function substituteRecordInProps(
  props: Record<string, unknown>,
  record: Record<string, unknown>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(props).map(([key, value]) => [
      key,
      typeof value === 'string' ? substituteRecordVars(value, record) : value,
    ])
  )
}

/**
 * Expands a data-bound component's children once per record,
 * wrapping each record's expanded children in an <li> element.
 *
 * If no children template or no records, marks the component as data-bound
 * so the list renderer can still show an empty <ul>.
 */
function expandDataSourceChildren(
  component: Component,
  records: readonly Record<string, unknown>[]
): Component {
  if (!component.children || component.children.length === 0 || records.length === 0) {
    return {
      ...component,
      props: { ...(component.props ?? {}), _dataSourceBound: true },
    }
  }

  const expandedChildren: readonly (Component | string)[] = records.map((record) => ({
    type: 'li' as Component['type'],
    children: component.children!.map((child: Component | string) =>
      typeof child === 'string'
        ? substituteRecordVars(child, record)
        : substituteRecordInComponent(child, record)
    ),
  }))

  return {
    ...component,
    children: expandedChildren,
    props: { ...(component.props ?? {}), _dataSourceBound: true },
  }
}

// ─── Database querying ──────────────────────────────────────────────────────

/**
 * Fetches records from a table using bun:sql
 *
 * Uses the DATABASE_URL environment variable. Returns empty array if
 * no database is configured (e.g., static sites without DB).
 */
async function fetchTableRecords(
  tableName: string,
  fields?: readonly string[]
): Promise<readonly Record<string, unknown>[]> {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) return []

  const sanitized = sanitizeTableName(tableName)
  const columns =
    fields && fields.length > 0 ? fields.map((f) => `"${sanitizeTableName(f)}"`).join(', ') : '*'

  const sql = new SQL({ url: databaseUrl })
  try {
    const result = await sql.unsafe(`SELECT ${columns} FROM "${sanitized}"`)
    return result as Record<string, unknown>[]
  } finally {
    sql.close()
  }
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

// ─── Data source resolution ─────────────────────────────────────────────────

/**
 * Resolves a section's dataSource: validates config, fetches records, expands children
 *
 * For sections with valid dataSource bindings, queries the database and
 * pre-expands children templates with $record.* values substituted.
 * For invalid bindings, injects error messages into props.
 */
async function resolveDataSourceSectionAsync(
  section: Component | SimpleComponentReference | ComponentReference,
  app: App
): Promise<Component | SimpleComponentReference | ComponentReference> {
  // Only process direct components (not references)
  if ('component' in section || '$ref' in section) return section

  const component = section as Component
  if (!component.dataSource) return component

  const { table: tableName, fields: requestedFields } = component.dataSource
  const tables = app.tables ?? []
  const matchedTable = tables.find((t) => t.name === tableName)

  if (!matchedTable) {
    return withDataSourceError(component, `Error: table "${tableName}" not found`)
  }

  // Validate requested fields exist in the table schema
  if (requestedFields && requestedFields.length > 0) {
    const tableFieldNames = new Set(matchedTable.fields.map((f) => f.name))
    const errorComponent = validateDataSourceFields(
      component,
      tableName,
      requestedFields,
      tableFieldNames
    )
    if (errorComponent) return errorComponent
  }

  // Fetch records from the database
  const records = await fetchTableRecords(tableName, requestedFields ?? undefined)

  // Expand children template with fetched records
  return expandDataSourceChildren(component, records)
}

/**
 * Pre-processes page sections to resolve dataSource bindings asynchronously
 *
 * Validates dataSource table/field references, fetches records from the database,
 * and expands children templates with $record.* values substituted.
 */
async function resolvePageDataSourcesAsync(page: Page, app: App): Promise<Page> {
  if (!page.sections || page.sections.length === 0) return page

  const resolvedSections = await Promise.all(
    page.sections.map((section) => resolveDataSourceSectionAsync(section, app))
  )

  return { ...page, sections: resolvedSections }
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

  // Pre-process page sections: validate dataSource, fetch records, expand children
  const page = await resolvePageDataSourcesAsync(authStrippedPage, app)

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
