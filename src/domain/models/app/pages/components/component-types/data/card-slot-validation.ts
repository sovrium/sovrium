/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Decode rule for a card SLOT — a board card's `card.children` and a gallery
 * card's `galleryCard.children`.
 *
 * A card slot draws RECORD components bound to its card: text, a badge, an
 * avatar, a QR code, an image — each reading `$record.<field>` of the record
 * the card stands for. A DATA component (a list, a grid, a chart) placed there
 * would be one query per card, and it reaches the browser with any
 * `$currentUser` token it carries unresolved, because the page's request-time
 * passes never walk a card slot. So it is refused at boot, naming the slot and
 * the component, rather than rendered as something that looks deliberate.
 *
 * A card slot's children decode as open records, so a `qr-code` there is not
 * checked by the page `qr-code` schema. Its `size` and `ecc` are checked here
 * against that schema's own fields: the browser writes `size` into the symbol's
 * SVG markup, and an `ecc` outside L/M/Q/H makes the encoder throw.
 *
 * Runs over the RAW config at the shared decode boundary
 * (`decodeAppConfigObject` → `runSemanticChecks`), so boot, `sovrium validate`
 * and a watch reload reach the same verdict. Pure: no I/O.
 */

import { Schema } from 'effect'
import { qrCodeFields } from '../content/qr-code'

type RawRecord = Readonly<Record<string, unknown>>

const isRecord = (value: unknown): value is RawRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Component types that read their own records — never allowed in a card slot. */
const DATA_COMPONENT_TYPES: ReadonlySet<string> = new Set([
  'table',
  'list',
  'kanban',
  'gallery',
  'calendar',
  'chart',
  'kpi',
  'timeline',
  'graph',
  'matrix',
  'form',
])

/** Where each card-bearing component keeps its slot. */
const CARD_SLOTS: readonly { readonly type: string; readonly slot: string }[] = [
  { type: 'kanban', slot: 'card' },
  { type: 'gallery', slot: 'galleryCard' },
]

/** True when the node reads records of its own. */
const isDataComponent = (node: RawRecord): boolean =>
  (typeof node['type'] === 'string' && DATA_COMPONENT_TYPES.has(node['type'])) ||
  node['dataSource'] !== undefined

/** Every data component in a slot's children, at any depth, by type. */
function dataComponentsIn(children: unknown): readonly string[] {
  if (!Array.isArray(children)) return []
  return children.flatMap((child: unknown) => {
    if (!isRecord(child)) return []
    const self = isDataComponent(child) ? [String(child['type'] ?? 'component')] : []
    return [...self, ...dataComponentsIn(child['children'])]
  })
}

/** Every object at any depth. */
function collectNodes(node: unknown): readonly RawRecord[] {
  if (Array.isArray(node)) return node.flatMap(collectNodes)
  if (!isRecord(node)) return []
  return [node, ...Object.values(node).flatMap(collectNodes)]
}

/** A card `qr-code`'s options, held to the page `qr-code`'s own field schemas. */
const isCardQrOption = {
  size: Schema.is(qrCodeFields.size.schema),
  ecc: Schema.is(qrCodeFields.ecc.schema),
} as const

/** The `size` / `ecc` of every `qr-code` in a slot's children that its schema refuses. */
function qrOptionViolations(type: string, slot: string, children: unknown): readonly string[] {
  return collectNodes(children)
    .filter((node) => node['type'] === 'qr-code')
    .flatMap((node) =>
      (['size', 'ecc'] as const)
        .filter((key) => node[key] !== undefined && !isCardQrOption[key](node[key]))
        .map(
          (key) =>
            `${type}: a \`qr-code\` in \`${slot}.children\` has an invalid \`${key}\` (${JSON.stringify(node[key])}) — \`size\` is a whole number of pixels above 0 and \`ecc\` one of L, M, Q, H, as on a page \`qr-code\`.`
        )
    )
}

/** The violations of one card-bearing component. */
function slotViolations(node: RawRecord): readonly string[] {
  return CARD_SLOTS.flatMap(({ type, slot }) => {
    if (node['type'] !== type) return []
    const card = node[slot]
    if (!isRecord(card)) return []
    return [
      ...dataComponentsIn(card['children']).map(
        (found) =>
          `${type}: \`${slot}.children\` holds a data component (\`${found}\`). A card slot draws components bound to its card's record — text, badge, avatar, qr-code, image; place the \`${found}\` on the page instead.`
      ),
      ...qrOptionViolations(type, slot, card['children']),
    ]
  })
}

/**
 * Refuse a data component in any card slot of any page.
 *
 * @returns one message per offending component, empty when every slot holds
 *   record components only
 */
export function validateCardSlotComponents(config: unknown): readonly string[] {
  const pages = isRecord(config) ? config['pages'] : undefined
  if (!Array.isArray(pages)) return []
  return collectNodes(pages).flatMap(slotViolations)
}
