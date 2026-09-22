/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The record-binding walk families 6 and 14 of `page-binding-validation.ts`
 * share.
 *
 * Both answer the same structural question — "does anything above this component
 * bind a record?" — for two different primitives, and a second walk would drift
 * from this one silently: the two rules would then disagree about which pages
 * bind, which is a contradiction an author cannot debug from either message.
 *
 * Structural rather than typed, for the reason its callers record: a typed
 * traversal of a ~58-branch component union goes stale in silence.
 */

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Every component node of a page, each paired with whether some PROPER ancestor
 * binds a record — the one walk families 6 and 14 share.
 *
 * WHAT COUNTS AS A PAGE-LEVEL BINDING. Three keys, because three of them hand a
 * record to every component on the page: `dataSource` (a detail or rows binding
 * declared on the page itself), `collection` (one route per record — the shape
 * every slug-routed detail page uses, resolved by `page-collection-resolver.ts`),
 * and `contentDir` (a markdown corpus routed the same way).
 *
 * The list is deliberately GENEROUS rather than exact, for the direction reason
 * {@link recordVisibilityViolations} records: both rules refuse an ABSENCE, so a
 * binding form missing from this list refuses a page that is in fact correct,
 * while a form listed here that binds nothing merely declines to refuse. Only
 * the first of those is a bug an author cannot work around.
 */
export function boundNodesOf(page: Readonly<Record<string, unknown>>): readonly BoundNode[] {
  const pageBindsRecord =
    isRecord(page['dataSource']) || isRecord(page['collection']) || isRecord(page['contentDir'])
  return [
    ...walkWithBinding(page['components'], pageBindsRecord),
    ...walkWithBinding(page['layout'], pageBindsRecord),
  ]
}

/** A component node, paired with whether some PROPER ancestor binds a record. */
export interface BoundNode {
  readonly node: Record<string, unknown>
  readonly boundByAncestor: boolean
}

/**
 * Depth-first walk that carries the one bit {@link walk} throws away: whether an
 * ancestor of this node declares a `dataSource`.
 *
 * Structural for the same reason its flat sibling is — a typed traversal of a
 * ~58-branch union goes stale silently. It only reads `dataSource`, `children`
 * and the well-known template keys, so an unrelated object passing through is
 * inert (it simply cannot bind a record, which is the safe answer).
 */
function walkWithBinding(value: unknown, boundByAncestor: boolean): readonly BoundNode[] {
  if (Array.isArray(value)) return value.flatMap((entry) => walkWithBinding(entry, boundByAncestor))
  if (!isRecord(value)) return []
  // `contentFrom` is a rows binding too: a `code` block folds the rows
  // it fetches into its own content, so its `template` is bound by the node itself.
  const bindsForDescendants =
    boundByAncestor || isRecord(value['dataSource']) || isRecord(value['contentFrom'])
  return [
    { node: value, boundByAncestor },
    ...Object.entries(value)
      // `dataSource` is the binding itself, not a place a component can be
      // nested — walking into it would report its own filter objects as nodes.
      //
      // `action` is excluded for a sharper version of the same reason: it is a
      // typed CONFIG object that carries a `type` DISCRIMINANT (`'automation'`,
      // `'fetch'`, `'crud'`), and `describeNode` reads any string `type` as a
      // component name — so a button's action was returned as a second node and
      // reported as an `"automation" component`. No action schema nests a
      // component (none declares `components` or `children`), and family 14
      // already reads the whole action subtree as the OWNING component's own
      // strings, so nothing is lost: what goes is a duplicate report under a
      // name no author would recognise.
      .filter(([key]) => key !== 'dataSource' && key !== 'contentFrom' && key !== 'action')
      .flatMap(([, child]) => walkWithBinding(child, bindsForDescendants)),
  ]
}

/** Name a node for the error message: its `type` when it has one. */
export function describeNode(node: Readonly<Record<string, unknown>>): string {
  const { type } = node
  return typeof type === 'string' ? `"${type}" component` : 'component'
}
