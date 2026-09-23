/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// The kit's own catalogue, restated for the surfaces that navigate it.
//
// ─── WRITTEN OUT, BECAUSE THIS FILE MAY NOT IMPORT THE REGISTRY ────────────
//
// This is `CATALOG_COMPONENT_CATEGORIES` and `catalogedTypesOf`
// (`src/domain/models/app/pages/components/component-types/catalog.ts`)
// restated. `src/admin/**` value-imports nothing from `src/` — the
// `Admin Config Only` drift check enforces it — so the lists cannot be imported
// and have to be copied. `sidebar.ts` and `ui-kit.ts` already carry the CATEGORY
// half for the same reason; this file is where the two of them will converge,
// and where the per-type page bodies hang off next.
//
// ─── DRIFT IS ASSERTED, NOT PREVENTED ──────────────────────────────────────
//
// `[internal ref]` sweeps every category the domain publishes and
// requires the console to open a row for each, so a category added there and not
// here fails that criterion rather than quietly vanishing from the chrome. The
// TYPE lists below want the same treatment: a type added to the registry and not
// here is a page with no way in.
//
// ─── AND WHY THE LIST IS AUTHORED RATHER THAN FETCHED ──────────────────────
//
// `GET /api/admin/schema/component-types` publishes every type and its category,
// and a `sidebar` group CAN read rows from an endpoint — but the endpoint takes
// no query, so all twelve groups would fetch the whole catalogue and each would
// list all of it. Narrowing needs either a `?category=` parameter or a
// slug-keyed count object; until one exists the entry lists are authored and the
// COUNTS beside them are read live, which is the half that must never be a
// literal.

/** The twelve published categories, in the registry's own reading order. */
export const KIT_CATEGORIES: readonly (readonly [slug: string, title: string])[] = [
  ['interactive', 'Interactive'],
  ['form-controls', 'Form controls'],
  ['data', 'Data'],
  ['layout', 'Layout'],
  ['content', 'Content'],
  ['display', 'Display'],
  ['navigation', 'Navigation'],
  ['overlays', 'Overlays'],
  ['feedback', 'Feedback'],
  ['structural', 'Structural'],
  ['specialty', 'Specialty'],
  ['ai', 'AI'],
]

/**
 * Every catalogued type, under the category the registry files it in.
 *
 * Read from the registry rather than typed from memory. Alphabetical within a
 * category, which is the order `catalogedTypesOf` sorts in.
 *
 * This list went stale within hours of being written — the registry gained
 * `record-picker` and the column had no row for it, so the type had a page and
 * no way in. That is the exact failure the header above predicts, and it is why
 * the check belongs in the drift family rather than in an E2E sweep: a copy that
 * mirrors a derived list has to be compared against it on every commit, not on
 * every boot.
 */
export const KIT_TYPES: Readonly<Record<string, readonly string[]>> = {
  interactive: ['alert', 'badge', 'button', 'button-group', 'link', 'theme-toggle'],
  'form-controls': [
    'checkbox',
    'code-editor',
    'date-picker',
    'date-range-picker',
    'field',
    'input',
    'input-group',
    'radio-group',
    'record-picker',
    'rich-text-editor',
    'select',
    'slider',
    'switch',
    'textarea',
    'toggle',
    'toggle-group',
  ],
  data: [
    'calendar',
    'chart',
    'filter-bar',
    'form',
    'gallery',
    'graph',
    'kanban',
    'kpi',
    'list',
    'matrix',
    'table',
  ],
  layout: ['card', 'container', 'flex', 'grid', 'sidebar', 'split-pane'],
  content: [
    'audio',
    'code',
    'icon',
    'iframe',
    'image',
    'kbd',
    'qr-code',
    'search-input',
    'text',
    'toc',
    'video',
  ],
  display: [
    'accordion',
    'avatar',
    'description-list',
    'empty-state',
    'list-item',
    'marquee',
    'record-field',
    'scroll-area',
    'swatch',
    'tabs',
    'timeline',
  ],
  navigation: [
    'breadcrumb',
    'command-palette',
    'context-menu',
    'dropdown-menu',
    'menubar',
    'navigation-menu',
    'pagination',
  ],
  overlays: ['alert-dialog', 'dialog', 'drawer', 'hover-card', 'popover', 'toast', 'tooltip'],
  feedback: ['progress', 'skeleton', 'spinner'],
  structural: ['divider', 'spacer'],
  specialty: [
    'comments',
    'field-specimen',
    'file-upload',
    'language-switcher',
    'number-input',
    'preview',
    'reorderable-list',
    'specimen',
    'time-picker',
  ],
  ai: ['ai-chat'],
}
