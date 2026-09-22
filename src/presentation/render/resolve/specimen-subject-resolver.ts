/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `specimen.subject` — turning a NAMED subject into the component the engine
 * draws for it.
 *
 * ─── ONE PAGE, NOT NINETY ──────────────────────────────────────────────────
 *
 * `specimen.component` holds a component LITERAL, which is what makes the
 * snippet honest — and also means one declaration draws one type. A per-type
 * kit route needs ninety pages of otherwise identical config, or one page whose
 * subject comes from the route. There is no `$param` substitution into a
 * component's `type`, because that `type` is the discriminant the union decodes
 * on, so the reference has to sit beside it rather than inside it.
 *
 * ─── THE SUBSTITUTION HAPPENS BEFORE EVERY OTHER PASS ──────────────────────
 *
 * The resolved subject is written into the `component` field, and from that
 * point on a named subject and a written-out one are the SAME declaration. That
 * is not an implementation convenience, it is the criterion
 * `[internal ref]` asserts: the drawn thing has to go through
 * the option-source pass, the data-source pass, the design cascade and the
 * snippet projection exactly as a literal does, or the two forms would draw
 * different elements and the provenance badges beside them would describe
 * something that is not on screen.
 *
 * ─── AN UNRESOLVABLE SUBJECT IS A 404, NOT AN EMPTY FRAME ──────────────────
 *
 * A literal subject is checked at DECODE time
 * (`design-console-component-validation.ts`), so only a `$param` one can fail
 * here — its value is a URL segment rather than a config fact. The answer is
 * the page's own 404: a mistyped URL that silently rendered SOME page makes a
 * broken link look live, and an empty frame leaves a reader believing the type
 * has no specimen rather than no existence. 404 rather than an explanatory
 * page, for the anti-enumeration reason every route parser here gives.
 *
 * Source: src/domain/models/app/pages/components/component-types/specialty/specimen.ts
 * Specs: [internal ref]
 */

import {
  catalogSpecimenInAxes,
  catalogSpecimenRefusal,
} from '@/domain/models/app/design/catalog-specimens'
import { catalogSpecimenWrapperProps } from '@/domain/models/app/design/catalog-specimens/provenance'
import { catalogSpecimenWithOption } from '@/domain/models/app/design/preview-option'
import { introspectType } from '@/domain/models/app/design/type-introspection'
import { parseRouteParamRef } from '@/domain/models/app/pages/route-param-ref'
import type { SpecimenAxes } from '@/domain/models/app/design/catalog-specimens'
import type { Component } from '@/domain/models/app/pages/components'

/**
 * WHEN a subject is being resolved, which decides what an unresolvable one means.
 *
 * ─── A ROUTE IS ONE FACT; A ROW IS ONE OF MANY ─────────────────────────────
 *
 * `route` runs BEFORE the row templates expand, and resolves literals and
 * `$param.` subjects. A `$param` naming no drawable type is the page's own 404:
 * a URL segment is one fact about one request, and a mistyped URL that silently
 * rendered SOME page makes a broken link look live.
 *
 * `row` runs AFTER expansion, when `$record.` has been substituted to a real
 * value. Here a 404 would be wrong in the other direction — blanking a
 * ninety-card index because its eleventh row is undrawable loses the ten that
 * were fine — so the offending specimen REPORTS itself where it sits and the
 * page answers 200.
 */
/**
 * Which pass is resolving, and — for a route pass — whether the PAGE has
 * already vouched for the segment.
 *
 * `'route'` and `'vouched'` are both route passes and differ in exactly one
 * answer: what an undrawable subject means. With no `page.params`, the specimen
 * is the only authority on whether the URL is real, so it 404s (`-014`). Once
 * the page declares which segments it serves, THAT is the authority — the URL
 * is one of this page's own whatever a single component can draw — so the
 * specimen reports its refusal in place exactly as it does for one row of an
 * index (`-023`). Otherwise adding a specimen to a page would silently narrow
 * which URLs the page serves.
 */
export type SpecimenSubjectMode = 'route' | 'vouched' | 'row'

