/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { DemoNotice } from '@/presentation/render/page/demo-notice'
import { PageBodyScripts } from '@/presentation/render/page/page-body-scripts'
import { hasIslandComponents } from '@/presentation/render/page/page-island-detection'
import { resolvePageLanguage } from '@/presentation/render/page/page-lang-resolver'
import { PageMain } from '@/presentation/render/page/page-main'
import { extractPageMetadata } from '@/presentation/render/page/page-metadata'
import { groupScriptsByPosition } from '@/presentation/render/page/page-scripts'
import { PageSidebar } from '@/presentation/render/page/page-sidebar'
import { SovriumBadge } from '@/presentation/render/page/sovrium-badge'
import { getToastDismissLabel } from '@/presentation/render/page/toast-dismiss-labels'
// Island-runtime detection lives in page-island-detection.ts (extracted on main);
// this file keeps only interactive-runtime detection, which shares the same
// reference-aware walker so a template-hosted action button also ships client.js.
import { DynamicPageHead } from './dynamic-page-head'
import { hasInteractiveFeatures, mergeComponentMetaIntoPage } from './page-interactivity'
import type { RouteParams } from '@/domain/kernel/matching/route-matcher'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { Buckets } from '@/domain/models/app/buckets'
import type { Components } from '@/domain/models/app/components'
import type { Design } from '@/domain/models/app/design'
import type { Languages } from '@/domain/models/app/languages'
import type { Page } from '@/domain/models/app/pages'
import type { Tables } from '@/domain/models/app/tables'
import type { ResolvedMarkdownPage } from '@/presentation/render/markdown/markdown-page-resolver'
import type { ResolvedSidebarSection } from '@/presentation/render/resolve/sidebar-resolver'

type DynamicPageProps = {
  readonly page: Page
  readonly components?: Components
  /**
   * App-level `design` key, threaded on the same
   * channel as `design` so `design.components` reaches every rendered component.
   */
  readonly design?: Design
  readonly languages?: Languages
  readonly tables?: Tables
  readonly buckets?: Buckets
  /** App-level `auth.landingPath`. */
  readonly landingPath?: string
  readonly detectedLanguage?: string
  /**
   * The `/:lang/` URL-prefix locale, when the request carried one. Outranks
   * `page.meta.lang` ([internal ref]..039) — see `resolvePageLanguage`.
   */
  readonly urlLanguage?: string
  readonly routeParams?: RouteParams
  readonly builtInAnalyticsEnabled?: boolean
  readonly builtInAnalyticsSessionTimeout?: number
  /** Hashed filename of the island entry bundle (e.g., "island-client-a7f3b2.js") */
  readonly islandEntryFile?: string
  /** Island `modulepreload` hrefs — see {@link IslandPreloadLinks}. */
  readonly islandPreloadHrefs?: readonly string[]
  /** Pre-resolved sidebar sections. */
  readonly resolvedSidebar?: readonly ResolvedSidebarSection[]
  /** Pre-rendered markdown payload. */
  readonly markdownPayload?: ResolvedMarkdownPage
  /**
   * Request session. Forwarded to
   * the component-renderer pipeline so island prop-builders can gate
   * user-specific UI affordances (own-comment edit/delete, admin overrides).
   */
  readonly session?: SessionInfo
  /** Content-versioned stylesheet URL — see `PageHeadProps.cssHref`. */
  readonly cssHref?: string
  /**
   * "Built with Sovrium" badge toggle — callers pass `isBadgeEnabled(app.badge)`,
   * threaded like `builtInAnalyticsEnabled`. Undefined renders no badge.
   */
  readonly badgeEnabled?: boolean
  /**
   * Demo context notice toggle. INVERSE default to `badgeEnabled`: undefined
   * means "render if the env enables it", because whether the notice appears at
   * all is decided by `SOVRIUM_DEMO_*` inside `DemoNotice`, not by the caller.
   * Callers pass `false` only to SUPPRESS it on a surface that must stay free of
   * end-user chrome — today just the `/_admin` operator console.
   */
  readonly demoNoticeEnabled?: boolean
}

