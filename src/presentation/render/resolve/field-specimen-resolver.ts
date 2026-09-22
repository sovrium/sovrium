/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Expand a field specimen — written by an author as `{ type: 'field-specimen' }`
 * or synthesized by the application layer as `{ type: '_fieldSpecimen' }` — into
 * a pre-rendered `customHTML` equivalent carrying the control that named
 * surface draws for that field type.
 *
 * ─── TWO FACES, ONE EXPANSION ───────────────────────────────────────────────
 *
 * The descriptor came first, private to the builders that composed the console
 * in code. The console is config now, so the same shape needed a decodable
 * public face: `field-specimen` in the component union. They meet in
 * {@link descriptorOfConfigNode} and share everything after it, which is what
 * keeps a config specimen and a builder specimen drawing the same control.
 *
 * ─── THE SEAM, IN ONE PARAGRAPH ─────────────────────────────────────────────
 *
 * The design-system catalog is composed in `src/application/`, which has zero
 * `@/presentation` imports and must keep them. Drawing a field-type control
 * needs presentation code. So the application emits a DESCRIPTOR — inert data
 * naming what to draw (`@/domain/types/field-specimen`) — and this resolver,
 * running in the render pipeline, expands it. The application layer imports
 * nothing new; the rendering decision stays entirely on this side. It is the
 * relationship every component already has with its renderer, with a private
 * vocabulary instead of a schema-declared one.
 *
 * The pattern, its three siblings, and when NOT to reach for it:
 * `@docs/architecture/patterns/render-time-component-expansion.md`.
 *
 * ─── WHY THIS WALK RECURSES AND `expandFormRefs` DOES NOT ───────────────────
 *
 * `expandFormRefs` maps the TOP LEVEL of `page.components` only, which is
 * sufficient because a `formRef` shorthand only ever appears there. A catalog
 * specimen never does: it sits four levels down, inside
 * page -> container -> container -> `<article>` -> canvas. A flat walk would
 * find nothing at all and every specimen would silently render as the
 * dispatcher's bare `<div>` — the exact "confidently empty box" failure the
 * catalog's own specimen table was hand-authored to avoid. The recursion here
 * mirrors `resolveComponentTree` in `select-option-source-resolver.ts`, the
 * pipeline's other rewriting walk.
 *
 * ─── THE WRAPPER CARRIES NO CONTROL, DELIBERATELY ───────────────────────────
 *
 * A specimen is verified by comparing its control against the same field type
 * drawn by a real crud-form, anchored on the `[name]` element. `rich-text`
 * makes that rule load-bearing: its first descendant control is a
 * `div[role=status]` placeholder (post-hydration, a toolbar button), NOT the
 * hidden mirror input that carries the name. Any self-or-first-descendant
 * extractor pointed at a wrapper therefore reads a different element on each
 * side and compares two unrelated things.
 *
 * So the wrapper emitted here is a plain `<div>` carrying provenance
 * attributes and nothing else, and the anchor the control actually turned out
 * to have is reported on it as `data-field-specimen-anchor` — absent when the
 * control has no name-bearing element at all (`code`).
 */

import {
  fieldSpecimen,
  isFieldSpecimenDescriptor,
  type FieldSpecimenDescriptor,
  type FieldSpecimenFidelity,
  type FieldSpecimenSurface,
} from '@/domain/models/app/design/field-specimen'
import { fieldControlName } from '@/domain/models/app/tables/fields/field-types/catalog'
import { renderFieldSpecimen } from '@/presentation/render/elements/field-specimen-renderer'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'

/**
 * The sentence a reader sees under each specimen.
 *
 * This is the LABEL the catalog decision requires, and it is not decoration:
 * without it the page asserts that this is THE rendering of the field type,
 * which the existence of three differing surfaces disproves. Keyed by surface
 * so adding one forces its sentence to be written.
 */
