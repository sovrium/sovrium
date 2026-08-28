/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Expand `{ type: '_fieldSpecimen', ... }` descriptors into pre-rendered
 * `customHTML` equivalents carrying the control that names surface draws for
 * that field type.
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
  isFieldSpecimenDescriptor,
  type FieldSpecimenDescriptor,
  type FieldSpecimenFidelity,
  type FieldSpecimenSurface,
} from '@/domain/types/field-specimen'
import { renderFieldSpecimen } from '@/presentation/rendering/island-ssr/field-specimen-renderer'
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
  'field-specimen__surface text-foreground-subtle max-w-prose text-xs leading-relaxed'

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
function expandFieldSpecimen(descriptor: FieldSpecimenDescriptor): Component {
  const { html, fidelity, anchor } = renderFieldSpecimen(descriptor)
  return {
    type: 'customHTML',
    props: {
      className: 'field-specimen flex flex-col gap-2',
      'data-field-specimen': descriptor.fieldType,
      'data-field-specimen-surface': descriptor.surface,
      'data-field-specimen-fidelity': fidelity,
      ...(anchor !== undefined ? { 'data-field-specimen-anchor': anchor } : {}),
    },
    trustedContent: `${html}${caption(descriptor.surface, fidelity)}`,
  } as unknown as Component
}

/**
 * Expand every field-specimen descriptor in a component subtree.
 *
 * Any node that is not a descriptor is returned untouched, including
 * `{ component }` / `{ $ref }` reference wrappers — a specimen is always a
 * direct node, so there is nothing to gain by resolving a reference here and a
 * whole resolution order to get wrong.
 */
function expandSubtree(node: unknown): unknown {
  if (isFieldSpecimenDescriptor(node)) return expandFieldSpecimen(node)
  if (typeof node !== 'object' || node === null) return node
  const { children } = node as { readonly children?: ReadonlyArray<unknown> }
  if (children === undefined || children.length === 0) return node
  return { ...node, children: children.map(expandSubtree) }
}

/**
 * Walk a page's components, expanding field-specimen descriptors at any depth.
 *
 * Cheap on every other page in the world: one `type ===` comparison per node,
 * and outside the admin design-system catalog no descriptor exists to match.
 */
export function expandFieldSpecimens(components: Page['components']): Page['components'] {
  if (!components) return components
  return components.map((item) => expandSubtree(item)) as Page['components']
}
