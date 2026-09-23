/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { ElementProps } from '@/presentation/render/elements/html-element-renderer'

/**
 * Drop the resolver→renderer marker props before author props reach a DOM
 * element.
 *
 * WHAT THE MARKERS ARE. When a `dataSource` binds to a component, the resolve
 * pipeline stamps underscore-prefixed signals onto that component's props —
 * `_dataSourceBound` and `_record` (`resolve/data-source-modes.ts`,
 * `resolve/page-collection-resolver.ts`), the `_pagination*` trio and the
 * `_recordFieldSystem*` trio (`resolve/data-source-rows.ts`), `_dataSourceError`,
 * and `_readOnly` (`page/page-crud-gating.tsx`). They are how a resolver tells a
 * renderer what it bound; they are not markup, and React answers each one that
 * reaches an element with "React does not recognize the `_dataSourceBound` prop
 * on a DOM element", on every render of every data-bound page.
 *
 * WHY THE STRIP CANNOT MOVE UPSTREAM. The markers are READ by the renderers
 * that own their types — `record-field-component.tsx` reads the
 * `_recordFieldSystem*` trio, `special-components.tsx` reads `_dataSourceBound`
 * for `list`, `crud-form-renderer.tsx` reads `_record` and `_readOnly`. Stripping
 * them where props are built would delete the signal before its reader ever saw
 * it. The terminal DOM boundary is the only point at which every marker is
 * certainly spent, which is the same conclusion `toUncontrolledFormProps`
 * reaches for `value`/`checked` in `uncontrolled-form-props.ts`.
 *
 * WHY A PREFIX TEST RATHER THAN A LIST OF KEYS. `renderHTMLElement` used to
 * destructure six markers by name, and three more renderers destructured their
 * own — so a data source bound to `container` was clean while the same source
 * bound to `link`, `image`, `audio`, `iframe`, `list`, `paragraph` or any other
 * leaf still leaked, because those seven renderers spread props unfiltered.
 * Enumerating keys reproduces that failure one marker at a time: the list is
 * already 24 keys across four setter sites, and the next marker added to the
 * resolve pipeline leaks by default until someone remembers to extend every
 * copy of the list. The invariant that actually holds is structural — an
 * underscore-prefixed prop is internal by construction — so testing the prefix
 * closes the class and stays closed.
 *
 * Nothing legitimate is lost. HTML has no underscore-prefixed attributes;
 * author-facing extension points are `data-*` and `aria-*`, which React passes
 * through and this function preserves. An author writing `_foo` in their config
 * would have had it rejected by React with a warning anyway.
 *
 * Returns the ARGUMENT unchanged when it carries no marker, which is the common
 * case — most elements on a page are not data-bound. That keeps the function
 * allocation-free on the hot path, since it now runs at every DOM element of
 * every server render, and it preserves the referential identity that
 * `toUncontrolledFormProps` documents and its tests assert.
 */
export function omitInternalMarkers(props: ElementProps): ElementProps {
  const entries = Object.entries(props)
  const authorEntries = entries.filter(([key]) => !key.startsWith('_'))
  return authorEntries.length === entries.length ? props : Object.fromEntries(authorEntries)
}
