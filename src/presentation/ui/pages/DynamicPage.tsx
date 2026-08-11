/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { SovriumBadge } from '@/presentation/ui/badge/sovrium-badge'
import { DemoNotice } from '@/presentation/ui/demo-notice/demo-notice'
import { extractComponentMetaFromSections } from '@/presentation/ui/metadata/extract-component-meta'
import {
  COMMAND_PALETTE_CAPTURE_SCRIPT,
  hasCommandPaletteHost,
} from '@/presentation/ui/pages/CommandPaletteCapture'
import { PageBodyScripts } from '@/presentation/ui/pages/PageBodyScripts'
import { PageHead } from '@/presentation/ui/pages/PageHead'
import { hasIslandComponents } from '@/presentation/ui/pages/PageIslandDetection'
import { resolvePageLanguage } from '@/presentation/ui/pages/PageLangResolver'
import { PageMain } from '@/presentation/ui/pages/PageMain'
import { extractPageMetadata } from '@/presentation/ui/pages/PageMetadata'
import { groupScriptsByPosition } from '@/presentation/ui/pages/PageScripts'
import { PageSidebar } from '@/presentation/ui/pages/PageSidebar'
// Island-runtime detection lives in PageIslandDetection.ts (extracted on main);
// this file keeps only interactive-runtime detection, which shares the same
// reference-aware walker so a template-hosted action button also ships client.js.
import { someComponentInTree } from '@/presentation/utils/component-template-walker'
import type { Buckets } from '@/domain/models/app/buckets'
import type { Components } from '@/domain/models/app/components'
import type { Languages } from '@/domain/models/app/languages'
import type { Page } from '@/domain/models/app/pages'
import type { Tables } from '@/domain/models/app/tables'
import type { Theme } from '@/domain/models/app/theme'
import type { SessionInfo } from '@/domain/types/session-info'
import type { RouteParams } from '@/domain/utils/matching/route-matcher'
import type { ResolvedMarkdownPage } from '@/presentation/rendering/markdown-page-resolver'
import type { ResolvedSidebarSection } from '@/presentation/rendering/sidebar-resolver'

