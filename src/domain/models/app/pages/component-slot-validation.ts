/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { collectPlacements, type Placement } from './component-reference-validation'
import { COMPONENT_LENGTH_RULES } from './components/component-types/component-xor-rules'

/**
 * A component template's slot — `children: $children` on one of its nodes —
 * and the placements that fill it, checked together.
 *
 * The schema accepts the marker on any template node and `children` on any
 * placement; whether the two MEET is a question about the whole app, so it is
 * answered here, once both lists are known. Four refusals, each closing a way
 * for something a page wrote to vanish or to read the wrong data:
 *
 * 1. A template declares at most ONE slot. With two, the page's components
 *    would have to be split between them, and nothing says how.
 * 2. A placement passing `children` to a template WITHOUT a slot is refused,
 *    rather than its children being dropped in silence.
 * 3. A placement cannot fill the slot through its values (`vars.children` or
 *    `variables.children`): the slot takes components, not a `$children`
 *    placeholder value, and a value of that name would never reach it.
 * 4. The slot cannot sit inside a template node that changes what a record
 *    means — one that binds rows (`dataSource`, `contentFrom`) or repeats
 *    (`repeat`). The page's components are read in the PAGE's scope; inside a
 *    row template `$record` would name each row instead, and inside a repeat
 *    the page's components would be drawn once per element. The node holding
 *    the marker counts, as does every node above it up to the template root.
 *
 * A named slot — `children: $slots.<name>` — follows the same rules, once per
 * name, and two more besides: the template must declare `<name>` as an input
 * of kind `slot` and mark it, and a placement's `slots` may name only a slot
 * the template declares and marks.
 *
 * And one check on a slot whose node lays its children out by POSITION — a
 * `tabs` (`panels[i]` shows `children[i]`) or a `stepper` (`steps[i]`): the
 * placement must pass exactly as many children as the template declares
 * panels or steps. Decode holds that length rule for children written in
 * place; a slot is filled after decode, so it is held here, or one missing
 * component would put the wrong body under every tab after it.
 *
 * Everything else about the slotted components — a form's sections, a
 * `$record` reference, a visibility rule, a nested placement — is checked by
 * the page's own rules, because they ARE written on the page, under the
 * placement, with the page's ancestors above them. Rule 4 is what keeps that
 * reading exact: no template node between the page and the slot can bind or
 * repeat.
 */

/** Minimal shape needed to validate slots. */
interface AppForSlotValidation {
  readonly pages?: unknown
  readonly components?: unknown
}

const SLOT_MARKER = '$children'
const NAMED_SLOT_PREFIX = '$slots.'

/** Keys on a template node that change what `$record` means below it. */
const SCOPE_KEYS: readonly string[] = ['dataSource', 'contentFrom', 'repeat']

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * One slot found in a template: which slot (`$children`, or a named slot's
 * name), whether a scope-changing node encloses it, and which; and, when the
 * slot's own node aligns its children by position, how many it expects.
 */
interface SlotSite {
  readonly slot: string
  readonly scopeKey: string | undefined
  readonly positional?: { readonly type: string; readonly key: string; readonly length: number }
}

/** The positional arity of the node holding a slot (`tabs.panels`, `stepper.steps`), if any. */
const positionalArityOf = (node: Readonly<Record<string, unknown>>): SlotSite['positional'] => {
  const rule = COMPONENT_LENGTH_RULES.find(
    (candidate) => node['type'] === candidate.type && Array.isArray(node[candidate.keys[0]])
  )
  if (rule === undefined) return undefined
  const [key] = rule.keys
  const { length } = node[key] as readonly unknown[]
  return { type: rule.type, key, length }
}

/** The scope key a node declares, if any. */
const scopeKeyOf = (node: Readonly<Record<string, unknown>>): string | undefined =>
  SCOPE_KEYS.find((key) => node[key] !== undefined)

