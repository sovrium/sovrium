/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Dashboard "Design System" surface (`/_admin/design-system`) — the console
 * page that shows an operator what their app actually looks like.
 *
 * The third config-introspection surface, and the one the other two cannot
 * cover: `/_admin/schema` reports what the config SAYS and `/_admin/env` what
 * the box RESOLVED, while this reports what the app RENDERS — including
 * everything it inherited without declaring, which is precisely the part an
 * author cannot learn by reading their own file.
 *
 * ─── ONE IFRAME PER SECTION, NEVER ONE PER COMPONENT ────────────────────────
 *
 * N iframes is N page loads. The UI-kit section alone renders several clusters;
 * one frame per specimen would make this page cost dozens of full renders, and
 * the cost would scale with the CATALOGUE rather than with the number of things
 * a reader actually looks at. Three frames is the whole page.
 *
 * ─── READ-ONLY, AND STRUCTURALLY SO ([internal ref] A2) ────────────────────────────
 *
 * No edit affordance, no textbox, no form, no write endpoint — on this page or
 * inside the specimens. Reading a design system is observability; changing it
 * is authoring, and authoring happens in the config file. A theme editor here
 * would be exactly the config-editing plane the self-hosted product omits.
 */

import { homeCrumb, wrapInShell } from './dashboard-shell-surface'
import {
  CATALOG_CATEGORY_TITLES,
  CATALOG_COMPONENT_CATEGORIES,
  type CatalogComponentCategory,
} from './design-system-catalog-registry'
import {
  CATALOG_FIELD_CATEGORIES,
  CATALOG_FIELD_CATEGORY_TITLES,
  type CatalogFieldCategory,
} from './design-system-field-registry'
import {
  DESIGN_SYSTEM_PREVIEW_SECTIONS,
  DESIGN_SYSTEM_SECTION_TITLES,
  type DesignSystemPreviewSection,
} from './design-system-preview-surface'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'

/** The console page's own path, within the `/_admin` mount. */
export const DESIGN_SYSTEM_CONSOLE_PATH = '/design-system'

/** The absolute URL of one section's preview document. */
export const designSystemPreviewHref = (section: string): string =>
  `/_admin${DESIGN_SYSTEM_CONSOLE_PATH}/preview/${section}`

/** The absolute URL of one component-type category's catalog document. */
export const designSystemCatalogHref = (category: string): string =>
  `/_admin${DESIGN_SYSTEM_CONSOLE_PATH}/preview/components/${category}`

/** The absolute URL of one FIELD-type category's catalog document. */
export const designSystemFieldCatalogHref = (category: string): string =>
  `/_admin${DESIGN_SYSTEM_CONSOLE_PATH}/preview/fields/${category}`

/** Shell-wrap concerns for the standalone Design System surface. */
export interface DesignSystemSurfaceOptions {
  /** Retained for shell-host signature parity; inert in the read-only console. */
  readonly canEdit: boolean
  /** Operator slug; seeds the shell sidebar brand label. */
  readonly appName?: string
  /** Operator config version (`app.version`); seeds the sidebar version chip. */
  readonly appVersion?: string
}

const text = (element: string, className: string, content: string): Component =>
  ({ type: 'text', element, props: { className }, content }) as unknown as Component

/** What this page is, and where the design system is actually authored. */
const header = (): Component =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-col gap-2' },
    children: [
      text('h1', 'text-foreground text-2xl font-semibold tracking-tight', 'Design system'),
      text(
        'p',
        'text-foreground-subtle max-w-2xl text-sm leading-relaxed',
        'Everything this app renders with: the tokens it declared, the ones it ' +
          'inherited, and the rules a writer follows here. Each panel is a live page ' +
          'from this instance, so it cannot go stale. Author all of it in the design ' +
          'block of your config.'
      ),
    ],
  }) as unknown as Component

/**
 * The share affordance's island host ([internal ref] amendment A3 Part 2).
 *
 * ─── WHY THE SSR SKELETON CARRIES NO BUTTON ─────────────────────────────────
 *
 * The mint control appears only once `design-system-share` is live. A button
 * rendered server-side would be clickable during the window before hydration,
 * and the click would go nowhere — the failure mode being an operator who
 * presses "Create share link", sees nothing happen, and presses it again. A
 * skeleton that is visibly not-yet-ready is the honest state.
 *
 * The skeleton is also, deliberately, prose and nothing else: no `<form>`, no
 * input, no button at all, so `[internal ref]`'s three absences hold
 * over this region in BOTH the pre- and post-hydration DOM rather than only
 * after React arrives.
 */
