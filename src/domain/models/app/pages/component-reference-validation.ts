/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isFileRefValue } from '@/domain/kernel/config-parsing/ref-value-kind'

/**
 * A template placement — `$ref` or `component:` — must name a template
 * declared in `app.components`.
 *
 * A bare `$ref` (`- $ref: plan-card`, optionally with `vars`) places the
 * component template of that name. The schema checks the name's grammar, not
 * that a template carries it — so a typo (`plan-crad`) validated and then drew
 * a "Component not found" box at request time. In a YAML or JSON config the
 * same typo is also one character away from a file include, which the loader
 * reads only when the value is path-shaped: the message therefore names both
 * readings, so an author who meant a file sees how it is spelled.
 *
 * ─── WHAT IS A PLACEMENT HERE ──────────────────────────────────────────────
 *
 * An object whose keys are `$ref` and at most `vars` and `children`, and whose
 * `$ref` is a bare name. That excludes an action template reference (it always carries its
 * step `name`), and a path-shaped value (a file include the loader already
 * replaced, or — in a TypeScript config — a value the name grammar refuses on
 * its own). The walk reaches every page and every template body at any depth,
 * so a placement inside a container, a breakpoint's children or another
 * template is checked where it is written.
 *
 * ─── THE `component:` FORM ────────────────────────────────────────────────
 *
 * `- component: plan-card` places the same template, and a typo in it is
 * refused the same way, at boot — two spellings of one placement must not fail
 * at two different moments. `component` is also an ordinary field on other
 * nodes, so the placement is told apart by SHAPE, as the `$ref` one is: an
 * object whose keys are `component` plus at most one of `vars` / `variables`
 * (and the slot's `children`), and whose `component` is a string, written as a
 * member of a component list.
 * A `specimen` holds a component OBJECT and sits beside `type`, and its
 * `subject` is a lone object rather than a list member; an `openDrawer` action
 * carries `action`; none of them matches.
 * The message offers no file spelling: `component:` is never read from disk.
 */

/** Minimal shape needed to validate template placements. */
interface AppForReferenceValidation {
  readonly pages?: unknown
  readonly components?: unknown
}

/** How a placement was spelled — it decides the message's second sentence. */
type PlacementForm = '$ref' | 'component'

/** One placement: the template name it asks for, the key that asked, and the node. */
export interface Placement {
  readonly name: string
  readonly form: PlacementForm
  readonly node: Readonly<Record<string, unknown>>
}

// `children` rides along on either form: the page components that fill the
// template's `$children` slot.
const REF_PLACEMENT_KEYS: ReadonlySet<string> = new Set(['$ref', 'vars', 'children'])
const VALUE_KEYS: ReadonlySet<string> = new Set(['vars', 'variables'])

/** The template name a node places with a bare `$ref`, or `undefined`. */
const refPlacedName = (record: Readonly<Record<string, unknown>>): string | undefined => {
  const ref = record['$ref']
  if (typeof ref !== 'string' || isFileRefValue(ref)) return undefined
  return Object.keys(record).every((key) => REF_PLACEMENT_KEYS.has(key)) ? ref : undefined
}

/**
 * The template name a node places with `component:`, or `undefined`: keys are
 * `component` plus at most one of `vars` / `variables`, and `component` is a
 * string.
 */
const componentPlacedName = (record: Readonly<Record<string, unknown>>): string | undefined => {
  const name = record['component']
  if (typeof name !== 'string') return undefined
  const others = Object.keys(record).filter((key) => key !== 'component' && key !== 'children')
  return others.length <= 1 && others.every((key) => VALUE_KEYS.has(key)) ? name : undefined
}

/**
 * The placement a node makes, in either form, or `undefined`. The `component:`
 * form is read only on a member of an array — see {@link collectPlacements}.
 */
const placementOf = (
  record: Readonly<Record<string, unknown>>,
  inArray: boolean
): Placement | undefined => {
  const ref = refPlacedName(record)
  if (ref !== undefined) return { name: ref, form: '$ref', node: record }
  const component = inArray ? componentPlacedName(record) : undefined
  return component === undefined ? undefined : { name: component, form: 'component', node: record }
}

/**
 * Every placement written anywhere under `node`.
 *
 * A `component:` placement is always a MEMBER of a component list — a page's
 * `components`, a node's `children`, a template body — so only an array member
 * is read in that form. That is what keeps a specimen's `subject` out: it is a
 * single object (`subject: { component: site-header }`) naming a template that,
 * under the admin console, belongs to the documented app rather than this one.
 */
export const collectPlacements = (node: unknown, inArray = false): readonly Placement[] => {
  if (Array.isArray(node)) return node.flatMap((member: unknown) => collectPlacements(member, true))
  if (node === null || typeof node !== 'object') return []
  const record = node as Readonly<Record<string, unknown>>
  const own = placementOf(record, inArray)
  // A placement's own `children` are page components for the template's slot,
  // so a placement written among them is checked where it is written too.
  return own === undefined
    ? Object.values(record).flatMap((value: unknown) => collectPlacements(value))
    : [own, ...collectPlacements(record['children'])]
}

/** The `name` of every declared template. */
const templateNames = (components: unknown): ReadonlySet<string> =>
  new Set(
    (Array.isArray(components) ? components : []).flatMap((template: unknown) => {
      const name = (template as { readonly name?: unknown } | null)?.name
      return typeof name === 'string' ? [name] : []
    })
  )

/** Where a placement was written, for the message. */
const ownerLabel = (owner: unknown, kind: 'page' | 'template'): string => {
  const name = (owner as { readonly name?: unknown } | null)?.name
  return typeof name === 'string' ? ` (on ${kind} '${name}')` : ''
}

/** The refusal for one unknown name, worded for the form it was placed with. */
const unknownTemplateMessage = ({ name, form }: Placement, where: string): string =>
  `${form}: ${name}${where} names no component template: app.components has no template named '${name}'. ` +
  (form === '$ref'
    ? `A bare $ref places a template by name. To include a file instead, write its path: $ref: ./${name}.yaml`
    : `Declare a template of that name in app.components, or correct the name.`)

/**
 * Validate every template placement, in both forms, against `app.components`.
 *
 * @returns `true` when every placed name is declared, or the message naming
 * the first one that is not.
 */
export const validateAllComponentReferences = (app: AppForReferenceValidation): string | true => {
  const declared = templateNames(app.components)
  const owners = [
    ...(Array.isArray(app.pages) ? app.pages : []).map((page: unknown) => ({
      node: page,
      where: ownerLabel(page, 'page'),
    })),
    ...(Array.isArray(app.components) ? app.components : []).map((template: unknown) => ({
      node: template,
      where: ownerLabel(template, 'template'),
    })),
  ]
  const missing = owners
    .flatMap(({ node, where }) =>
      collectPlacements(node).map((placement) => ({ placement, where }))
    )
    .find(({ placement }) => !declared.has(placement.name))
  return missing === undefined ? true : unknownTemplateMessage(missing.placement, missing.where)
}
