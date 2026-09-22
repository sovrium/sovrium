/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { isLocalDevDefault } from '@/domain/models/process-env/dev-mode'
import { isSchemaAuthoredComponent } from '@/presentation/render/registry/synthesized-component-types'
import {
  renderInlineScriptTag,
  renderScriptTag,
  renderWindowConfig,
} from '@/presentation/render/scripts/script-renderers'
import { buildPageMetadataI18n } from './page-metadata-i18n'
import type { GroupedScripts } from './page-scripts'
import type { Design } from '@/domain/models/app/design'
import type { Languages } from '@/domain/models/app/languages'
import type { Page } from '@/domain/models/app/pages'

/** Stable identity for `style={{ display: 'none' }}` reuse to satisfy react-perf. */
const HIDDEN_STYLE = { display: 'none' } as const

/**
 * Props for PageBodyScripts component
 */
type PageBodyScriptsProps = {
  readonly page: Page
  readonly design: Design | undefined
  readonly languages: Languages | undefined
  readonly direction: 'ltr' | 'rtl'
  readonly scripts: GroupedScripts
  readonly position: 'start' | 'end'
  /** Rendered-markdown frontmatter for `$frontmatter.*` resolution in i18n meta. */
  readonly frontmatter?: Readonly<Record<string, string>>
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
  design,
  direction,
  frontmatter,
}: {
  readonly page: Page
  readonly languages: Languages
  readonly design: Design | undefined
  readonly direction: 'ltr' | 'rtl'
  readonly frontmatter?: Readonly<Record<string, string>>
}): ReactElement {
  // Build enriched metadata with i18n translations for all languages
  const enrichedMeta = buildPageMetadataI18n(page, languages, frontmatter)

  // Deliberately excludes `translations`: the client switcher reads only these
  // fields (per-element strings arrive via `data-translations` attributes), and
  // the full dictionary is ~100s of KB serialized into EVERY page — twice.
  const switcherConfig = {
    supported: languages.supported,
    default: languages.default,
    fallback: languages.fallback ?? languages.default,
    ...(languages.detectBrowser !== undefined ? { detectBrowser: languages.detectBrowser } : {}),
    ...(languages.persistSelection !== undefined
      ? { persistSelection: languages.persistSelection }
      : {}),
  }

  return (
    <>
      {/* Configuration data for external script (CSP-compliant) */}
      <div
        data-language-switcher-config={JSON.stringify(switcherConfig)}
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
        data: switcherConfig,
        reactKey: 'window-app-languages',
      })}
      {/* Expose design config with RTL-aware direction to window for testing/debugging */}
      {renderWindowConfig({
        windowKey: 'APP_THEME',
        data: {
          ...(design || {}),
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
  design,
}: {
  readonly page: Page
  readonly design: Design | undefined
}): ReactElement | undefined {
  // Count only schema-authored components — the render-time-synthesized
  // `command-palette` is appended to every page and must not, on its own,
  // make an otherwise-empty page emit the scroll-animation script.
  const hasAuthoredComponents = (page.components ?? []).some((item) =>
    isSchemaAuthoredComponent(item.type)
  )
  const needsAnimation = hasAuthoredComponents || design?.motion?.animations?.scaleUp
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
  readonly design: Design | undefined
  readonly languages: Languages | undefined
  readonly direction: 'ltr' | 'rtl'
  readonly frontmatter?: Readonly<Record<string, string>>
}): ReactElement {
  const { page, design, languages, direction, frontmatter } = config
  return (
    <>
      <ScrollAnimationScript
        page={page}
        design={design}
      />
      {languages && (
        <LanguageSwitcherScripts
          page={page}
          languages={languages}
          design={design}
          direction={direction}
          frontmatter={frontmatter}
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
 *
 * `openModal` clears `hidden` / `aria-hidden` off the `[role="dialog"]` panel
 * before focusing it, because a SECOND modal lifecycle exists in the client
 * bundle: `setupModalHandlers` in `src/presentation/client.ts` stamps both
 * attributes on `[role="dialog"]:not([hidden])` when Escape is pressed, and on
 * a `[data-backdrop]` click, and never removes them again. That handler keys on
 * the ARIA role rather than on this enhancer's `[data-modal-container]`
 * contract, so it reaches an enhancer-driven overlay it knows nothing about:
 * the container reopens (its inline `display` is restored here) while the panel
 * inside it stays `hidden` forever, leaving a visible backdrop over an empty
 * screen from the first Escape onward.
 *
 * Clearing on open rather than deleting that handler is deliberate — it also
 * serves the older `[data-modal-trigger]` contract, and making open idempotent
 * costs one statement. `command-palette-runtime.ts` already does exactly this,
 * for exactly this reason; see the comment above its `removeAttribute('hidden')`.
 */
const clickScript = `!function(){function openModal(id){window.__sovriumOpenModals=window.__sovriumOpenModals||{};window.__sovriumOpenModals[id]=true;var c=document.getElementById(id);if(!c)return;c.style.display="";var d=c.querySelector('[role="dialog"]');if(d){d.removeAttribute("hidden");d.setAttribute("aria-hidden","false");d.focus()}}function closeModal(c){c.style.display="none"}document.addEventListener("click",function(t){var e=t.target.closest("[data-click-animation], [data-click-navigate], [data-click-open-url], [data-click-scroll-to], [data-click-toggle-element], [data-click-submit-form], [data-click-modal], [data-modal-close], [data-backdrop]");if(!e)return;if(e.hasAttribute("data-modal-close")){var mc=e.closest("[data-modal-container]");if(mc)closeModal(mc);return}if(e.hasAttribute("data-backdrop")&&t.target===e){var mc2=e.closest("[data-modal-container]");if(mc2)closeModal(mc2);return}var n=e.getAttribute("data-click-animation"),a=e.getAttribute("data-click-navigate"),c=e.getAttribute("data-click-open-url"),i=e.getAttribute("data-click-open-in-new-tab")==="true",o=e.getAttribute("data-click-scroll-to"),l=e.getAttribute("data-click-toggle-element"),r=e.getAttribute("data-click-submit-form"),m=e.getAttribute("data-click-modal"),s=c||a,d=!!c;if(m){openModal(m)}else if(r){var f=document.querySelector(r);f&&"FORM"===f.tagName&&f.requestSubmit()}else if(l){var g=document.querySelector(l);if(g){var h="none"===window.getComputedStyle(g).display;g.style.display=h?"":"none"}}else if(o){var j=document.querySelector(o);j&&j.scrollIntoView({behavior:"smooth",block:"start"})}else if(n&&"none"!==n){var k="animate-click-"+n;if(e.classList.add(k),s){var done=!1;var cb=function(){done||(done=!0,e.classList.remove(k),d&&i?window.open(s,"_blank"):window.location.href=s)};e.addEventListener("animationend",cb,{once:!0});setTimeout(cb,300)}else{var cb2=function(){e.classList.remove(k)};e.addEventListener("animationend",cb2,{once:!0});setTimeout(cb2,300)}}else s&&(d&&i?window.open(s,"_blank"):window.location.href=s)});document.addEventListener("keydown",function(e){if(e.key==="Escape"){var open=document.querySelector('[data-modal-container]:not([style*="display: none"])');if(!open){var all=document.querySelectorAll("[data-modal-container]");for(var i=0;i<all.length;i++){if(all[i].style.display!=="none"){open=all[i];break}}}if(open)closeModal(open)}})}();`

/**
 * Design-toggle runtime (SECURITY: Safe - static code, no user input).
 *
 * Delegated click handler for `[data-theme-toggle]` buttons: flips the `dark`
 * class on `<html>` and persists the new choice to `localStorage.theme`
 * ('dark' | 'light'). The complementary no-FOUC head script (see
 * `ThemeColorSchemeScript`) reads that stored value on the next page load so
 * the choice survives navigation without a flash. Concatenated into the single
 * body-end inline script to keep the page inline-script count stable
 *.
 */
const themeToggleScript = `!function(){document.addEventListener("click",function(t){var e=t.target.closest("[data-theme-toggle]");if(!e)return;var root=document.documentElement;var willEnable=!root.classList.contains("dark");if(willEnable){root.classList.add("dark")}else{root.classList.remove("dark")}try{window.localStorage.setItem("theme",willEnable?"dark":"light")}catch(err){}})}();`

/**
 * Code-block copy runtime (SECURITY: Safe - static code, no user input).
 *
 * Makes the `code` component's copy button actually copy. The button has existed
 * — and been asserted visible — since [internal ref] while doing nothing
 * at all; only reading the clipboard back tells the two states apart
 *.
 *
 * Two properties are load-bearing:
 *
 *  - **Delegated, not a mount-time loop.** A loop over `[data-copy-code]` at load
 *    would miss every button inside a `tabs` panel, because those panels mount
 * AFTER hydration. A single document-level listener works
 *    for any button that ever exists.
 *  - **The payload is the COMMAND only.** The copy scope is now the `<figure>`
 *    itself — the button lives in the frame's header, above the code, so the
 *    scope has to enclose both — which puts a framed block's printed `output`
 *    inside the scope for the first time. The target is therefore resolved by
 *    walking `[data-copy-target]` → `[data-code-command]` →
 *    `pre:not([data-code-output])`, never by taking the scope's first `<pre>`.
 *    A reader pasting into a shell must not end up running
 * `Created hello-world.yaml` as a second command,
 *    nor the block's own filename header. The last fall-back covers the legacy
 *    post-render-splice path, where Shiki's replacement `<pre>` does not carry
 *    the renderer's `data-copy-target`.
 *
 * The confirmation is a `data-copied` flag on the button — the stylesheet reads
 * it to flip the icon-only control's glyph from a sheet to a check
 * — plus `data-copied-label` written into the scope's
 * `role="status" aria-live="polite"` region, which is what a screen-reader user
 * hears now that there is no visible label left to flip. The button's
 * `aria-label` is NEVER touched, so the control does not vanish from under a
 * screen-reader user mid-interaction. Both revert after
 * 2s so a second copy of the same block gives the same feedback.
 *
 * Concatenated into the single body-end inline script to keep the page-level
 * inline-script count stable. It only ever HANDLES
 * existing buttons — it never injects one — so a markdown article, whose fences
 * are server-rendered with their own copy button, is left with exactly one
 * control per block.
 */
const copyCodeScript = `!function(){document.addEventListener("click",function(t){var b=t.target.closest("[data-copy-code]");if(!b)return;var s=b.closest("[data-code-copy-scope]");if(!s)return;var p=s.querySelector("[data-copy-target]")||s.querySelector("[data-code-command]")||s.querySelector("pre:not([data-code-output])");if(!p)return;var c=p.querySelector("code")||p;var text=c.textContent||"";if(!text)return;var st=s.querySelector("[data-copy-status]");var done=function(){var copied=b.getAttribute("data-copied-label")||"Copied";b.setAttribute("data-copied","true");if(st)st.textContent=copied;setTimeout(function(){b.removeAttribute("data-copied");if(st)st.textContent=""},2000)};if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(done).catch(function(){})}else{try{var ta=document.createElement("textarea");ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand("copy");document.body.removeChild(ta);done()}catch(err){}}})}();`

/**
 * Marquee pause runtime (SECURITY: Safe - static code, no user input).
 *
 * Backs the optional `pauseControl` button on a `marquee` band. The band itself is
 * CSS-only — this handler does nothing but flip `data-marquee-paused` on the band
 * root, which the stylesheet reads to stop the track's `animation-play-state`.
 * The control is what makes the motion stoppable WITHOUT a pointer held anywhere
 * (WCAG 2.2.2), so it also swaps its own visible label to the inverse action —
 * otherwise a visitor who paused the band is stranded with a permanently frozen
 * row and no obvious way back.
 *
 * Delegated for the same reason as `copyCodeScript`: a band inside a tab panel
 * mounts after hydration.
 */
const marqueePauseScript = `!function(){document.addEventListener("click",function(t){var b=t.target.closest("[data-marquee-pause]");if(!b)return;var m=b.closest("[data-marquee]");if(!m)return;if(m.getAttribute("data-marquee-paused")==="true"){m.removeAttribute("data-marquee-paused");b.textContent=b.getAttribute("data-marquee-pause-label")||"Pause"}else{m.setAttribute("data-marquee-paused","true");b.textContent=b.getAttribute("data-marquee-resume-label")||"Resume"}})}();`

/**
 * Dev-only live-reload script. Loads the external client served by
 * `dev-reload-routes`, so the browser auto-reloads after a
 * `sovrium start --watch` restart.
 *
 * Emitted ONLY when `NODE_ENV` is unset/empty — the genuine local-dev default
 * that the CLI dev-experience specs run under. It is
 * absent both in production (`NODE_ENV=production`) AND under the in-process
 * E2E test server, which sets `NODE_ENV=development` solely to skip the
 * production CSS check. The latter is what
 * lets an empty page emit zero `<script src>` tags.
 *
 * The genuine-local-dev predicate lives in `domain/utils/dev-mode.ts` so the
 * infrastructure `isLiveReloadEligible` and this SSR shell consume the same
 * canonical shape (no inline duplication of the unset-vs-empty distinction).
 *
 * Uses an external `src` (NOT inline) so it does not perturb the strict-CSP
 * inline-script-count contract. The `process.env` read
 * is server-side only — this page shell never ships to the client bundle
 * (mirrors the direct env read in `ai-chat-component.tsx`).
 */
function DevLiveReloadScript(): ReactElement | undefined {
  if (!isLocalDevDefault(process.env.NODE_ENV)) return undefined
  return (
    <script
      src="/assets/dev-reload.js"
      defer={true}
    />
  )
}

/**
 * Renders scripts for body end position
 */
function renderBodyEndScripts(config: {
  readonly page: Page
  readonly design: Design | undefined
  readonly languages: Languages | undefined
  readonly direction: 'ltr' | 'rtl'
  readonly scripts: GroupedScripts
  readonly frontmatter?: Readonly<Record<string, string>>
}): ReactElement {
  const { page, design, languages, direction, scripts, frontmatter } = config
  return (
    <>
      {renderScripts(scripts.external.bodyEnd, scripts.inline.bodyEnd, 'body-end')}
      {renderConditionalScripts({ page, design, languages, direction, frontmatter })}
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
        page-level inline-script count stable. [internal ref] asserts
        `script:not([src])` matches exactly one element under strict mode;
        adding a sibling <script> here would break that contract for a
        non-feature reason. Every enhancer below is an IIFE, so their internals
        never leak across the concatenation, and every one that binds a handler
        binds it DELEGATED on `document` — which is what lets a control inside a
        `tabs` panel work even though the panel mounts after hydration. Order is
        therefore not load-bearing; keep it stable only to keep diffs readable:
        clickScript (delegated click/modal), autoResizeScript (textarea grow),
        themeToggleScript, copyCodeScript (code-block copy), marqueePauseScript.
      */}
      <script
        // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- SSR-only <script> element; never re-renders client-side
        dangerouslySetInnerHTML={{
          __html:
            clickScript +
            autoResizeScript +
            themeToggleScript +
            copyCodeScript +
            marqueePauseScript,
        }}
      />
      <DevLiveReloadScript />
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
 * - Scroll animation script (if design has scaleUp animation)
 * - Language switcher script (if languages configured)
 * - Feature flags script (if features configured)
 *
 * @param props - Component props
 * @returns Script elements for the specified position
 */
export function PageBodyScripts({
  page,
  design,
  languages,
  direction,
  scripts,
  position,
  frontmatter,
}: PageBodyScriptsProps): Readonly<ReactElement> {
  if (position === 'start') {
    return renderScripts(scripts.external.bodyStart, scripts.inline.bodyStart, 'body-start')
  }

  return renderBodyEndScripts({ page, design, languages, direction, scripts, frontmatter })
}
