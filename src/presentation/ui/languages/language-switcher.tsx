/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import type { Languages } from '@/domain/models/app/languages'

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
 */
function LanguageSwitcherButton({
  defaultLanguage,
  defaultCode,
}: {
  readonly defaultLanguage: Languages['supported'][number] | undefined
  readonly defaultCode: string
}): ReactElement {
  return (
    <button
      data-testid="language-switcher-button"
      type="button"
    >
      {shouldShowFlag(defaultLanguage?.flag) && (
        <span data-testid="language-flag">{defaultLanguage!.flag} </span>
      )}
      <span
        data-testid="language-code"
        aria-hidden="true"
        style={{ display: 'none' }}
      />
      <span
        data-testid="current-language"
        data-code={defaultCode}
      >
        {defaultLanguage?.label || defaultCode}
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
 * @returns React element with language switcher HTML structure
 */
export function LanguageSwitcher({
  languages,
  variant = 'dropdown',
  showFlags = false,
}: {
  readonly languages: Languages
  readonly variant?: string
  readonly showFlags?: boolean
}): Readonly<ReactElement> {
  const defaultLanguage = languages.supported.find((lang) => lang.code === languages.default)

  return (
    <div
      data-testid="language-switcher"
      className="relative"
      data-variant={variant}
    >
      <LanguageSwitcherButton
        defaultLanguage={defaultLanguage}
        defaultCode={languages.default}
      />

      {/* Dropdown menu - vanilla JS will handle show/hide */}
      <div
        data-language-dropdown
        className="absolute top-full left-0 z-10"
        aria-hidden="true"
        style={{ display: 'none' }}
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
