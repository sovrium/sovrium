/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { renderToStaticMarkup } from 'react-dom/server'
import { resolveTranslationTokensDeep } from '@/domain/models/app/languages/translation-resolver'
import { resolveClasses } from '@/presentation/design/resolve-classes'
import {
  computeTabsFillPanelClasses,
  computeTabsFillShellClasses,
  type TabsLayout,
} from '@/presentation/design/tabs-fill-default-classes'
import { hostComponentType } from '@/presentation/render/registry/island-host-attributes'
import { LAZY_PANEL_PARAM_KEY } from '@/presentation/render/resolve/tabs-lazy-resolver'
import { buildAccordionItems } from './island-accordion-items'
import { asRecord, baseProps, controlLabel, pickFromComponent } from './island-form-props'
import { renderSsrNavItem } from './island-nav-ssr'
import {
  buildTabsItems,
  computeSsrTabsRootClasses,
  renderTabsSsrTriggerStrip,
  resolveAddressedPanel,
  stripAddressedPanelContent,
} from './island-tabs-ssr'
import { recordPickerComponent } from './record-picker-component'
import { selectComponent } from './select-component'
import type { ComponentRenderer, DispatchableComponentType } from './component-dispatch-config'
import type { ElemProps, RawProps } from './island-form-props'
import type { SsrNavItem } from './island-nav-ssr'

function buildCheckboxProps(rawProps: RawProps, elementProps: ElemProps, component?: unknown) {
  const c = asRecord(component)
  return {
    checked: pickFromComponent(c, rawProps, 'checked'),
    indeterminate: pickFromComponent(c, rawProps, 'indeterminate'),
    disabled: rawProps?.disabled,
    label: controlLabel(rawProps),
    name: rawProps?.name,
    ...baseProps(elementProps),
  }
}

