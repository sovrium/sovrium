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
 * a pages design primitives spec asserts: the drawn thing has to go through
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

import { isRecord } from '@/domain/kernel/config-parsing/plain-object'
import { catalogSpecimenInAxes } from '@/domain/models/app/design/catalog-specimens'
import { catalogSpecimenWrapperProps } from '@/domain/models/app/design/catalog-specimens/provenance'
import { introspectType } from '@/domain/models/app/design/type-introspection'
import {
  componentFields,
  synthesizedComponent,
  type ComponentEntry,
  type ComponentNode,
} from './component-rewrite'
import { resolvePreview, containsPreview, withResolvedPreviews } from './specimen-preview-resolver'
import {
  nameSpecimen,
  subjectTemplateOf,
  resolveTemplateSubject,
  subjectTypeOf,
  AXIS_KEYS,
  subjectAxesOf,
  reportUndrawable,
} from './specimen-subject-values'
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
 * LAST DECLARATION WINS, which matters only under the admin mount. There the
 * rendering app's `components` is the console's own followed by the operator's
 * — spread in that order by `routeBoundOperatorComponents` in
 * `application/use-cases/admin/embedded-app-mount.ts`, so the console's
 * furniture always resolves to its own template. A SPECIMEN is the other way
 * round: it draws the operator's template on the Components surface, the one
 * surface the operator's templates are merged into, so when the operator names
 * a template like one of the console's, the card must draw the operator's.
 * Outside the mount one app's names are unique, and the order changes nothing.
 */
export type SpecimenTemplates = ReadonlyMap<string, Component>

/**
 * Index a component list by name, LAST declaration winning — see
 * {@link SpecimenTemplates} for why.
 *
 * `new Map(entries)` keeps the last value for a repeated key, which is exactly
 * the order wanted.
 */
export const indexTemplatesByName = (
  components: readonly Component[] | undefined
): SpecimenTemplates =>
  new Map(
    (components ?? []).flatMap((component) => {
      const { name } = componentFields(component)
      return typeof name === 'string' ? [[name, component] as const] : []
    })
  )

/** A page list whose every named subject resolved, or the 404 the page answers. */
export type SpecimenSubjectResolution =
  | { readonly kind: 'resolved'; readonly components: readonly ComponentNode[] }
  | { readonly kind: 'not-found' }

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
): ComponentEntry | undefined | 'not-found' => {
  if (!isRecord(node)) return node as ComponentEntry | undefined

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
    : synthesizedComponent(withBranches)
}

/**
 * A specimen that WROTE its component out, named after that component's own
 * type — the same stamp a named subject gets, so the two authoring forms are
 * addressable identically.
 */
const nameWrittenSpecimen = (node: Record<string, unknown>): Component => {
  const written = node['component']
  return synthesizedComponent(
    isRecord(written) && typeof written['type'] === 'string'
      ? { ...node, component: nameSpecimen(written, written['type']) }
      : node
  )
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
  if (mode !== 'row' && subjectAwaitsARow(node['subject'])) return synthesizedComponent(node)

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
    ? withResolvedPreviews(specimen, routeParams, mode, 0)
    : specimen
  return synthesizedComponent({
    ...rest,
    props: { ...catalogSpecimenWrapperProps(type), ...declaredProps },
    component: nameSpecimen(drawn, type),
  })
}

/** A children array, resolved element-wise; strings pass through untouched. */
const resolveList = (
  list: unknown,
  routeParams: Readonly<Record<string, string>>,
  mode: SpecimenSubjectMode,
  templates: SpecimenTemplates
): readonly ComponentEntry[] | undefined | 'not-found' => {
  if (!Array.isArray(list)) return undefined
  const resolved = list.map((entry: unknown) =>
    typeof entry === 'string' ? entry : resolveNode(entry, routeParams, mode, templates)
  )
  return resolved.some((entry) => entry === 'not-found')
    ? 'not-found'
    : (resolved as readonly ComponentEntry[])
}

/**
 * Resolve every named specimen subject on one page.
 *
 * A no-op for the overwhelming majority of pages — the walk short-circuits on
 * anything that is not an object — so it costs a tree traversal and nothing
 * else on a page with no specimens.
 */
export const resolveSpecimenSubjects = (
  components: readonly ComponentNode[] | undefined,
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
    : // A page list holds no text, and resolving a node never yields text, so
      // the resolved list holds exactly the kinds of entry it was given.
      { kind: 'resolved', components: resolved as readonly ComponentNode[] }
}
