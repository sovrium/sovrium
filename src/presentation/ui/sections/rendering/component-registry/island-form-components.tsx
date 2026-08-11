/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { renderToStaticMarkup } from 'react-dom/server'
import {
  resolveTranslationPattern,
  resolveTranslationTokensDeep,
} from '@/domain/utils/translation-resolver'
import { cn } from '@/presentation/utils/design/class-merge'
import { NavChevronDown, NavItemBadge } from '@/presentation/utils/recipes/nav-menu-parts'
import {
  computeNavMenuTriggerClasses,
  type BadgeVariant,
} from '@/presentation/utils/recipes/navbar-default-classes'
import { renderSsrSelectOptions } from '@/presentation/utils/recipes/select-ssr-options'
import type { ComponentRenderer, DispatchableComponentType } from '../component-dispatch-config'
import type { Languages } from '@/domain/models/app/languages'
import type { ReactElement } from 'react'

/** Nav item badge shape (mirrors `NavItemSchema.badge`). */
type SsrNavBadge = { readonly text: string; readonly variant?: BadgeVariant }

/** The nav-item fields the navigation-menu SSR placeholder renders. */
type SsrNavItem = {
  readonly label: string
  readonly href?: string
  readonly target?: '_self' | '_blank' | '_parent' | '_top'
  readonly rel?: string
  readonly badge?: SsrNavBadge
  readonly children?: readonly unknown[]
}

/**
 * Render a single navigation-menu item in the SSR placeholder with the SAME
 * trigger chrome the hydrated island uses (`computeNavMenuTriggerClasses` +
 * shared chevron + shared badge pill). Rendering the SSR trigger identically to
 * the island is what keeps the trigger box fixed across hydration, so the header
 * row does not reflow; the badge appears as a real pill text
 * node pre-hydration.
 */
function renderSsrNavItem(
  item: SsrNavItem,
  index: number,
  triggerClassName?: string
): ReactElement {
  const badge = item.badge ? (
    <NavItemBadge
      text={item.badge.text}
      variant={item.badge.variant}
    />
  ) : undefined
  // Item WITH children → the mega-menu trigger (button + chevron), mirroring the
  // hydrated `Menu.Trigger`. Item WITHOUT children → a plain link, mirroring the
  // hydrated `<a>` branch. Both carry the identical trigger chrome — including any
  // authored `triggerClassName` override — so the SSR placeholder and hydrated
  // island emit a byte-identical class list and the header does not reflow
  //; the recipe's `group` marker drives the chevron rotation.
  return item.children && item.children.length > 0 ? (
    <button
      key={index}
      type="button"
      className={computeNavMenuTriggerClasses(triggerClassName)}
    >
      {item.label}
      {badge}
      <NavChevronDown />
    </button>
  ) : (
    <a
      key={index}
      href={item.href}
      target={item.target}
      rel={item.rel}
      className={computeNavMenuTriggerClasses(triggerClassName)}
    >
      {item.label}
      {badge}
    </a>
  )
}

type RawProps = Record<string, unknown> | undefined
type ElemProps = Record<string, unknown>