/**
 * The operator's reusable templates, by name — what a `subject.component`
 * resolves against.
 *
 * A `Map` rather than the raw `components[]` array, built once per page: the
 * walk is recursive and a linear scan per specimen would be quadratic on a kit
 * page drawing every template an app declares.
 *
 * FIRST DECLARATION WINS, which matters only under the admin mount. There the
 * rendering app's `components` is the console's own followed by the operator's
 * — spread in that order by `routeBoundOperatorComponents` in
 * `application/use-cases/mount/embedded-app-mount.ts`, which is where the
 * ordering moved when the console builders were deleted — precisely so an
 * operator cannot shadow a piece of Sovrium's chrome by naming a template after
 * it. Building the map
 * front-to-back with a no-overwrite insert preserves that order; `new Map(...)`
 * over the pairs would silently invert it.
 */
export type SpecimenTemplates = ReadonlyMap<string, Component>

/**
 * Index a component list by name, FIRST declaration winning.
 *
 * Built from the REVERSED pairs, because `new Map(entries)` keeps the LAST value
 * for a repeated key — so applying them back-to-front is what makes the first
 * declaration the one that survives, with no mutation and no loop. The order is
 * the whole point under the admin mount, where the list is the console's own
 * templates followed by the operator's.
 */
export const indexTemplatesByName = (
  components: readonly Component[] | undefined
): SpecimenTemplates =>
  new Map(
    (components ?? []).flatMap((component, index, all) => {
      const { name } = component as { readonly name?: unknown }
      if (typeof name !== 'string') return []
      // Keep only the FIRST declaration of a name. A quadratic scan over a
      // component list is free at this size, and it says what it means without
      // a mutation or a reversal the FP rules refuse.
      const first = all.findIndex((other) => (other as { name?: unknown }).name === name)
      return first === index ? [[name, component] as const] : []
    })
  )

/** A tree whose every named subject resolved, or the 404 the page answers. */
export type SpecimenSubjectResolution =
  | { readonly kind: 'resolved'; readonly components: readonly Component[] }
  | { readonly kind: 'not-found' }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Name the drawn component after the type the specimen is OF.
 *
 * A specimen has to be addressable by its SUBJECT, and the drawn root does not
 * always carry that name: the catalogue's `badge` specimen is a `container` of
 * four badges, so a reader looking for "the badge specimen" would find four
 * elements or none. `data-component` is the attribute the codebase already uses
 * for "what this element IS" (`data-component-type` reports the node's own type
 * and stays untouched), and it is a reserved pass-through prop, so stamping it
 * needs no renderer to opt in.
 *
 * Never overwritten: a renderer that already publishes its own name — the
 * `table` island mount host does — keeps it, and the stamped prop is
 * dropped by that renderer rather than emitting a second element under the same
 * name.
 */
const nameSpecimen = (drawn: unknown, subject: string): Component => {
  if (!isRecord(drawn)) return drawn as Component
  const props = isRecord(drawn['props']) ? drawn['props'] : {}
  if (props['data-component'] !== undefined) return drawn as Component
  return { ...drawn, props: { ...props, 'data-component': subject } } as Component
}

/**
 * One value a subject names: the route segment it points at, or the literal.
 *
 * `$record.` never reaches here — a subject holding one is left for the ROW
 * pass, which runs after expansion has substituted it to a real value.
 */
const declaredValueOf = (
  declared: unknown,
  routeParams: Readonly<Record<string, string>>
): string | undefined => {
  if (typeof declared !== 'string') return undefined
  const ref = parseRouteParamRef(declared)
  return ref === undefined ? declared : routeParams[ref.name]
}

/** The TEMPLATE a subject names: a route segment, or the literal itself. */
const subjectTemplateOf = (
  subject: unknown,
  routeParams: Readonly<Record<string, string>>
): string | undefined =>
  isRecord(subject) ? declaredValueOf(subject['component'], routeParams) : undefined

