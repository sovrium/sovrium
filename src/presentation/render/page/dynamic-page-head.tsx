/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { buildAnalyticsBeaconScript } from '@/presentation/render/page/analytics-beacon-script'
import {
  COMMAND_PALETTE_CAPTURE_SCRIPT,
  hasCommandPaletteHost,
  hasDrawerSidebar,
  SIDEBAR_DRAWER_TOGGLE_SCRIPT,
} from '@/presentation/render/page/command-palette-capture'
import { IslandPreloadLinks } from '@/presentation/render/page/island-preload-links'
import { PageHead } from '@/presentation/render/page/page-head'
// Island-runtime detection lives in page-island-detection.ts (extracted on main);
// this file keeps only interactive-runtime detection, which shares the same
// reference-aware walker so a template-hosted action button also ships client.js.
import type { Components } from '@/domain/models/app/components'
import type { Design } from '@/domain/models/app/design'
import type { Languages } from '@/domain/models/app/languages'
import type { Page } from '@/domain/models/app/pages'
import type { ResolvedMarkdownPage } from '@/presentation/render/markdown/markdown-page-resolver'
import type { groupScriptsByPosition } from '@/presentation/render/page/page-scripts'

export type DynamicPageHeadProps = {
  readonly mergedPage: Page
  /** `app.components` templates — needed so the no-FOUC color-scheme
   * detection can see a `theme-toggle` hosted inside a referenced template. */
  readonly components?: Components
  readonly design?: Design
  readonly directionStyles: string
  /** Content-versioned stylesheet URL — see `PageHeadProps.cssHref`. */
  readonly cssHref?: string
  /** Island `modulepreload` hrefs — see {@link IslandPreloadLinks}. */
  readonly islandPreloadHrefs?: readonly string[]
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

/**
 * Renders the <head> section of DynamicPage
 * Extracted to satisfy max-lines-per-function ESLint rule
 */
export function DynamicPageHead({
  mergedPage,
  components,
  design,
  directionStyles,
  cssHref,
  islandPreloadHrefs,
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
    ? buildAnalyticsBeaconScript(mergedPage.name || 'app', builtInAnalyticsSessionTimeout)
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
      {/* The mobile drawer toggle, on its OWN gate. It used to ride inside the
          palette capture above, which left a page with a sidebar and no palette
          with no way to open its navigation on a narrow viewport. */}
      {hasDrawerSidebar(mergedPage.components) && (
        // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- SSR-only <script> element; never re-renders client-side
        <script dangerouslySetInnerHTML={{ __html: SIDEBAR_DRAWER_TOGGLE_SCRIPT }} />
      )}
      <PageHead
        page={mergedPage}
        components={components}
        design={design}
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
      <IslandPreloadLinks hrefs={islandPreloadHrefs} />
      {analyticsScript && (
        // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- SSR-only <script> element; never re-renders client-side
        <script dangerouslySetInnerHTML={{ __html: analyticsScript }} />
      )}
    </head>
  )
}