/** Extract common island props (className, id, data-testid) shared by all islands */
function baseProps(elementProps: ElemProps) {
  return {
    className: elementProps.className,
    id: elementProps.id,
    'data-testid': elementProps['data-testid'],
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
function pickFromComponent(c: Record<string, unknown>, rawProps: RawProps, key: string): unknown {
  return c[key] ?? rawProps?.[key]
}

/** Convenience: coerce `component` to the unknown record shape `pickFromComponent` expects. */
function asRecord(component?: unknown): Record<string, unknown> {
  return (component ?? {}) as Record<string, unknown>
}

function buildSelectProps(rawProps: RawProps, elementProps: ElemProps, component?: unknown) {
  const c = asRecord(component)
  return {
    options: pickFromComponent(c, rawProps, 'options'),
    placeholder: rawProps?.placeholder,
    multiple: pickFromComponent(c, rawProps, 'multiple'),
    searchable: pickFromComponent(c, rawProps, 'searchable'),
    // `searchPlaceholder` overrides the generic `placeholder` inside the
    // combobox search input. `allowCustomValue` opts the combobox into
    // free-form input (typed values not in the option list are accepted).
    searchPlaceholder: pickFromComponent(c, rawProps, 'searchPlaceholder'),
    allowCustomValue: pickFromComponent(c, rawProps, 'allowCustomValue'),
    defaultValue: pickFromComponent(c, rawProps, 'defaultValue'),
    disabled: rawProps?.disabled,
    label: rawProps?.label ?? rawProps?.fieldLabel,
    ...baseProps(elementProps),
  }
}

function buildCheckboxProps(rawProps: RawProps, elementProps: ElemProps, component?: unknown) {
  const c = asRecord(component)
  return {
    checked: pickFromComponent(c, rawProps, 'checked'),
    indeterminate: pickFromComponent(c, rawProps, 'indeterminate'),
    disabled: rawProps?.disabled,
    label: rawProps?.label ?? rawProps?.content,
    name: rawProps?.name,
    ...baseProps(elementProps),
  }
}

/**
 * Resolve a CHILD component's caption through the active language.
 *
 * **Why this is needed at all.** `substitutePropsTranslationTokens` runs over the
 * props of the component currently being rendered (see `component-builder.ts`) —
 * and the `tabs` / `accordion` renderers do not read their children's rendered
 * output, they read the RAW child objects off `component.children` to build the
 * island's `items`. So both caption placements arrive unresolved:
 *
 *  - `content.label` / `content.title` — `content` is a top-level field, and
 *    `$t:` substitution never touches top-level fields;
 *  - `props.label` — substitution DOES reach it, but the substituted copy is on
 *    the rendered element the extractor throws away.
 *
 * The second one is the trap: it is the placement that looks like it must work.
 * Without this, a `$t:apps.crm.name` caption is painted on the tab verbatim and
 * a tabbed hero is unusable for any app with more than one locale.
 *
 * Mirrors the same `resolveTranslationPattern` call the auth-form and crud-form
 * renderers make for their own built-in labels.
 */
function localizeChildLabel(
  text: string,
  currentLang: string | undefined,
  languages: Languages | undefined
): string {
  if (text.length === 0) return text
  return resolveTranslationPattern(text, currentLang ?? languages?.default ?? '', languages)
}

/**
 * Slug source for a caption-derived id.
 *
 * A `$t:` caption is slugified from its translation KEY, not from the resolved
 * text: an id derived from the caption would be `projects` in English and
 * `projets` in French, so a `defaultTab` / `defaultOpen` referencing it could
 * only ever match in one locale — and would silently match NOTHING in the other,
 * leaving the container with no active panel. The key is locale-invariant, which
 * is exactly the property an id needs.
 */
function idSourceForLabel(label: string): string {
  return label.startsWith('$t:') ? label.slice(3) : label
}

/** Slugify a caption (or translation key) into a stable element id. */
function slugifyLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Map an accordion component's `children` array to the `items` shape consumed
 * by AccordionIsland. Each child is expected to be a `container` with `props.id`
 * and `content.{title, body}`. Children with missing or empty `id` are skipped.
 *
 * `title` is localized here for the same reason tab labels are — see
 * {@link localizeChildLabel}. The accordion header is a caption read by a human,
 * so an unresolved `$t:` reference is visible misinformation, not a silent no-op.
 */
function buildAccordionItems(
  rawChildren: unknown,
  currentLang: string | undefined,
  languages: Languages | undefined
): ReadonlyArray<{
  readonly id: string
  readonly title: string
  readonly content: string
}> {
  const children = (Array.isArray(rawChildren) ? rawChildren : []) as ReadonlyArray<{
    readonly type?: string
    readonly props?: { readonly id?: string }
    readonly content?: { readonly title?: string; readonly body?: string } | string
  }>
  return children
    .map((child) => {
      const itemContent = typeof child.content === 'object' ? child.content : undefined
      return {
        id: child.props?.id ?? '',
        title: localizeChildLabel(itemContent?.title ?? '', currentLang, languages),
        content: itemContent?.body ?? '',
      }
    })
    .filter((item) => item.id !== '')
}

/**
 * Map a tabs component's `children` array to the `items` shape consumed by
 * TabsIsland. Each child is expected to be a `tab-panel` with either:
 *  - `props.id` + `content.{label, body}` (canonical legacy form), OR
 *  - `props.label` (PG-04 record-detail composition form) — the label
 *    doubles as the tab's accessible name; `id` is derived from a slug of
 *    the label so the Base UI Tabs primitive still has a stable value to
 *    correlate triggers and panels.
 *
 * PG-04: when a tab-panel
 * declares its content as child React components (form, data-table) rather
 * than the legacy `content.body` string, the pre-rendered SSR HTML for those
 * children is passed in via `renderedChildren[index]`. The index-aligned
 * pre-rendered React element is converted to a static HTML string via
 * `renderToStaticMarkup` and injected into the panel via the island's
 * `dangerouslySetInnerHTML` so the embedded form/data-table SSR skeleton is
 * visible inside the active tab. Any client-side island markers inside (e.g.
 * `data-island="crud-form"`) need separate post-hydration mounting — see
 * tabs-island.tsx mount-effect.
 *
 * Children that resolve to an empty id AND empty label AND no content are
 * skipped so the island only renders well-formed tabs.
 */
/**
 * Derive a human tab label from a panel `id` (`'automations'` → `'Automations'`,
 * `'open-invoices'` → `'Open Invoices'`).
 *
 * Used only when a panel declares neither `content.label` nor `props.label` — the
 * third authoring shape, where the panel's whole body is child components and the
 * author never wrote a caption. That shape previously produced a tab trigger with
 * NO accessible name at all: unusable for a screen reader, unaddressable by
 * `getByRole('tab', { name })`, and indistinguishable from its siblings. The `id`
 * is the only naming information such a panel carries, so it becomes the name.
 * This is the inverse of the `label → id` slug fallback just below.
 */
function labelFromPanelId(id: string): string {
  return id
    .split(/[-_\s]+/)
    .filter((word) => word.length > 0)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
function buildTabsItems(
  rawChildren: unknown,
  renderedChildren: readonly ReactElement[],
  currentLang: string | undefined,
  languages: Languages | undefined
): ReadonlyArray<{
  readonly id: string
  readonly label: string
  readonly content: string
  readonly disabled?: boolean
  readonly description?: string
}> {
  const children = (Array.isArray(rawChildren) ? rawChildren : []) as ReadonlyArray<{
    readonly type?: string
    readonly props?: {
      readonly id?: string
      readonly label?: string
      readonly description?: string
      readonly disabled?: boolean
    }
    readonly content?:
      { readonly label?: string; readonly description?: string; readonly body?: string } | string
    readonly children?: readonly unknown[]
  }>
  return children
    .map((child, index) => ({ child, index }))
    .filter(({ child }) => child?.type === 'tab-panel')
    .map(({ child, index }) => {
      const tabContent = typeof child.content === 'object' ? child.content : undefined
      const authoredLabel = tabContent?.label ?? child.props?.label ?? ''
      // The id is derived from the AUTHORED label (its translation key, for a
      // `$t:` caption) so it never moves with the active locale.
      const id = child.props?.id ?? slugifyLabel(idSourceForLabel(authoredLabel))
      const resolvedLabel = localizeChildLabel(authoredLabel, currentLang, languages)
      // A tab with no name is not a tab anyone can use — fall back to the id.
      const label = resolvedLabel.length > 0 ? resolvedLabel : labelFromPanelId(id)
      // The optional second line on the trigger, read from EITHER placement —
      // `content.description` or `props.description` — exactly as `label`
      // already is, and localized the same way, so a `$t:`
      // reference resolves in a subtitle as it does in a caption. Left
      // `undefined` when absent so an undescribed trigger renders exactly the
      // markup it always did.
      const authoredDescription = tabContent?.description ?? child.props?.description
      const resolvedDescription =
        authoredDescription === undefined
          ? undefined
          : localizeChildLabel(authoredDescription, currentLang, languages)
      // Prefer the body string if author supplied one; otherwise fall back to
      // the SSR HTML of the pre-rendered tab-panel children (PG-04 record-
      // detail composition form, data-table embedded inside tabs).
      const stringBody = tabContent?.body
      const childRendered = renderedChildren[index]
      const renderedBody =
        stringBody !== undefined
          ? stringBody
          : childRendered
            ? renderToStaticMarkup(childRendered)
            : ''
      return {
        id,
        label,
        content: renderedBody,
        disabled: child.props?.disabled,
        description: resolvedDescription,
      }
    })
    .filter((item) => item.id !== '' || item.label !== '' || item.content !== '')
}

/**
 * Resolve the HTML the tabs SSR placeholder should render for the INITIALLY
 * ACTIVE panel.
 *
 * Until this existed the placeholder was pulse skeletons only, and every
 * tab-panel's real content reached the response escaped inside
 * `data-island-props` — where no crawler and no SSR-built search index will ever
 * read it as text. A tabbed hero therefore said nothing at all to a visitor
 * without JavaScript. Rendering the default panel's body server-side makes the
 * page's primary message real markup again; the tabs island's `createRoot`
 * replaces it on its first client render, so there is no hydration mismatch.
 *
 * Returns `undefined` — keeping today's skeleton — in two cases:
 *  - the panel has no body to show; or
 *  - the body carries a `data-island` marker. Such a panel holds its own nested
 *    island (a `crud-form`, a `data-table`); server-rendering it would let the
 *    island client discover and mount that nested island, which the tabs island
 *    then immediately wipes on its own first render. Those panels are
 *    interactive compositions that need hydration to mean anything, so a
 *    skeleton is the honest representation.
 */
function resolveDefaultPanelSsrHtml(
  items: ReadonlyArray<{ readonly id: string; readonly content: string }>,
  defaultTab: string | undefined
): string | undefined {
  const active = items.find((item) => item.id === defaultTab) ?? items[0]
  if (active === undefined || active.content.length === 0) return undefined
  if (active.content.includes('data-island')) return undefined
  return active.content
}

interface TabsSsrItem {
  readonly id: string
  readonly label: string
  readonly description?: string
}

/**
 * The split layout for the tabs SSR wrapper — the pre-hydration twin of
 * `computeTabsRootClasses` in
 * `src/presentation/islands/disclosure/disclosure-default-classes.ts`.
 *
 * Duplicated as a literal rather than imported because the layer boundary
 * forbids `presentation-component → presentation-island`, and the two strings
 * MUST stay byte-identical: they are applied to the same depth in the same
 * container, one before hydration and one after, and any divergence is a
 * visible repaint the moment the island mounts.
 *
 * A horizontal tab set gets no layout in either state — the strip already sits
 * above the panel in normal block flow — so this returns `undefined` and the
 * wrapper carries nothing but the author's own `className`.
 */
function computeSsrTabsRootClasses(orientation: 'horizontal' | 'vertical'): string | undefined {
  return orientation === 'vertical'
    ? 'grid grid-cols-1 gap-6 md:grid-cols-[18rem_minmax(0,1fr)] md:items-start'
    : undefined
}

/**
 * Trigger strip for the tabs SSR placeholder.
 *
 * Mirrors the hydrated island's LAYOUT so the page does not jump when the
 * island mounts: a vertical tab set stacks its trigger rail above the panel on
 * a phone and moves it beside the panel from `md` up, exactly as the recipe
 * does, and a described trigger already shows both of its lines.
 *
 * Labels are real text, not skeleton bars — they are the band of the page a
 * crawler reads first. They are plain `<span>`s and NOT `role="tab"`, so
 * `getByRole('tab', …)` only ever resolves to the hydrated island's triggers
 * and never transiently matches two elements during the mount window. The
 * description spans deliberately carry no `id`: `aria-describedby` wiring is
 * the hydrated trigger's job, and a duplicate id during the mount window would
 * make the association ambiguous.
 */
function renderTabsSsrTriggerStrip(
  items: readonly TabsSsrItem[],
  orientation: 'horizontal' | 'vertical'
): ReactElement {
  const triggers =
    items.length > 0 ? (
      items.map((item) => (
        <span
          key={item.id}
          className="px-1 py-2 text-sm font-medium"
        >
          {item.description !== undefined && item.description.length > 0 ? (
            <>
              <span className="block">{item.label}</span>
              <span className="text-foreground-muted mt-0.5 block text-xs font-normal">
                {item.description}
              </span>
            </>
          ) : (
            item.label
          )}
        </span>
      ))
    ) : (
      <>
        <div className="bg-background-subtle h-8 w-20 animate-pulse rounded" />
        <div className="bg-background-subtle h-8 w-20 animate-pulse rounded" />
        <div className="bg-background-subtle h-8 w-20 animate-pulse rounded" />
      </>
    )

  if (orientation === 'vertical') {
    // No width here: the rail's width is the wrapper's FIRST grid track, exactly
    // as `computeTabsListClasses({ orientation: 'vertical' })` leaves it to
    // `computeTabsRootClasses`. A `md:w-72` in this one place would survive an
    // author who re-proportioned the track and would move the rail's edge on
    // hydration.
    return (
      <div className="border-border flex flex-col gap-1 border-b px-4 py-2 md:border-r md:border-b-0">
        {triggers}
      </div>
    )
  }
  return (
    <div className="border-border border-b">
      <div className="flex gap-4 px-4">{triggers}</div>
    </div>
  )
}

/** Form, navigation, and interactive island components */
export const islandFormComponents: Partial<Record<DispatchableComponentType, ComponentRenderer>> = {
  select: ({ rawProps, elementProps, component }) => {
    const selectProps = buildSelectProps(rawProps, elementProps, component)
    return (
      <div
        id={elementProps.id as string | undefined}
        data-island="select"
        data-island-props={JSON.stringify(selectProps)}
        data-testid={elementProps['data-testid'] as string | undefined}
      >
        {/*
         * SSR placeholder. The hydrated trigger lives in `plain-select.tsx` /
         * `searchable-select.tsx` and is styled via the [internal ref] var-fallback
         * recipe in `select-default-classes.ts`. This skeleton uses the
         * theme-layer-emitted utility tokens so it renders correctly during
         * the brief pre-hydration window — it can't import the islands-layer
         * recipe per the layer boundary rules (presentation-component cannot
         * import presentation-island).
         */}
        <select
          className="border-border bg-background-raised text-foreground w-full rounded-md border px-3 py-2 text-sm shadow-sm"
          defaultValue={selectProps.defaultValue as string | undefined}
          disabled
        >
          {renderSsrSelectOptions(selectProps.options, rawProps?.placeholder as string | undefined)}
        </select>
      </div>
    )
  },

  accordion: ({ component, elementProps, currentLang, languages }) => {
    // `accordionType`, `defaultOpen`, and `children` are top-level schema
    // properties (siblings of `props`), not inside `props`, so read from
    // `component` directly — same pattern as the tabs renderer.
    const c = asRecord(component)
    const props = {
      items: buildAccordionItems(c['children'], currentLang, languages),
      accordionType: (c['accordionType'] as 'single' | 'multiple' | undefined) ?? 'single',
      defaultOpen: c['defaultOpen'] as readonly string[] | undefined,
      ...baseProps(elementProps),
    }
    return (
      <div
        data-island="accordion"
        data-island-props={JSON.stringify(props)}
        data-testid={elementProps['data-testid'] as string | undefined}
      >
        <div className="divide-border border-border divide-y rounded-lg border">
          <div className="px-4 py-3">
            <div className="bg-background-subtle h-5 w-48 animate-pulse rounded" />
          </div>
          <div className="px-4 py-3">
            <div className="bg-background-subtle h-5 w-40 animate-pulse rounded" />
          </div>
        </div>
      </div>
    )
  },

  tabs: ({ component, elementProps, renderedChildren, currentLang, languages }) => {
    // The tabs schema places `tabsOrientation` and `defaultTab` at the top
    // level (siblings of `props`/`children`), not inside `props`, so we read
    // them from `component` rather than `rawProps`. Items are derived from
    // `children` — each `tab-panel` contributes one tab..
    //
    // PG-04 (PATTERN-REGRESSION): `renderedChildren` carries the pre-rendered
    // SSR ReactElements for each tab-panel — `buildTabsItems` falls back to
    // their static HTML when an author uses the React-child form (form,
    // data-table inside a panel) rather than a `content.body` string.
    const c = asRecord(component)
    const items = buildTabsItems(c['children'], renderedChildren, currentLang, languages)
    const defaultTab = c['defaultTab'] as string | undefined
    const defaultPanelHtml = resolveDefaultPanelSsrHtml(items, defaultTab)
    const tabsOrientation =
      (c['tabsOrientation'] as 'horizontal' | 'vertical' | undefined) ?? 'horizontal'
    const islandProps = {
      items,
      defaultTab,
      tabsOrientation,
      // Thread the author's `props['aria-label']` onto the `<Tabs.List>` so the
      // rendered `role="tablist"` carries an accessible name (e.g. the admin
      // dashboard's per-domain "Onglets du domaine" tab bar).
      ariaLabel: elementProps['aria-label'] as string | undefined,
      ...baseProps(elementProps),
    }
    return (
      // The `data-island` host is deliberately LAYOUT-NEUTRAL, and that is the
      // whole fix behind [internal ref]. The island mounts `Tabs.Root`
      // as this element's single child carrying the same split classes from
      // `computeTabsRootClasses`, so when the host carried them too the real
      // tab set became a non-growing item of a clone of its own layout and
      // shrink-fit to its content — ~950px of a 1400px container handed back,
      // straight out of the column the config sample is read in.
      //
      // The layout lives on ONE element in each state instead: the wrapper
      // below before hydration, `Tabs.Root` after — the element the wrapper is
      // replaced by, at the same depth, with the same classes.
      <div
        data-island="tabs"
        data-island-props={JSON.stringify(islandProps)}
        data-testid={elementProps['data-testid'] as string | undefined}
      >
        <div
          // Same `cn(defaults, author className)` as the island's root, for the
          // same reason: an author cap or a re-proportioned grid track that
          // applied only after hydration is a layout jump they never asked for
          // and cannot see in a screenshot.
          className={
            cn(
              computeSsrTabsRootClasses(tabsOrientation),
              elementProps.className as string | undefined
            ) || undefined
          }
        >
          {renderTabsSsrTriggerStrip(items, tabsOrientation)}
          <div className={tabsOrientation === 'vertical' ? 'min-w-0 p-4' : 'p-4'}>
            {defaultPanelHtml !== undefined ? (
              <div
                data-tab-panel-ssr="true"
                // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- SSR-only HTML passthrough; one-shot during server render
                dangerouslySetInnerHTML={{ __html: defaultPanelHtml }}
              />
            ) : (
              <div className="bg-background-subtle h-24 animate-pulse rounded" />
            )}
          </div>
        </div>
      </div>
    )
  },

  checkbox: ({ rawProps, elementProps, component }) => {
    const checkboxProps = buildCheckboxProps(rawProps, elementProps, component)
    return (
      <div
        data-island="checkbox"
        data-island-props={JSON.stringify(checkboxProps)}
        data-testid={elementProps['data-testid'] as string | undefined}
      >
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            defaultChecked={checkboxProps.checked as boolean | undefined}
            disabled
          />
          <span className="text-sm">{(rawProps?.content as string) ?? ''}</span>
        </label>
      </div>
    )
  },

  'radio-group': ({ rawProps, elementProps, component }) => {
    // `options`, `defaultValue`, `orientation` live at the component top level
    // (siblings of `props`) per the radio-group schema. See pickFromComponent
    // doc-comment for the full lookup contract.
    const c = asRecord(component)
    const props = {
      options: pickFromComponent(c, rawProps, 'options'),
      defaultValue: pickFromComponent(c, rawProps, 'defaultValue'),
      orientation: pickFromComponent(c, rawProps, 'orientation'),
      disabled: rawProps?.disabled,
      name: rawProps?.name,
      label: rawProps?.label ?? rawProps?.fieldLabel,
      ...baseProps(elementProps),
    }
    return (
      <div
        data-island="radio-group"
        data-island-props={JSON.stringify(props)}
        data-testid={elementProps['data-testid'] as string | undefined}
      >
        <fieldset className="flex flex-col gap-2">
          <div className="bg-background-subtle h-5 w-32 animate-pulse rounded" />
          <div className="bg-background-subtle h-5 w-28 animate-pulse rounded" />
        </fieldset>
      </div>
    )
  },

  switch: ({ rawProps, elementProps, component }) => {
    // `checked` and `size` are top-level schema fields per switch.ts.
    const c = asRecord(component)
    const props = {
      checked: pickFromComponent(c, rawProps, 'checked'),
      disabled: rawProps?.disabled,
      size: pickFromComponent(c, rawProps, 'size'),
      label: rawProps?.label ?? rawProps?.content,
      name: rawProps?.name,
      ...baseProps(elementProps),
    }
    return (
      <div
        data-island="switch"
        data-island-props={JSON.stringify(props)}
        data-testid={elementProps['data-testid'] as string | undefined}
      >
        <label className="inline-flex items-center gap-2">
          <div className="bg-background-subtle h-5 w-9 animate-pulse rounded-full" />
          <span className="text-sm">{(rawProps?.content as string) ?? ''}</span>
        </label>
      </div>
    )
  },

  slider: ({ rawProps, elementProps, component }) => {
    // `min`, `max`, `step`, `defaultValue`, `showValue` are all top-level
    // schema fields per slider.ts.
    const c = asRecord(component)
    const props = {
      min: pickFromComponent(c, rawProps, 'min'),
      max: pickFromComponent(c, rawProps, 'max'),
      step: pickFromComponent(c, rawProps, 'step'),
      defaultValue: pickFromComponent(c, rawProps, 'defaultValue'),
      showValue: pickFromComponent(c, rawProps, 'showValue'),
      disabled: rawProps?.disabled,
      label: rawProps?.label ?? rawProps?.fieldLabel,
      ...baseProps(elementProps),
    }
    return (
      <div
        data-island="slider"
        data-island-props={JSON.stringify(props)}
        data-testid={elementProps['data-testid'] as string | undefined}
      >
        <div className="bg-background-subtle h-1.5 w-full rounded-full">
          <div className="bg-primary h-full w-1/2 rounded-full" />
        </div>
      </div>
    )
  },

  toggle: ({ rawProps, elementProps, component }) => {
    // `pressed`, `toggleType`, `size`, `variant` are top-level schema fields
    // per toggle.ts.
    const c = asRecord(component)
    const props = {
      pressed: pickFromComponent(c, rawProps, 'pressed'),
      disabled: rawProps?.disabled,
      variant: pickFromComponent(c, rawProps, 'variant'),
      size: pickFromComponent(c, rawProps, 'size'),
      label: rawProps?.content,
      ...baseProps(elementProps),
    }
    return (
      <div
        data-island="toggle"
        data-island-props={JSON.stringify(props)}
        data-testid={elementProps['data-testid'] as string | undefined}
      >
        <button
          type="button"
          disabled
          className="bg-background-subtle text-foreground rounded-md px-3 py-2 text-sm"
        >
          {(rawProps?.content as string) ?? 'Toggle'}
        </button>
      </div>
    )
  },

  'toggle-group': ({ rawProps, elementProps, component }) => {
    // `options`, `toggleType`, `orientation`, `size`, `defaultValue` are
    // top-level schema fields per toggle-group.ts. The island consumes
    // `{ id, label }` items so we normalize the platform `OptionsSchema`
    // (`{ label, value }`) into the island shape here; raw `items` is
    // accepted for back-compat when a caller flattens its own item array
    // directly into rawProps.
    const c = asRecord(component)
    const rawOptions = pickFromComponent(c, rawProps, 'options') ?? rawProps?.items
    const items = Array.isArray(rawOptions)
      ? rawOptions.map((option) => {
          const o = option as Record<string, unknown>
          return {
            id: (o.value ?? o.id ?? '') as string,
            label: (o.label ?? o.value ?? o.id ?? '') as string,
            disabled: o.disabled as boolean | undefined,
          }
        })
      : undefined
    const props = {
      items,
      toggleType: pickFromComponent(c, rawProps, 'toggleType'),
      orientation: pickFromComponent(c, rawProps, 'orientation'),
      size: pickFromComponent(c, rawProps, 'size'),
      defaultValue: pickFromComponent(c, rawProps, 'defaultValue'),
      ...baseProps(elementProps),
    }
    return (
      <div
        data-island="toggle-group"
        data-island-props={JSON.stringify(props)}
        data-testid={elementProps['data-testid'] as string | undefined}
      >
        <div className="border-border inline-flex rounded-md border">
          <div className="bg-background-subtle h-9 w-16 animate-pulse" />
          <div className="bg-background-subtle h-9 w-16 animate-pulse" />
        </div>
      </div>
    )
  },

  menubar: ({ rawProps, elementProps }) => {
    const props = { menus: rawProps?.menus, ...baseProps(elementProps) }
    return (
      <div
        data-island="menubar"
        data-island-props={JSON.stringify(props)}
        data-testid={elementProps['data-testid'] as string | undefined}
      >
        <div
          role="menubar"
          className="border-border flex rounded-md border"
        >
          <div className="bg-background-subtle h-8 w-16 animate-pulse rounded" />
          <div className="bg-background-subtle h-8 w-16 animate-pulse rounded" />
        </div>
      </div>
    )
  },

  'navigation-menu': ({
    rawProps,
    elementProps,
    renderedChildren,
    component,
    languages,
    currentLang,
  }) => {
    const navMenuComp = component?.type === 'navigation-menu' ? component : undefined
    const rawNavItems =
      (navMenuComp && Array.isArray(navMenuComp.navItems)
        ? (navMenuComp.navItems as readonly SsrNavItem[])
        : undefined) ?? (rawProps?.navItems as readonly SsrNavItem[] | undefined)
    // [internal ref] (round-4): `openOnHover` + `triggerClassName` are top-level schema
    // fields (siblings of `navItems`). Serialize them into the island props so the
    // hydrated NavMenuIsland opens on hover and applies the
    // authored trigger override. `triggerClassName` is ALSO
    // applied to the SSR placeholder trigger below so the two class lists match.
    const openOnHover = navMenuComp?.openOnHover
    const triggerClassName = navMenuComp?.triggerClassName
    // Schema-level navItems can carry `$t:` tokens in label/description/href
    //; resolve them against the active language BEFORE
    // serialization so both the SSR fallback and the hydrated island show the
    // translated strings.
    const navItems = resolveTranslationTokensDeep(rawNavItems, currentLang, languages) as
      readonly SsrNavItem[] | undefined
    const props = { navItems, openOnHover, triggerClassName, ...baseProps(elementProps) }
    // Respect className from schema props; default to horizontal flex when not provided.
    const userClassName = elementProps['className'] as string | undefined
    const navClassName = userClassName
      ? `flex items-center gap-1 ${userClassName}`
      : 'flex items-center gap-1'
    // Landmark discipline: the mega-menu (`navItems`) form
    // renders a `div` wrapper — menus carry their own roles, and the standard
    // header composition embeds this component inside an authored `<nav>`,
    // which must stay the page's ONLY navigation landmark. The legacy
    // children-based form keeps its `<nav>` element (page-direct standalone
    // usage relies on the landmark, e.g. `nav a` selectors in the
    // responsive-override specs).
    const Wrapper = navItems !== undefined ? 'div' : 'nav'
    return (
      <Wrapper
        data-island="navigation-menu"
        data-island-props={JSON.stringify(props)}
        data-testid={elementProps['data-testid'] as string | undefined}
        aria-label={elementProps['aria-label'] as string | undefined}
        className={navClassName}
      >
        {renderedChildren.length > 0 ? (
          renderedChildren
        ) : navItems && navItems.length > 0 ? (
          navItems.map((item, index) => renderSsrNavItem(item, index, triggerClassName))
        ) : (
          <div className="bg-background-subtle h-8 w-60 animate-pulse rounded" />
        )}
      </Wrapper>
    )
  },

  'scroll-area': ({ rawProps, elementProps, component, renderedChildren }) => {
    const c = asRecord(component)
    const scrollAreaHeight = pickFromComponent(c, rawProps, 'scrollAreaHeight') as
      string | undefined
    const scrollOrientation = pickFromComponent(c, rawProps, 'scrollOrientation') as
      'vertical' | 'horizontal' | 'both' | undefined
    const childrenHtml = renderedChildren.map((child) => renderToStaticMarkup(child)).join('')
    const props = {
      scrollAreaHeight,
      scrollOrientation,
      childrenHtml,
      ...baseProps(elementProps),
    }
    return (
      <div
        data-island="scroll-area"
        data-island-props={JSON.stringify(props)}
        data-testid={elementProps['data-testid'] as string | undefined}
        // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- SSR placeholder; one-shot during server render before island hydration
        style={{ maxHeight: scrollAreaHeight ?? '400px', overflow: 'auto' }}
        id={elementProps.id as string | undefined}
        className={elementProps.className as string | undefined}
        // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- SSR-only HTML passthrough; one-shot during server render
        dangerouslySetInnerHTML={{ __html: childrenHtml }}
      />
    )
  },
}
