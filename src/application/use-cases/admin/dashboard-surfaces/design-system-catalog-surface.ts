/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `/_admin/design-system/preview/components/:category` — every component-type
 * in one category, rendered by the REAL renderer under the operator's theme.
 *
 * ─── WHY IT LIVES INSIDE THE EXISTING PREVIEW NAMESPACE ────────────────────
 *
 * The D4 admin guard, the `frame-ancestors 'self'` CSP narrowing and the
 * operator-theme stylesheet routing are all properties of
 * `/_admin/design-system/preview/*`. A sibling namespace would have to
 * re-earn all three, and the first one it forgot would be a silent hole.
 *
 * ─── WHY A LINK AND NOT A FRAME ────────────────────────────────────────────
 *
 * The console embeds three panels inline. It does NOT embed the catalog: N
 * iframes is N full page renders, and 23 categories framed on the console
 * would make its cost scale with the CATALOGUE rather than with what a reader
 * actually opens. `[internal ref]` asserts the iframe count does not
 * grow.
 *
 * ─── WHAT IS DELIBERATELY NOT CARRIED OVER ─────────────────────────────────
 *
 * Like the v1 previews, the catalog app is built field by field rather than
 * spread from the operator app. `tables`, `env`, `auth` and everything else
 * stay behind, so A2's confidentiality bound holds BY CONSTRUCTION rather than
 * by a redaction pass someone has to remember to extend. The one data specimen
 * that shows rows reads them from a platform endpoint, never from a table.
 */

import {
  CATALOG_CATEGORY_SUMMARIES,
  CATALOG_CATEGORY_TITLES,
  catalogedTypesOf,
} from './design-system-catalog-registry'
import { specimensOf } from './design-system-catalog-specimens'
import type { CatalogComponentCategory } from './design-system-catalog-registry'
import type { CatalogSpecimen } from './design-system-catalog-specimens'
import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'

const asComponent = (value: unknown): Component => value as Component

const text = (element: string, className: string, content: string): Component =>
  asComponent({ type: 'text', element, props: { className }, content })

/**
 * The specimen's own name, above whatever it draws.
 *
 * Plain text on purpose: `controlSignature` (the `021` / `027` extractor)
 * resolves self-or-first-descendant over
 * `input, select, textarea, button, [role]`, so a label that carried a role —
 * a heading element is fine, an element with a `role` ATTRIBUTE is not — would
 * be picked up INSTEAD of the component's own control, and the oracle would
 * compare two different elements as if they were one.
 */
const specimenLabel = (type: string): Component =>
  text('p', 'text-foreground font-mono text-xs tracking-tight', type)

/**
 * The box the real component is drawn in. Absent on a reported specimen.
 *
 * `element: 'article'` and never `'div'` — see {@link specimenBlock}.
 */
const specimenCanvas = (child: Component): Component =>
  asComponent({
    type: 'container',
    element: 'article',
    props: {
      className: 'border-border bg-background flex flex-col gap-2 rounded-md border p-4',
      'data-design-specimen-canvas': 'true',
    },
    children: [child],
  })

/**
 * One catalogued type: its name, then either the component or the reason.
 *
 * ─── `element: 'article'`, AND IT IS LOAD-BEARING (MEASURED) ───────────────
 *
 * `buildAccessibilityRole` gives any `div` with children and no content an
 * automatic `role="group"`. Both the specimen wrapper and its canvas are such
 * elements — and `controlSignature`, the extractor `021` runs on BOTH sides of
 * its oracle, resolves `el.matches('input, select, textarea, button, [role]')`
 * BEFORE looking at descendants. So a `div` wrapper answers `div[group]` for
 * every type in the category: eleven identical signatures, and the oracle
 * comparing the wrapper against the ordinary page's actual control.
 *
 * Measured: the `checkbox` specimen read `div[group]` against an oracle of
 * `span[checkbox]`. An `<article>` takes no `role` ATTRIBUTE (its ARIA role is
 * implicit, which the attribute selector does not see), so the extractor falls
 * through to the descendant branch and finds the component's own control —
 * which is exactly what the oracle side does with the island marker `div`.
 *
 * It is also the honest markup: a catalog entry IS a self-contained
 * composition. But do not change it back to `div` for tidiness.
 */
function specimenBlock(specimen: CatalogSpecimen): Component {
  const { type, component, refusal, wrapperProps } = specimen
  return asComponent({
    type: 'container',
    element: 'article',
    props: {
      className: 'flex flex-col gap-2',
      'data-design-specimen': type,
      ...(refusal === undefined ? {} : { 'data-design-specimen-state': refusal.state }),
      ...(wrapperProps ?? {}),
    },
    children: [
      specimenLabel(type),
      ...(refusal === undefined
        ? [specimenCanvas(component as Component)]
        : [text('p', 'text-foreground-subtle max-w-prose text-sm leading-relaxed', refusal.note)]),
    ],
  })
}

/**
 * A type the domain places in this category that has no specimen here.
 *
 * This is what makes the derived type list earn its keep: a component-type
 * added to the domain appears on the page as a NAMED GAP on the next boot,
 * rather than silently not existing in the catalogue that claims to be
 * exhaustive.
 */
const uncatalogued = (type: string): CatalogSpecimen => ({
  type,
  refusal: {
    state: 'not-previewable',
    note: 'This component-type ships in this build and has no specimen yet.',
  },
})

/** Every block the category shows: its specimens, then any uncovered type. */
function categoryBlocks(category: CatalogComponentCategory): readonly Component[] {
  const specimens = specimensOf(category)
  const covered = new Set(specimens.map((specimen) => specimen.type))
  const gaps = catalogedTypesOf(category)
    .filter((type) => !covered.has(type))
    .map(uncatalogued)
  return [...specimens, ...gaps].map(specimenBlock)
}

/** The catalog document for one category. */
function catalogPage(category: CatalogComponentCategory, path: string): Page {
  const title = CATALOG_CATEGORY_TITLES[category]
  return {
    id: `design-system-catalog-${category}`,
    name: `design-system-catalog-${category}`,
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
              {
                type: 'text',
                element: 'h1',
                props: { className: 'text-foreground text-xl font-semibold tracking-tight' },
                content: title,
              },
              {
                type: 'text',
                element: 'p',
                props: { className: 'text-foreground-subtle max-w-2xl text-sm leading-relaxed' },
                content: CATALOG_CATEGORY_SUMMARIES[category],
              },
            ],
          },
          {
            type: 'container',
            element: 'div',
            props: { className: 'flex flex-col gap-6' },
            children: categoryBlocks(category),
          },
        ],
      }),
    ],
  } as Page
}

/**
 * Build the app that renders one catalog document.
 *
 * Identical theme routing to the v1 previews, and for the same reason: the app
 * carries the OPERATOR's name, which is what routes the document to the
 * operator's compiled stylesheet rather than the console's. A catalog painted
 * in Sovrium's chrome would document the wrong design system.
 */
export function buildDesignSystemCatalogApp(
  operatorApp: App,
  category: CatalogComponentCategory,
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
    pages: [catalogPage(category, path)],
  } as unknown as App
}