const sharePanel = (): Component =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className: 'flex flex-col gap-3',
      'data-island': 'design-system-share',
      'data-island-props': '{}',
      'data-testid': 'design-system-share',
    },
    children: [
      text('h2', 'text-foreground text-base font-semibold tracking-tight', 'Share link'),
      text('p', 'text-foreground-subtle max-w-2xl text-sm leading-relaxed', 'Loading…'),
    ],
  }) as unknown as Component

/**
 * One section panel: its heading, a way out to the full document, then the live
 * specimen in its own frame.
 *
 * ─── WHY EVERY PANEL CARRIES AN "OPEN FULL PAGE" LINK ───────────────────────
 *
 * Every panel is taller than any frame this page can afford. Measured against
 * `apps/partner` at a 1024px frame width: foundations is 2295px of content and
 * voice 2779px, so even a generous frame shows a quarter of them. The rest is
 * reachable only by scrolling INSIDE a nested document — an affordance with no
 * outward scrollbar hint, which captures the wheel and takes a click to focus
 * before a keyboard can move it. The link is the honest exit: the same page,
 * full height, in its own tab. Without it the truncation is a dead end.
 *
 * `loading="lazy"` because each panel is a FULL page render plus the app's whole
 * stylesheet, and an operator reads one section at a time, so the two they have
 * not scrolled to should not be paid for up front. The frame carries a `title`
 * so the document is announced rather than read out as an unlabelled frame.
 *
 * The frame height is a COMPROMISE, not a fit: 40rem clears the whole colour
 * grid in foundations and the whole principles block in voice, which is the
 * point at which each panel stops looking like it failed to render. Sizing to
 * content would make this page ~9000px and defeat the one-page console.
 */
const sectionPanel = (section: DesignSystemPreviewSection): Component =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className: 'flex flex-col gap-3',
      'data-testid': `design-system-section-${section}`,
    },
    children: [
      {
        type: 'container',
        element: 'div',
        props: { className: 'flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1' },
        children: [
          text(
            'h2',
            'text-foreground text-base font-semibold tracking-tight',
            DESIGN_SYSTEM_SECTION_TITLES[section]
          ),
          {
            type: 'link',
            props: {
              href: designSystemPreviewHref(section),
              target: '_blank',
              rel: 'noopener noreferrer',
              'data-testid': `design-system-open-${section}`,
              className: 'text-foreground-subtle hover:text-foreground text-sm underline',
            },
            content: 'Open full page',
          },
        ],
      },
      {
        type: 'iframe',
        props: {
          src: designSystemPreviewHref(section),
          title: `${DESIGN_SYSTEM_SECTION_TITLES[section]} preview`,
          loading: 'lazy',
          className: 'border-border h-[40rem] w-full rounded-lg border',
        },
      },
    ],
  }) as unknown as Component

/**
 * The catalog index: one LINK per published component-type category.
 *
 * ─── LINKS, NOT FRAMES, AND THE COST INVARIANT IS WHY ──────────────────────
 *
 * `[internal ref]` fixes the console's iframe count at the inline
 * section count, on the stated ground that N iframes is N full page renders.
 * The catalog is where that reason gets tested for real: embedding the
 * categories inline would make the console's cost scale with the CATALOGUE
 * rather than with what a reader opens. So the catalog is reached by link, and
 * `[internal ref]` asserts the frame count did not grow.
 *
 * ─── NO `target="_blank"`, UNLIKE THE PANELS' "OPEN FULL PAGE" LINKS ───────
 *
 * Those links escape a frame that truncates their content, so a new tab is the
 * right exit. A catalog category is not embedded anywhere and is a destination
 * in its own right; opening it in place keeps the back button meaningful.
 *
 * ─── ONLY IMPLEMENTED CATEGORIES ARE LISTED ────────────────────────────────
 *
 * The remaining categories are absent rather than linked-and-empty. A missing
 * catalog route answers 404 with a full, real-looking HTML page, so a
 * speculative link would not even look broken — it would just be wrong. And
 * `editors` is absent PERMANENTLY: see the registry for why that is a safety
 * property rather than a backlog item.
 */
