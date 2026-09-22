/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * THE ISLAND-SSR BRIDGE — the one file on the SSR side that may import an
 * island module, and the reason `src/presentation/rendering/island-ssr/` is a
 * boundary element type of its own.
 *
 * ─── WHY A NAMED ONE-DIRECTORY CROSSING AND NOT AN ALLOWANCE ────────────────
 *
 * Nothing outside `src/presentation/islands/` imports an island anywhere in
 * this tree, and `presentation-rendering`'s allow-list omits
 * `presentation-island` accordingly. That omission is worth keeping: a static
 * import of an island module runs its module scope in the SERVER process, so a
 * single island touching `window`/`document` at module scope becomes a boot
 * crash. Widening `presentation-rendering -> presentation-island` would license
 * that for ~40 rendering files. Confining it to this directory keeps the
 * hazard to code that was written knowing about it.
 *
 * ─── WHY THE ISLAND'S `renderField` AND NOT THE SSR SKELETON ────────────────
 *
 * Both exist, and they disagree. `renderSkeletonField`
 * (`ui/sections/renderers/element-renderers/crud-form/crud-form-skeleton.tsx`,
 * which `presentation-rendering` may already import with no exception at all)
 * is a progressive-enhancement PLACEHOLDER: it draws `long-text` as
 * `input:text` and swaps in the real control on hydration. What a user looks at
 * is the hydrated control — a `textarea`. Documenting the placeholder would
 * document a state that lasts a few hundred milliseconds, so the cheaper import
 * is the wrong one, and the boundary cost above is what buys the right one.
 *
 * ─── THE LIMIT THIS BRIDGE MEASURES RATHER THAN HIDES ───────────────────────
 *
 * A specimen is a STATIC STRING. It never mounts, so a control that loads
 * itself on mount (`useDeferredComponent`) is frozen at its pre-mount
 * placeholder here — `rich-text` and `code` today. That is not a defect to
 * paper over; it is a fact the catalog has to say out loud, so this module
 * reports it as {@link FieldSpecimenFidelity} and the caller labels the
 * specimen with it.
 *
 * Both verdicts are read off the markup this module just produced, never off a
 * hand-written table of widgets. A control that becomes deferred tomorrow
 * cannot keep claiming `exact`, and one that loses its `name` cannot keep
 * claiming an anchor.
 *
 * ─── BORROWING THE ISLAND'S RUNTIME, NOT JUST ITS COMPONENTS ────────────────
 *
 * A control is not a pure function of its props: it renders inside the
 * providers `IslandWrapper` mounts around every island root
 * (`islands/island-client.tsx`). Importing the component without them renders
 * it in an environment it never actually runs in, which is how a `relationship`
 * specimen took the whole page down with `No QueryClient set` the day that
 * control became a searching picker — a `useQuery` in a tree with no provider
 * THROWS, so one field type's control crashed the render of all of them.
 *
 * So the bridge supplies the same runtime, from the same factory the client
 * mount uses. That is deliberately not "a `QueryClientProvider` for the
 * specimen page": it is the island's own environment, reproduced on the server
 * so the drawn control is the one that ships. Query hooks are render-safe
 * without it doing any I/O — `useSyncExternalStore` takes its server snapshot
 * and never subscribes, and `renderToString` runs no effects, so nothing
 * fetches and the specimen is the control's empty, pre-data state.
 */

import { QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { renderField, type FieldDef } from '@/presentation/islands/parts/crud-form/fields'
import { createIslandQueryClient } from '@/presentation/islands/runtime/query-client'
import type {
  FieldSpecimenDescriptor,
  FieldSpecimenFidelity,
} from '@/domain/models/app/design/field-specimen'

/** What the bridge produced, and how much it is worth. */
export interface FieldSpecimenRender {
  /** Server-generated, fully-trusted markup for the control. */
  readonly html: string
  /** `exact` or `deferred` — derived from the markup, see the module note. */
  readonly fidelity: FieldSpecimenFidelity
  /**
   * The `name` the drawn control actually carries, or `undefined` when it
   * carries none. `code` is the standing `undefined` case: neither its loading
   * placeholder nor the loaded CodeMirror editor emits a name-bearing control,
   * so a `code` specimen has nothing for a comparison to anchor on. Reported
   * rather than thrown — the specimen is still worth SHOWING, it just cannot be
   * mechanically compared against the real form.
   */
  readonly anchor: string | undefined
}

/**
 * The marker every deferred control's pre-mount placeholder emits.
 *
 * `RichTextLoading` and `CodeLoading` both render `role="status"
 * aria-busy="true"` on the box that stands in for the editor, because that is
 * what "this control cannot take input yet" means in ARIA. Detecting the ARIA
 * fact rather than listing the two widget names is what keeps this honest when
 * a third one arrives.
 */
const DEFERRED_PLACEHOLDER_MARKER = 'aria-busy="true"'

/**
 * A specimen is documentation, not an input: nothing it emits may write. The
 * island's field components are controlled, so they require an `onChange`;
 * this one is never called, because `renderToString` runs no event handlers and
 * the resulting string never hydrates.
 */
const IGNORE_CHANGE = (): undefined => undefined

/**
 * Project a descriptor onto the island's own `FieldDef`.
 *
 * `fieldType` is a plain string on the descriptor and `FieldType` on `FieldDef`,
 * so the cast is here rather than at the call site. It is safe by construction:
 * every dispatch downstream routes through `fieldWidgetOf`, which degrades an
 * unrecognised type to the `text` widget rather than indexing off the end of a
 * table.
 */
function toFieldDef(descriptor: FieldSpecimenDescriptor): FieldDef {
  return {
    name: descriptor.name,
    type: descriptor.fieldType,
    ...(descriptor.displayLabel !== undefined ? { displayLabel: descriptor.displayLabel } : {}),
    ...(descriptor.options !== undefined ? { options: descriptor.options } : {}),
    ...(descriptor.placeholder !== undefined ? { placeholder: descriptor.placeholder } : {}),
    ...(descriptor.description !== undefined ? { description: descriptor.description } : {}),
  } as FieldDef
}

/**
 * Render one field-type specimen's control to a trusted HTML string.
 *
 * Produces the control ALONE — no wrapper, no caption, no anchor of its own.
 * The wrapper and the surface label belong to the resolver, which owns the
 * rule that no control-like attribute may sit above the `[name]` element.
 */
export function renderFieldSpecimen(descriptor: FieldSpecimenDescriptor): FieldSpecimenRender {
  const html = renderToString(
    // A client per render, exactly as `IslandWrapper` makes one per island
    // root: nothing subscribes to it during `renderToString`, so it holds no
    // state worth sharing and none worth leaking between requests.
    createElement(
      QueryClientProvider,
      { client: createIslandQueryClient() },
      renderField({
        field: toFieldDef(descriptor),
        value: descriptor.value ?? '',
        onChange: IGNORE_CHANGE,
        invalid: false,
      })
    )
  )
  const anchored = html.includes(`name="${descriptor.name}"`)
  return {
    html,
    fidelity: html.includes(DEFERRED_PLACEHOLDER_MARKER) ? 'deferred' : 'exact',
    ...(anchored ? { anchor: descriptor.name } : { anchor: undefined }),
  }
}
