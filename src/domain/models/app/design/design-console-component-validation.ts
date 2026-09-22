/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Design-console page-component cross-validation.
 *
 * The design-console primitives DOCUMENT the design system, so each of them is
 * a claim about something declared elsewhere in the same config. That is what
 * puts their rules here rather than on their own schemas: a component cannot
 * see `app.design` from inside its own branch.
 *
 * Two rules today: the easing token, and the specimen subject.
 *
 * ─── A PLOTTED EASING TOKEN MUST NAME A CURVE ─────────────────────────────
 *
 * A plot whose token resolves to nothing has no path to draw, and the empty
 * box it leaves reads to a reader as "this one is linear" — a specific and
 * wrong belief about how the app moves. So a name that resolves to nothing is
 * refused rather than reported.
 *
 * That is deliberately the OPPOSITE of a COLOUR swatch, which reports an
 * unresolvable colour token at render time, and the difference is the namespace
 * rather than the taste. `--sv-*` colour properties are emitted from ramps,
 * colour roles and engine defaults, and no single table in the config
 * enumerates them, so a decode-time membership test would refuse names that
 * exist. Easing names have exactly two sources — the platform's four inherited
 * curves and the keys of `design.motion.easings` — and there is no third. The
 * typo is therefore decidable OFFLINE, which is what `sovrium validate` is for.
 *
 * A `cubic-bezier(x1, y1, x2, y2)` literal is admitted without resolution: it
 * is not a snapshot of a token, it IS the curve. It is still CHECKED, because
 * four control points that do not parse — or whose x ordinates leave `0..1` —
 * describe a timing function every browser rejects, so the app would move on
 * its fallback while the page drew the curve it was told about.
 *
 * ─── A `specimen` DRAWS EXACTLY ONE THING ─────────────────────────────────
 *
 * `component` writes the drawn component out; `subject` names a type and lets
 * the engine draw its own catalogue specimen for it. Both answer "what is
 * drawn", so declaring both leaves no defensible precedence — one would be
 * silently discarded, along with the snippet projected from it — and declaring
 * neither leaves a frame with nothing in it.
 *
 * Neither half is expressible at the field level, and this one could not even
 * be a per-branch struct check: `component` is INJECTED by the component-type
 * barrel while `subject` is declared in `specimen.ts`, so no single schema node
 * has both in view.
 *
 * The named type is checked three ways, and each catches a different silence:
 *
 *  - **`$param.<name>` must name a `:segment` of the host page's `path`.** A
 *    reference to a segment the route never declares resolves to nothing at
 *    request time, and the page draws an empty frame on every URL rather than
 *    failing on one.
 *  - **A literal must be CATALOGUED.** `buton` is a typo the catalogue can see,
 *    and the alternative to seeing it is a kit page with a hole in it.
 *  - **A literal must not be one a specimen may never draw.** The write-path
 * refusal is about the FRAME ([internal ref] A3 clause 2), so naming `form` is the
 *    same hazard as writing it out and gets the same answer. Which types those
 *    are is read from `SPECIMEN_REFUSED_TYPES`, not restated here.
 *
 * ─── AND `preview.subject.type` MEETS THE SAME THREE TESTS ───────────────
 *
 * [internal ref]'s `preview` names a type the engine draws its own catalogue specimen
 * for, exactly as `specimen.subject.type` does, so it is run through the SAME
 * function rather than through a copy of it. That matters most for the third
 * test: a preview IS a preview frame, so [internal ref] A3 clause 2 applies to it
 * verbatim, and a rule with coverage on only one of its two callers is a rule
 * that goes quiet on the other.
 *
 * A `$param` subject is NOT checked against the catalogue, because its value is
 * a URL segment rather than a config fact. An unknown or refused segment is a
 * REQUEST-time 404, for the anti-enumeration reason every parser in
 * `dashboard-surface-routes.ts` gives: a mistyped URL that silently rendered
 * some page makes a broken link look live.
 *
 * ─── A `$record.` VALUE DEFERS EVERY CHECK IN THIS FILE ───────────────────
 *
 * Both rules above test a VALUE against a table
 * the config declares — the easing curves, the component catalogue. A field
 * whose value is wholly a `$record.<field>` reference has no value yet: it names
 * a column of a row that does not exist until the template is expanded. Running
 * either test on it would compare the literal text `$record.type` against the
 * catalogue and refuse every row template that has not been written.
 *
 * So both stand down, exactly as the subject rule already stands down for
 * `$param.<name>`, and for the identical reason: the value is not a config fact.
 * What replaces them is a check at ROW-EXPANSION time on the resolved value,
 * whose answer is the component's OWN refusal rendering — the specimen frame's
 * `data-design-specimen-state`, the swatch's silence where a token does not
 * resolve — reported per ROW. Never a 500, and never the page-wide 404 an
 * unresolvable `$param` subject gets: a URL segment is one fact about one
 * request, while a row is one of many, and blanking an index because its
 * eleventh row names an undrawable type loses the ten that were fine.
 *
 * The reference ITSELF is still policed, one level up: family 14 of
 * `page-binding-validation.ts` refuses a `$record.` reference with no
 * record-binding ancestor, because THAT is decidable offline.
 *
 * ─── AND THE AXIS VALUES ARE NOT CHECKED HERE AT ALL ──────────────────────
 *
 * `subject.variant` / `size` / `state` name a member of an axis, and the two
 * tables that answer for one are the schema INTROSPECTOR
 * (`design/type-introspection.ts`) and the state vocabulary
 * (`design/state-vocabulary.ts`).
 *
 * **The original reason for not checking them here has expired, and the
 * behaviour deliberately did not change with it.** Both tables were
 * `domain/services/`, which the model layer could not reach
 * (`boundaries/dependencies`) — which is why `catalogedTypesOf`, a MODEL, was
 * legal in the check above while these two were not. The layout programme
 * dissolved that directory and moved both into the `design` slug, so nothing
 * now stops a boot-time membership check. Writing one is a behaviour change
 * with its own acceptance criteria, not a side effect of moving files, so it
 * was left alone.
 *
 * What stands on its own merits is this: the whole axis triple is validated at
 * ROW-EXPANSION time, beside the
 * unknown-type refusal that already has to live there, and the answer is the
 * same in-place refusal rather than a boot error. That is one place answering
 * "is this drawable", not two that could disagree — and the two halves of the
 * question genuinely belong together: a subject whose TYPE comes from a row
 * could not have its axes checked at boot either way.
 *
 * NOR IS THERE A CROSS-FIELD AXIS RULE, and the reason is worth stating so it
 * is not written twice. `subject.type` is REQUIRED by the struct, so an axis
 * always arrives with a type — and a `subject` beside a written-out `component`
 * is already refused as mutually exclusive. Every malformed shape an axis rule
 * could have caught is therefore refused one layer earlier, by the schema or by
 * the rule above it. A third refusal would be unreachable code that reads as
 * coverage.
 *
 * WHY IT IS NOT A NEW `Schema.filter`
 * -----------------------------------
 * The caller BUNDLES this into `AppSchema`'s existing final filter, exactly as
 * `validateAllSelectOptionSources` and `validateAllQrCodePayloads` are bundled:
 * each additional link in that chain pushes TypeScript's inference depth in the
 * one place the codebase documents as fragile, where the failure is `App`
 * collapsing to `never` — silently, at every consumer.
 *
 * The walk is intentionally loose-typed (`unknown`) and recurses through every
 * value, so it finds a plotted curve wherever it is nested — top-level
 * `components[]`, a container's `children[]`, or inside the component a
 * `specimen` draws.
 */

