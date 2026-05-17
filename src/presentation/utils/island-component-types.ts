/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Top-level component types that require the client-side React island runtime.
 *
 * Used by both:
 * - The page renderer ({@link "../rendering/render-page"}) to decide whether
 *   to BUILD the island bundle so it can be served from `/assets/islands/`.
 * - The HTML emitter ({@link "../ui/pages/DynamicPage"}) to decide whether to
 *   inject the `<script src="/assets/islands/${entry}">` hydration tag.
 *
 * Both sites must agree. If they diverge:
 * - Bundle built but no script tag → island never hydrates (gray skeleton).
 * - Script tag but no bundle → 404 on the script.
 *
 * Note: this set covers component types triggered purely by their `type` field
 * at the page-component top level. Search-mode sections (`dataSource.mode === 'search'`)
 * and form sections with auth/crud actions are detected separately by the same
 * call-sites and also require the runtime — they are not listed here.
 *
 * **CRITICAL — adding a new island component type requires THREE coordinated edits.**
 *
 * 1. Register the React island in `src/presentation/islands/island-registry.ts`
 *    (the `ISLANDS` map). Without this, the bootstrap script can't find the
 *    component and hydration silently no-ops.
 * 2. Add the SSR placeholder renderer in
 *    `src/presentation/ui/sections/rendering/component-registry/island-form-components.tsx`
 *    (or the appropriate sibling registry). The placeholder must emit
 *    `data-island="<type>"` and `data-island-props="..."` so the bootstrap
 *    script knows what to mount and with which props.
 * 3. Add the `<type>` literal to this set. Without this, `hasIslandComponents()`
 *    returns `false`, the script tag never gets injected, and the SSR
 *    placeholder sits there forever.
 *
 * Form-control schemas put their custom fields (`options`, `defaultValue`,
 * `searchable`, `multiple`, `min`, `max`, …) at the **component top level**
 * as siblings of `props`. The placeholder renderer must use
 * `pickFromComponent(component, rawProps, key)` to read these fields, NOT
 * `rawProps?.key`. See the `pickFromComponent` doc-comment in
 * `island-form-components.tsx` for details.
 */
export const ISLAND_COMPONENT_TYPES: ReadonlySet<string> = new Set([
  'data-table',
  'kanban',
  'calendar',
  'gallery',
  'chart',
  'tabs',
  'accordion',
  'select',
])
