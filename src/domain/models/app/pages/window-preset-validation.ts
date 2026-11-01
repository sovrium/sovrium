/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isRecord } from '@/domain/kernel/config-parsing/plain-object'
import { PAGE_WINDOW_DEFAULT_PARAM, PAGE_WINDOW_PRESET_ID } from '@/domain/models/app/pages/window'

/**
 * Family 7 of the page binding rules (families numbered at the head of `page-binding-validation.ts`, which runs
 * them for one page): a page `window`'s presets
 * are spans, distinct, its `default` names one, and its `param` does not
 * shadow a declared query property. Pure.
 */

/**
 * A declared `page.window` must be selectable and internally coherent.
 *
 * All four rules are here rather than on `PageWindowSchema` for the reason the
 * header records: a `Schema.check` WRAPS the node it guards, so a checked
 * `PageWindowPreset` would stop being addressed by its own identifier and
 * silently re-key the published property universe the docs gate compares
 * against.
 *
 * The `param` collision rule is the one that is easy to miss and impossible to
 * debug: `window.param` and a `page.query` property share the URL's key space,
 * and a page declaring both under one name would have two independent resolvers
 * clamping the same parameter into two different allow-lists. Whichever
 * substitution ran second would win, which is a coin toss the config author
 * cannot see.
 */
export function windowViolations(
  page: Readonly<Record<string, unknown>>,
  label: string
): readonly string[] {
  const { window } = page
  if (!isRecord(window)) return []

  const presets = Array.isArray(window['presets']) ? window['presets'].filter(isRecord) : []
  const ids = presets
    .map((preset) => preset['id'])
    .filter((id): id is string => typeof id === 'string')

  return [
    ...presetGrammarViolations(ids, label),
    ...duplicatePresetViolations(ids, label),
    ...windowDefaultViolation(window, ids, label),
    ...windowParamCollisionViolation(page, window, label),
  ]
}

/** Every preset id must spell a span: a positive integer plus `h`, `d` or `w`. */
function presetGrammarViolations(ids: readonly string[], label: string): readonly string[] {
  const invalid = ids.filter((id) => !PAGE_WINDOW_PRESET_ID.test(id))
  if (invalid.length === 0) return []
  return [
    `${label} declares window preset id(s) [${invalid.join(', ')}] that are not a span: a positive integer followed by h, d or w (${PAGE_WINDOW_PRESET_ID.source})`,
  ]
}

/**
 * Two presets with one id make the selector ambiguous — the second is
 * unreachable, and which one `default` names is a lookup-order accident.
 */
function duplicatePresetViolations(ids: readonly string[], label: string): readonly string[] {
  const duplicated = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))]
  if (duplicated.length === 0) return []
  return [
    `${label} declares window preset id(s) [${duplicated.join(', ')}] more than once — each id names one window`,
  ]
}

/** `default` must name a declared preset, or nothing is selectable. */
function windowDefaultViolation(
  window: Readonly<Record<string, unknown>>,
  ids: readonly string[],
  label: string
): readonly string[] {
  const fallback = window['default']
  if (typeof fallback !== 'string' || ids.length === 0 || ids.includes(fallback)) return []
  return [
    `${label} declares window default "${fallback}" which is not one of its preset ids [${ids.join(', ')}]`,
  ]
}

/** `window.param` may not shadow a declared `page.query` property. */
function windowParamCollisionViolation(
  page: Readonly<Record<string, unknown>>,
  window: Readonly<Record<string, unknown>>,
  label: string
): readonly string[] {
  const param = typeof window['param'] === 'string' ? window['param'] : PAGE_WINDOW_DEFAULT_PARAM
  const { query } = page
  if (!isRecord(query) || !(param in query)) return []
  return [
    `${label} declares window param "${param}" and a query property of the same name — one URL key cannot carry two independent allow-lists`,
  ]
}