import { extractParamNames } from '@/domain/kernel/matching/route-matcher'
import {
  INHERITED_EASING_NAMES,
  easingNameOf,
  isDrawableBezier,
  isEasingLiteral,
  resolvableEasingCurves,
} from '@/domain/models/app/design/easing-curve'
import { parseRouteParamRef } from '@/domain/models/app/pages/route-param-ref'
import { isRecordFieldRef } from '@/domain/models/app/pages/substitute-record-vars'
import {
  CATALOG_COMPONENT_CATEGORIES,
  catalogedTypesOf,
} from '../pages/components/component-types/catalog'
import { SPECIMEN_REFUSED_TYPES } from '../pages/components/component-types/specialty/specimen-refusal'
import { isCatalogedFieldType } from '../tables/fields/field-types/catalog'

/** Minimal shape needed to validate the design-console components. */
interface AppForDesignConsoleValidation {
  readonly pages?: unknown
  readonly design?: unknown
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Every easing name the app can resolve: the inherited curves, plus whatever
 * `design.motion.easings` declares.
 *
 * The table comes from `@/domain/models/app/design/easing-curve`, the SAME resolver the
 * renderer draws from — so a name this rule accepts is a name that has a curve
 * to plot. Two copies of that answer drift in exactly one direction: boot
 * accepts a name the renderer cannot draw, and the page shows an empty box.
 */
const resolvableEasingNames = (app: AppForDesignConsoleValidation): ReadonlySet<string> =>
  new Set(
    Object.keys(resolvableEasingCurves(isRecord(app.design) ? app.design['motion'] : undefined))
  )

/**
 * Does this node plot an easing curve?
 *
 * KEYED ON THE VARIANT, not on the type name alone. A `swatch` paints a colour
 * token by default and plots an easing one under `variant: 'curve'`, so a check
 * that fired on every swatch would refuse colour tokens against the easing
 * table, and one that fired on none would let an unresolvable easing reach the
 * page as an empty box — the failure this whole module exists to prevent.
 *
 * This read a retired console-only spelling as a second accepted form until
 * that type was deleted. Should another type ever plot a curve, it joins the
 * disjunction here rather than growing a gate of its own.
 */
const plotsAnEasingCurve = (node: Readonly<Record<string, unknown>>): boolean =>
  node['type'] === 'swatch' && node['variant'] === 'curve'

/** Recursively collect every easing token declared in the page tree. */
const collectEasingTokens = (node: unknown): readonly string[] => {
  if (Array.isArray(node)) return node.flatMap(collectEasingTokens)
  if (!isRecord(node)) return []

  const nested = Object.values(node).flatMap(collectEasingTokens)
  if (!plotsAnEasingCurve(node)) return nested

  const { token } = node
  return typeof token === 'string' ? [token, ...nested] : nested
}

/** Validate ONE token; returns an error message, or `undefined` when it resolves. */
const validateEasingToken = (
  token: string,
  resolvable: ReadonlySet<string>
): string | undefined => {
  // A value that IS a `$record.` reference carries a row fact, not a config
  // fact — see the header section on deferral to row expansion.
  if (isRecordFieldRef(token)) return undefined
  if (isEasingLiteral(token)) {
    return isDrawableBezier(token)
      ? undefined
      : `An easing curve declares token "${token}", which is not a timing function a browser will run — a cubic-bezier needs four finite numbers with both x ordinates in 0..1. The y ordinates may overshoot; the x ordinates may not.`
  }

  const name = easingNameOf(token)
  if (resolvable.has(name)) return undefined

  return `An easing curve declares token "${token}", which names no easing curve. Declare it under design.motion.easings, name one of the inherited curves (${[...INHERITED_EASING_NAMES].toSorted().join(', ')}), or write the cubic-bezier(...) out.`
}

/**
 * Every type the catalogue publishes — the set a named subject may draw.
 *
 * Derived from the published categories rather than restated, for the reason
 * `catalog.ts` gives about its own membership: a category gains a type the
 * moment the schema does, so a copy here would be right on the day it is typed
 * and silently wrong afterwards.
 */
const catalogedTypes = (): ReadonlySet<string> =>
  new Set(CATALOG_COMPONENT_CATEGORIES.flatMap((category) => catalogedTypesOf(category)))

/** A `specimen` found on one page, reduced to what its rule needs. */
interface FoundSpecimen {
  readonly hasComponent: boolean
  readonly subjectType: string | undefined
  readonly subjectComponent: string | undefined
  /** Whether this specimen asked to be re-rendered in a document of its own. */
  readonly hasViewport: boolean
}

/** Recursively collect every `specimen` declared in one page's tree. */
const collectSpecimens = (node: unknown): readonly FoundSpecimen[] => {
  if (Array.isArray(node)) return node.flatMap(collectSpecimens)
  if (!isRecord(node)) return []

  const nested = Object.values(node).flatMap(collectSpecimens)
  if (node['type'] !== 'specimen') return nested

  const { subject } = node
  return [
    {
      hasComponent: node['component'] !== undefined,
      subjectType:
        isRecord(subject) && typeof subject['type'] === 'string' ? subject['type'] : undefined,
      subjectComponent:
        isRecord(subject) && typeof subject['component'] === 'string'
          ? subject['component']
          : undefined,
      hasViewport: node['viewport'] !== undefined,
    },
    ...nested,
  ]
}

/**
 * Validate ONE named subject; returns an error message, or `undefined`.
 *
 * TWO CALLERS, ONE RULE. `specimen.subject.type` and `preview.subject.type` name
 * the same thing — a type the engine draws its own catalogue specimen for — so
 * they meet the same three tests, and a `preview` naming `form` is refused for
 * exactly the reason a `specimen` naming it is: [internal ref] A3 clause 2 is about the
 * preview FRAME, not about how the type was reached. A second copy of this
 * function would be a rule that could go quiet on one of its callers without
 * anything turning red.
 *
 * `noun` changes the sentence and nothing else. It is what an author reads back,
 * and "A specimen names subject …" under a `preview` sends them to the wrong
 * component.
 */
const validateSubjectType = (
  subjectType: string,
  declaredParams: ReadonlySet<string>,
  path: string,
  noun: 'specimen' | 'preview' = 'specimen'
): string | undefined => {
  // Same exemption a `$param` subject gets, and for the same reason — see the
  // header section on deferral to row expansion. The catalogue cannot answer
  // for a name that is not yet a name.
  if (isRecordFieldRef(subjectType)) return undefined

  const ref = parseRouteParamRef(subjectType)
  if (ref !== undefined) {
    // The VALUE is a URL segment, so nothing about the catalogue applies here —
    // an unknown or refused segment is a request-time 404. What IS a config
    // fact is whether the route can ever supply the name at all.
    return declaredParams.has(ref.name)
      ? undefined
      : `A ${noun} names subject "${subjectType}" but its page path "${path}" declares no ":${ref.name}" segment, so the subject would resolve to nothing on every URL.`
  }

  if (SPECIMEN_REFUSED_TYPES.includes(subjectType)) {
    return `A ${noun} cannot draw \`${subjectType}\` by name any more than by value: the refusal is about the preview FRAME, not about how the type was reached (ADR-022 A3 clause 2).`
  }

  return catalogedTypes().has(subjectType)
    ? undefined
    : `A ${noun} names subject "${subjectType}", which is not a catalogued component type. Name a published type, or write the component out under \`component\`.`
}

/**
 * Validate the SUBJECT's own two vocabularies against each other.
 *
 * `type` names something the engine draws, `component` names something the
 * operator declared, and both answer "what is drawn". Neither can be stated at
 * the field level once both are optional — which they had to become the moment
 * a second one existed — so the "exactly one" rule lives here beside the outer
 * one it mirrors.
 */
const validateSubjectShape = (specimen: FoundSpecimen): string | undefined => {
  const { subjectType, subjectComponent } = specimen
  if (subjectType !== undefined && subjectComponent !== undefined) {
    return "A specimen subject names both 'type' and 'component' — an engine type and one of your own templates. They are mutually exclusive, and there is no defensible precedence: one would be silently discarded along with the snippet projected from it. Remove one."
  }
  return subjectType === undefined && subjectComponent === undefined
    ? "A specimen declares a 'subject' that names neither 'type' nor 'component' — it has nothing to draw. Add exactly one."
    : undefined
}

/**
 * Validate a `viewport` against the subject it was declared beside.
 *
 * ─── A FRAMED RE-RENDER COSTS A DOCUMENT, AND ONLY A TEMPLATE REPAYS IT ────
 *
 * `viewport` is the one specimen field that does not change how a subject is
 * drawn but WHERE: the subject is re-rendered inside a document of its own, at
 * the declared width, so its own `@media` rules evaluate against that width
 * instead of against the reader's window. That is only worth a second document
 * where the subject HAS a layout that changes with width — a header, a footer,
 * a hero — which is to say one of the operator's own composed templates.
 *
 * An engine catalogue specimen is one control drawn from illustrative props.
 * Framing a `button` at 375 spends a document to show the same button, and a
 * page that draws three identical pictures under three different width headings
 * answers the reader's question wrongly rather than leaving it open — which is
 * the exact defect the field was added to fix.
 *
 * A written-out `component` is refused for a different and harder reason: the
 * framed document resolves its subject by NAME against `components[]`, so an
 * inline tree has nothing for the frame route to look up. Refusing the pairing
 * is what keeps that from being a blank frame at request time.
 *
 * Widening this to `subject.type` later is additive. Shipping it wide and
 * narrowing it afterwards would not be.
 */
const validateViewport = (specimen: FoundSpecimen): string | undefined => {
  const { hasViewport, hasComponent, subjectType, subjectComponent } = specimen
  if (!hasViewport || subjectComponent !== undefined) return undefined
  if (hasComponent) {
    return "A specimen declares a 'viewport' beside a written-out 'component'. A framed re-render resolves its subject by NAME in a document of its own, and a component written out inline has no name to resolve — so the frame would have nothing to draw. Declare the component once under `components[]` and name it with `subject.component`."
  }
  return `A specimen declares a 'viewport' beside \`subject.type: "${subjectType ?? ''}"\`. A viewport re-renders the subject in a document of its own, which only earns its cost where the subject's LAYOUT changes with width — one of your own templates, named with \`subject.component\`. An engine catalogue specimen is one control drawn from illustrative props, so it draws the same picture at every width.`
}

/** Validate ONE specimen; returns an error message, or `undefined`. */
const validateSpecimen = (
  specimen: FoundSpecimen,
  declaredParams: ReadonlySet<string>,
  path: string
): string | undefined => {
  const { hasComponent, subjectType, subjectComponent } = specimen
  const hasSubject = subjectType !== undefined || subjectComponent !== undefined
  if (hasComponent && hasSubject) {
    return "A specimen declares both 'component' and 'subject' — the two are mutually exclusive, and there is no defensible precedence between them. One would be silently discarded along with the snippet projected from it. Remove one."
  }
  if (!hasComponent && !hasSubject) {
    return "A specimen declares neither 'component' nor 'subject' — it has nothing to draw. Add exactly one."
  }
  const shapeError = hasComponent ? undefined : validateSubjectShape(specimen)
  if (shapeError !== undefined) return shapeError
  const viewportError = validateViewport(specimen)
  if (viewportError !== undefined) return viewportError
  // A `subject.component` name is NOT checked against `components[]` here, and
  // that is the same deferral a `$param` subject already takes. Under an admin
  // mount the templates being documented belong to the OPERATOR's app, which
  // the preset cannot see at decode time — so a boot-time membership test would
  // refuse every console page that draws one. An unresolvable name renders that
  // specimen's own refusal, in place, where the scope IS reachable.
  return subjectType === undefined
    ? undefined
    : validateSubjectType(subjectType, declaredParams, path)
}

/**
 * Recursively collect every `preview`'s declared `subject.type`.
 *
 * Its own collector rather than a branch inside {@link collectSpecimens},
 * because the two types are validated for different things: a `specimen` is
 * checked for WHICH of its two mutually exclusive sources it declared, and a
 * `preview` has one source the schema already makes required. Folding them
 * together would produce a shape with three optional halves whose combinations
 * are mostly unreachable — the same argument the `field-specimen` collector
 * below makes for its own separation.
 *
 * What the two DO share is the rule they end at: {@link validateSubjectType}.
 */
const collectPreviewSubjectTypes = (node: unknown): readonly string[] => {
  if (Array.isArray(node)) return node.flatMap(collectPreviewSubjectTypes)
  if (!isRecord(node)) return []

  const nested = Object.values(node).flatMap(collectPreviewSubjectTypes)
  if (node['type'] !== 'preview') return nested
  const { subject } = node
  return isRecord(subject) && typeof subject['type'] === 'string'
    ? [subject['type'], ...nested]
    : nested
}

/**
 * Recursively collect every `field-specimen`'s declared `fieldType`.
 *
 * Separate from {@link collectSpecimens} rather than folded into it, because
 * the two answer different questions: a `specimen` is validated for WHICH of
 * its two mutually exclusive sources it declared, and a `field-specimen` has
 * only one source and needs no such rule. Merging them would produce a shape
 * with three optional halves where every combination but two is unreachable.
 */
const collectFieldSpecimenTypes = (node: unknown): readonly string[] => {
  if (Array.isArray(node)) return node.flatMap(collectFieldSpecimenTypes)
  if (!isRecord(node)) return []

  const nested = Object.values(node).flatMap(collectFieldSpecimenTypes)
  if (node['type'] !== 'field-specimen') return nested
  const { fieldType } = node
  return typeof fieldType === 'string' ? [fieldType, ...nested] : nested
}

/**
 * Validate ONE `field-specimen.fieldType`; returns an error, or `undefined`.
 *
 * The same three-way deferral the subject rule uses, and deliberately so: a
 * `$record.` value names a column of a row that does not exist yet, and a
 * `$param.` value is a URL segment rather than a config fact. Only a LITERAL is
 * a claim the catalogue can answer today.
 *
 * The `$param` half is checked one notch further than the `$record` half, for
 * the reason the subject rule gives: whether the page can EVER supply the
 * segment is a config fact even when the value is not.
 */
const validateFieldSpecimenType = (
  fieldType: string,
  declaredParams: ReadonlySet<string>,
  path: string
): string | undefined => {
  if (isRecordFieldRef(fieldType)) return undefined

  const ref = parseRouteParamRef(fieldType)
  if (ref !== undefined) {
    return declaredParams.has(ref.name)
      ? undefined
      : `A field specimen names field type "${fieldType}" but its page path "${path}" declares no ":${ref.name}" segment, so it would resolve to nothing on every URL.`
  }

  return isCatalogedFieldType(fieldType)
    ? undefined
    : `A field specimen names field type "${fieldType}", which is not a catalogued table field type. Name a published field type — the catalogue is derived from \`tables/fields/field-types/\`, so it lists exactly what a table may declare.`
}

/**
 * Validate every specimen on one page.
 *
 * Per-page rather than over the whole tree, because a `$param` subject is only
 * meaningful against the path of the page that hosts it.
 */
const validatePageSpecimens = (page: unknown): string | undefined => {
  if (!isRecord(page)) return undefined
  const path = typeof page['path'] === 'string' ? page['path'] : ''
  const declaredParams = new Set(extractParamNames(path))
  const tree = [page['components'], page['layout']]
  return (
    collectSpecimens(tree)
      .map((specimen) => validateSpecimen(specimen, declaredParams, path))
      .find((error) => error !== undefined) ??
    collectPreviewSubjectTypes(tree)
      .map((subjectType) => validateSubjectType(subjectType, declaredParams, path, 'preview'))
      .find((error) => error !== undefined) ??
    collectFieldSpecimenTypes(tree)
      .map((fieldType) => validateFieldSpecimenType(fieldType, declaredParams, path))
      .find((error) => error !== undefined)
  )
}

/**
 * Validate every design-console page component against the config around it.
 *
 * Returns `true` when every component resolves, or an error message naming the
 * first offending one.
 */
export const validateAllDesignConsoleComponents = (
  app: AppForDesignConsoleValidation
): string | true => {
  if (!app.pages) return true

  const resolvable = resolvableEasingNames(app)
  const easingError = collectEasingTokens(app.pages)
    .map((token) => validateEasingToken(token, resolvable))
    .find((error) => error !== undefined)
  if (easingError !== undefined) return easingError

  const pages = Array.isArray(app.pages) ? app.pages : []
  return (
    pages.map((page) => validatePageSpecimens(page)).find((error) => error !== undefined) ?? true
  )
}
