/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import {
  computeLanguageSwitcherDropdownClasses,
  computeLanguageSwitcherTriggerClasses,
} from '@/presentation/design/specialty-ssr-default-classes'
import type { Languages } from '@/domain/models/app/languages'

/** Stable identity for `style={{ display: 'none' }}` reuse to satisfy react-perf. */
const HIDDEN_STYLE = { display: 'none' } as const

/**
 * Helper to check if flag is an image path (starts with /)
 */
const isImageFlag = (flag: string | undefined): boolean => Boolean(flag?.startsWith('/'))

/**
 * Helper to determine if flag should be shown (emoji flags only, not image paths)
 */
const shouldShowFlag = (flag: string | undefined): boolean => Boolean(flag && !isImageFlag(flag))

/**
 * Language switcher button component
 *
 * Renders the ACTIVE language, not the default one. The distinction only began
 * to matter once an unprefixed selection recomposed the document server-side
 * instead of repainting it: `updateUI` rewrote this label client-side after
 * every click, so a trigger hard-coded to the default was corrected a few
 * milliseconds later and nobody ever saw it. Across a real navigation there is
 * no such correction — what the server rendered is what the reader reads — so
 * a trigger naming the default would say "English" on a French page, on the
 * one control whose whole job is to report which language is showing.
 */
function LanguageSwitcherButton({
  activeLanguage,
  activeCode,
}: {
  readonly activeLanguage: Languages['supported'][number] | undefined
  readonly activeCode: string
}): ReactElement {
  return (
    <button
      data-testid="language-switcher-button"
      type="button"
      className={computeLanguageSwitcherTriggerClasses()}
    >
      {shouldShowFlag(activeLanguage?.flag) && (
        <span data-testid="language-flag">{activeLanguage!.flag} </span>
      )}
      <span
        data-testid="language-code"
        aria-hidden="true"
        style={HIDDEN_STYLE}
      />
      <span
        data-testid="current-language"
        data-code={activeCode}
      >
        {activeLanguage?.label || activeCode}
      </span>
    </button>
  )
}

/**
 * LanguageSwitcher component - Server-side rendered language switcher
 *
 * This component renders the static HTML structure for the language switcher.
 * All client-side interactivity (click handlers, language detection, localStorage)
 * is handled by the vanilla JavaScript file: language-switcher.js
 *
 * Architecture:
 * - React component = SSR only (renders HTML structure)
 * - Vanilla JS = Client-side progressive enhancement (handles interactivity)
 *
 * This separation ensures:
 * - No duplicate logic between React and vanilla JS
 * - Works without React hydration (pure progressive enhancement)
 * - Clear separation of concerns (SSR vs client-side)
 *
 * @param props - Component props
 * @param props.languages - Languages configuration from AppSchema
 * @param props.variant - Display variant (dropdown, inline, tabs) - defaults to dropdown
 * @param props.showFlags - Whether to show flag emojis - defaults to false
 * @param props.currentLang - The page's active language, as `resolvePageLanguage`
 *   answered it. Matched against either declared spelling because it arrives as
 *   the locale while `languages.default` is the short code. Absent — or naming a
 *   language this app does not declare — the trigger falls back to the default,
 *   which is what it always showed.
 * @returns React element with language switcher HTML structure
 */
export function LanguageSwitcher({
  languages,
  variant = 'dropdown',
  showFlags = false,
  currentLang,
}: {
  readonly languages: Languages
  readonly variant?: string
  readonly showFlags?: boolean
  readonly currentLang?: string
}): Readonly<ReactElement> {
  const activeLanguage =
    languages.supported.find((lang) => lang.code === currentLang || lang.locale === currentLang) ??
    languages.supported.find((lang) => lang.code === languages.default)

  return (
    <div
      data-testid="language-switcher"
      className="relative"
      data-variant={variant}
    >
      <LanguageSwitcherButton
        activeLanguage={activeLanguage}
        activeCode={activeLanguage?.code ?? languages.default}
      />

      {/* Dropdown menu - vanilla JS will handle show/hide */}
      <div
        data-language-dropdown
        className={computeLanguageSwitcherDropdownClasses()}
        aria-hidden="true"
        style={HIDDEN_STYLE}
        data-supported-languages={JSON.stringify(languages.supported)}
        data-show-flags={showFlags}
      />

      {/* Fallback indicator - shows when fallback is configured */}
      {languages.fallback && (
        <div
          data-testid="fallback-handled"
          aria-label={`Fallback language: ${languages.fallback}`}
        >
          Fallback: {languages.fallback}
        </div>
      )}
    </div>
  )
}