type DynamicPageBodyProps = {
  readonly page: Page
  readonly components?: Components
  /**
   * App-level `design` key, threaded on the same
   * channel as `design` so `design.components` reaches every rendered component.
   */
  readonly design?: Design
  readonly languages?: Languages
  readonly tables?: Tables
  readonly buckets?: Buckets
  /** App-level `auth.landingPath`. */
  readonly landingPath?: string
  readonly direction: 'ltr' | 'rtl'
  readonly scripts: ReturnType<typeof groupScriptsByPosition>
  readonly lang: string
  readonly bodyStyle:
    | {
        readonly fontFamily?: string
        readonly fontSize?: string
        readonly lineHeight?: string
        readonly fontStyle?: 'normal' | 'italic' | 'oblique'
        readonly letterSpacing?: string
        readonly textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize'
      }
    | undefined
  readonly routeParams?: RouteParams
  readonly islandEntryFile?: string
  readonly resolvedSidebar?: readonly ResolvedSidebarSection[]
  readonly markdownPayload?: ResolvedMarkdownPage
  readonly session?: SessionInfo
  readonly badgeEnabled?: boolean
  readonly demoNoticeEnabled?: boolean
}

/**
 * Generic parameter names that require context from path segments
 * These parameters get prefixed with their context (e.g., product-id, user-key)
 */
const GENERIC_PARAM_NAMES = new Set(['id', 'key', 'uid', 'pk'])

/**
 * Converts route parameters to data attributes for testing
 * Uses context-aware naming: generic params (id, key) get prefixed, descriptive ones (slug) don't
 *
 * @param routeParams - Route parameters extracted from URL
 * @param path - Page path pattern (e.g., '/blog/:slug')
 * @returns Data attributes object
 */
function buildDataAttributes(
  routeParams: RouteParams | undefined,
  path: string | undefined
): Record<string, string> {
  if (!routeParams || !path) {
    return {}
  }

  const pathSegments = path.split('/').filter(Boolean)

  return Object.entries(routeParams).reduce<Record<string, string>>((acc, [key, value]) => {
    // Check if parameter name is generic and needs context
    if (GENERIC_PARAM_NAMES.has(key)) {
      // Generic parameter - add context from previous path segment
      // e.g., /products/:id -> data-product-id
      const paramIndex = pathSegments.findIndex((seg) => seg === `:${key}`)
      if (paramIndex > 0) {
        const contextSegment = pathSegments[paramIndex - 1]
        if (!contextSegment) {
          return { ...acc, [`data-${key}`]: value }
        }
        // Convert plural to singular (e.g., 'products' -> 'product')
        const singularContext = contextSegment.endsWith('s')
          ? contextSegment.slice(0, -1)
          : contextSegment
        return { ...acc, [`data-${singularContext}-${key}`]: value }
      }
      // No context available, use parameter name only
      return { ...acc, [`data-${key}`]: value }
    }
    // Descriptive parameter - use as-is (e.g., /blog/:slug -> data-slug)
    return { ...acc, [`data-${key}`]: value }
  }, {})
}

/** Stable identity for the toast container's flex stack to satisfy react-perf. */
const TOAST_CONTAINER_STYLE = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  minHeight: '1px',
} as const

/** Stable identity for the presence-indicator container to satisfy react-perf. */
const PRESENCE_CONTAINER_STYLE = { minHeight: '1px' } as const

/**
 * Renders the page-level presence-indicator island placeholder (Wave-6).
 *
 * Emitted on every page configured with `presence: true`. The placeholder
 * carries the page path as an island prop so the hydrated
 * `presence-indicator` island can open a page-path-scoped presence channel
 *. The visible `[data-testid="presence-indicator"]` div is
 * rendered server-side so the indicator is present even before hydration.
 */
function PresenceIndicatorMount({ page }: { readonly page: Page }): Readonly<ReactElement> {
  const islandProps = JSON.stringify({ pagePath: page.path })
  return (
    <div
      data-island="presence-indicator"
      data-island-props={islandProps}
      style={PRESENCE_CONTAINER_STYLE}
    >
      <div
        data-testid="presence-indicator"
        aria-label="Users viewing this page"
      />
    </div>
  )
}

/**
 * Returns the resolved sidebar sections only when the page actually
 * declares a sidebar AND the resolver produced at least one section.
 *
 * Extracted to keep `DynamicPageBody`'s cyclomatic complexity under
 * the project limit (`[internal ref]`: complexity 10).
 */