/** The slot a `children` value marks: `$children`, a named slot's name, or none. */
const slotMarkedBy = (children: unknown): string | undefined => {
  if (children === SLOT_MARKER) return SLOT_MARKER
  return typeof children === 'string' && children.startsWith(NAMED_SLOT_PREFIX)
    ? children.slice(NAMED_SLOT_PREFIX.length)
    : undefined
}

/**
 * Every slot under `node`, walking `children` lists — the only place a slot can
 * be written — and carrying the first scope-changing key met on the way down.
 */
const slotSites = (node: unknown, enclosingScope: string | undefined): readonly SlotSite[] => {
  if (!isRecord(node)) return []
  const scopeKey = enclosingScope ?? scopeKeyOf(node)
  const { children } = node
  const slot = slotMarkedBy(children)
  if (slot !== undefined) {
    const positional = positionalArityOf(node)
    return [positional === undefined ? { slot, scopeKey } : { slot, scopeKey, positional }]
  }
  return Array.isArray(children)
    ? children.flatMap((child: unknown) => slotSites(child, scopeKey))
    : []
}

/** A template's slots, and the names it declares as inputs of kind `slot`. */
interface TemplateSlots {
  readonly sites: readonly SlotSite[]
  readonly declared: ReadonlySet<string>
}

/** The names a template declares as inputs of kind `slot`. */
const declaredSlotsOf = (template: Readonly<Record<string, unknown>>): ReadonlySet<string> => {
  const { inputs } = template
  if (!isRecord(inputs)) return new Set()
  return new Set(
    Object.entries(inputs).flatMap(([name, input]) =>
      isRecord(input) && input['kind'] === 'slot' ? [name] : []
    )
  )
}

/** Each declared template by name, with the slots its tree holds. */
const templateSlots = (components: unknown): ReadonlyMap<string, TemplateSlots> =>
  new Map(
    (Array.isArray(components) ? components : []).flatMap((template: unknown) =>
      isRecord(template) && typeof template['name'] === 'string'
        ? [
            [
              template['name'],
              { sites: slotSites(template, undefined), declared: declaredSlotsOf(template) },
            ] as const,
          ]
        : []
    )
  )

/** How a slot is written in a template, for a message. */
const markerOf = (slot: string): string =>
  slot === SLOT_MARKER ? 'children: $children' : `children: $slots.${slot}`

/** The template-side refusals about how often, and whether declared, a slot is marked. */
const markingViolation = (name: string, { sites, declared }: TemplateSlots): string | undefined => {
  const marked = sites.map((site) => site.slot)
  const repeated = marked.find((slot, index) => marked.indexOf(slot) !== index)
  if (repeated === SLOT_MARKER) {
    const count = marked.filter((slot) => slot === SLOT_MARKER).length
    return `Template '${name}' declares ${count} slots (children: $children); a template takes at most one. Keep one slot and lay the others out inside the page's components.`
  }
  if (repeated !== undefined) {
    return `Template '${name}' marks the slot $slots.${repeated} more than once; each slot is marked on one node. Keep one marker and lay the rest out inside the page's components.`
  }
  const undeclared = marked.find((slot) => slot !== SLOT_MARKER && !declared.has(slot))
  if (undeclared !== undefined) {
    return `Template '${name}' marks the slot $slots.${undeclared}, but '${undeclared}' is not declared as an input of kind slot. Add inputs: { ${undeclared}: { kind: slot } } to the template.`
  }
  const unmarked = [...declared].find((slot) => !marked.includes(slot))
  return unmarked === undefined
    ? undefined
    : `Template '${name}' declares the slot input '${unmarked}' but marks no node with children: $slots.${unmarked}, so what a page passes for it would be drawn nowhere. Mark the node that should hold it, or remove the input.`
}

/** The template-side refusals: a slot marked wrongly, or a slot in a binding or repeating node. */
const templateViolation = (name: string, slots: TemplateSlots): string | undefined => {
  const marking = markingViolation(name, slots)
  if (marking !== undefined) return marking
  const scoped = slots.sites.find((site) => site.scopeKey !== undefined)
  return scoped === undefined
    ? undefined
    : `Template '${name}' places its slot (${markerOf(scoped.slot)}) inside a node that declares ${scoped.scopeKey}. The page's components are read in the page's scope, so the slot cannot sit where ${scoped.scopeKey} would bind or repeat them. Move the slot outside that node.`
}

