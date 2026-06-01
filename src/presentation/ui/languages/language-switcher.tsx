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
} from '@/presentation/ui/sections/renderers/element-renderers/specialty-ssr-default-classes'
import type { Languages } from '@/domain/models/app/languages'

const HIDDEN_STYLE = { display: 'none' } as const

const isImageFlag = (flag: string | undefined): boolean => Boolean(flag?.startsWith('/'))

const shouldShowFlag = (flag: string | undefined): boolean => Boolean(flag && !isImageFlag(flag))

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
      className={computeLanguageSwitcherTriggerClasses()}
    >
      {shouldShowFlag(defaultLanguage?.flag) && (
        <span data-testid="language-flag">{defaultLanguage!.flag} </span>
      )}
      <span
        data-testid="language-code"
        aria-hidden="true"
        style={HIDDEN_STYLE}
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

      {}
      <div
        data-language-dropdown
        className={computeLanguageSwitcherDropdownClasses()}
        aria-hidden="true"
        style={HIDDEN_STYLE}
        data-supported-languages={JSON.stringify(languages.supported)}
        data-show-flags={showFlags}
      />

      {}
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
