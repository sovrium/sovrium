/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  resolveInterpreterString,
  resolveTranslationPattern,
} from '@/domain/models/app/languages/translation-resolver'
import type { Languages } from '@/domain/models/app/languages'

/** The attribute the client runtime reads a pending button's word from. */
export const PENDING_LABEL_ATTR = 'data-action-pending-label'

/** The attribute a `crud` delete button reads its word from when it declares no `content`. */
export const DELETE_LABEL_ATTR = 'data-action-delete-label'

/**
 * The built-in word of each action type whose press waits on a request, by
 * catalogue key. A fetch that navigates or downloads hands the page to the
 * browser, so it has no in-flight state of its own.
 */
function builtInPendingKey(action: Readonly<Record<string, unknown>>): string | undefined {
  if (action['type'] === 'automation') return 'action.running'
  if (action['type'] === 'crud')
    return action['operation'] === 'delete' ? 'form.deleting' : 'form.saving'
  if (action['type'] !== 'fetch') return undefined
  return action['mode'] === 'navigate' || action['mode'] === 'download' ? undefined : 'form.sending'
}

/**
 * The in-flight word an action button reads while its request is open, resolved
 * on the server in the page language and stamped on the button: the action's
 * own `pendingLabel` (a `$t:` key resolved), else the built-in word for its
 * type. Empty for an action with no in-flight state. A `crud` delete button
 * also gets its resting word (`form.delete`), read when it declares no `content`.
 */
export function buildPendingLabelAttribute(
  action: unknown,
  lang: { readonly currentLang?: string; readonly languages?: Languages }
): Record<string, string> {
  if (action === null || typeof action !== 'object') return {}
  const record = action as Readonly<Record<string, unknown>>
  const key = builtInPendingKey(record)
  if (key === undefined) return {}
  const own = record['pendingLabel']
  const word =
    typeof own === 'string'
      ? resolveTranslationPattern(
          own,
          lang.currentLang ?? lang.languages?.default ?? 'en',
          lang.languages
        )
      : resolveInterpreterString(key, lang.currentLang, lang.languages)
  const resting: Record<string, string> =
    key === 'form.deleting'
      ? {
          [DELETE_LABEL_ATTR]: resolveInterpreterString(
            'form.delete',
            lang.currentLang,
            lang.languages
          ),
        }
      : {}
  return { [PENDING_LABEL_ATTR]: word, ...resting }
}
