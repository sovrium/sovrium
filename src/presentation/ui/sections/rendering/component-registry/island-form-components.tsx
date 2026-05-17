/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable max-lines -- Component-registry file: one renderer per island
   component naturally accumulates length as new component types are added.
   Splitting by component category (e.g. form vs tabs) was attempted but the
   shared `baseProps` / `buildSelectProps` helpers and the `Partial<Record>`
   contract made the split awkward. Acceptable to exceed the 300-line cap. */

import type { ComponentRenderer } from '../component-dispatch-config'
import type { Component } from '@/domain/models/app/pages/components'

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
 * Map an accordion component's `children` array to the `items` shape consumed
 * by AccordionIsland. Each child is expected to be a `container` with `props.id`
 * and `content.{title, body}`. Children with missing or empty `id` are skipped.
 */
function buildAccordionItems(rawChildren: unknown): ReadonlyArray<{
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
        title: itemContent?.title ?? '',
        content: itemContent?.body ?? '',
      }
    })
    .filter((item) => item.id !== '')
}

/**
 * Map a tabs component's `children` array to the `items` shape consumed by
 * TabsIsland. Each child is expected to be a `tab-panel` with `props.id` and
 * `content.{label, body}`. Children with missing or empty `id` are skipped
 * so the island only renders well-formed tabs.
 */
function buildTabsItems(rawChildren: unknown): ReadonlyArray<{
  readonly id: string
  readonly label: string
  readonly content: string
  readonly disabled?: boolean
}> {
  const children = (Array.isArray(rawChildren) ? rawChildren : []) as ReadonlyArray<{
    readonly type?: string
    readonly props?: { readonly id?: string; readonly disabled?: boolean }
    readonly content?: { readonly label?: string; readonly body?: string } | string
  }>
  return children
    .filter((child) => child?.type === 'tab-panel')
    .map((child) => {
      const tabContent = typeof child.content === 'object' ? child.content : undefined
      return {
        id: child.props?.id ?? '',
        label: tabContent?.label ?? '',
        content: tabContent?.body ?? '',
        disabled: child.props?.disabled,
      }
    })
    .filter((item) => item.id !== '')
}

