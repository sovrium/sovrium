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

const HIDDEN_STYLE = { display: 'none' } as const

type PageBodyScriptsProps = {
  readonly page: Page
  readonly theme: Theme | undefined
  readonly languages: Languages | undefined
  readonly direction: 'ltr' | 'rtl'
  readonly scripts: GroupedScripts
  readonly position: 'start' | 'end'
}

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
  const enrichedMeta = buildPageMetadataI18n(page, languages)

  return (
    <>
      {}
      <div
        data-language-switcher-config={JSON.stringify(languages)}
        style={HIDDEN_STYLE}
      />
      {}
      <div
        data-page-meta={JSON.stringify(enrichedMeta)}
        style={HIDDEN_STYLE}
      />
      {}
      {renderWindowConfig({
        windowKey: 'APP_LANGUAGES',
        data: {
          ...languages,
          fallback: languages.fallback ?? languages.default,
        },
        reactKey: 'window-app-languages',
      })}
      {}
      {renderWindowConfig({
        windowKey: 'APP_THEME',
        data: {
          ...(theme || {}),
          direction: direction,
        },
        reactKey: 'window-app-theme',
      })}
      {}
      <script
        src="/assets/language-switcher.js"
        defer={true}
      />
    </>
  )
}

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

function FeatureFlagsScript({ page }: { readonly page: Page }): ReactElement | undefined {
  if (!page.scripts?.features) return undefined
  return renderWindowConfig({
    windowKey: 'FEATURES',
    data: page.scripts.features,
    reactKey: 'window-features',
  })
}

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

const autoResizeScript = `!function(){function grow(el){el.style.height='auto';el.style.height=el.scrollHeight+'px'}var els=document.querySelectorAll('textarea[data-auto-resize]');for(var i=0;i<els.length;i++){(function(el){el.style.overflow='hidden';el.style.resize='none';el.addEventListener('input',function(){grow(el)});grow(el)})(els[i])}}();`

const clickScript = `!function(){function openModal(id){var c=document.getElementById(id);if(!c)return;c.style.display="";var d=c.querySelector('[role="dialog"]');if(d){d.focus()}}function closeModal(c){c.style.display="none"}document.addEventListener("click",function(t){var e=t.target.closest("[data-click-animation], [data-click-navigate], [data-click-open-url], [data-click-scroll-to], [data-click-toggle-element], [data-click-submit-form], [data-click-modal], [data-modal-close], [data-backdrop]");if(!e)return;if(e.hasAttribute("data-modal-close")){var mc=e.closest("[data-modal-container]");if(mc)closeModal(mc);return}if(e.hasAttribute("data-backdrop")&&t.target===e){var mc2=e.closest("[data-modal-container]");if(mc2)closeModal(mc2);return}var n=e.getAttribute("data-click-animation"),a=e.getAttribute("data-click-navigate"),c=e.getAttribute("data-click-open-url"),i=e.getAttribute("data-click-open-in-new-tab")==="true",o=e.getAttribute("data-click-scroll-to"),l=e.getAttribute("data-click-toggle-element"),r=e.getAttribute("data-click-submit-form"),m=e.getAttribute("data-click-modal"),s=c||a,d=!!c;if(m){openModal(m)}else if(r){var f=document.querySelector(r);f&&"FORM"===f.tagName&&f.requestSubmit()}else if(l){var g=document.querySelector(l);if(g){var h="none"===window.getComputedStyle(g).display;g.style.display=h?"":"none"}}else if(o){var j=document.querySelector(o);j&&j.scrollIntoView({behavior:"smooth",block:"start"})}else if(n&&"none"!==n){var k="animate-"+n;if(e.classList.add(k),s){var done=!1;var cb=function(){done||(done=!0,e.classList.remove(k),d&&i?window.open(s,"_blank"):window.location.href=s)};e.addEventListener("animationend",cb,{once:!0});setTimeout(cb,300)}else{var cb2=function(){e.classList.remove(k)};e.addEventListener("animationend",cb2,{once:!0});setTimeout(cb2,300)}}else s&&(d&&i?window.open(s,"_blank"):window.location.href=s)});document.addEventListener("keydown",function(e){if(e.key==="Escape"){var open=document.querySelector('[data-modal-container]:not([style*="display: none"])');if(!open){var all=document.querySelectorAll("[data-modal-container]");for(var i=0;i<all.length;i++){if(all[i].style.display!=="none"){open=all[i];break}}}if(open)closeModal(open)}})}();`

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
      {}
      {page.scripts?.config &&
        renderWindowConfig({
          windowKey: 'APP_CONFIG',
          data: page.scripts.config,
          reactKey: 'window-app-config-body',
        })}
      {}
      {}
      <script dangerouslySetInnerHTML={{ __html: clickScript + autoResizeScript }} />
    </>
  )
}

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
