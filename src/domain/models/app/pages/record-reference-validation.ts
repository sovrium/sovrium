/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { recordFieldRefsIn } from '@/domain/models/app/pages/substitute-record-vars'
import { boundNodesOf, describeNode } from './record-binding-walk'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

// ---------------------------------------------------------------------------
// 14. `$record.<field>` requires a record-binding ancestor
// ---------------------------------------------------------------------------

/**
 * A `$record.<field>` reference is resolved as each row is expanded from its
 * template (`substituteRecordInComponent`). With no record-binding ancestor
 * nothing ever expands the component, so the reference is never handed a record
 * and reaches the browser as the LITERAL text `$record.name` — a page that looks
 * built rather than one that fails.
 *
 * EVERY STRING LEAF, NOT A LIST OF KEYS. `$record.` shipped substituted in four
 * places — `props`, `content`, `dataSource.filter[].value` and `children` — so a
 * reference in any TYPED field of a component (`specimen.subject.type`,
 * `swatch.token`, `badge.foreground`) passes through untouched.
 * Enumerating the keys a row value is useful in means the rule silently stops
 * covering each new one, and fails exactly the way the thing it guards does: in
 * silence. So it reads string LEAVES, at parity with family 1's `$param` scan
 * and with the substitution pass this rule polices.
 *
 * THE ANCESTOR IS PROPER, NEVER SELF, and the walk is {@link boundNodesOf} —
 * the same one family 6 uses, because it is the same structural question. A
 * component's own `dataSource` binds its CHILDREN, not itself.
 *
 * THE ROUTE PARAM IS A FOURTH BINDING, IN ONE PLACE. `renderAutomationButton`
 * resolves an automation action's `inputData` against
 * `buildRecordContext(_record, routeParams)` — literally `{ ...routeParams,
 * ..._record }` — so on a `/tickets/:id` route `$record.id` is handed the URL
 * segment with no `dataSource` anywhere on the page. That is not an accident an
 * author stumbled into: it shipped WITH the GAP-H1 automation-button contract
 * (`a60fda1aa3`, "record context merges _record over routeParams, the
 * crud-delete precedent"), and it is what lets an Escalate button on a
 * record-detail ROUTE pass the ticket id before the page declares a
 * single-record source. So `declared` is threaded in, and {@link ownStringsOf}
 * marks exactly the strings that mechanism reaches — see it for how narrowly
 * "exactly those" is drawn, because every string it marks by mistake is a
 * refusal this rule silently stops making.
 *
 * WHAT IS DELIBERATELY OUT OF REACH. `dataSource` is excluded from the walk (it
 * is the binding, not a place a component nests), so a `$record.` inside a
 * `filter[].value` is not read here. That is an UNDER-reach, and this rule
 * refuses an absence — so under-reaching declines to refuse, where over-reaching
 * would refuse a valid page. Only the second is a bug an author cannot work
 * around, which is the same direction argument {@link boundNodesOf} records for
 * its own generosity.
 *
 * @param declared the `:segment` names this page's own `path` declares — the
 *   same set `routeParamAllowListViolations` takes, derived once by the caller
 */
export function recordReferenceViolations(
  page: Readonly<Record<string, unknown>>,
  declared: ReadonlySet<string>,
  label: string
): readonly string[] {
  return boundNodesOf(page)
    .filter(({ node, boundByAncestor }) => !boundsRecordRefs(node, boundByAncestor))
    .filter(({ node }) => typeof node['type'] === 'string')
    .flatMap(({ node }) => {
      const fields = ownStringsOf(node).flatMap(({ value, routeBound }) =>
        recordFieldRefsIn(value).filter((field) => !(routeBound && declared.has(field)))
      )
      if (fields.length === 0) return []
      const named = [...new Set(fields)].map((field) => `$record.${field}`).join(', ')
      return [
        `${label} references ${named} on a ${describeNode(node)} with no record-binding ancestor — the substitution runs as each row is expanded from its template, so here it resolves to nothing and the literal text reaches the browser. Nest it under a component with a dataSource (a rows template over a table or a system endpoint), or bind the page itself with dataSource / collection / contentDir`,
      ]
    })
}

/**
 * True when this node's own `$record.` references have a record to resolve
 * against.
 *
 * SELF COUNTS HERE, where family 6 requires a PROPER ancestor, and the
 * difference is real rather than an inconsistency. `visibility.record` is
 * decided BEFORE a component's own source resolves, so a component cannot gate
 * itself on the record it is about to fetch. A `$record.` reference is resolved
 * AFTER: a rows binding substitutes its own per-row template — the data-table's
 * `columns[].actions[].url` is exactly this shape, and the island interpolates
 * it per row client-side — and a `mode: 'single'` binding substitutes the
 * component it is declared on.
 *
 * `contentFrom` is the SECOND spelling of a rows binding a node declares on
 * itself: a `code` block folds an endpoint's rows into its own
 * content, substituting `contentFrom.template` once per row on the render path.
 * Its template is bound exactly as a `dataSource` per-row template is — and
 * bound more strictly than one, because the schema separately refuses a
 * template carrying no `$record.` reference at all.
 *
 * BELT AND BRACES, deliberately. `contentFrom` is ALSO in {@link SKIPPED_KEYS},
 * so the template's strings are never scanned and this clause is unreachable
 * today. Both halves landed from two branches that hit the same refusal
 * independently, and both are kept: the skip is the one that fires, and this
 * clause is what keeps a legal fold legal if the skip is ever narrowed to let
 * some other `contentFrom` string through. Refusing a valid page is the
 * OVER-reach direction this family's own docstring names as the only bug an
 * author cannot work around.
 */