function selectSidebarSections(
  resolvedSidebar: readonly ResolvedSidebarSection[] | undefined,
  page: Page
): readonly ResolvedSidebarSection[] | undefined {
  if (resolvedSidebar === undefined || resolvedSidebar.length === 0) return undefined
  if (page.layout?.sidebar === undefined) return undefined
  return resolvedSidebar
}

/**
 * Renders the toast container element when page.toasts is configured.
 *
 * The container is the page's ONE standing live region, and it stays exactly
 * one: a toast that has to be announced urgently carries `role="alert"` on
 * itself (`islands/runtime/toast-accessibility.ts`) rather than being served a
 * second container, because a second one would make the selector union
 * `[data-toast-container], [role="status"], [aria-live="polite"]` match twice
 * for every reader of it.
 *
 * `data-dismiss-label` is the server→client channel for the dismiss control's
 * accessible name. The renderers that build that control run in the browser and
 * cannot see the page's locale, so the locale-resolved word is handed to them
 * here — the same way every other island label crosses that boundary.
 */
function PageToastContainer({
  toasts,
  lang,
}: {
  readonly toasts: NonNullable<DynamicPageBodyProps['page']['toasts']>
  readonly lang: string
}): Readonly<ReactElement> {
  return (
    <div
      data-sonner-toaster=""
      role="status"
      aria-live="polite"
      data-dismiss-label={getToastDismissLabel(lang)}
      {...(toasts.position !== undefined && { 'data-position': toasts.position })}
      style={TOAST_CONTAINER_STYLE}
    />
  )
}

/**
 * Persistent platform chrome: the "Built with Sovrium" badge (bottom-right) and
 * the demo context notice (bottom-left). Extracted from `DynamicPageBody` so the
 * two visibility gates live together — they are one visual system and the pair
 * has to stay clear of each other — and so the body renderer stays under the
 * complexity cap.
 *
 * The two gates have OPPOSITE defaults, deliberately:
 * - `badgeEnabled` is resolved from per-app config by the caller, so an absent
 *   value means "no app context" and renders nothing.
 * - `demoNoticeEnabled` is an override, not a source: whether the notice appears
 *   is decided by `SOVRIUM_DEMO_*` inside `DemoNotice`, so absent means "let the
 *   env decide" and only an explicit `false` suppresses it.
 */
function PlatformChrome({
  lang,
  badgeEnabled,
  demoNoticeEnabled,
}: {
  readonly lang: string
  readonly badgeEnabled?: boolean
  readonly demoNoticeEnabled?: boolean
}): Readonly<ReactElement> {
  return (
    <>
      {badgeEnabled === true && <SovriumBadge lang={lang} />}
      {demoNoticeEnabled !== false && <DemoNotice lang={lang} />}
    </>
  )
}

/**
 * Renders the <body> section of DynamicPage
 * Extracted to satisfy max-lines-per-function ESLint rule
 */