const SURFACE_NOTES: Record<FieldSpecimenSurface, string> = {
  'crud-form-island':
    'As the crud form draws it. The data table’s inline cell editor and the server-rendered form skeleton draw this field type differently, and legitimately so.',
}

/**
 * Appended when the drawn control is code-split and loads on mount. A static
 * specimen never mounts, so what is shown above is that control’s pre-mount
 * placeholder — true, and misleading unless said.
 */
const DEFERRED_NOTE =
  'This control loads on demand, so the specimen shows the placeholder that stands in for it until it arrives.'

const CAPTION_CLASS =
  'field-specimen__surface text-foreground-subtle max-w-prose text-sm leading-relaxed'

/** The caption element. Text is module-constant, so no escaping is required. */
function caption(surface: FieldSpecimenSurface, fidelity: FieldSpecimenFidelity): string {
  const note = SURFACE_NOTES[surface]
  const full = fidelity === 'deferred' ? `${note} ${DEFERRED_NOTE}` : note
  return `<p class="${CAPTION_CLASS}">${full}</p>`
}

/**
 * Rewrite one descriptor into its `customHTML` equivalent.
 *
 * The markup is server-generated from this module and the island's own field
 * renderer — never from user input — so it is emitted on `trustedContent`
 * rather than `content`. `content` would run the rich-text allowlist sanitiser,
 * which drops every interactive element (`<input>`, `<select>`, `<textarea>`,
 * `<label>`) and would strip a field specimen to bare label text. The
 * substitution is safe from injection for the same reason `expandFormRefs`'
 * is: the component is synthesized AFTER decode, so a schema author can never
 * supply `trustedContent` themselves.
 */
function expandFieldSpecimen(
  descriptor: FieldSpecimenDescriptor,
  authorProps: Readonly<Record<string, unknown>> = {}
): Component {
  const { html, fidelity, anchor } = renderFieldSpecimen(descriptor)
  return {
    type: 'customHTML',
    props: {
      // The AUTHOR's props first, so the provenance attributes below win a
      // collision: a config that set `data-field-specimen-fidelity` itself
      // would otherwise overwrite the measured value with a claim, which is
      // the one thing this component exists not to let a page do.
      //
      // Forwarded at all because the expansion REPLACES the node: a
      // `data-testid`, an `id`, an `aria-label` or a layout class written on
      // the specimen would simply vanish, and the author would be debugging a
      // selector that matches nothing. The synthesized descriptors this pass
      // was built for carry no author props, so nothing forwarded before the
      // type became config-authored.
      ...authorProps,
      className: [authorProps['className'], 'field-specimen flex flex-col gap-2']
        .filter((entry) => typeof entry === 'string' && entry.length > 0)
        .join(' '),
      'data-field-specimen': descriptor.fieldType,
      'data-field-specimen-surface': descriptor.surface,
      'data-field-specimen-fidelity': fidelity,
      ...(anchor !== undefined ? { 'data-field-specimen-anchor': anchor } : {}),
    },
    trustedContent:
      descriptor.compact === true ? html : `${html}${caption(descriptor.surface, fidelity)}`,
  } as unknown as Component
}

/**
 * The DECODED `field-specimen` component, as an author writes it in config.
 *
 * Structurally the descriptor minus the two members the engine supplies, plus
 * the `label`/`displayLabel` rename — see {@link descriptorOfConfigNode}.
 */
interface FieldSpecimenConfigNode {
  readonly type: 'field-specimen'
  readonly fieldType: string
  readonly name?: string
  readonly label?: string
  readonly options?: readonly string[]
  readonly placeholder?: string
  readonly description?: string
  readonly value?: string
  readonly compact?: boolean
}

/** True for a decoded `field-specimen` config node. */
function isFieldSpecimenConfigNode(value: unknown): value is FieldSpecimenConfigNode {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as { readonly type?: unknown; readonly fieldType?: unknown }
  return (
    candidate.type === 'field-specimen' &&
    typeof candidate.fieldType === 'string' &&
    candidate.fieldType.length > 0
  )
}

