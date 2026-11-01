/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isRecord } from '@/domain/kernel/config-parsing/plain-object'

/**
 * Family 4 of the page binding rules (families numbered at the head of `page-binding-validation.ts`, which runs
 * them for one page): a query property's `default`
 * lies inside its own `enum`, and its name is a legal URL key. Pure.
 */

/** Query property names accepted as URL keys: lowercase kebab-case. */
const QUERY_PROP_NAME = /^[a-z][a-z0-9-]*$/

/**
 * A declared query property must be usable from a URL and internally coherent.
 *
 * The name rule is checked HERE rather than by refining the record's key schema
 * because Effect 4's `Schema.Record` silently DROPS an entry whose key fails —
 * a typo'd `Period:` would become a property that simply does not exist, with no
 * error and a `$query.Period` that never resolves.
 */
export function queryViolations(
  page: Readonly<Record<string, unknown>>,
  label: string
): readonly string[] {
  const { query } = page
  if (!isRecord(query)) return []

  const invalidNames = Object.keys(query).filter((name) => !QUERY_PROP_NAME.test(name))

  return [
    ...(invalidNames.length > 0
      ? [
          `${label} declares query property name(s) [${invalidNames.join(', ')}] that are not lowercase kebab-case (${QUERY_PROP_NAME.source})`,
        ]
      : []),
    ...Object.entries(query).flatMap(([name, prop]) =>
      unreachableDefaultViolation(name, prop, label)
    ),
  ]
}

function unreachableDefaultViolation(
  name: string,
  prop: unknown,
  label: string
): readonly string[] {
  if (!isRecord(prop)) return []
  const { enum: allowed } = prop
  if (!Array.isArray(allowed)) return []
  // Both fallbacks answer to one rule, because they fail the same way: a value
  // outside the property's own `enum` names a state the page can never be in.
  // `default` would render it on every unparameterised request; `onUnknown`
  // would render it on every mistyped one — and a `visibility.query` gate can
  // never NAME either, since that predicate's value is checked against this same
  // `enum` (family 17). Reported per key so an author with both wrong is told
  // about both.
  return (['default', 'onUnknown'] as const).flatMap((key) => {
    const fallback = prop[key]
    if (typeof fallback !== 'string' || allowed.includes(fallback)) return []
    return [
      `${label} declares query property "${name}" whose ${key} "${fallback}" is not one of its enum values [${allowed.join(', ')}]`,
    ]
  })
}