/**
 * One specimen drawn from the operator's own `components[]`.
 *
 * ─── THE TEMPLATE IS SUBSTITUTED, NOT REFERENCED ───────────────────────────
 *
 * The cheaper move is to emit a reference node and let `renderComponentReference`
 * do the lookup at render time. It draws correctly and it makes the SNIPPET a
 * lie: `showSnippet` projects its block from this same `component` field, so a
 * reference serialises to `component: site-header` — a block that names the
 * template and shows none of it, offering a reader config the author never
 * wrote. Substituting the declaration itself gives one source of truth for both
 * halves, which is the whole reason `specimen` holds a literal.
 *
 * `$t:` needs nothing here. The substituted node is an ordinary part of the
 * page tree by the time the renderers run, so its lookups resolve exactly as
 * they do inside the pages that embed the template — against the rendering
 * app's own catalogue, which under the console mount is the operator's English
 * table (`dashboardSurfaceLanguages`).
 *
 * ─── AN UNKNOWN NAME NEVER 404s, IN ANY MODE ───────────────────────────────
 *
 * Unlike a subject `type`, a template name is not checked at boot: under an
 * admin mount the templates being documented belong to the OPERATOR's app,
 * which the preset cannot see at decode time, so a membership test there would
 * refuse every console page that draws one. The refusal is therefore reported
 * in place — including in `route` mode, where a catalogue miss would 404. A
 * console page listing an app's templates must not disappear because one of
 * them was renamed.
 */
const resolveTemplateSubject = (
  node: Record<string, unknown>,
  name: string,
  templates: SpecimenTemplates
): Component => {
  const template = templates.get(name)
  if (template === undefined) return reportMissingTemplate(node, name)
  const { subject: _resolved, ...rest } = node
  return { ...rest, component: nameSpecimen(template, name) } as Component
}

/** A specimen naming a template this app does not declare, reporting in place. */
const reportMissingTemplate = (node: Record<string, unknown>, name: string): Component => {
  const props = isRecord(node['props']) ? node['props'] : {}
  const { subject: _unresolved, component: _undrawn, ...rest } = node
  return {
    ...rest,
    props: { ...props, 'data-design-specimen-state': 'no-renderer' },
    children: [
      {
        type: 'text',
        element: 'p',
        content: `No specimen: this app declares no components[] template named “${name}”.`,
      },
    ],
  } as Component
}

/** The type a subject names: a route segment, or the literal itself. */
const subjectTypeOf = (
  subject: unknown,
  routeParams: Readonly<Record<string, string>>
): string | undefined =>
  isRecord(subject) ? declaredValueOf(subject['type'], routeParams) : undefined

/** The three axis keys, in the order the schema declares them. */
const AXIS_KEYS = ['variant', 'size', 'state'] as const

/**
 * The axis values a subject names, resolved.
 *
 * `undefined` — a refusal — when an axis IS declared and does not resolve,
 * which today means a `$param.` naming a segment the route has not got. An
 * axis that silently vanished would draw the default under a label promising
 * something else, which is the failure the whole triple exists to make visible.
 */
const subjectAxesOf = (
  subject: unknown,
  routeParams: Readonly<Record<string, string>>
): SpecimenAxes | undefined => {
  if (!isRecord(subject)) return {}
  const resolved = AXIS_KEYS.map((key) =>
    subject[key] === undefined
      ? ([key, undefined] as const)
      : ([key, declaredValueOf(subject[key], routeParams)] as const)
  )
  return resolved.some(([key, value]) => subject[key] !== undefined && value === undefined)
    ? undefined
    : Object.fromEntries(resolved.filter(([, value]) => value !== undefined))
}

/**
 * One node, with any named subject replaced by the drawing it names.
 *
 * `undefined` propagates the 404 up: a walk that skipped an unresolvable
 * specimen and kept going would render the rest of the page around a hole,
 * which is the state the refusal exists to prevent.
 */
const resolveNode = (
  node: unknown,
  routeParams: Readonly<Record<string, string>>,
  mode: SpecimenSubjectMode,
  templates: SpecimenTemplates
): Component | undefined | 'not-found' => {
  if (!isRecord(node)) return node as Component

  const children = resolveList(node['children'], routeParams, mode, templates)
  if (children === 'not-found') return 'not-found'

  // The drawn component of a specimen is not in `children`, so it is walked in
  // its own right — a `subject` nested inside a written-out component resolves
  // exactly as a top-level one does.
  const drawn =
    node['component'] === undefined
      ? undefined
      : resolveNode(node['component'], routeParams, mode, templates)
  if (drawn === 'not-found') return 'not-found'

  const withBranches: Record<string, unknown> = {
    ...node,
    ...(children === undefined ? {} : { children }),
    ...(drawn === undefined ? {} : { component: drawn }),
  }

  if (node['type'] === 'specimen') {
    return resolveSpecimen(withBranches, routeParams, mode, templates)
  }
  return node['type'] === 'preview'
    ? resolvePreview(withBranches, routeParams, mode)
    : (withBranches as Component)
}

