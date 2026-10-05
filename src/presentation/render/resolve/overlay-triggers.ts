/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Which overlays a component tree ADDRESSES — the ids its triggers open.
 *
 * Two trigger shapes name an overlay by id: a click interaction
 * (`interactions.click.modal: <id>`, at the root or under `props`) and an
 * `openDrawer` action (`{ action: 'openDrawer', component: <id> }`, on a row
 * click or a button). Both are read wherever they sit on a node — the node's
 * own fields, not its `children`, which are walked as nodes of their own.
 *
 * A trigger INSIDE the overlay it addresses (a "back" button that re-opens
 * its own dialog) does not count: an overlay cannot keep itself on the page.
 */

/** Component types an author opens by id — the ones a trigger can address. */
const OVERLAY_TYPES: ReadonlySet<string> = new Set([
  'dialog',
  'alert-dialog',
  'drawer',
  'record-drawer',
  'popover',
  'hover-card',
])

type NodeRecord = Readonly<Record<string, unknown>>

const isRecord = (value: unknown): value is NodeRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** The id an overlay is addressed by, when the node is one. */
export function overlayIdOf(node: unknown): string | undefined {
  if (!isRecord(node) || typeof node['type'] !== 'string') return undefined
  if (!OVERLAY_TYPES.has(node['type'])) return undefined
  const props = isRecord(node['props']) ? node['props'] : {}
  const id = props['id'] ?? node['id']
  return typeof id === 'string' && id !== '' ? id : undefined
}

/** Overlay ids named by one value of a node's own fields, at any depth. */
function targetsInValue(value: unknown, depth: number): readonly string[] {
  if (depth > 6) return []
  if (Array.isArray(value)) return value.flatMap((item) => targetsInValue(item, depth + 1))
  if (!isRecord(value)) return []
  const own = [
    ...(isRecord(value['click']) && typeof value['click']['modal'] === 'string'
      ? [value['click']['modal']]
      : []),
    ...(value['action'] === 'openDrawer' && typeof value['component'] === 'string'
      ? [value['component']]
      : []),
  ]
  const nested = Object.entries(value)
    .filter(([key]) => key !== 'children' && key !== 'responsive')
    .flatMap(([, inner]) => targetsInValue(inner, depth + 1))
  return [...own, ...nested]
}

/** Child node lists of a node: `children` and every breakpoint's `children`. */
function childListsOf(node: NodeRecord): readonly unknown[] {
  const children = Array.isArray(node['children']) ? node['children'] : []
  const responsive = isRecord(node['responsive']) ? Object.values(node['responsive']) : []
  const responsiveChildren = responsive.flatMap((variant) =>
    isRecord(variant) && Array.isArray(variant['children']) ? variant['children'] : []
  )
  return [...children, ...responsiveChildren]
}

function collectFromNode(node: unknown, enclosing: ReadonlySet<string>): readonly string[] {
  if (!isRecord(node)) return []
  const ownTargets = targetsInValue(
    Object.fromEntries(
      Object.entries(node).filter(([key]) => key !== 'children' && key !== 'responsive')
    ),
    0
  ).filter((id) => !enclosing.has(id))
  const selfId = overlayIdOf(node)
  const inside = selfId === undefined ? enclosing : new Set([...enclosing, selfId])
  return [...ownTargets, ...childListsOf(node).flatMap((child) => collectFromNode(child, inside))]
}

/** Every overlay id the triggers of `components` open. */
export function collectOverlayTargets(
  components: readonly unknown[] | undefined
): ReadonlySet<string> {
  return new Set((components ?? []).flatMap((node) => collectFromNode(node, new Set())))
}

/**
 * The render-time field that tells a dialog it HAS an opener: some trigger in
 * the page config names its id. Set by {@link markAddressedDialogs}, read by the
 * dialog renderer, and never authorable — it is added after the config decodes.
 */
const HAS_OPENER_KEY = '_hasOpener'

/** Dialog types whose initial open state depends on having an opener. */
const DIALOG_TYPES: ReadonlySet<string> = new Set(['dialog', 'alert-dialog'])

/** `node` with its `children` and every breakpoint's `children` mapped by `visit`. */
function mapChildLists(node: NodeRecord, visit: (child: unknown) => unknown): NodeRecord {
  const children = Array.isArray(node['children']) ? { children: node['children'].map(visit) } : {}
  const responsive = isRecord(node['responsive'])
    ? {
        responsive: Object.fromEntries(
          Object.entries(node['responsive']).map(([breakpoint, variant]) => [
            breakpoint,
            isRecord(variant) && Array.isArray(variant['children'])
              ? { ...variant, children: variant['children'].map(visit) }
              : variant,
          ])
        ),
      }
    : {}
  return { ...node, ...children, ...responsive }
}

function markNode(node: unknown, addressed: ReadonlySet<string>): unknown {
  if (!isRecord(node)) return node
  const id = overlayIdOf(node)
  const marked =
    id !== undefined && DIALOG_TYPES.has(String(node['type'])) && addressed.has(id)
      ? { ...node, [HAS_OPENER_KEY]: true }
      : node
  return mapChildLists(marked, (child) => markNode(child, addressed))
}

/**
 * Mark every dialog some trigger in `authored` opens — wherever that trigger
 * sits: in a tab panel not opened yet, behind a query gate, inside another
 * overlay. The decision is made from the page CONFIG, on the server, so it does
 * not depend on which triggers happen to be drawn when the dialog mounts: a
 * dialog with an opener waits closed for it, and one nothing names opens on its
 * own.
 */
export function markAddressedDialogs<T extends readonly unknown[] | undefined>(
  authored: readonly unknown[] | undefined,
  components: T
): T {
  if (components === undefined) return components
  const addressed = collectOverlayTargets(authored)
  if (addressed.size === 0) return components
  return components.map((node) => markNode(node, addressed)) as unknown as T
}

/**
 * `hasOpener: true` for a dialog a trigger in the page config opens
 * ({@link markAddressedDialogs}), so the island mounts it closed; nothing
 * otherwise, so a dialog outside that pass keeps its own mount-time judgement.
 */
export function openerProp(component: unknown): { readonly hasOpener?: true } {
  return isRecord(component) && component[HAS_OPENER_KEY] === true ? { hasOpener: true } : {}
}