function DynamicPageBody({
  page,
  components,
  design,
  languages,
  tables,
  buckets,
  landingPath,
  direction,
  scripts,
  lang,
  bodyStyle,
  routeParams,
  islandEntryFile,
  resolvedSidebar,
  markdownPayload,
  session,
  badgeEnabled,
  demoNoticeEnabled,
}: DynamicPageBodyProps): Readonly<ReactElement> {
  const dataAttributes = buildDataAttributes(routeParams, page.path)
  const sidebarSections = selectSidebarSections(resolvedSidebar, page)

  return (
    <body
      {...(bodyStyle && { style: bodyStyle })}
      {...dataAttributes}
    >
      {/*
        Skip link ([internal ref], WCAG 2.4.1 "bypass blocks"): the
        FIRST focusable element in the page chrome. Visually hidden until
        focused (`sr-only focus:not-sr-only`), it targets `#main-content` so
        keyboard/AT users can jump straight past the header/nav to the main
        region. `PageMain` renders `<main id="main-content" tabindex="-1">` so
        activating the link moves focus into the main content region.
      */}
      <a
        href="#main-content"
        className="text-md sr-only z-50 rounded-md bg-neutral-900 px-4 py-2 font-medium text-neutral-50 focus:not-sr-only focus:absolute focus:top-2 focus:left-2"
      >
        Skip to main content
      </a>
      <PageBodyScripts
        page={page}
        design={design}
        languages={languages}
        direction={direction}
        scripts={scripts}
        position="start"
      />
      {sidebarSections && <PageSidebar sections={sidebarSections} />}
      <PageMain
        page={page}
        pageComponents={page.components}
        design={design}
        components={components}
        languages={languages}
        currentLang={lang}
        tables={tables}
        buckets={buckets}
        landingPath={landingPath}
        routeParams={routeParams}
        session={session}
        markdownPayload={markdownPayload}
      />
      {page.presence === true && <PresenceIndicatorMount page={page} />}
      {page.toasts && (
        <PageToastContainer
          toasts={page.toasts}
          lang={lang}
        />
      )}
      <PlatformChrome
        lang={lang}
        badgeEnabled={badgeEnabled}
        demoNoticeEnabled={demoNoticeEnabled}
      />

      <PageBodyScripts
        page={page}
        design={design}
        languages={languages}
        direction={direction}
        scripts={scripts}
        position="end"
        frontmatter={markdownPayload?.frontmatter}
      />
      {hasInteractiveFeatures(page, components) && (
        <script
          src="/assets/client.js"
          defer={true}
        />
      )}
      {hasIslandComponents(page, components) && islandEntryFile && (
        <script
          src={`/assets/islands/${islandEntryFile}`}
          type="module"
        />
      )}
    </body>
  )
}

/**
 * Renders a page from configuration as a complete HTML document
 * Theme CSS is compiled globally at server startup via /assets/output.css
 * Theme is still passed for font URLs, animation flags, and debugging
 */
export function DynamicPage({
  page,
  components,
  design,
  languages,
  tables,
  buckets,
  landingPath,
  detectedLanguage,
  urlLanguage,
  routeParams,
  builtInAnalyticsEnabled,
  builtInAnalyticsSessionTimeout,
  islandEntryFile,
  islandPreloadHrefs,
  resolvedSidebar,
  markdownPayload,
  session,
  cssHref,
  badgeEnabled,
  demoNoticeEnabled,
}: DynamicPageProps): Readonly<ReactElement> {
  // Resolve the locale ONCE, then hand it to the metadata extractor. Both used
  // to derive it independently, which is how `<html lang>` and `<title>` drifted
  // into different languages on the same document.
  const langConfig = resolvePageLanguage(page, languages, detectedLanguage, urlLanguage)
  const metadata = extractPageMetadata(page, design, languages, {
    lang: langConfig.lang,
    frontmatter: markdownPayload?.frontmatter,
  })
  const scripts = groupScriptsByPosition(page)
  const pageWithMeta = mergeComponentMetaIntoPage(page, components)

  return (
    <html
      lang={langConfig.lang}
      dir={langConfig.direction}
      {...(page.scripts && { 'data-features': JSON.stringify(page.scripts.features || {}) })}
    >
      <DynamicPageHead
        mergedPage={pageWithMeta}
        components={components}
        design={design}
        directionStyles={langConfig.directionStyles}
        cssHref={cssHref}
        islandPreloadHrefs={islandPreloadHrefs}
        title={metadata.title}
        description={metadata.description}
        keywords={metadata.keywords}
        canonical={metadata.canonical}
        lang={langConfig.lang}
        languages={languages}
        scripts={scripts}
        builtInAnalyticsEnabled={builtInAnalyticsEnabled}
        builtInAnalyticsSessionTimeout={builtInAnalyticsSessionTimeout}
        contentDirSeo={markdownPayload?.seo}
      />
      <DynamicPageBody
        page={page}
        components={components}
        design={design}
        languages={languages}
        tables={tables}
        buckets={buckets}
        landingPath={landingPath}
        direction={langConfig.direction}
        scripts={scripts}
        lang={langConfig.lang}
        bodyStyle={metadata.bodyStyle}
        routeParams={routeParams}
        islandEntryFile={islandEntryFile}
        resolvedSidebar={resolvedSidebar}
        markdownPayload={markdownPayload}
        session={session}
        badgeEnabled={badgeEnabled}
        demoNoticeEnabled={demoNoticeEnabled}
      />
    </html>
  )
}