/**
 * Whether this subject is waiting for a row to supply any of its three values.
 *
 * All THREE are checked rather than only `type`, for the reason
 * {@link subjectAwaitsARow} gives about its own five: a Configuration section
 * names a LITERAL type from the route and takes the option and the value from
 * the row, so a check confined to `type` would resolve at route time, drop the
 * `subject` it resolved through, and take the two row references down with it —
 * every row then drawing the plain specimen.
 */
const previewAwaitsARow = (subject: unknown): boolean =>
  isRecord(subject) &&
  PREVIEW_SUBJECT_KEYS.some((key) => {
    const declared = subject[key]
    return typeof declared === 'string' && declared.includes('$record.')
  })

/** The three values a preview subject names. All required by the schema. */
const PREVIEW_SUBJECT_KEYS = ['type', 'option', 'value'] as const

/**
 * One `preview` node, with its subject replaced by the drawing it names.
 *
 * The resolved `type` / `option` / `value` are written BACK onto the subject
 * rather than dropped, because unlike a specimen the frame still prints them:
 * `showValue` reads out `option: value` above the drawing, and a row template
 * that resolved `$record.path` at expansion time must print the path rather than
 * the reference.
 *
 * An unresolvable subject takes the same two answers a specimen's does, for the
 * same reasons — a 404 in `route` mode, where a URL segment is the only
 * authority on whether the page exists, and an in-place refusal everywhere else,
 * because blanking a forty-row Configuration section over its eleventh row loses
 * the ten that were fine.
 */
/** A preview subject with all three of its values in hand. */
interface ResolvedPreviewSubject {
  readonly type: string
  readonly option: string
  readonly value: string | number | boolean
}

/**
 * The three values a subject names, resolved.
 *
 * `undefined` — a refusal — when ANY of them is missing, because all three are
 * required by the schema and a preview short of one has nothing to draw and
 * nothing to say. That is the difference from a specimen's axes, which are
 * genuinely optional: a type has a default variant and a resting state, and no
 * option has a "default option".
 */
const previewSubjectOf = (
  subject: Readonly<Record<string, unknown>>,
  routeParams: Readonly<Record<string, string>>
): ResolvedPreviewSubject | undefined => {
  const type = declaredValueOf(subject['type'], routeParams)
  const option = declaredValueOf(subject['option'], routeParams)
  const declared = subject['value']
  const value =
    typeof declared === 'number' || typeof declared === 'boolean'
      ? declared
      : declaredValueOf(declared, routeParams)
  return type === undefined || option === undefined || value === undefined
    ? undefined
    : { type, option, value }
}

const resolvePreview = (
  node: Record<string, unknown>,
  routeParams: Readonly<Record<string, string>>,
  mode: SpecimenSubjectMode
): Component | 'not-found' => {
  const { subject } = node
  if (!isRecord(subject)) return node as Component
  if (mode !== 'row' && previewAwaitsARow(subject)) return node as Component

  const resolved = previewSubjectOf(subject, routeParams)
  const drawn =
    resolved === undefined
      ? undefined
      : catalogSpecimenWithOption(resolved.type, resolved.option, resolved.value)

  if (resolved === undefined || drawn === undefined) {
    return mode === 'route' ? 'not-found' : reportUndrawable(node, resolved?.type)
  }
  return {
    ...node,
    subject: { ...subject, ...resolved },
    component: nameSpecimen(drawn, resolved.type),
  } as Component
}

/**
 * Does this subtree carry a `preview`, which needs a resolution pass of its own?
 *
 * Asked before doing anything, so the extra walk below costs nothing for the 85
 * catalogue specimens that are not previews — which is every one of them but the
 * `preview` row itself.
 */
const containsPreview = (node: unknown): boolean =>
  Array.isArray(node)
    ? node.some((entry) => containsPreview(entry))
    : isRecord(node) &&
      (node['type'] === 'preview' || Object.values(node).some((entry) => containsPreview(entry)))

