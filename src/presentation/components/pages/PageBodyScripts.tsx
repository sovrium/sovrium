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
 * Checks if scroll animation script should be loaded
 */
function shouldLoadScrollAnimation(
  page: Page,
  theme: Theme | undefined
): boolean {
  const hasSections = page.sections && page.sections.length > 0
  const hasScaleUpAnimation = theme?.animations?.scaleUp
  return hasSections || !!hasScaleUpAnimation
}

/**
 * Renders banner dismiss script if needed
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
function renderScrollAnimationScript(
  page: Page,
  theme: Theme | undefined
): ReactElement | undefined {
  if (!shouldLoadScrollAnimation(page, theme)) {
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
 * Renders feature flags window config if configured
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
      {/* Client-side banner dismiss functionality - inject when banner is dismissible */}
      {renderBannerScript(page)}
      {/* Client-side scroll animation functionality - inject when page has sections or theme has scaleUp */}
      {renderScrollAnimationScript(page, theme)}
      {/* Client-side language switcher functionality - always inject when languages configured */}
      {languages && (
        <LanguageSwitcherScripts
          page={page}
          languages={languages}
          theme={theme}
          direction={direction}
        />
      )}
      {/* Client-side feature flags - inject when features configured */}
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
      {/* Render APP_CONFIG after inline scripts to merge with any existing values */}
      {page.scripts?.config &&
        renderWindowConfig({
          windowKey: 'APP_CONFIG',
          data: page.scripts.config,
          reactKey: 'window-app-config-body',
        })}
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
