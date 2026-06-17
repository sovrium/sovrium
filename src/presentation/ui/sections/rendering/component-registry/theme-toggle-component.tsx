/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Moon, Sun } from 'lucide-react'
import { resolveChildTranslation } from '../../translations/translation-handler'
import type { ComponentRenderer } from '../component-dispatch-config'
import type { ReactElement } from 'react'

interface ThemeToggleComponent {
  readonly label?: string
  readonly variant?: 'text' | 'icon'
}

export const themeToggleComponent: ComponentRenderer = ({
  component,
  elementProps,
  currentLang,
  languages,
}): ReactElement => {
  const authored = (component ?? {}) as ThemeToggleComponent
  const label =
    typeof authored.label === 'string' && authored.label.length > 0
      ? resolveChildTranslation(authored.label, currentLang, languages)
      : 'Toggle theme'

  const className =
    typeof elementProps['className'] === 'string'
      ? (elementProps['className'] as string)
      : undefined
  const testId = elementProps['data-testid'] as string | undefined

  if (authored.variant === 'icon') {
    return (
      <button
        type="button"
        data-theme-toggle="true"
        data-variant="icon"
        aria-label={label}
        className={className}
        data-testid={testId}
      >
        {}
        <Sun
          className="hidden h-5 w-5 dark:inline-flex"
          aria-hidden="true"
          data-testid="icon-sun"
        />
        <Moon
          className="inline-flex h-5 w-5 dark:hidden"
          aria-hidden="true"
          data-testid="icon-moon"
        />
      </button>
    )
  }

  return (
    <button
      type="button"
      data-theme-toggle="true"
      data-variant="text"
      aria-label={label}
      className={className}
      data-testid={testId}
    >
      {label}
    </button>
  )
}