/**
 * Resolve every `preview` inside a component the CATALOGUE just supplied.
 *
 * A drawn specimen is inserted after {@link resolveNode} has already walked the
 * node, so nothing else would ever visit it — and the catalogue's own `preview`
 * specimen is a preview, which would then render an empty stage on the one page
 * that documents the type. Bounded by `depth` rather than by trust: a preview
 * whose subject is itself `preview` is expressible, and a stack overflow is a
 * worse answer than a frame that stops recursing.
 *
 * `not-found` never propagates from here — a catalogue drawing is not a URL, so
 * an undrawable nested preview reports itself in place exactly as one row of an
 * index does.
 */
const withResolvedPreviews = (
  node: unknown,
  routeParams: Readonly<Record<string, string>>,
  mode: SpecimenSubjectMode,
  depth: number
): unknown => {
  if (depth > 2 || !isRecord(node)) return node
  const children = Array.isArray(node['children'])
    ? node['children'].map((child) => withResolvedPreviews(child, routeParams, mode, depth + 1))
    : undefined
  const walked: Record<string, unknown> = {
    ...node,
    ...(children === undefined ? {} : { children }),
  }
  if (walked['type'] !== 'preview') return walked
  const resolved = resolvePreview(walked, routeParams, mode === 'route' ? 'row' : mode)
  return resolved === 'not-found' ? reportUndrawable(walked, undefined) : resolved
}

/**
 * A specimen that WROTE its component out, named after that component's own
 * type — the same stamp a named subject gets, so the two authoring forms are
 * addressable identically.
 */
const nameWrittenSpecimen = (node: Record<string, unknown>): Component => {
  const written = node['component']
  return (
    isRecord(written) && typeof written['type'] === 'string'
      ? { ...node, component: nameSpecimen(written, written['type']) }
      : node
  ) as Component
}

/**
 * Whether this subject is waiting for a row to supply ANY of its four values.
 *
 * A `$record.` reference has no record while the ROUTE pass runs — the row
 * templates expand afterwards — so it is left alone here rather than refused,
 * and the row pass resolves it once per expanded row.
 *
 * All FIVE values are checked, not just `type`. A variant matrix names a
 * LITERAL type and takes only its axis from the row (`{ type: 'button',
 * variant: '$record.value' }`), so a check confined to `type` resolves that
 * subject at route time, drops the `subject` key it resolved through, and takes
 * the axis reference down with it — every cell then draws the plain specimen.
 * `component` is in the set for the same reason: an index of an app's own
 * templates names each one from its row.
 */
const subjectAwaitsARow = (subject: unknown): boolean =>
  isRecord(subject) &&
  ['type', 'component', ...AXIS_KEYS].some((key) => {
    const declared = subject[key]
    return typeof declared === 'string' && declared.includes('$record.')
  })

/** One specimen node, with whichever of its two authoring forms it declared. */
const resolveSpecimen = (
  node: Record<string, unknown>,
  routeParams: Readonly<Record<string, string>>,
  mode: SpecimenSubjectMode,
  templates: SpecimenTemplates
): Component | 'not-found' => {
  if (node['subject'] === undefined) return nameWrittenSpecimen(node)
  if (mode !== 'row' && subjectAwaitsARow(node['subject'])) return node as Component

  // The OPERATOR's own template, named rather than written out. Resolved before
  // the catalogue arm because the two subject vocabularies are mutually
  // exclusive by decode rule, so reaching the catalogue with a template name in
  // hand would ask it a question about a word it has never heard.
  const template = subjectTemplateOf(node['subject'], routeParams)
  if (template !== undefined) return resolveTemplateSubject(node, template, templates)

  const type = subjectTypeOf(node['subject'], routeParams)
  const axes = subjectAxesOf(node['subject'], routeParams)
  // The axis triple resolves through the SCHEMA introspection for this type, so
  // a variant lands on whichever field the schema put the union on and a value
  // that union never declared is refused rather than written onto it. Both
  // halves of "is this drawable" are answered in one call, which is why the
  // axes could not be checked at boot beside the type name — see
  // `design-console-component-validation.ts`.
  const specimen =
    type === undefined || axes === undefined
      ? undefined
      : catalogSpecimenInAxes(type, axes, introspectType(type))
  if (specimen === undefined || type === undefined) {
    return mode === 'route' ? 'not-found' : reportUndrawable(node, type)
  }

  return drawnSpecimenNode({ node, specimen, type, routeParams, mode })
}