/** The page components a placement passes for a slot, or `undefined` when it passes none. */
const passedFor = (placement: Placement, slot: string): unknown => {
  if (slot === SLOT_MARKER) return placement.node['children']
  const { slots } = placement.node
  return isRecord(slots) ? slots[slot] : undefined
}

/** Whether a placement's values carry a `children` key. */
const fillsSlotThroughValues = (placement: Placement): boolean =>
  ['vars', 'variables'].some((key) => {
    const values = placement.node[key]
    return isRecord(values) && Object.hasOwn(values, 'children')
  })

/** A placement's `slots` entry naming no slot its template declares and marks. */
const unknownSlotViolation = (
  placement: Placement,
  template: TemplateSlots
): string | undefined => {
  const { slots } = placement.node
  if (!isRecord(slots)) return undefined
  const marked = new Set(template.sites.map((site) => site.slot))
  const unknown = Object.keys(slots).find(
    (slot) => !template.declared.has(slot) || !marked.has(slot)
  )
  return unknown === undefined
    ? undefined
    : `${placement.form}: ${placement.name} passes slots.${unknown}, but '${unknown}' is not a slot of template '${placement.name}'. Declare it in the template as an input of kind slot and mark its node with children: $slots.${unknown}, or write those components on the page beside the placement.`
}

/** The placement-side refusals: children to a slotless template, or the slot filled by a value. */
const placementViolation = (
  placement: Placement,
  slots: ReadonlyMap<string, TemplateSlots>
): string | undefined => {
  const template = slots.get(placement.name)
  // An unknown name is the reference check's to report, with its own message.
  if (template === undefined) return undefined
  const { sites } = template
  const hasDefault = sites.some((site) => site.slot === SLOT_MARKER)
  if (!hasDefault && passedFor(placement, SLOT_MARKER) !== undefined) {
    return `${placement.form}: ${placement.name} passes children, but template '${placement.name}' has no slot to put them in. Mark the node that should hold them with children: $children in the template, or write those components on the page beside the placement.`
  }
  if (hasDefault && fillsSlotThroughValues(placement)) {
    return `${placement.form}: ${placement.name} passes a value named children; template '${placement.name}' has a slot, which takes the page's components as the placement's own children list, not as a value. Move them to children: [ … ] on the placement.`
  }
  return (
    unknownSlotViolation(placement, template) ??
    sites.map((site) => positionalViolation(placement, site)).find((error) => error !== undefined)
  )
}

/** A placement filling a positional slot with a different number of children. */
const positionalViolation = (placement: Placement, site: SlotSite): string | undefined => {
  const { positional } = site
  const passed = passedFor(placement, site.slot)
  if (positional === undefined || !Array.isArray(passed) || passed.length === positional.length) {
    return undefined
  }
  const what = site.slot === SLOT_MARKER ? 'children' : `components in slots.${site.slot}`
  return `${placement.form}: ${placement.name} passes ${String(passed.length)} ${what}, but template '${placement.name}' holds its slot in a \`${positional.type}\` that declares ${String(positional.length)} \`${positional.key}\`. \`${positional.key}[i]\` shows the i-th child, so pass exactly one child per entry, or a missing one puts the wrong body under every entry after it.`
}

/**
 * Validate every template slot and every placement that fills one.
 *
 * @returns `true` when every slot and every placement is well-formed, or the
 * message naming the first that is not.
 */
export const validateAllComponentSlots = (app: AppForSlotValidation): string | true => {
  const slots = templateSlots(app.components)
  const templateError = [...slots].map(([name, template]) => templateViolation(name, template))
  const placements = [...collectPlacements(app.pages), ...collectPlacements(app.components)]
  const placementError = placements.map((placement) => placementViolation(placement, slots))
  return [...templateError, ...placementError].find((error) => error !== undefined) ?? true
}
