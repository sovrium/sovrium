/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isRecord } from '@/domain/kernel/config-parsing/plain-object'
import { boundNodesOf, describeNode } from './record-binding-walk'

/**
 * Family 6 of the page binding rules (families numbered at the head of `page-binding-validation.ts`, which runs
 * them for one page): `visibility.record` needs a
 * record to match against, and an operator to match with. Pure.
 */

/**
 * `visibility.record` renders a component only on records whose named field
 * satisfies a predicate — a PER-ROW gate, evaluated as each row is expanded from
 * its template (`presentation/rendering/record-visibility.ts`).
 *
 * A record only ever reaches a component through an ANCESTOR that binds one: a
 * component-level `dataSource` (a table binding, a rows envelope, a named
 * `systemSource`, or a single-record detail source), or the page-level
 * `dataSource` a collection page declares, which binds every component on the
 * page. Outside that, `satisfiesFieldCondition` is handed no record, so the
 * author has written a gate that can never pass.
 *
 * A `contentDir` page binds no record for THIS rule, though `boundNodesOf` counts
 * it for the rule it also serves: an article hands a component no record, so the
 * gate is refused here, and a row template on that page still reads its rows.
 *
 * THE ANCESTOR IS PROPER, NEVER SELF. A `record-field` with its own `dataSource`
 * resolves that source AFTER visibility would be decided, so it cannot gate
 * itself on the record it is about to fetch.
 *
 * DIRECTION: the rule refuses an ABSENCE, so a binding form it does not
 * recognise would refuse a VALID config — the failure mode
 * `ROWS_SOURCE_COMPONENT_TYPES` (`route-param-binding-validation.ts`) was scoped
 * to avoid. It is therefore
 * anchored on the single structural fact every binding form shares — the node
 * carries a `dataSource` object — rather than on a list of component types or of
 * `dataSource` shapes, neither of which can go stale into a false refusal.
 */
export function recordVisibilityViolations(
  page: Readonly<Record<string, unknown>>,
  label: string
): readonly string[] {
  const recordBindings = Object.fromEntries(
    Object.entries(page).filter(([key]) => key !== 'contentDir')
  )
  return boundNodesOf(recordBindings).flatMap(({ node, boundByAncestor }) => {
    const condition = readRecordVisibility(node)
    if (condition === undefined) return []
    if (!boundByAncestor) {
      if (isRecord(page['contentDir'])) {
        return [
          `${label} declares visibility.record on a ${describeNode(node)} with no record-binding ancestor — an article of a page routed by contentDir hands a component no record, so the gate could never pass. Remove the gate, or use \`visibility.when\`, \`visibility.roles\` or \`visibility.condition\` instead. A gate inside a row template on this page stays valid`,
        ]
      }
      return [
        `${label} declares visibility.record on a ${describeNode(node)} with no record-binding ancestor — the per-row gate is matched against a bound record, so here it could never fire and the component would never render. Nest it under a component with a dataSource (list / gallery / kanban / data-table row template, or a single-record container), or use visibility.condition for a session-based gate`,
      ]
    }
    if (!hasOperator(condition)) {
      return [
        `${label} declares visibility.record on a ${describeNode(node)} with a field but no operator — the matcher ANDs the operators it is given, so an empty predicate matches every record and the gate renders everywhere. Add one of ${CONDITION_OPERATORS.join(', ')}`,
      ]
    }
    return []
  })
}

/**
 * The operator vocabulary `ConditionOperatorsSchema` declares.
 *
 * Duplicated as a literal list rather than derived from the schema: this module
 * is deliberately schema-free (see the head of `page-binding-validation.ts` — a
 * `Schema.check` wrapping a node re-keys the published property universe), and
 * the list only ever NAMES the options in an error message. Its worst failure is an out-of-date
 * suggestion, never a wrong verdict — {@link hasOperator} tests for the absence
 * of ANY key but `field`, so an operator added later is honoured without
 * touching this.
 */
const CONDITION_OPERATORS = [
  'eq',
  'neq',
  'in',
  'notIn',
  'contains',
  'gt',
  'lt',
  'gte',
  'lte',
  'isEmpty: true',
  'isNotEmpty: true',
] as const

/** True when a predicate carries at least one key that is not `field`. */
function hasOperator(condition: Readonly<Record<string, unknown>>): boolean {
  return Object.keys(condition).some((key) => key !== 'field')
}

/**
 * The node's `visibility.record` predicate, by either convention — the component
 * ROOT (where the schema spreads `visibilityFields`) or `props.visibility` (the
 * runtime convention the renderer reads) — or `undefined` when it declares none.
 *
 * Anchored on the node having a `type`, so the structural walk reports the
 * COMPONENT once rather than reporting it and then its own `props` object again:
 * on the `props` node, `props.visibility` is reachable as a root `visibility`
 * and the two conventions collapse into one node twice.
 */
function readRecordVisibility(
  node: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> | undefined {
  if (typeof node['type'] !== 'string') return undefined
  const { visibility: fromRoot, props } = node
  const fromProps = isRecord(props) ? props['visibility'] : undefined
  const visibility = isRecord(fromRoot) ? fromRoot : fromProps
  if (!isRecord(visibility)) return undefined
  const condition = visibility['record']
  return isRecord(condition) ? condition : undefined
}
