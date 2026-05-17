/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
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

/** Stable identity for `style={{ display: 'none' }}` reuse to satisfy react-perf. */
const HIDDEN_STYLE = { display: 'none' } as const

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
        style={HIDDEN_STYLE}
      />
      {/* Page metadata for client-side updates (title, i18n) */}
      <div
        data-page-meta={JSON.stringify(enrichedMeta)}
        style={HIDDEN_STYLE}
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
 * Renders scroll animation script if needed
 */
function ScrollAnimationScript({
  page,
  theme,
}: {
  readonly page: Page
  readonly theme: Theme | undefined
}): ReactElement | undefined {
  const needsAnimation =
    (page.components && page.components.length > 0) || theme?.animations?.scaleUp
  if (!needsAnimation) return undefined
  return (
    <script
      src="/assets/scroll-animation.js"
      defer={true}
    />
  )
}

/**
 * Renders feature flags configuration if configured
 */
function FeatureFlagsScript({ page }: { readonly page: Page }): ReactElement | undefined {
  if (!page.scripts?.features) return undefined
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
      <ScrollAnimationScript
        page={page}
        theme={theme}
      />
      {languages && (
        <LanguageSwitcherScripts
          page={page}
          languages={languages}
          theme={theme}
          direction={direction}
        />
      )}
      <FeatureFlagsScript page={page} />
    </>
  )
}

/**
 * Auto-resize handler for textareas marked with `data-auto-resize`.
 *
 * Centralized counterpart to per-renderer inline scripts: discovers every
 * `<textarea data-auto-resize>` on body-end parse, sets `overflow:hidden;
 * resize:none` so the natural `scrollHeight` drives layout, and wires an
 * `input` listener that sets `style.height = scrollHeight + 'px'` on each
 * keystroke. Initial pass also runs `grow()` once so pre-filled content
 * sizes correctly on first paint.
 *
 * Pattern mirrors `clickScript` below: stateless behavioral enhancer that
 * runs synchronously during HTML parse — attaches before Playwright's
 * `fill()` (which waits for `load`) and before any user interaction in
 * production. No island runtime / no Suspense timing dependency. Used by
 * `renderTextarea` (see field-renderer.tsx) which only emits a
 * `data-auto-resize` attribute when the schema asks for it.
 *
 * SECURITY: Safe - static code, no user input.
 */
const autoResizeScript = `!function(){function grow(el){el.style.height='auto';el.style.height=el.scrollHeight+'px'}var els=document.querySelectorAll('textarea[data-auto-resize]');for(var i=0;i<els.length;i++){(function(el){el.style.overflow='hidden';el.style.resize='none';el.addEventListener('input',function(){grow(el)});grow(el)})(els[i])}}();`

/**
 * Click interaction handler (SECURITY: Safe - static code, no user input)
 */
const clickScript = `!function(){function openModal(id){var c=document.getElementById(id);if(!c)return;c.style.display="";var d=c.querySelector('[role="dialog"]');if(d){d.focus()}}function closeModal(c){c.style.display="none"}document.addEventListener("click",function(t){var e=t.target.closest("[data-click-animation], [data-click-navigate], [data-click-open-url], [data-click-scroll-to], [data-click-toggle-element], [data-click-submit-form], [data-click-modal], [data-modal-close], [data-backdrop]");if(!e)return;if(e.hasAttribute("data-modal-close")){var mc=e.closest("[data-modal-container]");if(mc)closeModal(mc);return}if(e.hasAttribute("data-backdrop")&&t.target===e){var mc2=e.closest("[data-modal-container]");if(mc2)closeModal(mc2);return}var n=e.getAttribute("data-click-animation"),a=e.getAttribute("data-click-navigate"),c=e.getAttribute("data-click-open-url"),i=e.getAttribute("data-click-open-in-new-tab")==="true",o=e.getAttribute("data-click-scroll-to"),l=e.getAttribute("data-click-toggle-element"),r=e.getAttribute("data-click-submit-form"),m=e.getAttribute("data-click-modal"),s=c||a,d=!!c;if(m){openModal(m)}else if(r){var f=document.querySelector(r);f&&"FORM"===f.tagName&&f.requestSubmit()}else if(l){var g=document.querySelector(l);if(g){var h="none"===window.getComputedStyle(g).display;g.style.display=h?"":"none"}}else if(o){var j=document.querySelector(o);j&&j.scrollIntoView({behavior:"smooth",block:"start"})}else if(n&&"none"!==n){var k="animate-"+n;if(e.classList.add(k),s){var done=!1;var cb=function(){done||(done=!0,e.classList.remove(k),d&&i?window.open(s,"_blank"):window.location.href=s)};e.addEventListener("animationend",cb,{once:!0});setTimeout(cb,300)}else{var cb2=function(){e.classList.remove(k)};e.addEventListener("animationend",cb2,{once:!0});setTimeout(cb2,300)}}else s&&(d&&i?window.open(s,"_blank"):window.location.href=s)});document.addEventListener("keydown",function(e){if(e.key==="Escape"){var open=document.querySelector('[data-modal-container]:not([style*="display: none"])');if(!open){var all=document.querySelectorAll("[data-modal-container]");for(var i=0;i<all.length;i++){if(all[i].style.display!=="none"){open=all[i];break}}}if(open)closeModal(open)}})}();`

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
      {/*
        Stateless behavioral enhancer scripts are concatenated into a single
        <script> tag (rather than emitted as separate elements) to keep the
        page-level inline-script count stable. APP-PAGES-SCRIPTS-004 asserts
        `script:not([src])` matches exactly one element under strict mode;
        adding a sibling <script> here would break that contract for a
        non-feature reason. Order: clickScript first (delegated click/modal
        handling) then autoResizeScript (textarea grow) — both are IIFEs so
        their internals don't leak across.
      */}
      {/* eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- SSR-only <script> element; never re-renders client-side */}
      <script dangerouslySetInnerHTML={{ __html: clickScript + autoResizeScript }} />
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
