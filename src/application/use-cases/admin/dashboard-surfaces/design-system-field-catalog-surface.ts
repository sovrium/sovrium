/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `/_admin/design-system/preview/fields/:category` — every FIELD-type in one
 * category, drawn with the control the crud-form island draws for it.
 *
 * ─── WHY A FIELD NEEDS A DESCRIPTOR AND A COMPONENT DOES NOT ───────────────
 *
 * A component-type has a renderer, so the component catalog just writes the
 * component and lets the page pipeline draw it. A field type is a table COLUMN
 * type: it has no renderer of its own, and its visual surface is a control that
 * some OTHER surface draws for it. Drawing that control is presentation work,
 * and this file is in `src/application/`, which holds zero `@/presentation`
 * imports and must keep it that way.
 *
 * So this file emits a DESCRIPTOR — inert data naming what to draw
 * (`@/domain/types/field-specimen`) — and `expandFieldSpecimens`
 * (`@/presentation/rendering/field-specimen-resolver`) expands it during the
 * render pipeline. The application layer gains no import; the rendering
 * decision never leaves presentation. The pattern, and when NOT to reach for
 * it: `@docs/architecture/patterns/render-time-component-expansion.md`.
 *
 * ─── WHICH SURFACE, AND WHY THE LABEL IS NOT DECORATION ────────────────────
 *
 * `field-type-behavior.ts` names three surfaces that draw a field type and says
 * in terms that they *"legitimately differ"*. The specimen documents the
 * CRUD-FORM ISLAND — the hydrated control, which is the one a user actually
 * looks at, and not the SSR skeleton that stands in for it for a few hundred
 * milliseconds (the skeleton draws `long-text` as `input:text`; the island
 * draws a `textarea`). Saying WHICH surface is what keeps the page from
 * asserting that this is THE rendering of the field type, which the existence
 * of three surfaces disproves.
 *
 * ─── THE SPECIMEN CARRIES NO WRITE PATH ────────────────────────────────────
 *
 * The control is hosted directly, never inside a `<form>` and never beside a
 * submit control ([internal ref] A3 clauses 1 and 2), which is also why the `data`
 * catalog reports `form` / `data-form` rather than drawing them. Like every
 * other preview the app is built field by field rather than spread from the
 * operator app, so A2's confidentiality bound holds by construction: no
 * `tables`, no `env`, no `auth`, and every specimen value is empty.
 */

import { fieldSpecimen } from '@/domain/types/field-specimen'
import {
  CATALOG_FIELD_CATEGORY_SUMMARIES,
  CATALOG_FIELD_CATEGORY_TITLES,
  catalogedFieldTypesOf,
} from './design-system-field-registry'
import type { CatalogFieldCategory } from './design-system-field-registry'
import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'

const asComponent = (value: unknown): Component => value as Component

const text = (element: string, className: string, content: string): Component =>
  asComponent({ type: 'text', element, props: { className }, content })

/**
 * The `name` the drawn control carries — the comparison anchor.
 *
 * Derived from the field type so it is deterministic and self-describing, and
 * underscored because `FieldNameSchema` rejects a hyphen outright (*"start with
 * a letter, contain only lowercase letters, numbers, and underscores"*). The
 * humanised form of this name is also what the control's own `<label>` shows,
 * so `single-line-text` reads as "Single Line Text" with nothing hand-written.
 */
const specimenFieldName = (fieldType: string): string => fieldType.replaceAll('-', '_')

/**
 * One catalogued field type: its name, then the control drawn for it.
 *
 * ─── `element: 'article'`, FOR THE REASON THE COMPONENT CATALOG GIVES ──────
 *
 * `buildAccessibilityRole` gives any `div` with children and no content an
 * automatic `role="group"`, and the `021` / `027` extractor resolves
 * `el.matches('input, select, textarea, button, [role]')` before looking at
 * descendants — so a `div` wrapper answers `div[group]` for every type in the
 * category. An `<article>` takes no `role` ATTRIBUTE, so the extractor falls
 * through. Do not change it back to `div` for tidiness.
 *
 * ─── AND WHY THE ORACLE STILL ANCHORS INSIDE, NOT HERE ─────────────────────
 *
 * Falling through to the first DESCENDANT control is not enough for a field.
 * `rich-text`'s first descendant control is the deferred editor's
 * `div[role=status]` placeholder; the element that carries the `name` is the
 * hidden mirror input after it. So `027` anchors on `[name]` INSIDE this
 * wrapper, exactly as it anchors the oracle side, and this wrapper deliberately
 * carries no control-like attribute of its own.
 */
