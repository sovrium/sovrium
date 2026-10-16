/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A `crud` action may carry its own `confirm: true` and `confirmMessage`, and
 * the schema documents them as a prompt shown before the action runs. The
 * surfaces that hold actions in a list — a grid's row actions and bulk actions,
 * a record drawer's footer — ask before they run when the ITEM declares
 * `confirm`. So the action's own request is lifted onto its item here: an item
 * that declares no `confirm` of its own takes the action's `confirmMessage`, or
 * the page-language default prompt when it names none. An item's own `confirm`
 * always wins. Without this, a config asking for a confirmation would validate
 * and then delete on one click.
 */

import { resolveInterpreterString } from '@/domain/models/app/languages/translation-resolver'
import type { Languages } from '@/domain/models/app/languages'

/** The page's language, from which the default prompt is read. */
type PageLanguage = {
  readonly currentLang?: string | undefined
  readonly languages?: Languages | undefined
}

const defaultPrompt = (page: PageLanguage): string =>
  resolveInterpreterString('confirmGate.message', page.currentLang, page.languages)

type ConfirmBearer = { readonly confirm?: unknown; readonly action?: unknown }

const liftOne = <T>(item: T, fallback: string): T => {
  const { confirm, action } = item as ConfirmBearer
  if (confirm !== undefined || typeof action !== 'object' || action === null) return item
  const own = action as {
    readonly type?: unknown
    readonly confirm?: unknown
    readonly confirmMessage?: unknown
  }
  // A `fetch` action asks through its own gate when it runs; only `crud` relies on the item.
  if (own.type !== 'crud' || own.confirm !== true) return item
  const message =
    typeof own.confirmMessage === 'string' && own.confirmMessage.trim() !== ''
      ? own.confirmMessage
      : fallback
  return { ...item, confirm: message }
}

/** Each item of an action list, with its action's own confirmation lifted onto it. */
export const liftActionConfirms = <T>(items: T, page: PageLanguage): T =>
  (Array.isArray(items)
    ? items.map((item: unknown) => liftOne(item, defaultPrompt(page)))
    : items) as T

/** A grid's columns, each `actions` column's items lifted as {@link liftActionConfirms} does. */
export const liftColumnActionConfirms = <T>(columns: T, page: PageLanguage): T =>
  (Array.isArray(columns)
    ? columns.map((column: unknown) => {
        const actions = (column as { readonly actions?: unknown } | null)?.actions
        return Array.isArray(actions)
          ? { ...(column as object), actions: liftActionConfirms(actions, page) }
          : column
      })
    : columns) as T