/**
 * Turn a decoded `field-specimen` node into the descriptor this file already
 * expands.
 *
 * ─── ONE EXPANSION PATH, WHICH IS THE POINT ─────────────────────────────────
 *
 * The config type and the private descriptor are one shape with two faces: the
 * face an author writes, and the face the application layer synthesizes. This
 * is the only place they meet, so a config specimen and a builder specimen draw
 * through the same renderer and cannot come to disagree about what a field type
 * looks like. A second expansion beside this one would be a second answer to
 * the question the catalog exists to answer once.
 *
 * Two members are supplied here rather than declared in config:
 *
 *  - `name` defaults to the field type with hyphens replaced by underscores,
 *    because `FieldNameSchema` rejects a hyphen and a config page has no string
 *    operations with which to derive one. The default is deterministic, so a
 *    specimen and the real form it documents agree on the comparison anchor
 *    without either side writing it down.
 *  - `surface` is the single member that exists today. Publishing a one-member
 *    union would ask every author to spell a constant; the field appears in
 *    config on the day a second surface does.
 *
 * `label` becomes `displayLabel`: the descriptor's name is unambiguous INSIDE a
 * file about three drawing surfaces, and `label` is what an author writing a
 * form calls it. The rename is one line here rather than a vocabulary an author
 * has to learn.
 */
function descriptorOfConfigNode(node: FieldSpecimenConfigNode): FieldSpecimenDescriptor {
  return fieldSpecimen({
    fieldType: node.fieldType,
    name: node.name ?? fieldControlName(node.fieldType),
    surface: 'crud-form-island',
    ...(node.label === undefined ? {} : { displayLabel: node.label }),
    ...(node.options === undefined ? {} : { options: node.options }),
    ...(node.placeholder === undefined ? {} : { placeholder: node.placeholder }),
    ...(node.description === undefined ? {} : { description: node.description }),
    ...(node.value === undefined ? {} : { value: node.value }),
    ...(node.compact === undefined ? {} : { compact: node.compact }),
  })
}

/**
 * Whether a resolved `fieldType` is still a reference rather than a type name.
 *
 * `$record.<field>` names a column of the row the specimen is expanded from, and
 * the rows have not been read when the page-scoped pass runs. Expanding it there
 * would hand `renderField` the literal string `$record.type`, which matches no
 * registered field type and falls through to the generic text control — a
 * plausible-looking specimen of a field type that does not exist, drawn once per
 * page instead of once per row.
 *
 * `$param.` is deliberately NOT tested for: route parameters are substituted in
 * `prepareRequestPage`, before this pass runs at all, so by the time a node is
 * seen here a `$param.` reference has either resolved or names no segment.
 */
const awaitsARow = (fieldType: unknown): boolean =>
  typeof fieldType === 'string' && fieldType.includes('$record.')

/**
 * Expand every field-specimen descriptor in a component subtree.
 *
 * Any node that is not a descriptor is returned untouched, including
 * `{ component }` / `{ $ref }` reference wrappers — a specimen is always a
 * direct node, so there is nothing to gain by resolving a reference here and a
 * whole resolution order to get wrong.
 *
 * `deferRecordRefs` leaves a node whose subject comes from a ROW for the second
 * pass — see {@link expandFieldSpecimens}.
 */