type DynamicPageProps = {
  readonly page: Page
  readonly components?: Components
  readonly theme?: Theme
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

type DynamicPageHeadProps = {
  readonly mergedPage: Page
  /** `app.components` templates — needed so the no-FOUC color-scheme
   * detection can see a `theme-toggle` hosted inside a referenced template. */
  readonly components?: Components
  readonly theme?: Theme
  readonly directionStyles: string
  /** Content-versioned stylesheet URL — see `PageHeadProps.cssHref`. */
  readonly cssHref?: string
  readonly title: string
  readonly description: string
  readonly keywords?: string
  readonly canonical?: string
  readonly lang: string
  readonly languages?: Languages
  readonly scripts: ReturnType<typeof groupScriptsByPosition>
  readonly builtInAnalyticsEnabled?: boolean
  readonly builtInAnalyticsSessionTimeout?: number
  readonly contentDirSeo?: ResolvedMarkdownPage['seo']
}

const INTERACTIVE_COMPONENT_TYPES = new Set(['form', 'modal', 'data-table', 'dropdown'])

/**
 * True for a component that binds to the caller's session: a `session` field, or a `$session.<field>` token in `content`.
 * Such a `text` carries no `action`, so without this it would never emit
 * `/assets/client.js` and the global session-text enhancer (which fills it from
 * `GET /api/auth/get-session`) would never run.
 */
function componentIsSessionBound(record: Record<string, unknown>): boolean {
  if (typeof record['session'] === 'string') return true
  const { content } = record
  return typeof content === 'string' && content.includes('$session.')
}

/** True if THIS component (ignoring children) is interactive. */
function componentSelfIsInteractive(record: Record<string, unknown>): boolean {
  const { type } = record
  if (typeof type === 'string' && INTERACTIVE_COMPONENT_TYPES.has(type)) return true
  if (record['action']) return true
  if (componentIsSessionBound(record)) return true
  const props = record['props'] as Record<string, unknown> | undefined
  return Boolean(props?.['action'] || props?.['interactions'])
}

/**
 * Checks if a page has interactive features that require the client runtime
 *
 * Returns true if the page has components with action types (auth, crud, filter),
 * modal components, or interactive patterns like dropdowns and search — at any
 * nesting depth. Action buttons are frequently nested inside layout containers
 * (header → section → card → button) OR hosted inside a referenced
 * `app.components` template, so detection walks children AND resolves
 * references (via `someComponentInTree`) — otherwise a deeply-nested or
 * template-hosted logout/automation button would never emit
 * `/assets/client.js` and the button would be inert.
 */
function hasInteractiveFeatures(page: Page, components?: Components): boolean {
  return someComponentInTree(page.components, components, componentSelfIsInteractive)
}

/**
 * Merges component metadata with page metadata
 *
 * @param page - Page configuration
 * @param components - Available component templates
 * @returns Page with merged metadata
 */
function mergeComponentMetaIntoPage(page: Page, components?: Components): Page {
  const componentOpenGraph = extractComponentMetaFromSections(page.components, components)

  if (!componentOpenGraph || !page.meta) return page

  return {
    ...page,
    meta: {
      ...page.meta,
      openGraph: {
        ...page.meta.openGraph,
        ...componentOpenGraph,
      },
    },
  }
}

/**
 * Renders the <head> section of DynamicPage
 * Extracted to satisfy max-lines-per-function ESLint rule
 */
function DynamicPageHead({
  mergedPage,
  components,
  theme,
  directionStyles,
  cssHref,
  title,
  description,
  keywords,
  canonical,
  lang,
  languages,
  scripts,
  builtInAnalyticsEnabled,
  builtInAnalyticsSessionTimeout,
  contentDirSeo,
}: DynamicPageHeadProps): Readonly<ReactElement> {
  // Inline analytics script if enabled (contains /api/analytics/collect endpoint)
  const analyticsScript = builtInAnalyticsEnabled
    ? `(function(){
"use strict";
var E="/api/analytics/collect",A="${mergedPage.name || 'app'}",D=true,sessionTimeout=${builtInAnalyticsSessionTimeout ?? 30};
if(D&&navigator.doNotTrack==="1")return;
var u=function(){
try{var s=new URLSearchParams(location.search);
var d={p:location.pathname,t:document.title,r:document.referrer||void 0,
sw:screen.width,sh:screen.height,
us:s.get("utm_source")||void 0,um:s.get("utm_medium")||void 0,
uc:s.get("utm_campaign")||void 0,ux:s.get("utm_content")||void 0,
ut:s.get("utm_term")||void 0};
var b=JSON.stringify(d);
if(navigator.sendBeacon){navigator.sendBeacon(E,new Blob([b],{type:"application/json"}))}
else{var x=new XMLHttpRequest();x.open("POST",E,true);x.setRequestHeader("Content-Type","application/json");x.send(b)}
}catch(e){}};
u();
var op=history.pushState;
history.pushState=function(){op.apply(this,arguments);u()};
window.addEventListener("popstate",u);
})();`
    : undefined

  return (
    <head>
      {/* Emitted FIRST in <head> so it executes at the very start of HTML parse
          — before any other tag — and attaches the ⌘K capture listener as early
          as a synchronous inline script can, minimizing the window in which a
          post-navigation ⌘K could land before the listener is live. */}
      {hasCommandPaletteHost(mergedPage.components) && (
        // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- SSR-only <script> element; never re-renders client-side
        <script dangerouslySetInnerHTML={{ __html: COMMAND_PALETTE_CAPTURE_SCRIPT }} />
      )}
      <PageHead
        page={mergedPage}
        components={components}
        theme={theme}
        directionStyles={directionStyles}
        cssHref={cssHref}
        title={title}
        description={description}
        keywords={keywords}
        canonical={canonical}
        lang={lang}
        languages={languages}
        scripts={scripts}
        contentDirSeo={contentDirSeo}
      />
      {analyticsScript && (
        // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- SSR-only <script> element; never re-renders client-side
        <script dangerouslySetInnerHTML={{ __html: analyticsScript }} />
      )}
    </head>
  )
}

type DynamicPageBodyProps = {
  readonly page: Page
  readonly components?: Components
  readonly theme?: Theme
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
 */
function PageToastContainer({
  toasts,
}: {
  readonly toasts: NonNullable<DynamicPageBodyProps['page']['toasts']>
}): Readonly<ReactElement> {
  return (
    <div
      data-sonner-toaster=""
      role="status"
      aria-live="polite"
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
  theme,
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
        className="sr-only z-50 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-neutral-50 focus:not-sr-only focus:absolute focus:top-2 focus:left-2"
      >
        Skip to main content
      </a>
      <PageBodyScripts
        page={page}
        theme={theme}
        languages={languages}
        direction={direction}
        scripts={scripts}
        position="start"
      />
      {sidebarSections && <PageSidebar sections={sidebarSections} />}
      <PageMain
        page={page}
        pageComponents={page.components}
        theme={theme}
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
      {page.toasts && <PageToastContainer toasts={page.toasts} />}
      <PlatformChrome
        lang={lang}
        badgeEnabled={badgeEnabled}
        demoNoticeEnabled={demoNoticeEnabled}
      />

      <PageBodyScripts
        page={page}
        theme={theme}
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
  theme,
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
  const metadata = extractPageMetadata(page, theme, languages, {
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
        theme={theme}
        directionStyles={langConfig.directionStyles}
        cssHref={cssHref}
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
        theme={theme}
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