function fieldSpecimenBlock(fieldType: string): Component {
  return asComponent({
    type: 'container',
    element: 'article',
    props: {
      className: 'flex flex-col gap-2',
      'data-design-specimen': `field:${fieldType}`,
    },
    children: [
      text('p', 'text-foreground font-mono text-xs tracking-tight', fieldType),
      asComponent({
        type: 'container',
        element: 'article',
        props: {
          className: 'border-border bg-background flex flex-col gap-2 rounded-md border p-4',
          'data-design-specimen-canvas': 'true',
        },
        children: [
          fieldSpecimen({
            fieldType,
            name: specimenFieldName(fieldType),
            surface: 'crud-form-island',
          }) as unknown as Component,
        ],
      }),
    ],
  })
}

/**
 * The one sentence that names the surface these specimens document.
 *
 * Page-level rather than per-specimen ON PURPOSE: the claim is a property of
 * the whole catalog, and six elements sharing one test id would be a strict-mode
 * violation for any assertion that reads it. The resolver additionally captions
 * each specimen — including the extra sentence a DEFERRED control earns — and
 * that caption is per-specimen because its truth is.
 */
const surfaceNote = (): Component =>
  asComponent({
    type: 'text',
    element: 'p',
    props: {
      className: 'text-foreground-subtle max-w-2xl text-sm leading-relaxed',
      'data-testid': 'design-system-field-surface-note',
    },
    content:
      'Each specimen shows the control the crud form draws for that field type. ' +
      'The data table’s inline cell editor and the server-rendered form skeleton ' +
      'draw the same field types differently, and legitimately so.',
  })

/** The catalog document for one field category. */
function fieldCatalogPage(category: CatalogFieldCategory, path: string): Page {
  const title = CATALOG_FIELD_CATEGORY_TITLES[category]
  return {
    id: `design-system-field-catalog-${category}`,
    name: `design-system-field-catalog-${category}`,
    path,
    meta: { title: `Design system — ${title}`, lang: 'en-US' },
    components: [
      asComponent({
        type: 'container',
        element: 'div',
        props: {
          className: 'bg-background text-foreground flex min-h-screen flex-col gap-6 p-6',
          'data-testid': 'preview-surface',
        },
        children: [
          {
            type: 'container',
            element: 'div',
            props: { className: 'flex flex-col gap-1' },
            children: [
              text('h1', 'text-foreground text-xl font-semibold tracking-tight', title),
              text(
                'p',
                'text-foreground-subtle max-w-2xl text-sm leading-relaxed',
                CATALOG_FIELD_CATEGORY_SUMMARIES[category]
              ),
              surfaceNote(),
            ],
          },
          {
            type: 'container',
            element: 'div',
            props: { className: 'flex flex-col gap-6' },
            children: catalogedFieldTypesOf(category).map(fieldSpecimenBlock),
          },
        ],
      }),
    ],
  } as Page
}

/**
 * Build the app that renders one field-catalog document.
 *
 * Identical theme routing to the component catalog and the v1 previews, and for
 * the same reason: the app carries the OPERATOR's name, which is what routes
 * the document to the operator's compiled stylesheet rather than the console's.
 * A catalog painted in Sovrium's chrome would document the wrong design system.
 */
export function buildDesignSystemFieldCatalogApp(
  operatorApp: App,
  category: CatalogFieldCategory,
  path: string,
  scheme?: string
): App {
  const theme = operatorApp.design?.theme ?? operatorApp.theme
  const themed = scheme === 'dark' ? { ...theme, colorScheme: 'dark' as const } : theme

  return {
    name: operatorApp.name,
    theme: themed,
    design: { ...operatorApp.design, theme: themed },
    // No "Built with Sovrium" badge, and no auto-appended record palette (which
    // would mount a search island in a document that has no records).
    badge: false,
    palette: { enabled: false },
    pages: [fieldCatalogPage(category, path)],
  } as unknown as App
}
