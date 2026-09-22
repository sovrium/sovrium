/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The lookup contract EVERY form-control island renderer shares.
 *
 * Lifted out of `island-form-components.tsx` when that file reached its
 * `max-lines` ceiling and a second module needed the same three helpers. The
 * split is along a real seam: what follows answers "where does a schema field
 * live, and what do all islands carry?", which is a rule rather than a
 * renderer.
 */

import type { ComponentDesignResolution } from '@/presentation/design/resolve-component-classes'

export type RawProps = Record<string, unknown> | undefined
export type ElemProps = Record<string, unknown>

/**
 * Extract common island props (className, id, data-testid) shared by all islands.
 *
 * `className` already carries the `design.components` ROOT part and the
 * accessibility floor — `buildFinalClassName` folded them in before the
 * renderer ran — so an island that honours `className` applies the operator's
 * app-wide styling with no further wiring. That is the whole reason the root
 * part travels on the existing channel rather than a new one: it costs no
 * `data-island-props` bytes and it works for every island at once.
 *
 * `designClasses` is the other half: the NON-root parts, which no `className`
 * can reach because they land on elements the island builds itself. It is
 * emitted ONLY when the operator declared such a part, so an app that declares
 * nothing serialises exactly the props it serialised before — which is what
 * keeps the island payload budget flat and `data-island-props` byte-identical.
 *
 * `designFloor` and `designReplace` complete that half, and the root does not
 * need either: its recipe is dropped and its floor applied SERVER-side, inside
 * the `className` the island receives already merged. An inner part is built by
 * the island itself, so the island is the only place those two decisions can be
 * taken — and without them an operator's part classes would be layered onto a
 * recipe `replace: true` was supposed to drop, and a class of theirs that zeroes
 * a focusable part's focus ring would stand. (Ring classes are described rather
 * than spelled here for the reason `component-floor.ts` gives: the build-time
 * CSS candidate scan reads comments, so a bare Tailwind-shaped token in one
 * becomes a rule in every app's stylesheet.)
 *
 * All three are CONDITIONAL for the same measured reason: an app that declares
 * no `design.components` block for the type resolves to the empty resolution,
 * so none of the three is emitted and its serialised props are byte-identical
 * to what they were before this key existed. Do not make any of them
 * unconditional — the island payload budget is calibrated on that.
 *
 * @param elementProps - The resolved element props for this component.
 * @param designStyles - `design.components[<type>]`, pre-resolved by the renderer.
 */
export function baseProps(elementProps: ElemProps, designStyles?: ComponentDesignResolution) {
  const parts = designStyles?.parts
  const hasParts = parts !== undefined && Object.keys(parts).length > 0
  const partFloors = designStyles?.partFloors
  const hasPartFloors = partFloors !== undefined && Object.keys(partFloors).length > 0
  return {
    className: elementProps.className,
    id: elementProps.id,
    'data-testid': elementProps['data-testid'],
    ...(hasParts ? { designClasses: parts } : {}),
    ...(hasPartFloors ? { designFloor: partFloors } : {}),
    ...(designStyles?.replace === true ? { designReplace: true } : {}),
  }
}

/**
 * Single source of truth for the "where does this field live in the schema?"
 * lookup contract used by every form-control renderer.
 *
 * **CRITICAL — read this before adding a new form-control island renderer.**
 *
 * Form-control component schemas (see `src/domain/models/app/pages/components/
 * component-types/form-controls/*.ts`) place their custom fields (e.g.
 * `options`, `defaultValue`, `multiple`, `orientation`, `min`, `max`,
 * `searchable`, …) at the **component top level** as siblings of `props`,
 * not inside `props`. The renderer plumbing strips `props` into `rawProps`
 * separately, so a renderer that only reads from `rawProps` will silently
 * see `undefined` for every schema-defined field — the SSR placeholder
 * renders, the island hydrates, but it has no data and looks broken.
 *
 * Use this helper for every field that the schema defines at top level.
 * A handful of fields (`placeholder`, `label`, `disabled`, `name`,
 * `content`) are also accepted via `rawProps` for compositional reasons
 * (e.g. when a parent `field` wrapper passes them down) and should keep
 * reading from `rawProps` directly.
 *
 * Returns `c[key]` if defined, otherwise falls back to `rawProps[key]`.
 */
export function pickFromComponent(
  c: Record<string, unknown>,
  rawProps: RawProps,
  key: string
): unknown {
  return c[key] ?? rawProps?.[key]
}

/** Convenience: coerce `component` to the unknown record shape `pickFromComponent` expects. */
export function asRecord(component?: unknown): Record<string, unknown> {
  return (component ?? {}) as Record<string, unknown>
}

/**
 * The caption a form control is named by, from either spelling.
 *
 * Both resolve and `label` wins. `content` is the generic slot every other
 * control in the catalogue reads and is what existing configs already carry, so
 * it cannot be retired; `label` is what a form control is actually CALLED, it is
 * what the platform's own catalogue specimens write, and it is what an author
 * reaches for first.
 *
 * **Use it for the SSR skeleton as well as for the island props.** A skeleton
 * reading one spelling while the island beside it reads the other renders blank
 * and then pops its text in when the chunk lands — correct with JavaScript,
 * wrong without it, and wrong for a crawler or a reader with no JavaScript at
 * all.
 */
export function controlLabel(rawProps: RawProps): string | undefined {
  const caption = rawProps?.label ?? rawProps?.content
  return typeof caption === 'string' ? caption : undefined
}
