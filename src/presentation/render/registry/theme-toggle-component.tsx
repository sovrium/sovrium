/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Moon, Sun } from 'lucide-react'
import { resolveChildTranslation } from '../i18n/translation-handler'
import type { ComponentRenderer } from './component-dispatch-config'
import type { ReactElement } from 'react'

/** Shape of the schema-authored `theme-toggle` component. */
interface ThemeToggleComponent {
  readonly label?: string
  readonly variant?: 'text' | 'icon'
}

/**
 * Renderer for the `theme-toggle` component.
 *
 * Emits an accessible `<button data-theme-toggle>` whose default accessible
 * name ("Toggle theme") matches the toggle's intent. The click behaviour is
 * wired by the body-end theme-toggle runtime (see `PageBodyScripts`): a single
 * delegated handler flips the `dark` class on `<html>` and persists the choice
 * to `localStorage.theme`. The complementary no-FOUC head script (see
 * `PageHead`) applies the stored / configured / system scheme before content
 * renders, so a toggled-then-navigated page stays on its chosen scheme.
 *
 * A `$t:`-prefixed `label` is resolved against the current language (same path
 * as other localizable component fields) so the button text + accessible name
 * are localized; a missing label falls back to the English default.
 */
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

  // The `'icon'` variant shows a sun/moon glyph pair instead of the text label;
  // the label is kept as the accessible name only. The flip handler keys off
  // `[data-theme-toggle]` (see PageBodyScripts) so no runtime change is needed —
  // the variant only changes what is rendered inside the button.
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
        {/* Sun shows in dark mode, moon in light mode — the visible glyph is the
            scheme the click will switch TO. Both ship in the SSR HTML; the
            `.dark` scheme class on <html> chooses which is displayed via the
            dark: variant, so the swap is FOUC-free and needs no JS. */}
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
