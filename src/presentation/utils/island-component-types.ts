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
  // `split-pane` — resizable two-pane layout. The SSR renderer emits the static
  // structure plus an empty `data-island="split-pane"` enhancement marker that
  // hydrates drag-to-resize in place.
  'split-pane',
  'kanban',
  'calendar',
  'gallery',
  'chart',
  'kpi',
  'data-timeline',
  'ai-chat',
  'tabs',
  'accordion',
  'select',
  'dialog',
  'alert-dialog',
  'drawer',
  // `record-drawer` — record-detail/edit drawer specialization
  //. Listed so the page-level
  // island bundle includes its chunk whenever the surface renders one.
  'record-drawer',
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
  // `pageSearch` hydrates the public-pages search shell: turns the SSR
  // `<input type="search">` into a live results panel sourced from the
  // build-time `/sovrium-search/index.json`. Note the camelCase type name
  // matches the schema literal (`PageSearchTypeLiteral`); the registry key
  // in `island-registry.ts` is kebab-case (`page-search`) per the
  // ISLAND-name convention.
  'pageSearch',
  // `comments` + `commentCount` (PG-01 / PG-02): comment-thread island
  // hydrates the paged list + form + edit/delete; comment-count island
  // fetches the total from the comments-API pagination metadata. Both
  // SSR placeholders ship under the `data-component="comments"` /
  // `data-component="comment-count"` markers; hydration only mounts
  // when the placeholder also emits `data-island=...` (i.e. when
  // `tableName` + `recordId` are both resolvable at SSR time).
  'comments',
  'commentCount',
  // Schema config-editor islands (platform B10). Mount a CodeMirror JSON/YAML
  // editor that POSTs the edited config to the records API on Submit. The SSR
  // placeholder (skeleton + disabled Submit button) is the visible fallback
  // until the lazy chunk resolves.
  'schema-json-editor',
  'schema-yaml-editor',
  // `schema-form-editor` mounts a structured no-code config builder; its Submit
  // serializes the section inputs to a config submission tagged `format: 'form'`.
  // `schema-ai-agent` mounts a natural-language chat surface; Send persists the
  // described change tagged `format: 'ai'`.
  'schema-form-editor',
  'schema-ai-agent',
])
