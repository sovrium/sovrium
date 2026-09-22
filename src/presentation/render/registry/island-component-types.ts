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
  'table',
  // The four kit-addition islands. `rich-text-editor` and `code-editor` are
  // WRAPPERS: each mounts a small island that then defers to the SAME editor
  // chunk the crud-form field already loads, so a page carrying both a form
  // field and a standalone editor downloads Tiptap (or CodeMirror) once.
  // `filter-bar` mounts on every page that declares one — it publishes on the
  // shared-filter channel, and a bar that never hydrated would leave its
  // subscribers unfiltered with no visible cause.
  'rich-text-editor',
  'code-editor',
  'date-range-picker',
  'filter-bar',
  // `split-pane` — resizable two-pane layout. The SSR renderer emits the static
  // structure plus an empty `data-island="split-pane"` enhancement marker that
  // hydrates drag-to-resize in place.
  'split-pane',
  'kanban',
  'calendar',
  'gallery',
  'chart',
  // `graph` — the DRAWING half of a hybrid. Its data, its accessible twin, its
  // degraded notice and its empty state are all server-rendered; only the
  // canvas hydrates, because selection and the reach highlight are client
  // state. It belongs here for the ordinary reason: without this entry
  // `hasIslandComponents()` is false, no hydration script is injected, and the
  // reader is left looking at the loading skeleton for ever.
  'graph',
  'kpi',
  // `timeline` under a `dataSource` mounts the Gantt island; without one it
  // renders a structural rail and mounts nothing. ONE entry, keyed by TYPE.
  'timeline',
  'ai-chat',
  'tabs',
  'accordion',
  'select',
  'dialog',
  'alert-dialog',
  // `drawer`, in BOTH of its shapes. A drawer carrying a `dataSource` is the
  // record-detail/edit surface
  // and mounts the `record-drawer` island; one without renders its authored
  // children through the `drawer` island. ONE entry covers both, because the
  // gate is keyed by TYPE and the renderer decides which island the page ends
  // up mounting. `record-drawer` was its own entry until the two merged.
  'drawer',
  'popover',
  'tooltip',
  'dropdown-menu',
  'context-menu',
  'hover-card',
  // `file-upload` is hydrated only when the schema sets `dropZone: true`; for
  // the basic (non-dropzone) variant the SSR renderer emits plain HTML and
  // no island mounts. Listed here so the page-level island bundle includes
  // the file-upload chunk whenever a `file-upload` component is present.
  'file-upload',
  // `record-picker` is always hydrated: the SSR skeleton is an INERT box, and
  // it has to be — a picker inlines no candidates, so every row it can offer
  // comes back from a live search. A page that declared one and never hydrated
  // it would show a search box that finds nothing, with no visible cause.
  'record-picker',
  // `number-input` is always hydrated (the stepper buttons + on-blur clamping
  // are JS-only behaviour beyond the native `<input type="number">`).
  'number-input',
  // Form-control islands that ship `role="slider"` / `role="checkbox"` /
  // `role="switch"` / `role="radiogroup"` on hydration — Playwright specs
  // depend on those roles to resolve, so the page-level bundle must include
  // their chunks. (Hydration itself is gated by the existing `data-island`
  // discovery in `island-client.tsx`.)
  'slider',
  'checkbox',
  'switch',
  'radio-group',
  // `date-picker` mounts a popover trigger + react-day-picker grid; the
  // calendar dialog only appears after the trigger is clicked.
  'date-picker',
  // `search-input` under `scope: 'page'` hydrates the public-pages search
  // shell: turns the SSR `<input type="search">` into a live results panel
  // sourced from the build-time `/sovrium-search/index.json`. Under
  // `scope: 'subscribers'` it mounts nothing of its own — it publishes DOM
  // events a bound sibling island consumes.
  //
  // The gate is keyed by TYPE, so ONE entry covers both scopes, and a
  // subscriber-scoped page therefore gets a hydration script it does not
  // strictly need. That is the gate's standing trade (it decides whether to
  // BUILD the bundle, not what mounts) and it is the safe direction: the
  // opposite miss is a page-scoped search box that never becomes a search.
  //
  // The registry KEY was renamed to `search-input` to follow the type, which is
  // why this needs no `TYPE_TO_ISLAND_KEY` translation. It needed one while the
  // type was spelled `pageSearch` and the key `page-search`; renaming the key
  // removed the split instead of describing it, and emptied that table. The
  // island FILE is still `search/page-search-island.tsx` — file names are
  // load-bearing for the payload ceilings and never move.
  'search-input',
  // `comments` (PG-01 / PG-02), in BOTH of its displays. `display: 'thread'`
  // hydrates the paged list + form + edit/delete through the comment-thread
  // island; `display: 'count'` fetches the total through the comment-count
  // island. ONE entry covers both because they are one component type — the
  // gate is keyed by `type`, and the island a page ends up mounting is decided
  // by the renderer, not here. Both SSR placeholders ship under the
  // `data-component="comments"` / `data-component="comment-count"` markers;
  // hydration only mounts when the placeholder also emits `data-island=...`
  // (i.e. when `tableName` + `recordId` are both resolvable at SSR time).
  'comments',
])

/**
 * True for a `dialog` that opted OUT of hydration (`hydrate: false`) — the
 * zero-JavaScript overlay this type absorbed when `modal` was retired.
 *
 * This is the RENDER contract: such a dialog is opened and closed entirely by
 * the always-present click enhancer in `page-body-scripts.tsx`
 * (`[data-click-modal]`, `[data-modal-close]`, `[data-backdrop]`, Escape), and
 * its SSR renderer emits enhancer-compatible markup instead of a
 * `data-island="dialog"` marker.
 *
 * An EXPLICIT opt-in, never inferred from the absence of `formRef` / `children`
 * / `confirmLabel`: what `hydrate: false` gives up is focus containment and
 * focus restoration, and no other field governs those — so an inference would
 * silently strip them from some future dialog with no config diff to show.
 */
export function isZeroJsDialog(component: {
  readonly type?: string
  readonly hydrate?: unknown
}): boolean {
  return component.type === 'dialog' && component.hydrate === false
}

/**
 * True when a component is a zero-JS dialog that ALSO demands nothing of the
 * island runtime — the gate half of {@link isZeroJsDialog}.
 *
 * `dialog` is a member of {@link ISLAND_COMPONENT_TYPES}, and that set is keyed
 * by TYPE, so it cannot express "this instance mounts nothing". Both gate sites
 * consult this before consulting the set: `selfNeedsIslands` in
 * `render-page.tsx`, which decides whether to BUILD the bundle, and
 * `itemSelfNeedsIslands` in `page-island-detection.ts`, which decides whether to
 * INJECT the `<script>` tag. It lives here rather than being written twice
 * because the two must agree — a bundle with no script leaves a dead skeleton,
 * a script with no bundle 404s.
 *
 * `formRef` is excluded, deliberately, in the SAFE direction. A dialog wrapping
 * a top-level form has its body expanded from `app.forms[]` by `expandFormRefs`
 * at render time, and that markup can itself carry island fields (`select`,
 * `date-picker`, `file-upload`, …). Neither gate walks into the expansion, so
 * whether the runtime is needed is invisible here. Keeping the bundle for that
 * shape costs an unused chunk; dropping it would leave a real form dead.
 */
export function zeroJsDialogNeedsNoRuntime(component: {
  readonly type?: string
  readonly hydrate?: unknown
  readonly formRef?: unknown
}): boolean {
  return isZeroJsDialog(component) && component.formRef === undefined
}
