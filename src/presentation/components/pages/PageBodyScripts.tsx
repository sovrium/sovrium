/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import {
  renderInlineScriptTag,
  renderScriptTag,
  renderWindowConfig,
} from '@/presentation/scripts/script-renderers'
import { buildPageMetadataI18n } from './PageMetadataI18n'
import type { GroupedScripts } from './PageScripts'
import type { Languages } from '@/domain/models/app/languages'
import type { SectionItem } from '@/domain/models/app/page/sections'
import type { Page } from '@/domain/models/app/pages'
import type { Theme } from '@/domain/models/app/theme'

/**
 * Props for PageBodyScripts component
 */
type PageBodyScriptsProps = {
  readonly page: Page
  readonly theme: Theme | undefined
  readonly languages: Languages | undefined
  readonly direction: 'ltr' | 'rtl'
  readonly scripts: GroupedScripts
  readonly position: 'start' | 'end'
}

/**
 * Renders external and inline scripts for a given position
 */
function renderScripts(
  externalScripts: GroupedScripts['external']['head'],
  inlineScripts: GroupedScripts['inline']['head'],
  keyPrefix: string
): ReactElement {
  return (
    <>
      {externalScripts.map((script, index) =>
        renderScriptTag({
          src: script.src,
          async: script.async,
          defer: script.defer,
          module: script.module,
          integrity: script.integrity,
          crossOrigin: script.crossorigin as 'anonymous' | 'use-credentials' | undefined,
          reactKey: `${keyPrefix}-${index}`,
        })
      )}
      {inlineScripts.map((script, index) =>
        renderInlineScriptTag({
          code: script.code,
          async: script.async,
          reactKey: `inline-${keyPrefix}-${index}`,
        })
      )}
    </>
  )
}

/**
 * Renders language switcher scripts and configuration
 */
function LanguageSwitcherScripts({
  page,
  languages,
  theme,
  direction,
}: {
  readonly page: Page
  readonly languages: Languages
  readonly theme: Theme | undefined
  readonly direction: 'ltr' | 'rtl'
}): ReactElement {
  // Build enriched metadata with i18n translations for all languages
  const enrichedMeta = buildPageMetadataI18n(page, languages)

  return (
    <>
      {/* Configuration data for external script (CSP-compliant) */}
      <div
        data-language-switcher-config={JSON.stringify(languages)}
        style={{ display: 'none' }}
      />
      {/* Page metadata for client-side updates (title, i18n) */}
      <div
        data-page-meta={JSON.stringify(enrichedMeta)}
        style={{ display: 'none' }}
      />
      {/* Expose languages config to window for testing/debugging - fallback defaults to default language */}
      {renderWindowConfig({
        windowKey: 'APP_LANGUAGES',
        data: {
          ...languages,
          fallback: languages.fallback ?? languages.default,
        },
        reactKey: 'window-app-languages',
      })}
      {/* Expose theme config with RTL-aware direction to window for testing/debugging */}
      {renderWindowConfig({
        windowKey: 'APP_THEME',
        data: {
          ...(theme || {}),
          direction: direction,
        },
        reactKey: 'window-app-theme',
      })}
      {/* External script file loaded only when needed (defer ensures DOM is ready) */}
      <script
        src="/assets/language-switcher.js"
        defer={true}
      />
    </>
  )
}

/**
 * Check if section or its children have scroll interactions
 */
function hasSectionScrollInteraction(section: SectionItem): boolean {
  // Type guard: check if this is a component (not a string or block reference)
  if (typeof section === 'string') {
    return false
  }

  // Check if section has scroll interactions
  if ('interactions' in section && section.interactions?.scroll) {
    return true
  }

  // Recursively check children if they exist
  if ('children' in section && Array.isArray(section.children)) {
    return section.children.some((child: SectionItem) => hasSectionScrollInteraction(child))
  }

  return false
}

/**
 * Check if page has scroll interactions in any section
 */
function hasScrollInteractions(sections: readonly SectionItem[]): boolean {
  return sections.some((section) => hasSectionScrollInteraction(section))
}

/**
 * Check if page needs scroll animation script
 */
function needsScrollAnimationScript(page: Page, theme: Theme | undefined): boolean {
  return hasScrollInteractions(page.sections) || theme?.animations?.scaleUp === true
}

/**
 * Renders banner dismiss script if banner is dismissible
 */
function renderBannerScript(page: Page): ReactElement | undefined {
  if (!page.layout?.banner?.dismissible) {
    return undefined
  }

  return (
    <script
      src="/assets/banner-dismiss.js"
      defer={true}
    />
  )
}

