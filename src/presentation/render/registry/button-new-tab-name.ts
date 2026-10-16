/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveInterpreterString } from '@/domain/models/app/languages/translation-resolver'
import { newTabName } from '@/presentation/design/new-tab-attributes'
import type { Languages } from '@/domain/models/app/languages'

/** Whether a button opens its address in a new tab: an `openUrl` click, or a `navigate` action. */
function opensNewTab(interactions: unknown, action: unknown): boolean {
  const click = (interactions as { click?: { openUrl?: unknown; openInNewTab?: unknown } })?.click
  if (click?.openInNewTab === true && typeof click.openUrl === 'string') return true
  const navigate = action as { type?: unknown; openInNewTab?: unknown } | undefined
  return navigate?.type === 'navigate' && navigate.openInNewTab === true
}

/**
 * A button that opens a new tab says so (WCAG 3.2.5, RGAA 13.2), as a new-tab
 * link does: its accessible name is its words — an author's `aria-label`, else
 * its content, else its `label` — then the engine string `link.opensInNewTab`
 * in the page language. Any other button's props are returned unchanged.
 */
export function withNewTabName(
  props: Readonly<Record<string, unknown>>,
  button: {
    readonly content: string | undefined
    readonly interactions: unknown
    readonly action: unknown
    readonly currentLang: string | undefined
    readonly languages: Languages | undefined
  }
): Readonly<Record<string, unknown>> {
  if (!opensNewTab(button.interactions, button.action)) return props
  const { 'aria-label': authored, label } = props
  const words =
    typeof authored === 'string'
      ? authored
      : (button.content ?? (typeof label === 'string' ? label : undefined))
  if (words === undefined || words === '') return props
  const notice = resolveInterpreterString(
    'link.opensInNewTab',
    button.currentLang,
    button.languages
  )
  return { ...props, ...newTabName(words, notice) }
}