/** Form, navigation, and interactive island components */
export const islandFormComponents: Partial<Record<Component['type'], ComponentRenderer>> = {
  select: ({ rawProps, elementProps, component }) => {
    const selectProps = buildSelectProps(rawProps, elementProps, component)
    return (
      <div
        id={elementProps.id as string | undefined}
        data-island="select"
        data-island-props={JSON.stringify(selectProps)}
        data-testid={elementProps['data-testid'] as string | undefined}
      >
        <select
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm"
          disabled
        >
          <option>{(rawProps?.placeholder as string) ?? 'Loading...'}</option>
        </select>
      </div>
    )
  },

  accordion: ({ component, elementProps }) => {
    // `accordionType`, `defaultOpen`, and `children` are top-level schema
    // properties (siblings of `props`), not inside `props`, so read from
    // `component` directly — same pattern as the tabs renderer.
    const c = asRecord(component)
    const props = {
      items: buildAccordionItems(c['children']),
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
        <div className="divide-y rounded-lg border border-gray-200">
          <div className="px-4 py-3">
            <div className="h-5 w-48 animate-pulse rounded bg-gray-200" />
          </div>
          <div className="px-4 py-3">
            <div className="h-5 w-40 animate-pulse rounded bg-gray-200" />
          </div>
        </div>
      </div>
    )
  },

  tabs: ({ component, elementProps }) => {
    // The tabs schema places `tabsOrientation` and `defaultTab` at the top
    // level (siblings of `props`/`children`), not inside `props`, so we read
    // them from `component` rather than `rawProps`. Items are derived from
    // `children` — each `tab-panel` contributes one tab. See APP-THEME-TABS-ENH-001.
    const c = asRecord(component)
    const islandProps = {
      items: buildTabsItems(c['children']),
      defaultTab: c['defaultTab'] as string | undefined,
      tabsOrientation:
        (c['tabsOrientation'] as 'horizontal' | 'vertical' | undefined) ?? 'horizontal',
      ...baseProps(elementProps),
    }
    return (
      <div
        data-island="tabs"
        data-island-props={JSON.stringify(islandProps)}
        data-testid={elementProps['data-testid'] as string | undefined}
      >
        <div className="border-b border-gray-200">
          <div className="flex gap-4 px-4">
            <div className="h-8 w-20 animate-pulse rounded bg-gray-200" />
            <div className="h-8 w-20 animate-pulse rounded bg-gray-200" />
            <div className="h-8 w-20 animate-pulse rounded bg-gray-200" />
          </div>
        </div>
        <div className="p-4">
          <div className="h-24 animate-pulse rounded bg-gray-100" />
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
          <div className="h-5 w-32 animate-pulse rounded bg-gray-200" />
          <div className="h-5 w-28 animate-pulse rounded bg-gray-200" />
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
          <div className="h-5 w-9 animate-pulse rounded-full bg-gray-200" />
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
        <div className="h-1.5 w-full rounded-full bg-gray-200">
          <div className="h-full w-1/2 rounded-full bg-blue-600" />
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
          className="rounded-md bg-gray-100 px-3 py-2 text-sm"
        >
          {(rawProps?.content as string) ?? 'Toggle'}
        </button>
      </div>
    )
  },

  'toggle-group': ({ rawProps, elementProps, component }) => {
    // `options`, `toggleType`, `orientation`, `size` are top-level schema
    // fields per toggle-group.ts. The island reads `items` for back-compat
    // when a caller flattens options into rawProps.
    const c = asRecord(component)
    const props = {
      items: pickFromComponent(c, rawProps, 'options') ?? rawProps?.items,
      toggleType: pickFromComponent(c, rawProps, 'toggleType'),
      orientation: pickFromComponent(c, rawProps, 'orientation'),
      size: pickFromComponent(c, rawProps, 'size'),
      ...baseProps(elementProps),
    }
    return (
      <div
        data-island="toggle-group"
        data-island-props={JSON.stringify(props)}
        data-testid={elementProps['data-testid'] as string | undefined}
      >
        <div className="inline-flex rounded-md border border-gray-200">
          <div className="h-9 w-16 animate-pulse bg-gray-100" />
          <div className="h-9 w-16 animate-pulse bg-gray-100" />
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
          className="flex rounded-md border border-gray-200"
        >
          <div className="h-8 w-16 animate-pulse rounded bg-gray-100" />
          <div className="h-8 w-16 animate-pulse rounded bg-gray-100" />
        </div>
      </div>
    )
  },

  'navigation-menu': ({ rawProps, elementProps, renderedChildren, component }) => {
    const navItems =
      (component?.type === 'navigation-menu' && Array.isArray(component.navItems)
        ? (component.navItems as readonly { label: string; href?: string }[])
        : undefined) ??
      (rawProps?.navItems as readonly { label: string; href?: string }[] | undefined)
    const props = { navItems, ...baseProps(elementProps) }
    return (
      <nav
        data-island="navigation-menu"
        data-island-props={JSON.stringify(props)}
        data-testid={elementProps['data-testid'] as string | undefined}
        className="flex items-center gap-1"
      >
        {renderedChildren.length > 0 ? (
          renderedChildren
        ) : navItems && navItems.length > 0 ? (
          navItems.map((item, index) => {
            const navItem = item as {
              readonly label: string
              readonly href?: string
              readonly target?: '_self' | '_blank' | '_parent' | '_top'
              readonly rel?: string
            }
            return (
              <a
                key={index}
                href={navItem.href}
                target={navItem.target}
                rel={navItem.rel}
              >
                {navItem.label}
              </a>
            )
          })
        ) : (
          <div className="h-8 w-60 animate-pulse rounded bg-gray-100" />
        )}
      </nav>
    )
  },

  'scroll-area': ({ rawProps, elementProps }) => {
    const props = {
      scrollAreaHeight: rawProps?.scrollAreaHeight,
      scrollOrientation: rawProps?.scrollOrientation,
      ...baseProps(elementProps),
    }
    return (
      <div
        data-island="scroll-area"
        data-island-props={JSON.stringify(props)}
        data-testid={elementProps['data-testid'] as string | undefined}
        // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- SSR placeholder; one-shot during server render before island hydration
        style={{ maxHeight: (rawProps?.scrollAreaHeight as string) ?? '400px', overflow: 'hidden' }}
      >
        <div className="h-full animate-pulse bg-gray-50" />
      </div>
    )
  },
}