const catalogIndex = (): Component =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className: 'flex flex-col gap-3',
      'data-testid': 'design-system-catalog',
    },
    children: [
      text('h2', 'text-foreground text-base font-semibold tracking-tight', 'Component catalog'),
      text(
        'p',
        'text-foreground-subtle max-w-2xl text-sm leading-relaxed',
        'Every component-type this instance ships, drawn by the renderer your ' +
          'own pages use, under your own theme. Open a category to see what a ' +
          'component actually looks like here before you write it into config.'
      ),
      {
        type: 'container',
        element: 'div',
        props: { className: 'flex flex-wrap gap-2' },
        children: CATALOG_COMPONENT_CATEGORIES.map(catalogCategoryLink),
      },
    ],
  }) as unknown as Component

/** One category's entry in the index. */
const catalogCategoryLink = (category: CatalogComponentCategory): Component =>
  ({
    type: 'link',
    props: {
      href: designSystemCatalogHref(category),
      'data-testid': `design-system-catalog-components-${category}`,
      className:
        'border-border text-foreground-subtle hover:text-foreground rounded-md border px-3 py-1.5 text-sm',
    },
    content: CATALOG_CATEGORY_TITLES[category],
  }) as unknown as Component

/**
 * The FIELD catalog's index, a sibling panel to the component one.
 *
 * Two panels rather than one list, because the two catalogues answer different
 * questions: a component-type is something an author writes into `pages`, a
 * field type is something they write into `tables`. Folding them together would
 * put `single-line-text` next to `data-table` under one heading and leave a
 * reader to work out which of the two config surfaces each belongs to.
 *
 * By LINK and not by frame, for the reason {@link catalogIndex} gives: N
 * iframes is N full page renders, and `[internal ref]` asserts the
 * console's frame count does not grow with the catalogue.
 */
const fieldCatalogIndex = (): Component =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className: 'flex flex-col gap-3',
      'data-testid': 'design-system-field-catalog',
    },
    children: [
      text('h2', 'text-foreground text-base font-semibold tracking-tight', 'Field catalog'),
      text(
        'p',
        'text-foreground-subtle max-w-2xl text-sm leading-relaxed',
        'Every field type this instance ships, drawn with the control your crud ' +
          'forms draw for it, under your own theme. A field type has no renderer ' +
          'of its own — three surfaces draw one for it, and each specimen says ' +
          'which of the three it is showing.'
      ),
      {
        type: 'container',
        element: 'div',
        props: { className: 'flex flex-wrap gap-2' },
        children: CATALOG_FIELD_CATEGORIES.map(fieldCatalogCategoryLink),
      },
    ],
  }) as unknown as Component

/** One field category's entry in the index. */
const fieldCatalogCategoryLink = (category: CatalogFieldCategory): Component =>
  ({
    type: 'link',
    props: {
      href: designSystemFieldCatalogHref(category),
      'data-testid': `design-system-catalog-fields-${category}`,
      className:
        'border-border text-foreground-subtle hover:text-foreground rounded-md border px-3 py-1.5 text-sm',
    },
    content: CATALOG_FIELD_CATEGORY_TITLES[category],
  }) as unknown as Component

/**
 * Build the Design System console page, wrapped in the persistent console shell.
 *
 * @param title - the page meta title
 * @param options - shell concerns (breadcrumb, sidebar brand)
 */
export function buildDesignSystemPage(title: string, options: DesignSystemSurfaceOptions): Page {
  const { canEdit, appName, appVersion } = options
  const body = {
    type: 'container',
    element: 'div',
    props: { className: 'flex max-w-5xl flex-col gap-8' },
    children: [
      header(),
      sharePanel(),
      catalogIndex(),
      fieldCatalogIndex(),
      ...DESIGN_SYSTEM_PREVIEW_SECTIONS.map(sectionPanel),
    ],
  } as unknown as Component

  return {
    id: 'dashboard-design-system',
    name: 'dashboard-design-system',
    path: DESIGN_SYSTEM_CONSOLE_PATH,
    meta: { title },
    components: wrapInShell([body], {
      canEdit,
      appName,
      appVersion,
      breadcrumb: [homeCrumb(appName), { label: 'Design system' }],
    }),
  } as Page
}