/** Form, navigation, and interactive island components */
export const islandFormComponents: Partial<Record<DispatchableComponentType, ComponentRenderer>> = {
  'record-picker': recordPickerComponent,
  select: selectComponent,
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
        data-component-type={hostComponentType(elementProps)}
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

  tabs: ({ component, elementProps, renderedChildren, currentLang, languages, designStyles }) => {
    // The tabs schema places `tabsOrientation` and `defaultTab` at the top
    // level (siblings of `props`/`children`), not inside `props`, so we read
    // them from `component` rather than `rawProps`. Items are derived from
    // `children` — each `tab-panel` contributes one tab.
    //
    // PG-04 (PATTERN-REGRESSION): `renderedChildren` carries the pre-rendered
    // SSR ReactElements for each tab-panel — `buildTabsItems` falls back to
    // their static HTML when an author uses the React-child form (form,
    // data-table inside a panel) rather than a `content.body` string.
    const c = asRecord(component)
    const items = buildTabsItems(c['panels'], renderedChildren, currentLang, languages)
    const defaultTab = c['defaultTab'] as string | undefined
    const addressed = resolveAddressedPanel(items, defaultTab)
    const tabsOrientation =
      (c['tabsOrientation'] as 'horizontal' | 'vertical' | undefined) ?? 'horizontal'
    // `layout` sits at the top level beside `tabsOrientation` and `defaultTab`,
    // so it is read off `component` for the same reason they are — and it has to
    // reach `islandProps` EXPLICITLY, because these props are assembled key by
    // key: a key that merely decodes never crosses to the hydrated half, and the
    // tab set reverts to a flowing one the moment the chunk lands.
    const layout = c['layout'] as TabsLayout | undefined
    // The DECLARED `page.query` property this tab set's `defaultTab` binds to,
    // attached by `resolveTabsLazyPanels` before that binding was substituted
    // away. Present only on a tab set the author made an ADDRESS, which is what
    // makes deferring its unopened panels free of the three costs
    // A pages tabs spec priced — see that resolver.
    //
    // Read through the resolver's own constant rather than by repeating the
    // string: the writer spreads a computed key, so a literal here is a second
    // spelling that `tsc` cannot pair with the first. Renaming the field would
    // have left this read returning `undefined` — a tab set silently reverting
    // to shipping every panel, with nothing red to say so.
    const lazyParam = c[LAZY_PANEL_PARAM_KEY] as string | undefined
    const fillShell = computeTabsFillShellClasses(layout, tabsOrientation)
    const islandProps = {
      // The addressed panel's markup is DROPPED here: it is already in the
      // document below, and the island reads it back through the `ssrHtml`
      // capture rather than being handed a second, escaped copy of it
      // On an ADDRESSED tab set every panel's markup is
      // dropped — the unopened ones are fetched by address on activation
      // So a reader of one lens pays for one lens.
      items: stripAddressedPanelContent(items, addressed?.id, lazyParam !== undefined),
      defaultTab,
      lazyParam,
      tabsOrientation,
      layout,
      // Thread the author's `props['aria-label']` onto the `<Tabs.List>` so the
      // rendered `role="tablist"` carries an accessible name (e.g. the admin
      // dashboard's per-domain "Onglets du domaine" tab bar).
      ariaLabel: elementProps['aria-label'] as string | undefined,
      ...baseProps(elementProps, designStyles),
    }
    return (
      // The `data-island` host is deliberately LAYOUT-NEUTRAL, and that is the
      // whole fix behind a pages tabs spec. The island mounts `Tabs.Root`
      // as this element's single child carrying the same split classes from
      // `computeTabsRootClasses`, so when the host carried them too the real
      // tab set became a non-growing item of a clone of its own layout and
      // shrink-fit to its content — ~950px of a 1400px container handed back,
      // straight out of the column the config sample is read in.
      //
      // The layout lives on ONE element in each state instead: the wrapper
      // below before hydration, `Tabs.Root` after — the element the wrapper is
      // replaced by, at the same depth, with the same classes.
      //
      // `layout: 'fill'` is the ONE thing the host does carry, and it is not a
      // second copy of that split: the host is the bounded column and the root
      // inside it is the item that claims the column's height, so the two are
      // consecutive links of one chain rather than a layout and its clone. Its
      // absence is the whole of why a page dressing every OTHER reachable link
      // still left the grid at its natural height. `flow` — the default —
      // resolves to the empty string and the host keeps no `className` at all.
      // The host names the component: it is the one element that
      // outlives the mount — `Tabs.Root` replaces the wrapper inside it — so the
      // name sits here, once, before and after hydration.
      <div
        data-island="tabs"
        data-component-type={hostComponentType(elementProps)}
        data-island-props={JSON.stringify(islandProps)}
        // Opt in to the pre-mount `ssrHtml` capture in `island-client.tsx`. The
        // addressed panel's markup is no longer serialised into the props, so
        // this host's own server-rendered subtree is the ONLY copy of it — and
        // `createRoot` discards that subtree, so it has to be read before the
        // mount rather than after. Set only when there IS an addressed panel to
        // read; a tab set showing the skeleton has nothing to adopt.
        data-island-ssr={addressed !== undefined ? 'true' : undefined}
        data-testid={elementProps['data-testid'] as string | undefined}
        className={fillShell || undefined}
      >
        <div
          // Same `resolveClasses(defaults, author className)` as the island's
          // root, for the same reason: an author cap or a re-proportioned grid
          // track that applied only after hydration is a layout jump they never
          // asked for and cannot see in a screenshot. The
          // SSR half and the client half must call the SAME pure function or the
          // page paints one layout and snaps to another on mount.
          className={
            resolveClasses(
              computeSsrTabsRootClasses(tabsOrientation) ?? '',
              elementProps.className as string | undefined,
              undefined,
              fillShell || undefined
            ) || undefined
          }
        >
          {renderTabsSsrTriggerStrip(items, tabsOrientation, lazyParam)}
          <div
            // `py-4`, the pre-hydration twin of `TAB_PANEL_LAYOUT` in
            // `islands/disclosure/disclosure-default-classes.ts`. The panel
            // reserves no horizontal gutter, and this half
            // has to say so too: a `p-4` left here would paint the body 16px in
            // before hydration and flush after it, which is the repaint
            // A pages tabs spec exists to forbid.
            className={
              resolveClasses(
                tabsOrientation === 'vertical' ? 'min-w-0 py-4' : 'py-4',
                fillShell || undefined
              ) || undefined
            }
          >
            {addressed !== undefined ? (
              <div
                data-tab-panel-ssr="true"
                // Names WHICH panel this markup belongs to, so the island can
                // pair it back with its own `items` entry after `createRoot`
                // has discarded the subtree it was read from.
                data-tab-panel-id={addressed.id}
                // The panel's own content root, and the second half of the fill
                // chain: the pre-rendered body is injected INSIDE this box, so
                // it is the link that re-opens the chain across the wrapper a
                // panel's content brings with it — the hydrated twin of what
                // `computeTabsFillPanelClasses` does on `<Tabs.Panel>` one
                // element up, at the depth the island leaves this one at.
                className={computeTabsFillPanelClasses(layout) || undefined}
                // eslint-disable-next-line sovrium/require-sanitized-html -- server-rendered markup: renderToStaticMarkup output, which escapes every text and attribute value
                dangerouslySetInnerHTML={{ __html: addressed.html }}
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
        data-component-type={hostComponentType(elementProps)}
        data-island-props={JSON.stringify(checkboxProps)}
        data-testid={elementProps['data-testid'] as string | undefined}
      >
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            defaultChecked={checkboxProps.checked as boolean | undefined}
            disabled
          />
          <span className="text-md">{controlLabel(rawProps) ?? ''}</span>
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
        data-component-type={hostComponentType(elementProps)}
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
      label: controlLabel(rawProps),
      name: rawProps?.name,
      ...baseProps(elementProps),
    }
    return (
      <div
        data-island="switch"
        data-component-type={hostComponentType(elementProps)}
        data-island-props={JSON.stringify(props)}
        data-testid={elementProps['data-testid'] as string | undefined}
      >
        <label className="inline-flex items-center gap-2">
          <div className="bg-background-subtle h-5 w-9 animate-pulse rounded-full" />
          <span className="text-md">{controlLabel(rawProps) ?? ''}</span>
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
        data-component-type={hostComponentType(elementProps)}
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
      label: controlLabel(rawProps),
      ...baseProps(elementProps),
    }
    return (
      <div
        data-island="toggle"
        data-component-type={hostComponentType(elementProps)}
        data-island-props={JSON.stringify(props)}
        data-testid={elementProps['data-testid'] as string | undefined}
      >
        <button
          type="button"
          disabled
          className="bg-background-subtle text-foreground text-md rounded-md px-3 py-2"
        >
          {controlLabel(rawProps) ?? 'Toggle'}
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
        data-component-type={hostComponentType(elementProps)}
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

  menubar: ({ rawProps, elementProps, component }) => {
    // `menus` is a top-level schema field (a sibling of `props`), read like
    // every other form-control field through `pickFromComponent`.
    const props = {
      menus: pickFromComponent(asRecord(component), rawProps, 'menus'),
      ...baseProps(elementProps),
    }
    return (
      <div
        data-island="menubar"
        data-component-type={hostComponentType(elementProps)}
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
    // The navbar dropdown capability set (round-4): `openOnHover` + `triggerClassName` are top-level schema
    // fields (siblings of `navItems`). Serialize them into the island props so the
    // hydrated NavMenuIsland opens on hover and applies the
    // authored trigger override. `triggerClassName` is ALSO
    // applied to the SSR placeholder trigger below so the two class lists match.
    const openOnHover = navMenuComp?.openOnHover
    const triggerClassName = navMenuComp?.triggerClassName
    // Schema-level navItems can carry `$t:` tokens in label/description/href
    // Resolve them against the active language BEFORE
    // serialization so both the SSR fallback and the hydrated island show the
    // translated strings.
    const navItems = resolveTranslationTokensDeep(rawNavItems, currentLang, languages) as
      readonly SsrNavItem[] | undefined
    const props = { navItems, openOnHover, triggerClassName, ...baseProps(elementProps) }
    // Respect className from schema props; default to horizontal flex when not provided.
    const userClassName = elementProps['className'] as string | undefined
    const navClassName = resolveClasses('flex items-center gap-1', userClassName)
    // Landmark discipline: the mega-menu (`navItems`) form
    // renders a `div` wrapper — menus carry their own roles, and the standard
    // header composition embeds this component inside an authored `<nav>`,
    // which must stay the page's ONLY navigation landmark. The legacy
    // children-based form keeps its `<nav>` element (page-direct standalone
    // usage relies on the landmark, e.g. `nav a` selectors in the
    // responsive-override specs).
    const Wrapper = navItems !== undefined ? 'div' : 'nav'
    // Only the `navItems` form is an island. The island renders `navItems` and
    // nothing else, and it mounts INSIDE this host, replacing what the server
    // rendered — so marking the children-based form as an island erased the
    // author's children (and the empty placeholder) on hydration, leaving an
    // empty, zero-size nav. That form is complete as served.
    const isIsland = navItems !== undefined
    return (
      <Wrapper
        data-island={isIsland ? 'navigation-menu' : undefined}
        data-component-type={hostComponentType(elementProps)}
        data-island-props={isIsland ? JSON.stringify(props) : undefined}
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
        data-component-type={hostComponentType(elementProps)}
        data-island-props={JSON.stringify(props)}
        data-testid={elementProps['data-testid'] as string | undefined}
        style={{ maxHeight: scrollAreaHeight ?? '400px', overflow: 'auto' }}
        id={elementProps.id as string | undefined}
        className={elementProps.className as string | undefined}
        // eslint-disable-next-line sovrium/require-sanitized-html -- server-rendered markup: renderToStaticMarkup output, which escapes every text and attribute value
        dangerouslySetInnerHTML={{ __html: childrenHtml }}
      />
    )
  },
}