/**
 * The resolved node: the drawing, named, under the catalogue's own frame props.
 *
 * `subject` is DROPPED rather than kept beside the resolution — from here on the
 * two authoring forms are one declaration, and a node carrying both would trip
 * the mutual-exclusion rule if it were ever re-validated.
 *
 * `wrapperProps` land on the SPECIMEN node rather than on the drawing inside it:
 * they describe the FRAME, and a marker pushed onto the drawn component would be
 * read as a claim about the component type rather than about this depiction of
 * it.
 *
 * Declared props WIN. An author who wrote the attribute out is saying something
 * about their own frame, and a catalogue default that overrode it would silently
 * contradict the config in front of them.
 */
const drawnSpecimenNode = ({
  node,
  specimen,
  type,
  routeParams,
  mode,
}: {
  readonly node: Record<string, unknown>
  readonly specimen: Component
  readonly type: string
  readonly routeParams: Readonly<Record<string, string>>
  readonly mode: SpecimenSubjectMode
}): Component => {
  const { subject: _resolved, ...rest } = node
  const declaredProps = isRecord(rest['props']) ? rest['props'] : {}
  // The catalogue's own `preview` specimen is a `preview`, and nothing else
  // would ever walk it: this component is inserted AFTER `resolveNode` has
  // finished with the node it sits on. Guarded rather than unconditional so the
  // other 85 specimens pay one cheap predicate and no walk at all.
  const drawn = containsPreview(specimen)
    ? (withResolvedPreviews(specimen, routeParams, mode, 0) as Component)
    : specimen
  return {
    ...rest,
    props: { ...catalogSpecimenWrapperProps(type), ...declaredProps },
    component: nameSpecimen(drawn, type),
  } as Component
}

/**
 * A specimen whose resolved subject cannot be drawn, reporting itself in place.
 *
 * The state is the catalogue's OWN when it has one on file, and `no-renderer`
 * when the type is not catalogued at all — which is the closest true statement
 * rather than a fourth vocabulary invented for this branch. Nothing is drawn:
 * a frame that both reported and drew would be saying two things at once.
 */
const reportUndrawable = (node: Record<string, unknown>, type: string | undefined): Component => {
  const named = type ?? 'nothing'
  const refusal = type === undefined ? undefined : catalogSpecimenRefusal(type)
  const props = isRecord(node['props']) ? node['props'] : {}
  const { subject: _unresolved, component: _undrawn, ...rest } = node
  return {
    ...rest,
    props: { ...props, 'data-design-specimen-state': refusal?.state ?? 'no-renderer' },
    children: [
      {
        type: 'text',
        element: 'p',
        content: refusal?.note ?? `No specimen: “${named}” is not a catalogued component type.`,
      },
    ],
  } as Component
}

/** A children array, resolved element-wise; strings pass through untouched. */
const resolveList = (
  list: unknown,
  routeParams: Readonly<Record<string, string>>,
  mode: SpecimenSubjectMode,
  templates: SpecimenTemplates
): readonly Component[] | undefined | 'not-found' => {
  if (!Array.isArray(list)) return undefined
  const resolved = list.map((entry) =>
    typeof entry === 'string'
      ? (entry as unknown as Component)
      : resolveNode(entry, routeParams, mode, templates)
  )
  return resolved.some((entry) => entry === 'not-found')
    ? 'not-found'
    : (resolved as readonly Component[])
}

/**
 * Resolve every named specimen subject on one page.
 *
 * A no-op for the overwhelming majority of pages — the walk short-circuits on
 * anything that is not an object — so it costs a tree traversal and nothing
 * else on a page with no specimens.
 */
export const resolveSpecimenSubjects = (
  components: readonly Component[] | undefined,
  routeParams: Readonly<Record<string, string>>,
  mode: SpecimenSubjectMode = 'route',
  templates: SpecimenTemplates = new Map()
): SpecimenSubjectResolution => {
  if (components === undefined) return { kind: 'resolved', components: [] }
  const resolved = resolveList(components, routeParams, mode, templates)
  return resolved === 'not-found' || resolved === undefined
    ? resolved === undefined
      ? { kind: 'resolved', components }
      : { kind: 'not-found' }
    : { kind: 'resolved', components: resolved }
}