/**
 * Renders scroll animation script if needed
 */
function renderScrollAnimationScript(page: Page, theme: Theme | undefined): ReactElement | undefined {
  if (!needsScrollAnimationScript(page, theme)) {
    return undefined
  }

  return (
    <script
      src="/assets/scroll-animation.js"
      defer={true}
    />
  )
}

/**
 * Renders feature flags configuration
 */
function renderFeatureFlags(page: Page): ReactElement | undefined {
  if (!page.scripts?.features) {
    return undefined
  }

  return renderWindowConfig({
    windowKey: 'FEATURES',
    data: page.scripts.features,
    reactKey: 'window-features',
  })
}

/**
 * Renders conditional script tags (banner, animation, features)
 */
function renderConditionalScripts(config: {
  readonly page: Page
  readonly theme: Theme | undefined
  readonly languages: Languages | undefined
  readonly direction: 'ltr' | 'rtl'
}): ReactElement {
  const { page, theme, languages, direction } = config

  return (
    <>
      {renderBannerScript(page)}
      {renderScrollAnimationScript(page, theme)}
      {languages && (
        <LanguageSwitcherScripts
          page={page}
          languages={languages}
          theme={theme}
          direction={direction}
        />
      )}
      {renderFeatureFlags(page)}
    </>
  )
}

/**
 * Click interaction handler (SECURITY: Safe - static code, no user input)
 */
const clickScript = `!function(){document.addEventListener("click",function(t){const e=t.target.closest("[data-click-animation], [data-click-navigate], [data-click-open-url], [data-click-scroll-to], [data-click-toggle-element], [data-click-submit-form]");if(!e)return;const n=e.getAttribute("data-click-animation"),a=e.getAttribute("data-click-navigate"),c=e.getAttribute("data-click-open-url"),i=e.getAttribute("data-click-open-in-new-tab")==="true",o=e.getAttribute("data-click-scroll-to"),l=e.getAttribute("data-click-toggle-element"),r=e.getAttribute("data-click-submit-form"),s=c||a,d=!!c;if(r){const t=document.querySelector(r);t&&"FORM"===t.tagName&&t.requestSubmit()}else if(l){const t=document.querySelector(l);if(t){const e="none"===window.getComputedStyle(t).display;t.style.display=e?"":"none"}}else if(o){const t=document.querySelector(o);t&&t.scrollIntoView({behavior:"smooth",block:"start"})}else if(n&&"none"!==n){const t="animate-"+n;if(e.classList.add(t),s){let n=!1;const a=function(){n||(n=!0,e.classList.remove(t),d&&i?window.open(s,"_blank"):window.location.href=s)};e.addEventListener("animationend",a,{once:!0}),setTimeout(a,300)}else{const n=function(){e.classList.remove(t)};e.addEventListener("animationend",n,{once:!0}),setTimeout(n,300)}}else s&&(d&&i?window.open(s,"_blank"):window.location.href=s)})}();`

/**
 * Renders scripts for body end position
 */
function renderBodyEndScripts(config: {
  readonly page: Page
  readonly theme: Theme | undefined
  readonly languages: Languages | undefined
  readonly direction: 'ltr' | 'rtl'
  readonly scripts: GroupedScripts
}): ReactElement {
  const { page, theme, languages, direction, scripts } = config
  return (
    <>
      {renderScripts(scripts.external.bodyEnd, scripts.inline.bodyEnd, 'body-end')}
      {renderConditionalScripts({ page, theme, languages, direction })}
      <script dangerouslySetInnerHTML={{ __html: clickScript }} />
    </>
  )
}

/**
 * Renders scripts for body start or end position
 *
 * For 'start' position:
 * - External and inline scripts positioned at body-start
 *
 * For 'end' position:
 * - External and inline scripts positioned at body-end
 * - Banner dismiss script (if banner is dismissible)
 * - Scroll animation script (if theme has scaleUp animation)
 * - Language switcher script (if languages configured)
 * - Feature flags script (if features configured)
 *
 * @param props - Component props
 * @returns Script elements for the specified position
 */
export function PageBodyScripts({
  page,
  theme,
  languages,
  direction,
  scripts,
  position,
}: PageBodyScriptsProps): Readonly<ReactElement> {
  if (position === 'start') {
    return renderScripts(scripts.external.bodyStart, scripts.inline.bodyStart, 'body-start')
  }

  return renderBodyEndScripts({ page, theme, languages, direction, scripts })
}
