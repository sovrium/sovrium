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

/** The attribute a `crud` delete button reads its rate-limit refusal from (`{seconds}` left in). */
export const RATE_LIMIT_LABEL_ATTR = 'data-action-rate-limit-label'

/** The attribute a `crud` delete button reads the words of any other failure from. */
export const FAILURE_LABEL_ATTR = 'data-action-failure-label'

/** The attribute a `crud` delete button reads its confirmation and deleted words from (JSON). */
export const DELETE_WORDS_ATTR = 'data-action-delete-words'

/** The catalogue keys of a delete's confirmation, its Cancel and the line once it is gone. */
const DELETE_WORD_KEYS = [
  'form.confirmPrompt',
  'form.confirmNamed',
  'form.cancel',
  'form.recordDeleted',
]

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
 * also gets its resting word (`form.delete`), read when it declares no `content`,
 * the words of a refusal because the writes were too many (`rateLimit.retryIn`),
 * and those of any other failure (`form.operationFailed`).
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
  const resolve = (k: string) => resolveInterpreterString(k, lang.currentLang, lang.languages)
  const resting: Record<string, string> =
    key === 'form.deleting'
      ? {
          [DELETE_LABEL_ATTR]: resolve('form.delete'),
          [RATE_LIMIT_LABEL_ATTR]: resolve('rateLimit.retryIn'),
          [FAILURE_LABEL_ATTR]: resolve('form.operationFailed'),
          [DELETE_WORDS_ATTR]: JSON.stringify(
            Object.fromEntries(DELETE_WORD_KEYS.map((k) => [k, resolve(k)]))
          ),
        }
      : {}
  return { [PENDING_LABEL_ATTR]: word, ...resting }
}
