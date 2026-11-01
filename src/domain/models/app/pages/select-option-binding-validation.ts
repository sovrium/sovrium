/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isRecord } from '@/domain/kernel/config-parsing/plain-object'

/**
 * Family 8 of the page binding rules (families numbered at the head of `page-binding-validation.ts`, which runs
 * them for one page): an inline select editor, and a
 * form field, state their choices exactly once. Pure.
 */

/**
 * An inline `editSelect` states its choices exactly once — as a literal
 * `options` array, or as an `optionsSource` binding resolved before render.
 *
 * Neither is a dropdown with nothing in it. Both is two answers to one question
 * with no defensible precedence, which is the same reason a breadcrumb may not
 * carry `breadcrumbItems` and `derive` together.
 */
export function editSelectOptionViolations(
  nodes: readonly Record<string, unknown>[],
  label: string
): readonly string[] {
  return nodes
    .map((node) => node['editSelect'])
    .filter(isRecord)
    .flatMap((editSelect) => {
      const name = typeof editSelect['field'] === 'string' ? editSelect['field'] : 'unnamed'
      const hasOptions = editSelect['options'] !== undefined
      const hasSource = editSelect['optionsSource'] !== undefined
      if (hasOptions && hasSource) {
        return [
          `${label} declares an editSelect on "${name}" with both options and optionsSource — keep one: a literal list OR a resolved source`,
        ]
      }
      if (!hasOptions && !hasSource) {
        return [
          `${label} declares an editSelect on "${name}" with neither options nor optionsSource — a dropdown with nothing to pick`,
        ]
      }
      return []
    })
}

/**
 * A `control: select` form field states its choices at most once — as a literal
 * `options` array, or as an `optionsSource` binding resolved before render.
 *
 * ─── WHY "AT MOST", NOT "EXACTLY" ──────────────────────────────────────────
 *
 * Its `editSelect` sibling above refuses NEITHER as well as BOTH, because an
 * inline row editor with no choices can only ever be a dropdown with nothing in
 * it. A form field is different: `control` is optional and a TABLE-bound form
 * derives every control, and its choices, from the column type — so a field
 * declaring neither is the ordinary case, not a defect. Only the ambiguity is
 * refused here.
 */
export function formFieldOptionViolations(
  nodes: readonly Record<string, unknown>[],
  label: string
): readonly string[] {
  return nodes
    .flatMap((node) => (Array.isArray(node['fields']) ? node['fields'] : []))
    .filter(isRecord)
    .flatMap((field) => {
      if (field['options'] === undefined || field['optionsSource'] === undefined) return []
      const name = String(field['field'] ?? field['name'] ?? 'unnamed') // a filter bar's is `name`
      return [
        `${label} declares a form field "${name}" with both options and optionsSource — keep one: a literal list OR a resolved source`,
      ]
    })
}