function boundsRecordRefs(
  node: Readonly<Record<string, unknown>>,
  boundByAncestor: boolean
): boolean {
  return boundByAncestor || isRecord(node['dataSource']) || isRecord(node['contentFrom'])
}

/**
 * Every string a COMPONENT owns: its own values, its arrays' string elements,
 * and the leaves of the plain objects hanging off it (`props`, `subject`, …).
 *
 * Two subtrees are excluded, and each exclusion is the rule's correctness rather
 * than an optimisation:
 *
 *  - the two keys that hold nested COMPONENTS — `children` and the `component`
 *    a specimen draws. Each of those belongs to itself: {@link boundNodesOf}
 *    returns it separately WITH ITS OWN binding bit, and that bit differs from
 *    its parent's exactly when the parent declares a `dataSource` — the case
 *    this rule exists for. `children` is still read for its BARE STRING
 *    entries, which are this node's own inline text and belong to nobody else.
 *  - `dataSource` is the binding itself, matching {@link walkWithBinding}'s own
 *    exclusion and the under-reach the caller documents.
 *
 * The exclusion is by KEY and not by shape, because a component's own fields are
 * shaped like components: `specimen.subject` is `{ type: '$record.type' }`, and
 * a "carries a string `type`" test skips exactly the field this rule was written
 * for. A component-bearing key missing from the list costs a duplicate report of
 * one reference, never a missed one.
 */
const SKIPPED_KEYS: ReadonlySet<string> = new Set(['component', 'dataSource', 'contentFrom'])

/**
 * A `children` entry is either a nested component — which owns its own strings —
 * or a bare STRING, which is this node's own inline text. So the array is read
 * for strings and nothing else.
 */
const stringChildrenOf = (value: unknown): readonly string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []

/**
 * One string this component owns, and whether the route params can satisfy the
 * `$record.` references in it.
 */
interface StringLeaf {
  readonly value: string
  readonly routeBound: boolean
}

/**
 * The strings an automation button's route params reach — and nothing else.
 *
 * Three narrowings, each one a place the mechanism stops and therefore a place
 * the refusal has to resume. `renderAutomationButton` is the only caller of
 * `buildRecordContext`, and it feeds it exactly one thing:
 *
 *  - only an `action` whose `type` is `'automation'`. A standalone `fetch`
 *    button's config is serialized verbatim and dispatched by `client.ts`
 *    through `executeFetchAction` with NO `record` option, so a `$record.` in
 *    its `url` or `body` stays literal on a routed page.
 *  - only the `inputData` key of that action. `content`, `props` and `label` are
 *    never substituted from route params — `$param.<name>` is the spelling that
 *    works there, and family 1 already checks it.
 *  - only the TOP-LEVEL string values of `inputData`.
 *    `substituteRecordInInputData` maps `Object.entries` and substitutes when
 *    `typeof value === 'string'`; a nested object or array passes through
 *    untouched, so `inputData: { at: { id: '$record.id' } }` really does ship
 *    the literal text. Those leaves are still walked, just not marked.
 *
 * Everything else on the node keeps the plain, unbound scan.
 */
function actionLeavesOf(
  action: unknown,
  fromValue: (value: unknown) => readonly StringLeaf[]
): readonly StringLeaf[] {
  if (!isRecord(action)) return fromValue(action)
  const routeBinds = action['type'] === 'automation' && isRecord(action['inputData'])
  return Object.entries(action).flatMap(([key, value]) =>
    routeBinds && key === 'inputData'
      ? Object.values(value as Record<string, unknown>).flatMap((entry) =>
          typeof entry === 'string' ? [{ value: entry, routeBound: true }] : fromValue(entry)
        )
      : fromValue(value)
  )
}

function ownStringsOf(node: Readonly<Record<string, unknown>>): readonly StringLeaf[] {
  const fromValue = (value: unknown): readonly StringLeaf[] => {
    if (typeof value === 'string') return [{ value, routeBound: false }]
    if (Array.isArray(value)) return value.flatMap(fromValue)
    if (!isRecord(value)) return []
    return descend(value)
  }
  const descend = (value: Readonly<Record<string, unknown>>): readonly StringLeaf[] =>
    Object.entries(value)
      .filter(([key]) => !SKIPPED_KEYS.has(key))
      .flatMap(([key, child]) => {
        if (key === 'children')
          return stringChildrenOf(child).map((entry) => ({ value: entry, routeBound: false }))
        if (key === 'action') return actionLeavesOf(child, fromValue)
        return fromValue(child)
      })
  return descend(node)
}