function expandSubtree(node: unknown, deferRecordRefs: boolean): unknown {
  if (isFieldSpecimenDescriptor(node)) return expandFieldSpecimen(node)
  // The config face of the same shape, normalised into the descriptor above so
  // both reach ONE renderer. Checked second because the private descriptor is
  // the hotter path today; the order is otherwise irrelevant, since the two
  // `type` tags are disjoint.
  if (isFieldSpecimenConfigNode(node)) {
    if (deferRecordRefs && awaitsARow((node as { readonly fieldType?: unknown }).fieldType))
      return node
    const { props } = node as { readonly props?: Readonly<Record<string, unknown>> }
    return expandFieldSpecimen(descriptorOfConfigNode(node), props ?? {})
  }
  if (typeof node !== 'object' || node === null) return node
  const { children } = node as { readonly children?: ReadonlyArray<unknown> }
  if (children === undefined || children.length === 0) return node
  return { ...node, children: children.map((child) => expandSubtree(child, deferRecordRefs)) }
}

/**
 * Walk a page's components, expanding field-specimen descriptors at any depth.
 *
 * Cheap on every other page in the world: one `type ===` comparison per node,
 * and outside the admin design-system catalog no descriptor exists to match.
 *
 * ─── IT RUNS TWICE, ON THE SPECIMEN-SUBJECT PRECEDENT ──────────────────────
 *
 * `fieldType` accepts `$record.<field>`, which is what lets ONE declaration draw
 * an author's whole field catalogue from a rows endpoint instead of one node per
 * type. But this pass sits inside `applyPageComponentFilters`, which runs BEFORE
 * `expandSystemRowTemplates` — so on the first pass a row-scoped specimen has no
 * row yet, and expanding it produces a generic text control labelled after a
 * type name nobody wrote.
 *
 * So the page-scoped call DEFERS those nodes and a second, row-scoped call
 * (`applyRowScopedPasses`) expands them once per expanded row. That is exactly
 * the two-pass shape `resolveSpecimenSubjects` already uses for a `$record.`
 * component subject, for the same reason and in the same window.
 *
 * The second call does not defer, so a reference that STILL names nothing after
 * row expansion is expanded rather than left in the document as a literal: a
 * surviving `$record.type` in the markup is a token a reader sees, where the
 * generic control at least says which surface it belongs to.
 *
 * @param deferRecordRefs - leave `$record.`-subject nodes for the row-scoped
 *   pass. `true` from the page-scoped caller; omitted by the row-scoped one.
 */
export function expandFieldSpecimens(
  components: Page['components'],
  deferRecordRefs = false
): Page['components'] {
  if (!components) return components
  return components.map((item) => expandSubtree(item, deferRecordRefs)) as Page['components']
}

/**
 * The wrapper attributes and inner HTML of one field specimen, for a caller
 * that emits its own element.
 *
 * ─── WHY THE DISPATCHER NEEDS A DIFFERENT SHAPE FROM THE PASS ───────────────
 *
 * {@link expandFieldSpecimens} REPLACES the node with a `customHTML` component,
 * so it owns the wrapper. The registry renderer does not: the dispatcher has
 * already computed `elementPropsWithSpacing` for the author's own `props`, and
 * a renderer that returned a second element would drop them.
 *
 * So the drawing is factored out and the two callers each build their own
 * wrapper around the SAME markup and the SAME provenance attributes. That is
 * what keeps a specimen drawn by the pass and one drawn by the dispatcher
 * identical — a second drawing of a field type would be a second answer to the
 * question the catalogue answers once.
 */
export function fieldSpecimenMarkup(node: Omit<FieldSpecimenConfigNode, 'type'>): {
  readonly html: string
  readonly attributes: Readonly<Record<string, string>>
} {
  const descriptor = descriptorOfConfigNode({ ...node, type: 'field-specimen' })
  const { html, fidelity, anchor } = renderFieldSpecimen(descriptor)
  return {
    html: descriptor.compact === true ? html : `${html}${caption(descriptor.surface, fidelity)}`,
    attributes: {
      'data-field-specimen': descriptor.fieldType,
      'data-field-specimen-surface': descriptor.surface,
      'data-field-specimen-fidelity': fidelity,
      ...(anchor === undefined ? {} : { 'data-field-specimen-anchor': anchor }),
    },
  }
}
